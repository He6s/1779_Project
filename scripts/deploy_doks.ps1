param(
  [Parameter(Mandatory = $true)]
  [string]$ClusterName,

  [Parameter(Mandatory = $true)]
  [string]$Registry,

  [string]$Tag = (Get-Date -Format "yyyyMMdd-HHmmss"),
  [string]$Namespace = "settleup",
  [switch]$SkipBuildAndPush
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "c:/Users/Yiwei Cao/Desktop/ECE1779/1779_Project"

function Require-Command([string]$CommandName) {
  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $CommandName"
  }
}

function Resolve-DoctlCommand() {
  $cmd = Get-Command doctl -ErrorAction SilentlyContinue
  if ($cmd) {
    return "doctl"
  }

  $wingetPath = Join-Path $env:LOCALAPPDATA "Microsoft/WinGet/Packages"
  if (Test-Path $wingetPath) {
    $found = Get-ChildItem -Path $wingetPath -Filter doctl.exe -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) {
      return $found.FullName
    }
  }

  throw "Required command not found: doctl"
}

function Assert-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
}

function Wait-For-LB-IP([string]$ServiceName, [string]$Namespace, [int]$MaxAttempts = 40) {
  for ($i = 0; $i -lt $MaxAttempts; $i++) {
    $ip = kubectl get svc $ServiceName -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
    $hostname = kubectl get svc $ServiceName -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>$null

    if (-not [string]::IsNullOrWhiteSpace($ip)) {
      return $ip
    }
    if (-not [string]::IsNullOrWhiteSpace($hostname)) {
      return $hostname
    }

    Start-Sleep -Seconds 15
  }

  return ""
}

Write-Output "== Preconditions =="
Require-Command docker
Require-Command kubectl
$doctlCommand = Resolve-DoctlCommand

Assert-Env "POSTGRES_DB"
Assert-Env "POSTGRES_USER"
Assert-Env "POSTGRES_PASSWORD"
Assert-Env "JWT_SECRET"

if ([string]::IsNullOrWhiteSpace($env:EMAIL_FROM)) {
  $env:EMAIL_FROM = "no-reply@settleup.local"
}
if ([string]::IsNullOrWhiteSpace($env:SMTP_USER)) {
  $env:SMTP_USER = ""
}
if ([string]::IsNullOrWhiteSpace($env:SMTP_PASS)) {
  $env:SMTP_PASS = ""
}
if ([string]::IsNullOrWhiteSpace($env:SMTP_HOST)) {
  $env:SMTP_HOST = ""
}
if ([string]::IsNullOrWhiteSpace($env:SMTP_PORT)) {
  $env:SMTP_PORT = "2525"
}
if ([string]::IsNullOrWhiteSpace($env:EMAIL_ENABLED)) {
  $env:EMAIL_ENABLED = "false"
}

$apiImage = "$Registry/settleup-api:$Tag"
$webImage = "$Registry/settleup-web:$Tag"
$registryName = ($Registry -split "/")[-1]
$registrySecretName = "registry-$registryName"

Write-Output "== Build and Push Images =="
if (-not $SkipBuildAndPush) {
  docker build -t $apiImage ./api
  docker build -t $webImage ./web

  docker push $apiImage
  docker push $webImage
} else {
  Write-Output "SkipBuildAndPush enabled, reusing existing image tags."
}

Write-Output "== Configure Kubernetes Context =="
& $doctlCommand kubernetes cluster kubeconfig save $ClusterName

Write-Output "== Configure Registry Pull Secret =="
& $doctlCommand registry kubernetes-manifest --namespace $Namespace | kubectl apply -f -
$serviceAccountYaml = @"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: default
  namespace: $Namespace
imagePullSecrets:
  - name: $registrySecretName
"@
$serviceAccountYaml | kubectl apply -f -

Write-Output "== Apply Kubernetes Manifests (DOKS overlay) =="
kubectl apply -k deploy/doks

Write-Output "== Apply Secrets from Environment =="
$secretArgs = @(
  "create", "secret", "generic", "settleup-secrets",
  "-n", $Namespace,
  "--from-literal=POSTGRES_DB=$($env:POSTGRES_DB)",
  "--from-literal=POSTGRES_USER=$($env:POSTGRES_USER)",
  "--from-literal=POSTGRES_PASSWORD=$($env:POSTGRES_PASSWORD)",
  "--from-literal=JWT_SECRET=$($env:JWT_SECRET)",
  "--from-literal=EMAIL_FROM=$($env:EMAIL_FROM)",
  "--from-literal=SMTP_USER=$($env:SMTP_USER)",
  "--from-literal=SMTP_PASS=$($env:SMTP_PASS)",
  "--dry-run=client",
  "-o", "yaml"
)

$secretYaml = & kubectl @secretArgs
$secretYaml | kubectl apply -f -

Write-Output "== Patch Public Config Values =="
$configMapObj = kubectl get configmap settleup-app-config -n $Namespace -o json | ConvertFrom-Json
$configMapObj.data.EMAIL_ENABLED = "$($env:EMAIL_ENABLED)"
$configMapObj.data.SMTP_HOST = "$($env:SMTP_HOST)"
$configMapObj.data.SMTP_PORT = "$($env:SMTP_PORT)"
($configMapObj | ConvertTo-Json -Depth 25) | kubectl apply -f -

Write-Output "== Update Images =="
kubectl set image deployment/api api=$apiImage -n $Namespace
kubectl set image deployment/worker worker=$apiImage -n $Namespace
kubectl set image deployment/web web=$webImage -n $Namespace

Write-Output "== Rollout Status =="
kubectl rollout status deployment/db -n $Namespace --timeout=300s
kubectl rollout status deployment/redis -n $Namespace --timeout=300s
kubectl rollout status deployment/api -n $Namespace --timeout=300s
kubectl rollout status deployment/web -n $Namespace --timeout=300s
kubectl rollout status deployment/worker -n $Namespace --timeout=300s

Write-Output "== Wait for External Endpoints =="
$webHost = Wait-For-LB-IP -ServiceName "web" -Namespace $Namespace
$apiHost = Wait-For-LB-IP -ServiceName "api" -Namespace $Namespace

if (-not [string]::IsNullOrWhiteSpace($webHost)) {
  $webUrl = "http://$webHost:3000"
  $configMapObj = kubectl get configmap settleup-app-config -n $Namespace -o json | ConvertFrom-Json
  $apiUrl = if (-not [string]::IsNullOrWhiteSpace($apiHost)) { "http://$apiHost:3001" } else { $configMapObj.data.API_BASE_URL }
  $configMapObj.data.APP_BASE_URL = $webUrl
  $configMapObj.data.CORS_ORIGIN = $webUrl
  if (-not [string]::IsNullOrWhiteSpace($apiUrl)) {
    $configMapObj.data.API_BASE_URL = $apiUrl
  }
  ($configMapObj | ConvertTo-Json -Depth 25) | kubectl apply -f -
  kubectl rollout restart deployment/api deployment/worker deployment/web -n $Namespace
  kubectl rollout status deployment/api -n $Namespace --timeout=300s
  kubectl rollout status deployment/worker -n $Namespace --timeout=300s
  kubectl rollout status deployment/web -n $Namespace --timeout=300s
}

Write-Output "== Service Status =="
kubectl get svc -n $Namespace

if (-not [string]::IsNullOrWhiteSpace($webHost)) {
  Write-Output "WEB_URL=http://$webHost:3000"
} else {
  Write-Output "WEB_URL=<pending external IP>"
}

if (-not [string]::IsNullOrWhiteSpace($apiHost)) {
  Write-Output "API_URL=http://$apiHost:3001"
} else {
  Write-Output "API_URL=<pending external IP>"
}

Write-Output "Deployment script finished. Next: run scripts/validate_phase7_doks.ps1 with API and WEB URLs."
