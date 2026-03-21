# SettleUp Final Report

SettleUp is a cloud-native expense splitting platform for small groups. It supports group-based expense tracking, split validation, debt balancing, settlements, activity history, and asynchronous notifications, with containerized local development and Kubernetes deployment support.

## 1. Team Information

| Name | Student Number | Preferred Email |
|---|---|---|
| Hao-Chih Huang | 1006907037 | TODO |
| George Cao | 1005556426 | TODO |
| Lihao Xue | 1011809875 | TODO |
| Zuhao Zhang | 1005828080 | TODO |

## 2. Motivation

Small groups (roommates, classmates, trip partners) often split expenses manually through chat and spreadsheets, which is error-prone and difficult to audit. We built SettleUp to provide a transparent and reliable shared-expense workflow with clear accountability. A cloud-native architecture was chosen so the system can be validated locally and deployed in a production-like environment with reproducible operations.

## 3. Objectives

- Build a full-stack expense splitting application with secure authentication and group-level authorization.
- Support multiple split strategies (equal, percentage, exact) with input validation.
- Provide balance computation, debt graph, settlement recording, and activity traceability.
- Support asynchronous notification processing.
- Provide containerized local execution and Kubernetes deployment artifacts.
- Add observability and script-based verification to demonstrate correctness.

## 4. Technical Stack

- Web: React (Vite build), served by Express in production container.
- API: Node.js + Express.
- Database: PostgreSQL.
- Cache and queue: Redis.
- Authentication: JWT + bcrypt.
- Notification pipeline: background worker + Redis queue + nodemailer interface.
- Observability: structured JSON logs with request IDs, Prometheus-compatible metrics endpoint.
- Local orchestration: Docker Compose.
- Cluster orchestration: Kubernetes manifests (namespace, services, deployments, PVC, ingress, HPA, kustomization).
- Cloud deployment target: DOKS (DigitalOcean Kubernetes Service).

Implementation note:
- During intermediate development, a temporary non-React demo page was used to accelerate backend integration testing.
- For final deliverable alignment, the frontend has been migrated to React.

## 5. Features

- User registration/login with password hashing and JWT-based auth.
- Group creation and membership management with access control.
- Optional member nickname support for better readability in group operations.
- Expense creation with equal/percentage/exact split validation.
- Name-based split builder for percentage/exact modes (no manual UUID typing required).
- Expense payer selection support (`payer_id`) so payer can be selected explicitly within group members.
- Group balance computation and debt graph generation.
- Settlement recording between members.
- Settlement target selection by member name (dropdown), not raw user id input.
- Settlement form supports both payer (`from_user`) and receiver (`to_user`) selection with same-user validation.
- Group member add flow includes duplicate-member check in UI to prevent re-adding existing users.
- Activity log for auditable group events.
- Activity detail rendering includes expense description and amount (for example: Groceries, 1200 cents).
- Modern, responsive User Interface utilizing glassmorphism themes, floating labels, animated custom checkboxes, dynamic tabbed navigation, and a soft pastel fluid background.
- Asynchronous email notification job processing.
- Health and readiness endpoints.
- Prometheus-compatible metrics endpoint.

## 6. User Guide

This section is written for users with little or no development experience.

### 6.1 Before you start (one-time setup)
1. Install Docker Desktop for Windows or macOS.
2. Open Docker Desktop and wait until it shows "Engine running".
3. Open a terminal in the project folder.
4. Verify Docker is available:
```bash
docker --version
docker compose version
```

### 6.2 Start the app locally
1. In the project root, create your local environment file:
```bash
copy .env.example .env
```
2. Start all services (web, api, worker, db, redis):
```bash
docker compose up -d --build
```
3. Wait about 20 to 60 seconds for first startup.
4. Check that all containers are up:
```bash
docker compose ps
```
5. Open the web app:
- `http://localhost:3000`
6. The frontend automatically points to its respective environment API Base URL (`http://localhost:3001` or the deployment URL) meaning no manual connection inputs are required for users.
7. Optional API health checks:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/ready
```

### 6.3 First-time usage walkthrough (UI)
Use this exact flow for a demo.

1. Register User A
- Open the web app.
- Enter email and password.
- Click Register.

2. Register User B
- Open the app in another browser profile/incognito window.
- Register another account with a different email.

3. Login as User A and create a group
- Login with User A.
- Create a group, for example "Trip to Toronto".

4. Add User B to the group
- In member management, add User B by email.
- Optional: set a nickname so members are easier to recognize in split selection.
- If a user is already in the group, UI shows a duplicate-member warning and blocks repeated add.

5. Create an expense
- Example: description "Dinner", amount `1000` cents.
- Choose who paid for this expense from current group members.
- Choose split type `equal`.
- Submit.

Notes for split input UX:
- `equal`: select participants by member name; total is split automatically.
- `percentage`: choose members and input percentages per member; total must sum to 100.
- `exact`: choose members and input owed cents per member; total must equal `amount_cents`.
- You no longer need to manually paste member UUIDs for normal expense creation flow.

6. Check balances and debt graph
- Confirm one user is owed money and one user owes money.

7. Record a settlement
- Login as the debtor user.
- Select both payer (who is paying) and receiver (who is receiving) in the settlement form.
- Record settlement for the owed amount.

8. Re-check balances
- Both users should return close to zero net balance after full settlement.

9. Check activity history
- Confirm events exist for member add, expense create, and settlement.

### 6.4 Use the cloud deployment
If you are evaluating the deployed system, use:

- Application URL: `http://152.42.147.84:3000`
- API URL: `http://152.42.147.82:3001`

The API bindings are handled implicitly as the UI hides network connection details from standard users for a cleaner software experience.

How to interpret URLs:
- Local demo always uses `localhost` URLs.
- Cloud demo uses the deployed LoadBalancer URLs.
- Changing to another computer does not require changing URLs if you are still visiting the same deployment URL.
- Redeploying to a different cluster/project may produce new external IPs, so cloud URLs may need to be updated.
- The runtime auto-link strategy is correct. It avoids hardcoding API URLs into frontend build artifacts.

For API checks:
```bash
curl http://152.42.147.82:3001/health
curl http://152.42.147.82:3001/ready
curl http://152.42.147.82:3001/metrics
```

### 6.5 Stop and restart
Stop all local services:
```bash
docker compose down
```

Start again later:
```bash
docker compose up -d
```

### 6.6 Common issues and quick fixes
1. Web page does not open
- Check `docker compose ps`.
- If web is not Up, run `docker compose up -d --build` again.

2. API ready check fails
- DB may still be starting.
- Wait 30 seconds and retry `/ready`.

3. Port already in use
- Close conflicting app or container.
- Then restart with `docker compose up -d`.

4. Login/register fails unexpectedly
- Ensure email format is valid and password is at least 8 characters.
- Check API logs:
```bash
docker compose logs api --tail=100
```

5. Worker/email behavior not visible
- Inspect worker logs:
```bash
docker compose logs worker --tail=100
```

6. Expense email not received
- Current cloud setup is real email delivery via SendGrid (not simulated mode).
- If the message is not in Inbox, first check Spam/Junk and All Mail.
- Verify worker delivery status:
```powershell
kubectl logs deployment/worker -n settleup --tail=120
```
- Expected log field: `delivered=true`.
- If SMTP needs to be reconfigured, run:
```powershell
./scripts/enable_real_email.ps1 -SmtpHost "smtp.sendgrid.net" -SmtpPort 2525 -SmtpUser "apikey" -SmtpPass "<sendgrid-api-key>" -EmailFrom "<verified-sender-email>"
```

7. Deployment rollout stuck after updating image tag
- Symptom: `ImagePullBackOff` after `kubectl set image`.
- Typical cause: Docker build/push failed but deployment was still updated to a new tag.
- Fix order:
```powershell
docker info
docker build -t <api-image> ./api
docker build -t <web-image> ./web
docker push <api-image>
docker push <web-image>
kubectl set image deployment/api api=<api-image> -n settleup
kubectl set image deployment/worker worker=<api-image> -n settleup
kubectl set image deployment/web web=<web-image> -n settleup
kubectl rollout status deployment/api -n settleup --timeout=300s
kubectl rollout status deployment/worker -n settleup --timeout=300s
kubectl rollout status deployment/web -n settleup --timeout=300s
```

### Suggested report screenshots
- Auth success view.
- Group/member management.
- Expense creation result.
- Balance before/after settlement.
- Activity log.
- `/metrics` output sample.

## 7. Development Guide

### Prerequisites
- Docker Desktop + Docker Compose.
- Node.js (optional for local non-container commands).
- kubectl + kind (for local Kubernetes validation).
- doctl (for DOKS deployment step).

### Data and storage
- PostgreSQL stores users, groups, expenses, splits, settlements, activity logs.
- Redis handles queue operations and health checks.
- Schema and constraints are initialized from SQL files under `db/init`.

### Validation scripts
- `scripts/validate_phase1_2.ps1`: core API business flow.
- `scripts/validate_phase5_observability.ps1`: logs and metrics checks.
- `scripts/validate_phase6_k8s.ps1`: Kubernetes manifest verification.
- `scripts/validate_phase7_doks.ps1`: cloud runtime acceptance checks.

### Post-change release SOP (code -> cloud)
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

7. Documentation sync
- Update README feature list and user guide when UX changes.
- Record debugging decisions and lessons in `project_note.md` and `ai-session.md`.

## 8. Deployment Information

### Current verified deployment status
- Local Docker Compose runtime verified.
- Local Kubernetes (kind) deployment verified, including rollout and in-cluster API flow.
- DOKS deployment executed successfully on `ece1779-cluster`, with runtime verification passed.
- Cloud deployments now use explicit unique tags for rollout safety (avoid relying on `latest`).
- Latest deployed feature bundle includes: member nickname/split UX improvements, expense payer selection, duplicate-member guard in add-member flow, settlement from/to selection with owes-who display, and richer activity detail rendering.

### DOKS deployment commands
Using this team's verified values:
```powershell
./scripts/deploy_doks.ps1 -ClusterName "ece1779-cluster" -Registry "registry.digitalocean.com/mdgh-1779"
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://152.42.147.82:3001" -WebUrl "http://152.42.147.84:3000"
```

Generic template (for other clusters/registries):
```powershell
./scripts/deploy_doks.ps1 -ClusterName "<doks-cluster-name>" -Registry "registry.digitalocean.com/<registry-name>"
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://<api-external-ip>:3001" -WebUrl "http://<web-external-ip>:3000"
```

### Live URL
Current deployment (valid as of this report):
- Application URL: http://152.42.147.84:3000
- API URL: http://152.42.147.82:3001

Note: these are environment-specific runtime endpoints, not fixed project constants.

## 9. AI Assistance and Verification (Summary)

AI tools were used for architecture exploration, API/Kubernetes scaffolding, debugging assistance, and documentation drafting. The team reviewed outputs critically and corrected issues when needed.

Where AI contributed meaningfully:
- Initial endpoint and workflow scaffolding.
- Kubernetes and deployment script drafting.
- Validation script drafting and iteration.

Representative limitation found in AI-assisted process:
- Early Kubernetes verification relied on render-level checks only.
- Team corrected this by running real cluster rollout and in-cluster runtime validation.

How correctness was verified:
- Script-based end-to-end API checks.
- Real Kubernetes rollout and pod/service checks.
- Health/readiness and metrics validation.
- Worker log inspection and manual UI/API checks.

Detailed interaction evidence is documented in `ai-session.md`.

## 10. Individual Contributions

Contribution details should be aligned with Git commit history before final submission.

| Member | Key Contributions | Evidence (Commits/PRs) |
|---|---|---|
| Hao-Chih Huang | TODO | TODO |
| George Cao | TODO | TODO |
| Lihao Xue | TODO | TODO |
| Zuhao Zhang | TODO | TODO |

## 11. Lessons Learned and Concluding Remarks

- Runtime validation is more reliable than superficial pass indicators.
- Startup race conditions must be handled explicitly in distributed systems.
- Observability (structured logs, request IDs, metrics) significantly improves debugging speed.
- Incremental milestone delivery with repeated verification reduces integration risk.

SettleUp now has a complete backend workflow, React frontend, asynchronous worker pipeline, observability, and reproducible local/cluster deployment path, with successful DOKS deployment and cloud runtime validation. The remaining finalization work is SMTP production proof, cloud monitoring evidence packaging, and contribution table polishing.
