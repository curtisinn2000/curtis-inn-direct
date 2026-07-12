param(
  [string]$ProjectId = "curts-inn-website",
  [string]$Region = "us-central1",
  [string]$ServiceName = "curtis-inn-backend",
  [string]$Repository = "curtis-inn",
  [string]$ImageTag = "dev"
)

$ErrorActionPreference = "Stop"

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com --project=$ProjectId

$repoExists = gcloud artifacts repositories describe $Repository --location=$Region --project=$ProjectId --format="value(name)" 2>$null
if (-not $repoExists) {
  gcloud artifacts repositories create $Repository --repository-format=docker --location=$Region --project=$ProjectId
}

$image = "$Region-docker.pkg.dev/$ProjectId/$Repository/backend:$ImageTag"
gcloud builds submit backend --tag $image --project=$ProjectId

$envFile = Join-Path $env:TEMP "curtis-run-env.yaml"
@"
NODE_ENV: production
ALLOWED_ORIGINS: "http://localhost:8080,http://localhost:5173,https://curtisinnsuites.com,https://curtis-inn-direct.vercel.app,https://curtis-inn-direct-curtis-inn.vercel.app,https://curtis-inn-direct-git-main-curtis-inn.vercel.app"
PUBLIC_SITE_URL: "https://curtis-inn-direct.vercel.app"
TAX_RATE: "0.13"
DEPOSIT_RULE: one_night
STRIPE_ENV: test
GMAIL_SMTP_HOST: smtp.gmail.com
GMAIL_SMTP_PORT: "587"
MAIL_FROM: curtisinn200@gmail.com
"@ | Set-Content -LiteralPath $envFile -Encoding ascii

$secretFlags = "DATABASE_URL=curtis-inn-database-url:latest,JWT_SECRET=curtis-inn-jwt-secret:latest,STRIPE_SECRET_KEY=curtis-inn-stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=curtis-inn-stripe-webhook-secret:latest,GMAIL_SMTP_USER=curtis-inn-gmail-user:latest,GMAIL_SMTP_PASS=curtis-inn-gmail-pass:latest"

gcloud run deploy $ServiceName `
  --project=$ProjectId `
  --region=$Region `
  --image=$image `
  --platform=managed `
  --allow-unauthenticated `
  --add-cloudsql-instances="$ProjectId`:$Region`:curtis-inn-dev-db" `
  --min-instances=0 `
  --max-instances=2 `
  --memory=512Mi `
  --cpu=1 `
  --env-vars-file=$envFile `
  --set-secrets=$secretFlags
