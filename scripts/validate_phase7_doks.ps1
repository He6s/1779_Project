param(
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,

  [string]$WebUrl = "",
  [string]$Namespace = "settleup"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location "c:/Users/Yiwei Cao/Desktop/ECE1779/1779_Project"

$errors = @()

function Assert-Check($cond, $msg) {
  if ($cond) {
    Write-Output ("PASS: " + $msg)
  } else {
    Write-Output ("FAIL: " + $msg)
    $script:errors += $msg
  }
}

Write-Output "== DOKS Runtime Checks =="

try {
  $h = Invoke-RestMethod -Uri "$ApiBaseUrl/health" -Method Get -TimeoutSec 10
  Assert-Check ($h.ok -eq $true) "/health ok"
} catch {
  Assert-Check $false "/health reachable"
}

try {
  $r = Invoke-RestMethod -Uri "$ApiBaseUrl/ready" -Method Get -TimeoutSec 10
  Assert-Check ($r.ok -eq $true -and $r.db -eq "connected" -and $r.redis -eq "connected") "/ready db+redis connected"
} catch {
  Assert-Check $false "/ready reachable"
}

try {
  $m = Invoke-WebRequest -Uri "$ApiBaseUrl/metrics" -Method Get -UseBasicParsing -TimeoutSec 10
  $content = $m.Content
  Assert-Check ($content -match "settleup_http_requests_total") "metrics exposes request counter"
} catch {
  Assert-Check $false "metrics endpoint reachable"
}

if (-not [string]::IsNullOrWhiteSpace($WebUrl)) {
  $effectiveWebUrl = $WebUrl
  try {
    $w = Invoke-WebRequest -Uri $effectiveWebUrl -Method Get -UseBasicParsing -TimeoutSec 10
    Assert-Check ($w.StatusCode -eq 200) "web root reachable"
  } catch {
    # DOKS service is exposed on port 3000 in this project; retry with explicit port if omitted.
    if ($effectiveWebUrl -notmatch ":\d+$") {
      $effectiveWebUrl = "$effectiveWebUrl`:3000"
      try {
        $w = Invoke-WebRequest -Uri $effectiveWebUrl -Method Get -UseBasicParsing -TimeoutSec 10
        Assert-Check ($w.StatusCode -eq 200) "web root reachable"
      } catch {
        Assert-Check $false "web reachability and CORS preflight"
        $effectiveWebUrl = ""
      }
    } else {
      Assert-Check $false "web reachability and CORS preflight"
      $effectiveWebUrl = ""
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($effectiveWebUrl)) {
    try {
      $originHeader = @{ Origin = $effectiveWebUrl; "Access-Control-Request-Method" = "GET" }
      $preflight = Invoke-WebRequest -Uri "$ApiBaseUrl/health" -Method Options -Headers $originHeader -UseBasicParsing -TimeoutSec 10
      $allowOrigin = $preflight.Headers["Access-Control-Allow-Origin"]
      Assert-Check (-not [string]::IsNullOrWhiteSpace($allowOrigin)) "api returns CORS headers for web origin"
    } catch {
      Assert-Check $false "api returns CORS headers for web origin"
    }
  }
}

Write-Output "== API Workflow E2E =="
try {
  powershell -ExecutionPolicy Bypass -File ./scripts/validate_phase1_2.ps1 -BaseUrl $ApiBaseUrl
  Assert-Check ($LASTEXITCODE -eq 0) "phase1_2 end-to-end flow passes against DOKS API"
} catch {
  Assert-Check $false "phase1_2 end-to-end flow invocation"
}

Write-Output "== Kubernetes Health Snapshot =="
try {
  kubectl get pods -n $Namespace
  Assert-Check ($LASTEXITCODE -eq 0) "kubectl can read namespace pods"
} catch {
  Assert-Check $false "kubectl namespace snapshot"
}

if ($errors.Count -eq 0) {
  Write-Output "VALIDATION_RESULT: PASS"
  exit 0
}

Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
exit 1
