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

docker compose up -d --build api worker | Out-Null

$apiReady = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 3
    $apiReady = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $apiReady) {
  Assert-Check $false "health endpoint reachable"
  Assert-Check $false "metrics endpoint reachable"
  Assert-Check $false "api emits structured request logs with request_id"

  $workerLogs = docker compose logs worker --tail 20
  Assert-Check (($workerLogs -join "`n") -match "worker_started") "worker emits structured startup logs"

  Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
  exit 1
}

try {
  $null = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing
  Assert-Check $true "health endpoint reachable"
} catch {
  Assert-Check $false "health endpoint reachable"
}

try {
  $metrics = Invoke-WebRequest -Uri "http://localhost:3001/metrics" -UseBasicParsing
  $body = $metrics.Content
  Assert-Check ($body -match "settleup_http_requests_total") "custom request counter metric exists"
  Assert-Check ($body -match "settleup_http_request_duration_seconds") "custom request duration metric exists"
  Assert-Check ($body -match "settleup_http_active_requests") "custom active request metric exists"
} catch {
  Assert-Check $false "metrics endpoint reachable"
}

$apiLogs = docker compose logs api --tail 40
$workerLogs = docker compose logs worker --tail 20

Assert-Check (($apiLogs -join "`n") -match "request_completed" -and ($apiLogs -join "`n") -match "request_id") "api emits structured request logs with request_id"
Assert-Check (($workerLogs -join "`n") -match "worker_started") "worker emits structured startup logs"

if ($errors.Count -eq 0) {
  Write-Output "VALIDATION_RESULT: PASS"
  exit 0
}

Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
exit 1
