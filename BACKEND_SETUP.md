# Curtis Inn Backend Setup

This repo now contains a production backend service in `backend/` for the Curtis Inn direct booking app.

## Architecture

- Frontend: Vite/React deployed to Vercel.
- Backend: Node.js/TypeScript/Express deployed to Google Cloud Run.
- Database: PostgreSQL on Google Cloud SQL.
- Payments: Stripe Hosted Checkout. The backend never stores raw card data.
- Admin auth: backend-issued JWT plus `app_users` and `user_roles`.

## GCP Cost Note

Project: `curts-inn-website`

The existing Cloud SQL instance `curtis-inn-instance` is Enterprise Plus, tier `db-perf-optimized-N-8`, 100 GB SSD. Google rejected an in-place downgrade to `db-perf-optimized-N-2` because it is a Cloud SQL Free Trial instance and machine type changes are blocked.

I applied the reversible cost-saving setting:

```powershell
gcloud sql instances patch curtis-inn-instance --project=curts-inn-website --activation-policy=NEVER --quiet
```

For low-cost development, create a separate Enterprise edition shared-core instance:

```powershell
.\scripts\gcp-create-dev-sql.ps1
```

That script creates `curtis-inn-dev-db` using `db-f1-micro`, HDD, 10 GB storage, zonal, no backups.

## Local Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# edit .env
npm run migrate
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="use-a-strong-password"
npm run seed:admin
npm run dev
```

Required backend env vars:

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `PUBLIC_SITE_URL`
- `TAX_RATE`
- `STRIPE_ENV`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GMAIL_SMTP_HOST`
- `GMAIL_SMTP_PORT`
- `GMAIL_SMTP_USER`
- `GMAIL_SMTP_PASS`
- `MAIL_FROM`

Frontend Vercel env:

- `VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL/api`

Backend `PUBLIC_SITE_URL` must point to the active public frontend domain because Stripe uses it for Checkout success and cancel redirects. While the custom domain is not live, use:

```text
https://curtis-inn-direct.vercel.app
```

Production `ALLOWED_ORIGINS` must include every public frontend origin that will call the backend from a browser, for example:

```text
https://curtisinnsuites.com,https://curtis-inn-direct.vercel.app,https://curtis-inn-direct-curtis-inn.vercel.app,https://curtis-inn-direct-git-main-curtis-inn.vercel.app
```

Local frontend env:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8080/api"
npm run dev
```

## Deployment

Enable/build/deploy Cloud Run:

```powershell
.\scripts\gcp-deploy-backend.ps1
```

Required Stripe test-mode secrets in GCP Secret Manager:

```powershell
gcloud secrets create curtis-inn-stripe-secret-key --project=curts-inn-website --replication-policy=automatic
gcloud secrets create curtis-inn-stripe-webhook-secret --project=curts-inn-website --replication-policy=automatic

# Add values without printing them to logs:
$stripeSecret = Read-Host "Stripe test secret key"
$stripeSecret | gcloud secrets versions add curtis-inn-stripe-secret-key --project=curts-inn-website --data-file=-

$webhookSecret = Read-Host "Stripe webhook signing secret"
$webhookSecret | gcloud secrets versions add curtis-inn-stripe-webhook-secret --project=curts-inn-website --data-file=-
```

After Cloud Run is deployed, set production env vars/secrets on the Cloud Run service. Do not put Stripe secret keys, Gmail, JWT, or database secrets in Vercel.

## Migration Notes

Run migrations against the target Cloud SQL database:

```powershell
cd backend
$env:DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/curtis_inn"
npm run migrate
```

Seed the first admin:

```powershell
$env:ADMIN_EMAIL="admin@curtisinnsuites.com"
$env:ADMIN_PASSWORD="strong unique password"
$env:ADMIN_NAME="Front Desk"
npm run seed:admin
```

## Known Product Decisions Still Needed

- Stripe Hosted Checkout is the active card processor. Configure the Stripe webhook endpoint at `/api/stripe/webhook` and use test mode before live keys.
- Public reservation lookup currently returns `totalAmount` to match the existing UI; remove that if you want stricter redaction.
- Admin calendar/room/rate screens still use the existing Zustand UI model. Backend endpoints exist for these workflows, but the full React Query replacement should be the next hardening pass.
