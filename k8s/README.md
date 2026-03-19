# Kubernetes Deployment (Step 6)

This directory contains a deployable baseline for the SettleUp stack on Kubernetes:
- `api`
- `web`
- `worker`
- `db` (PostgreSQL + PVC)
- `redis`
- Ingress + HPA + ConfigMap + Secret template

## Prerequisites
- Kubernetes cluster with an Ingress controller (e.g., nginx)
- Metrics Server installed (for HPA)
- Images pushed to a registry accessible by the cluster

## Important: image names
The manifests currently use local image names:
- `settleup-api:latest`
- `settleup-web:latest`

For cloud deployment, update image references in:
- `api.yaml`
- `web.yaml`
- `worker.yaml`

to your registry tags (for example: `ghcr.io/<org>/settleup-api:<tag>`).

## Secrets
Copy `secret.example.yaml` to a real secret file and fill in production values before applying.

## Apply
```bash
kubectl apply -k k8s
```

## DOKS deployment workflow (Step 7)

This repo now includes a DOKS-focused overlay and deployment scripts:

- Overlay: `deploy/doks`
- Deploy script: `scripts/deploy_doks.ps1`
- Validation script: `scripts/validate_phase7_doks.ps1`

### 1) Prepare environment variables (PowerShell example)
Use `.env.doks.example` as the template source of truth.

```powershell
$env:POSTGRES_DB="settleup"
$env:POSTGRES_USER="settleup_user"
$env:POSTGRES_PASSWORD="<strong-password>"
$env:JWT_SECRET="<long-random-secret>"

$env:EMAIL_ENABLED="false"
$env:EMAIL_FROM="no-reply@settleup.local"
$env:SMTP_HOST=""
$env:SMTP_PORT="2525"
$env:SMTP_USER=""
$env:SMTP_PASS=""
```

### 2) Build/push images and deploy to DOKS
Team-verified values (this workspace):
```powershell
./scripts/deploy_doks.ps1 -ClusterName "ece1779-cluster" -Registry "registry.digitalocean.com/mdgh-1779"
```

Generic form:
```powershell
./scripts/deploy_doks.ps1 -ClusterName "<doks-cluster-name>" -Registry "<registry-prefix>"
```

Notes:
- `<registry-prefix>` example: `registry.digitalocean.com/<registry-name>`
- Ensure `docker login` and `doctl auth init` are completed first.

### 3) Run cloud acceptance checks
Team-verified values (current deployment):
```powershell
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://152.42.147.82:3001" -WebUrl "http://152.42.147.84:3000"
```

Generic form:
```powershell
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://<api-external-ip>:3001" -WebUrl "http://<web-external-ip>"
```

URL interpretation:
- `localhost` URLs are only for local Docker/desktop demo on the current machine.
- Cloud demo uses DOKS LoadBalancer URLs and is reachable from other devices.
- Cloud endpoint IPs can change after redeploy/recreate.

SMTP note (current cloud setup):
- Real email delivery is enabled via SendGrid SMTP.
- Reconfigure command example:
```powershell
./scripts/enable_real_email.ps1 -SmtpHost "smtp.sendgrid.net" -SmtpPort 2525 -SmtpUser "apikey" -SmtpPass "<sendgrid-api-key>" -EmailFrom "<verified-sender-email>"
```

### 4) Post-change release SOP (code -> cloud)
Use this sequence after frontend/backend code changes to avoid partial rollout failures.

1. Local quality gate
```bash
npm --prefix web run build
```

2. Ensure Docker daemon is running
```powershell
docker info
```

3. Build and push unique-tag images
```powershell
$tag = "<feature>-" + (Get-Date -Format 'yyyyMMddHHmmss')
$apiImg = "registry.digitalocean.com/mdgh-1779/settleup-api:$tag"
$webImg = "registry.digitalocean.com/mdgh-1779/settleup-web:$tag"
docker build -t $apiImg ./api
docker build -t $webImg ./web
docker push $apiImg
docker push $webImg
```

4. Update deployments only after push succeeds
```powershell
kubectl set image deployment/api api=$apiImg -n settleup
kubectl set image deployment/worker worker=$apiImg -n settleup
kubectl set image deployment/web web=$webImg -n settleup
```

5. Wait for rollout and verify image tags
```powershell
kubectl rollout status deployment/api -n settleup --timeout=300s
kubectl rollout status deployment/worker -n settleup --timeout=300s
kubectl rollout status deployment/web -n settleup --timeout=300s
kubectl get deployment api worker web -n settleup -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
```

6. Runtime smoke checks
```powershell
kubectl logs deployment/worker -n settleup --tail=120
curl http://152.42.147.82:3001/health
curl http://152.42.147.82:3001/ready
```

7. Common failure and quick recovery
- Symptom: `ImagePullBackOff` right after `kubectl set image`.
- Typical cause: Docker build/push failed but deployment was still updated to a new image tag.
- Quick recovery pattern:
	- set deployment image back to a known-good running tag,
	- complete build/push successfully,
	- rerun steps 4-6.

## Verify
```bash
kubectl get pods -n settleup
kubectl get svc -n settleup
kubectl get ingress -n settleup
kubectl get hpa -n settleup
```

## Notes
- Postgres schema bootstrap SQL is mounted from `settleup-db-init` ConfigMap.
- HPA targets API CPU utilization at 70%.
- API exposes `/health`, `/ready`, and `/metrics` for probes and monitoring.
