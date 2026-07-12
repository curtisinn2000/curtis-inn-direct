param(
  [string]$ProjectId = "curts-inn-website",
  [string]$InstanceName = "curtis-inn-dev-db",
  [string]$Region = "us-central1",
  [string]$DatabaseVersion = "POSTGRES_15",
  [string]$DatabaseName = "curtis_inn"
)

$ErrorActionPreference = "Stop"

$passwordBytes = New-Object byte[] 24
[Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
$rootPassword = [Convert]::ToBase64String($passwordBytes).TrimEnd("=") -replace "[+/]", "x"

gcloud config set project $ProjectId

gcloud sql instances create $InstanceName `
  --project=$ProjectId `
  --database-version=$DatabaseVersion `
  --region=$Region `
  --tier=db-f1-micro `
  --edition=ENTERPRISE `
  --storage-type=HDD `
  --storage-size=10 `
  --availability-type=ZONAL `
  --no-backup `
  --root-password=$rootPassword

gcloud sql databases create $DatabaseName `
  --project=$ProjectId `
  --instance=$InstanceName

Write-Host "Created low-cost dev Cloud SQL instance: $InstanceName"
Write-Host "Store this password securely; it will not be recoverable from this script output later:"
Write-Host $rootPassword
