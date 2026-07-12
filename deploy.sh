#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="curts-inn-website"
REGION="us-central1"
SERVICE_NAME="curtis-inn-backend"
ARTIFACT_REPOSITORY="curtis-inn"
BACKEND_IMAGE_NAME="backend"
EXPECTED_BRANCH="main"
REMOTE_NAME="origin"
DRY_RUN="${DRY_RUN:-0}"

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

is_backend_path() {
  case "$1" in
    backend/*|backend|scripts/gcp-*.ps1|backend/cloudbuild.yaml)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_frontend_path() {
  case "$1" in
    src/*|src|public/*|public|index.html|vercel.json|vite.config.*|vitest.config.*|tailwind.config.*|postcss.config.*|components.json|package.json|package-lock.json|tsconfig*.json|eslint.config.*|playwright.config.*|playwright-fixture.ts)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

status_paths() {
  git status --porcelain=v1 --untracked-files=all |
    sed -E 's/^...//; s/.* -> //' |
    grep -v '^$' || true
}

require_cmd git
require_cmd npm

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "This directory is not inside a git repository."
repo_root_real="$(cd "$repo_root" && pwd -P)"
cwd_real="$(pwd -P)"
[[ "$cwd_real" == "$repo_root_real" ]] || die "Run this script from the repository root: $repo_root"

branch="$(git branch --show-current)"
[[ "$branch" == "$EXPECTED_BRANCH" ]] || die "Refusing to deploy from branch '$branch'. Switch to '$EXPECTED_BRANCH' first."

[[ -z "$(git diff --name-only --diff-filter=U)" ]] || die "Merge conflicts are present. Resolve them before deploying."

mapfile -t changed_files < <(status_paths)
if [[ "${#changed_files[@]}" -eq 0 ]]; then
  log "Nothing to deploy. Working tree is clean."
  exit 0
fi

backend_changed=0
frontend_changed=0
for path in "${changed_files[@]}"; do
  if is_backend_path "$path"; then backend_changed=1; fi
  if is_frontend_path "$path"; then frontend_changed=1; fi
done

log "Changed files"
printf '  %s\n' "${changed_files[@]}"

log "Detected change types"
printf '  frontend: %s\n' "$([[ "$frontend_changed" == "1" ]] && echo yes || echo no)"
printf '  backend:  %s\n' "$([[ "$backend_changed" == "1" ]] && echo yes || echo no)"
printf '  dry run:  %s\n' "$([[ "$DRY_RUN" == "1" ]] && echo yes || echo no)"

if [[ "$frontend_changed" == "1" ]]; then
  log "Running frontend checks"
  npm run build
  npm run lint
fi

if [[ "$backend_changed" == "1" ]]; then
  log "Running backend checks"
  npm --prefix backend run build
fi

if [[ "$backend_changed" == "1" ]]; then
  require_cmd gcloud
  log "Checking GCP access"
  gcloud_account="$(gcloud config get-value account 2>/dev/null || true)"
  [[ -n "$gcloud_account" && "$gcloud_account" != "(unset)" ]] || die "gcloud is not logged in. Run: gcloud auth login"
  printf '  gcloud account: %s\n' "$gcloud_account"
  gcloud config set project "$PROJECT_ID"
fi

log "Committing changes"
if [[ "$DRY_RUN" == "1" ]]; then
  printf '+ git add -A\n'
else
  git add -A
fi

if [[ "$DRY_RUN" != "1" ]] && git diff --cached --quiet; then
  log "No staged changes after git add. Nothing to commit."
else
  if [[ "$frontend_changed" == "1" && "$backend_changed" == "1" ]]; then
    commit_message="Deploy frontend and backend updates"
  elif [[ "$backend_changed" == "1" ]]; then
    commit_message="Deploy backend updates"
  elif [[ "$frontend_changed" == "1" ]]; then
    commit_message="Deploy frontend updates"
  else
    commit_message="Deploy repository updates"
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '+ git commit -m %q\n' "$commit_message"
  else
    git commit -m "$commit_message"
  fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
  sha="$(git rev-parse --short HEAD)"
  printf '+ git push %q %q\n' "$REMOTE_NAME" "$EXPECTED_BRANCH"
else
  git push "$REMOTE_NAME" "$EXPECTED_BRANCH"
  sha="$(git rev-parse --short HEAD)"
fi

if [[ "$backend_changed" == "1" ]]; then
  timestamp="$(date -u +%Y%m%d%H%M%S)"
  image="$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPOSITORY/$BACKEND_IMAGE_NAME:deploy-$sha-$timestamp"

  log "Deploying backend to Cloud Run"
  printf '  image: %s\n' "$image"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '+ gcloud builds submit backend --tag %q --project %q\n' "$image" "$PROJECT_ID"
    printf '+ gcloud run services update %q --region %q --project %q --image %q\n' "$SERVICE_NAME" "$REGION" "$PROJECT_ID" "$image"
  else
    gcloud builds submit backend --tag "$image" --project "$PROJECT_ID"
    gcloud run services update "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --image "$image"
    log "Cloud Run status"
    gcloud run services describe "$SERVICE_NAME" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --format='value(spec.template.metadata.name,status.url,spec.template.spec.containers[0].image)'
  fi
else
  log "No backend changes detected. Cloud Run deploy skipped."
fi

if [[ "$frontend_changed" == "1" ]]; then
  log "Frontend deployment"
  printf '  Pushed to GitHub. Vercel will deploy automatically from %s/%s.\n' "$REMOTE_NAME" "$EXPECTED_BRANCH"
fi

log "Deploy script completed"
printf '  git sha: %s\n' "$sha"
