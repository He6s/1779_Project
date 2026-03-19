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

kubectl version --client | Out-Null
if ($LASTEXITCODE -ne 0) {
  Assert-Check $false "kubectl client available"
  Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
  exit 1
}
Assert-Check $true "kubectl client available"

$rendered = kubectl kustomize k8s
Assert-Check ($LASTEXITCODE -eq 0 -and $rendered.Length -gt 0) "kustomize renders manifests"

$kinds = ($rendered | Select-String -Pattern '^kind:' | ForEach-Object { $_.Line.Trim() })

Assert-Check (($kinds -join "`n") -match "kind: Deployment") "rendered output includes Deployment objects"
Assert-Check (($kinds -join "`n") -match "kind: Service") "rendered output includes Service objects"
Assert-Check (($kinds -join "`n") -match "kind: Ingress") "rendered output includes Ingress object"
Assert-Check (($kinds -join "`n") -match "kind: HorizontalPodAutoscaler") "rendered output includes HPA object"
Assert-Check (($kinds -join "`n") -match "kind: PersistentVolumeClaim") "rendered output includes PVC object"

if ($errors.Count -eq 0) {
  Write-Output "VALIDATION_RESULT: PASS"
  exit 0
}

Write-Output ("VALIDATION_RESULT: FAIL -> " + ($errors -join "; "))
exit 1
