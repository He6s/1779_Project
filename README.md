# SettleUp Final Report

SettleUp is a cloud-native expense splitting platform for small groups. It supports group-based expense tracking, split validation, debt balancing, settlements, activity history, and asynchronous notifications, with containerized local development and Kubernetes deployment support.
## Live URL
Current deployment (valid as of this report):
- **Application URL:** http://152.42.147.84:3000
- **API URL:** http://152.42.147.82:3001


## 1. Team Information

| Name | Student Number | Preferred Email |
|---|---|---|
| Hao-Chih Huang | 1006907037 | helioshuang2002@gmail.com |
| George Cao | 1005556426 | yiweicaogeorge@gmail.com |
| Lihao Xue | 1011809875 | xuelihaogpa4@gmail.com |
| Zuhao Zhang | 1005828080 | davidzhangzuhao@gmail.com |

## 2. Motivation

- **Problem**
  - Small groups such as roommates, classmates, and trip partners often split expenses manually through chat and spreadsheets.
  - This process is error-prone and difficult to audit.
- **Why SettleUp**
  - We built SettleUp to provide a transparent and reliable shared-expense workflow with clear accountability.
- **Why cloud-native**
  - A cloud-native architecture was chosen so the system can be validated locally and deployed in a production-like environment with reproducible operations.

## 3. Objectives

- **Core product goals**
  - Build a full-stack expense splitting application with secure authentication and group-level authorization.
  - Support multiple split strategies (equal, percentage, exact) with input validation.
  - Provide balance computation, debt graph, settlement recording, and activity traceability.
  - Support asynchronous notification processing.
- **Infrastructure and validation goals**
  - Provide containerized local execution and Kubernetes deployment artifacts.
  - Add observability and script-based verification to demonstrate correctness.

## 4. Technical Stack

- **Application Layer**
  - **Frontend:** React 18 + Vite 5
    - Single-page web UI for authentication, group management, expense entry, balances, settlements, and activity history
    - Built assets are served by an Express-based `web` container
    - Runtime API URL injection (`API_BASE_URL`) lets the same frontend image work in both local and cloud environments
  - **Backend API:** Node.js + Express 4
    - REST endpoints for auth, groups, members, expenses, balances, settlements, and activity
    - Server-Sent Events (SSE) endpoints provide live updates for group and user changes
    - Includes `/health`, `/ready`, and `/metrics` endpoints for operations support

- **Data and Messaging Layer**
  - **Primary database:** PostgreSQL 17
    - Stores users, groups, memberships, expenses, split records, settlements, and activity logs
    - SQL init scripts define schema, constraints, and indexes to improve integrity and performance
  - **Queue / async processing:** Redis 7
    - Used as the email job queue
    - A separate `worker` service consumes jobs asynchronously so notification delivery does not block API requests

- **Security, Auth, and External Integration**
  - **Authentication:** `bcryptjs` + `jsonwebtoken`
    - Password hashing with bcrypt
    - JWT-based authentication for protected routes
  - **Email notifications:** Nodemailer over SMTP
    - Supports simulated local mode and real SMTP delivery in deployment
    - Configured for SendGrid-compatible cloud email delivery

- **Observability and Reliability**
  - **Metrics:** `prom-client`
    - Prometheus-compatible metrics exposed at `/metrics`
  - **Logging:** structured JSON logs with request IDs
    - Helps trace requests across API operations
  - **Service health:** readiness and liveness support
    - `/health` checks API and Redis reachability
    - `/ready` verifies API, PostgreSQL, and Redis readiness

- **Containerization and Local Development**
  - **Containers:** Docker
    - Separate images for `web` and `api`
    - `worker` reuses the API image and runs `node src/worker.js`
  - **Local orchestration:** Docker Compose
    - Runs the full local stack: `web`, `api`, `worker`, `db`, and `redis`
    - Uses a named Docker volume for persistent PostgreSQL storage during local development

- **Chosen Orchestration Approach**
  - **Kubernetes** was selected instead of Swarm
    - Matches the project proposal and course objective for cloud-native orchestration
    - Supports scaling, persistent storage, service discovery, and production-style deployment workflows
  - **Implemented Kubernetes resources**
    - `Deployment`: `api`, `web`, `worker`, `db`, `redis`
    - `Service`: internal communication plus external exposure for deployed services
    - `ConfigMap` and `Secret`: app configuration and credentials
    - `PersistentVolumeClaim`: persistent PostgreSQL storage
    - `Ingress`: local host-based routing support
    - `HorizontalPodAutoscaler`: API autoscaling based on CPU usage

- **Deployment Environments and Tooling**
  - **Local Kubernetes validation:** `kind` + `kubectl` + `kustomize`
  - **Cloud deployment target:** DigitalOcean Kubernetes (DOKS)
    - `deploy/doks` overlay patches service exposure and environment-specific values
    - Deployment scripts also update image tags, config values, and rollout state
  - **Automation scripts:** PowerShell
    - Validation scripts for local workflow, observability, Kubernetes rollout, and DOKS deployment checks

## 5. Features

- **Core Application Features**
  - **Secure user authentication**
    - Users register and log in with email and password
    - Passwords are hashed with bcrypt
    - JWT-protected routes ensure only authorized users can access private group data
    - This fulfills the proposal's secure email-based authentication requirement
  - **Group creation and member management**
    - Users can create groups and add members by email
    - Members can have optional nicknames for easier display in the UI
    - Authorization checks protect group membership operations
    - This fulfills the requirement for multi-user, group-based expense sharing
  - **Expense creation with multiple split modes**
    - Supports `equal`, `percentage`, and `exact` split types
    - Frontend and backend both validate split input
    - Percentage splits must total 100, and exact splits must total the full expense amount
    - This directly implements the proposal's core split rules
  - **Flexible payer and participant selection**
    - Users can choose who paid for an expense
    - Users can select which group members are participating in the split
    - This supports real scenarios such as partial participation and non-creator payment
  - **Balance computation and debt graph**
    - Balances are derived from expense, split, and settlement records rather than stored as static values
    - The API also generates a simplified "who owes whom" debt graph
    - This fulfills the proposal's goal of transparent balance tracking and debt netting
  - **Settlement recording**
    - Members can record payments from one user to another
    - Same-user settlement is rejected
    - Balances update after settlement to reflect debt resolution
    - This completes the required workflow from expense creation to final settlement
  - **Activity history and auditability**
    - Expense and settlement events are stored in `activity_log`
    - Activity entries include structured payload details for easier auditing
    - The UI renders this history in a readable activity feed
    - This fulfills the proposal's requirement for history and traceability

- **Advanced / Enhanced Features**
  - **Event-driven email notification system**
    - Expense and settlement actions enqueue jobs in Redis
    - A background worker processes those jobs asynchronously
    - Email content includes group name, amount, description, recipient share when relevant, and a link back to the app
    - This satisfies the proposal's advanced external-service integration requirement
  - **Live updates in the frontend**
    - The API exposes SSE endpoints for group-level and user-level events
    - The React frontend refreshes members, balances, and activity when updates occur
    - This supports the proposal's objective of balances and group activity updating as actions happen
  - **Improved usability for demo and real use**
    - Member nicknames improve readability in splits and settlements
    - Expense and settlement forms use member selection instead of requiring raw IDs
    - UI checks help prevent duplicate member additions and invalid settlement choices

- **How These Features Meet Course Project Requirements**
  - **Stateful application**
    - PostgreSQL persists all core financial and group data
    - Persistent storage is provided locally and through Kubernetes PVCs in deployment
  - **Containerized multi-service system**
    - The application runs as separate `web`, `api`, `worker`, `db`, and `redis` services
    - This reflects a real multi-container cloud-native design
  - **Orchestrated cloud deployment**
    - The project uses Kubernetes rather than Swarm
    - Deployment manifests cover app services, configuration, scaling, networking, and persistence
  - **Observability and operations**
    - Health/readiness endpoints, structured logs, and metrics support debugging and monitoring
  - **Advanced feature requirement**
    - The asynchronous email notification pipeline serves as the project's major advanced feature

## 6. User Guide

This section is written for users with little or no development experience.

### 6.1 Before you start (one-time setup)
1. **Install Docker Desktop**
   - Install Docker Desktop for Windows or macOS.
2. **Start Docker**
   - Open Docker Desktop and wait until it shows "Engine running".
3. **Open the project folder**
   - Open a terminal in the project folder.
4. **Verify Docker is available**
```bash
docker --version
docker compose version
```

### 6.2 Start the app locally
1. **Create the local environment file**
```bash
copy .env.example .env
```
2. **Start all services**
   - This starts `web`, `api`, `worker`, `db`, and `redis`.
```bash
docker compose up -d --build
```
3. **Wait for first startup**
   - Wait about 20 to 60 seconds.
4. **Check container status**
```bash
docker compose ps
```
5. **Open the web app**
   - `http://localhost:3000`
6. **API connection behavior**
   - The frontend automatically points to its respective environment API Base URL (`http://localhost:3001` or the deployment URL), meaning no manual connection inputs are required for users.
7. **Optional API health checks**
```bash
curl http://localhost:3001/health
curl http://localhost:3001/ready
```

### 6.3 First-time usage walkthrough (UI)
Use this exact flow for a demo.

1. **Register User A**
   - Open the web app.
   - Enter email and password.
   - Click Register.

2. **Register User B**
   - Open the app in another browser profile/incognito window.
   - Register another account with a different email.

3. **Login as User A and create a group**
   - Login with User A.
   - Create a group, for example "Trip to Toronto".

4. **Add User B to the group**
   - In member management, add User B by email.
   - Optional: set a nickname so members are easier to recognize in split selection.
   - If a user is already in the group, UI shows a duplicate-member warning and blocks repeated add.

5. **Create an expense**
   - Example: description "Dinner", amount `1000` cents.
   - Choose who paid for this expense from current group members.
   - Choose split type `equal`.
   - Submit.

   Split input UX:
   - `equal`: select participants by member name; total is split automatically.
   - `percentage`: choose members and input percentages per member; total must sum to 100.
   - `exact`: choose members and input owed cents per member; total must equal `amount_cents`.
   - You no longer need to manually paste member UUIDs for normal expense creation flow.

6. **Check balances and debt graph**
   - Confirm one user is owed money and one user owes money.

7. **Record a settlement**
   - Login as the debtor user.
   - Select both payer (who is paying) and receiver (who is receiving) in the settlement form.
   - Record settlement for the owed amount.

8. **Re-check balances**
   - Both users should return close to zero net balance after full settlement.

9. **Check activity history**
   - Confirm events exist for member add, expense create, and settlement.

### 6.4 Use the cloud deployment
If you are evaluating the deployed system, use:

- **Application URL:** `http://152.42.147.84:3000`
- **API URL:** `http://152.42.147.82:3001`

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
- **Stop all local services**
```bash
docker compose down
```

- **Start again later**
```bash
docker compose up -d
```

### 6.6 Common issues and quick fixes
1. **Web page does not open**
   - Check `docker compose ps`.
   - If web is not Up, run `docker compose up -d --build` again.

2. **API ready check fails**
   - DB may still be starting.
   - Wait 30 seconds and retry `/ready`.

3. **Port already in use**
   - Close conflicting app or container.
   - Then restart with `docker compose up -d`.

4. **Login/register fails unexpectedly**
   - Ensure email format is valid and password is at least 8 characters.
   - Check API logs:
```bash
docker compose logs api --tail=100
```

5. **Worker/email behavior not visible**
   - Inspect worker logs:
```bash
docker compose logs worker --tail=100
```

6. **Expense email not received**
   - Current cloud setup is real email delivery via SendGrid (not simulated mode).
   - If the message is not in Inbox, first check Spam/Junk and All Mail.
   - Verify worker delivery status:
```powershell
kubectl logs deployment/worker -n settleup --tail=120
```
   - Expected log field: `delivered=true`.
   - Note for Gmail recipients: even when `delivered=true` at worker level, Gmail may still defer with `421 4.7.32` when the `From` header domain is not aligned with authenticated SPF/DKIM organizational domain. For stable inbox placement, use a SendGrid-authenticated custom domain as `EMAIL_FROM`.
   - If SMTP needs to be reconfigured, run:
```powershell
./scripts/enable_real_email.ps1 -SmtpHost "smtp.sendgrid.net" -SmtpPort 2525 -SmtpUser "apikey" -SmtpPass "<sendgrid-api-key>" -EmailFrom "<verified-sender-email>"
```

7. **Deployment rollout stuck after updating image tag**
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

1. **Local quality gate**
```bash
npm --prefix web run build
```

2. **Ensure Docker daemon is running**
```powershell
docker info
```

3. **Build and push unique-tag images**
```powershell
$tag = "<feature>-" + (Get-Date -Format 'yyyyMMddHHmmss')
$apiImg = "registry.digitalocean.com/mdgh-1779/settleup-api:$tag"
$webImg = "registry.digitalocean.com/mdgh-1779/settleup-web:$tag"
docker build -t $apiImg ./api
docker build -t $webImg ./web
docker push $apiImg
docker push $webImg
```

4. **Update deployments only after push succeeds**
```powershell
kubectl set image deployment/api api=$apiImg -n settleup
kubectl set image deployment/worker worker=$apiImg -n settleup
kubectl set image deployment/web web=$webImg -n settleup
```

5. **Wait for rollout and verify image tags**
```powershell
kubectl rollout status deployment/api -n settleup --timeout=300s
kubectl rollout status deployment/worker -n settleup --timeout=300s
kubectl rollout status deployment/web -n settleup --timeout=300s
kubectl get deployment api worker web -n settleup -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
```

6. **Runtime smoke checks**
```powershell
kubectl logs deployment/worker -n settleup --tail=120
curl http://152.42.147.82:3001/health
curl http://152.42.147.82:3001/ready
```

7. **Documentation sync**
   - Update README feature list and user guide when UX changes.
   - Record debugging decisions and lessons in `project_note.md` and `ai-session.md`.

## 8. Deployment Information

### Current verified deployment status
- Local Docker Compose runtime verified.
- Local Kubernetes (kind) deployment verified, including rollout and in-cluster API flow.
- DOKS deployment executed successfully on `ece1779-cluster`, with runtime verification passed.
- Cloud deployments now use explicit unique tags for rollout safety (avoid relying on `latest`).
- Deployment script reliability fixes are applied and re-verified:
  - URL config no longer regresses to empty host (`http://`) during DOKS deploy.
  - `-SkipBuildAndPush` now reuses deployed images (or accepts an explicit tag), preventing non-existent timestamp tags and `ImagePullBackOff`.
- SendGrid domain authentication is verified for `settleup-mail.ca`.
- Cloud sender identity is updated to `SettleUp <noreply@settleup-mail.ca>`.
- Latest deployed feature bundle includes: member nickname/split UX improvements, expense payer selection, duplicate-member guard in add-member flow, settlement from/to selection with owes-who display, and richer activity detail rendering.

### DOKS deployment commands
Important: include SMTP credentials during deploy if you want real email delivery.
- `scripts/deploy_doks.ps1` reads SMTP values from environment variables.
- If `SMTP_USER` or `SMTP_PASS` is missing, cloud secret values can be overwritten with empty strings and email notifications will stop working.

Recommended pre-deploy env setup:
```powershell
$env:EMAIL_ENABLED = "true"
$env:SMTP_HOST = "smtp.sendgrid.net"
$env:SMTP_PORT = "2525"
$env:SMTP_USER = "apikey"
$env:SMTP_PASS = "<sendgrid-api-key>"
$env:EMAIL_FROM = "<verified-sender-email>"
```

Using this team's verified values:
```powershell
./scripts/deploy_doks.ps1 -ClusterName "ece1779-cluster" -Registry "registry.digitalocean.com/mdgh-1779"
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://152.42.147.82:3001" -WebUrl "http://152.42.147.84:3000"
```

If SMTP values were accidentally cleared by a deploy, re-apply them with:
```powershell
./scripts/enable_real_email.ps1 -SmtpHost "smtp.sendgrid.net" -SmtpPort 2525 -SmtpUser "apikey" -SmtpPass "<sendgrid-api-key>" -EmailFrom "<verified-sender-email>"
```

Generic template (for other clusters/registries):
```powershell
./scripts/deploy_doks.ps1 -ClusterName "<doks-cluster-name>" -Registry "registry.digitalocean.com/<registry-name>"
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://<api-external-ip>:3001" -WebUrl "http://<web-external-ip>:3000"
```

## 9. AI Assistance and Verification (Summary)

- **How AI was used**
  - AI tools were used for architecture exploration, API/Kubernetes scaffolding, debugging assistance, and documentation drafting.
  - The team reviewed outputs critically and corrected issues when needed.

- **Where AI contributed meaningfully**
  - Initial endpoint and workflow scaffolding.
  - Kubernetes and deployment script drafting.
  - Validation script drafting and iteration.

- **Representative limitation found in AI-assisted process**
  - Early Kubernetes verification relied on render-level checks only.
  - Team corrected this by running real cluster rollout and in-cluster runtime validation.

- **How correctness was verified**
  - Script-based end-to-end API checks.
  - Real Kubernetes rollout and pod/service checks.
  - Health/readiness and metrics validation.
  - Worker log inspection and manual UI/API checks.

Detailed interaction evidence is documented in `ai-session.md`.

## 10. Individual Contributions
The project was integrated collaboratively. The breakdown below highlights each member's primary areas of responsibility, while all members also participated in integration, debugging, validation, and final report/demo preparation.

- **Hao-Chih Huang**
  - Set up the base project repository and local development environment, including the folder structure, environment files, and shared team setup.
  - Built the initial multi-container local stack with Docker Compose, connecting the `web`, `api`, `db`, and `redis` services and adding the first Dockerfiles.
  - Designed and implemented the initial PostgreSQL schema for users, groups, group membership, expenses, splits, settlements, and activity logs.
  - Added backend service connectivity for PostgreSQL and Redis, including early health/readiness support.
  - Implemented the initial user and group API foundation used for early backend testing and team integration.

- **George Cao**
  - Expanded the project from the initial stack into the full cloud-ready application, including authentication, async email queue/worker processing, observability, richer API flows, and final report documentation.
  - Built and iterated on the React frontend, including the main app structure, styling system, activity rendering, account UX, and the polished final demo interface.
  - Prepared the Kubernetes deployment assets and cloud deployment workflow, including `k8s/`, `deploy/doks/`, and the validation/deployment PowerShell scripts.
  - Drove major deployment and operations fixes, including DOKS rollout hardening, config patching, image-pull handling, resource tuning, and SendGrid/domain-email integration updates.
  - Maintained the release runbook, validation evidence, and documentation sync needed for the final deliverable.

- **Lihao Xue**
  - Focused on the core expense-sharing workflow requirements, especially expense splitting behavior, balance expectations, debt-settlement flow, and the overall end-to-end product logic.
  - Helped refine and validate the financial rules used by the system, including equal/percentage/exact split behavior, balance updates, and settlement correctness expectations.
  - Contributed to integration review of the main user flow: group creation, member management, expense creation, balance checking, settlement recording, and activity verification.
  - Supported testing, debugging, and final polishing of the core business workflow so the implemented system stayed aligned with the original proposal objectives.
  - Helped prepare the final report content by aligning implemented features with the course requirements and project goals.

- **Zuhao Zhang**
  - Implemented key collaborative-expense UX/backend improvements, including explicit payer selection, group-member validation checks, and settlement display refinements.
  - Added live group update streams so frontend data such as members, balances, and activity can refresh from server-side events.
  - Improved the interaction between the API and frontend for expense/settlement workflows, especially around real-time updates and user-facing state changes.
  - Supported feature integration and deployment verification for the later project milestones as new workflow improvements were released.
  - Contributed to refining the final product behavior around group operations, payment flow visibility, and interactive user experience.


## 11. Lessons Learned and Concluding Remarks

- **Lessons learned**
  - Runtime validation is more reliable than superficial pass indicators.
  - Startup race conditions must be handled explicitly in distributed systems.
  - Observability (structured logs, request IDs, metrics) significantly improves debugging speed.
  - Incremental milestone delivery with repeated verification reduces integration risk.

SettleUp now has a complete backend workflow, React frontend, asynchronous worker pipeline, observability, and reproducible local/cluster deployment path, with successful DOKS deployment and cloud runtime validation. The remaining finalization work is SMTP production proof, cloud monitoring evidence packaging, and contribution table polishing.
