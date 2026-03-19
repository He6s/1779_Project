param(
  [Parameter(Mandatory = $true)]
  [string]$SmtpHost,

  [int]$SmtpPort = 2525,

  [Parameter(Mandatory = $true)]
  [string]$SmtpUser,

  [Parameter(Mandatory = $true)]
  [string]$SmtpPass,

  [string]$EmailFrom = "",
  [string]$Namespace = "settleup"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "c:/Users/Yiwei Cao/Desktop/ECE1779/1779_Project"

if ([string]::IsNullOrWhiteSpace($EmailFrom)) {
  $EmailFrom = $SmtpUser
}

function Decode-SecretValue($secretData, $key) {
  if (-not ($secretData.PSObject.Properties.Name -contains $key)) {
    return ""
  }
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secretData.$key))
}

$existingSecret = kubectl get secret settleup-secrets -n $Namespace -o json | ConvertFrom-Json
$existingSecretData = $existingSecret.data
$postgresDb = Decode-SecretValue $existingSecretData "POSTGRES_DB"
$postgresUser = Decode-SecretValue $existingSecretData "POSTGRES_USER"
$postgresPassword = Decode-SecretValue $existingSecretData "POSTGRES_PASSWORD"
$jwtSecret = Decode-SecretValue $existingSecretData "JWT_SECRET"

Write-Output "== Update email configmap values =="
$cm = kubectl get configmap settleup-app-config -n $Namespace -o json | ConvertFrom-Json
$cm.data.EMAIL_ENABLED = "true"
$cm.data.SMTP_HOST = $SmtpHost
$cm.data.SMTP_PORT = "$SmtpPort"
($cm | ConvertTo-Json -Depth 25) | kubectl apply -f -

Write-Output "== Update secret values =="
$secretArgs = @(
  "create", "secret", "generic", "settleup-secrets",
  "-n", $Namespace,
  "--from-literal=POSTGRES_DB=$postgresDb",
  "--from-literal=POSTGRES_USER=$postgresUser",
  "--from-literal=POSTGRES_PASSWORD=$postgresPassword",
  "--from-literal=JWT_SECRET=$jwtSecret",
  "--from-literal=EMAIL_FROM=$EmailFrom",
  "--from-literal=SMTP_USER=$SmtpUser",
  "--from-literal=SMTP_PASS=$SmtpPass",
  "--dry-run=client",
  "-o", "yaml"
)

$secretYaml = & kubectl @secretArgs
$secretYaml | kubectl apply -f -

Write-Output "== Restart API/Worker =="
kubectl rollout restart deployment/api deployment/worker -n $Namespace
kubectl rollout status deployment/api -n $Namespace --timeout=300s
kubectl rollout status deployment/worker -n $Namespace --timeout=300s

Write-Output "== Effective email settings =="
kubectl get configmap settleup-app-config -n $Namespace -o json | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object EMAIL_ENABLED,SMTP_HOST,SMTP_PORT
Write-Output "EMAIL_FROM=$EmailFrom"
Write-Output "SMTP_USER=$SmtpUser"

Write-Output "Done. Create a new expense in UI and then run:"
Write-Output "kubectl logs deployment/worker -n $Namespace --tail=80"
Write-Output "Expected: email_job_processed with delivered=true (not simulated=true)."