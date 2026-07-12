param(
  [string]$ProjectId = "curts-inn-website",
  [string]$InstanceName = "curtis-inn-instance"
)

$ErrorActionPreference = "Stop"
gcloud sql instances patch $InstanceName --project=$ProjectId --activation-policy=NEVER --quiet
gcloud sql instances describe $InstanceName --project=$ProjectId --format="yaml(name,state,settings.activationPolicy,settings.tier,settings.edition,settings.dataDiskSizeGb)"
