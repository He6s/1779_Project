# Project Notes for Final Report (Working Draft)

Last updated: 2026-03-21
Purpose: Capture report-ready facts from implementation and validation so the final README report can be written quickly and accurately.

Template file for final report drafting:
- README.report-template.md

## 1. Current Project Snapshot

- Project: SettleUp (cloud-native expense splitting platform)
- Current stage: Core backend, async worker, observability, local runtime, and DOKS cloud deployment are implemented and validated.
- Validation style used: Real runtime validation (not only static checks), with reproducible scripts and in-cluster tests.

Latest update (2026-03-19):
- Member UX: nickname-enabled member display and name-based split selection for percentage/exact.
- Settlement UX: settlement target now selectable by member name in frontend.
- Activity UX: frontend now renders expense description and amount from activity payload.

Latest update (2026-03-21):
- Expense UX: payer can be explicitly selected during expense creation (`payer_id`), and payer is validated as a group member.
- Group member UX: add-member flow now blocks duplicate users already in the group.
- Settlement UX: settlement now records both `from_user` and `to_user`, with frontend displaying net balances plus owes-who edges.
- UI/UX Overhaul: Fully redesigned the React frontend with a modern glassmorphism aesthetic, featuring floating input labels, custom animated checkboxes, tab-based navigation, and a fluid, animated pastel radial-gradient background.
- Deployment Ops: Addressed `IfNotPresent` image caching in DOKS Kubernetes limits by explicitly bumping UI image tags (`v2-ui`, `v3-ui`, etc.) to force UI rollouts. Realigned doctl registry names (`mdgh-1779`).

## 2. Report-Ready Content by Required Sections

### Team Information
- Team names are already listed in README.
- Need to add student numbers and preferred active emails before final submission.

### Motivation
- Problem: Small groups need transparent and fair shared-expense tracking.
- Why this project: Practical need for group travel/roommate cost sharing; cloud-native architecture is suitable for scalability and reliability.

### Objectives
- Build a full-stack shared-expense system with authentication and group access control.
- Support expense split modes and debt balancing logic.
- Add settlement flow and activity traceability.
- Support containerized local development and Kubernetes deployment path.
- Add observability and verifiable correctness checks.

### Technical Stack (actual implemented stack)
- API: Node.js + Express
- DB: PostgreSQL
- Cache/queue: Redis
- Auth: JWT + bcrypt
- Notification: Async worker + queue + nodemailer interface
- Metrics/logging: Prometheus-compatible metrics endpoint and structured JSON logs
- Local orchestration: Docker Compose
- Kubernetes artifacts: namespace, configmap, secret template, deployments/services, PVC, ingress, HPA, kustomization

Note for final report accuracy:
- Web is now implemented as a React frontend (Vite build) and served in production by Express.
- In final report, mention that the team used a temporary non-React demo page during intermediate validation, then migrated to React for final deliverable alignment.

### Features (implemented and validated)
- User registration/login with hashed password and JWT auth.
- Group creation, membership management, and access control.
- Optional member nickname support for improved member identification.
- Expense creation with equal/percentage/exact split validation.
- React split builder supports name-based selection for percentage/exact input (no raw UUID entry required in normal flow).
- Expense payer selection is supported in frontend and API (`payer_id`), not fixed to current login user.
- Settlement target supports name-based dropdown selection in frontend.
- Settlement form supports both payer and receiver selection (`from_user` -> `to_user`) with same-user guard.
- Add-member flow includes duplicate-member check before submission.
- Activity list now includes expense description and amount for expense events.
- Balance and debt-graph calculation.
- Settlement recording and activity log.
- Async notification queue and worker processing.
- Health/readiness endpoints and /metrics endpoint.
- React web frontend connected to API.

### User Guide (evidence to include)
- Typical flow:
  1) Register/login
  2) Create group and add members
  3) Create expense
  4) View balances/debt graph
  5) Record settlement
  6) View activity
- Suggested screenshots for final report:
  - Auth success
  - Group/member screen
  - Expense creation result
  - Balance before/after settlement
  - Activity list
  - Metrics endpoint output

### Development Guide (facts already verified)
- Local startup via Docker Compose with services: web, api, worker, db, redis.
- Environment template exists and includes auth/email/queue related variables.
- Database schema and constraints/indexes are defined.
- Validation scripts exist for key phases.

### Deployment Information
- Kubernetes manifests are prepared and applied successfully on local kind cluster.
- Real local cluster validation completed (rollout + API E2E + worker processing + web reachable).
- DOKS deployment and phase-7 validation are completed.
- Live cloud endpoints (current deployment):
  - Application URL: `http://152.42.147.84:3000`
  - API URL: `http://152.42.147.82:3001`
- URL interpretation standard:
  - `localhost` endpoints are for local demo on the current machine.
  - Cloud demo uses DOKS LoadBalancer endpoints and may change after redeploy.

### AI Assistance and Verification (summary material)
Where AI meaningfully contributed:
- API endpoint scaffolding and business-flow wiring.
- Docker/Kubernetes manifest generation and iterative fixes.
- Validation script drafting and expansion.
- Runtime debugging support and documentation drafting.

Representative AI limitation/mistake to report:
- Early Phase 6 validation initially relied on render-level checks (kustomize output), which was insufficient for runtime proof.
- Correction: moved to real cluster deployment on kind and performed real in-cluster validation.

How correctness was verified:
- Automated endpoint validation scripts.
- Real service rollout checks in Kubernetes.
- Health/readiness and metrics inspection.
- Worker log verification for queue processing.
- Manual spot checks on web/API behavior.

Important report rule reminder:
- Do not paste full AI prompt/response logs in final report section.
- Put detailed evidence in ai-session.md and reference it.

### Individual Contributions
- Need to map each member contribution to Git commit history before finalization.
- Recommended format: member -> major modules/files -> validation evidence.

### Lessons Learned and Concluding Remarks (draft bullets)
- Runtime validation quality matters more than "script says PASS".
- Startup race conditions are common in distributed systems and need explicit handling.
- Observability (request IDs, logs, metrics) speeds up debugging and acceptance checks.
- Incremental milestone delivery with verification reduces integration risk.

## 3. Key Validation Evidence Collected So Far

- Phase 1/2 API validation script passed against local stack.
- A real logic bug was found and fixed in settlement/balance net formula; script rerun passed.
- Kubernetes manifests applied to a real local cluster (kind) with successful rollout for db/redis/api/web/worker.
- API E2E validation passed against in-cluster API via port-forward.
- Web endpoint check returned HTTP 200 and expected content.
- Worker consumed queued notification jobs successfully after redeploy.

## 4. Important Issues Found During Experiments

1) Settlement net-balance formula defect
- Symptom: Post-settlement balances were incorrect in one scenario.
- Action: Fixed formula/sign logic and reran validation.
- Outcome: Balances returned to expected zero-sum behavior.

2) Worker Redis startup race in Kubernetes
- Symptom: Worker logged repeated Redis connection refused at startup.
- Root cause pattern: Worker attempted connection before Redis was fully ready.
- Actions:
  - Added worker initContainer to wait for Redis port.
  - Hardened Redis client reconnect/connection handling.
- Outcome: Worker started cleanly and processed jobs without persistent Redis errors.

3) Validation rigor gap (process issue)
- Symptom: Early k8s check was manifest-render level, not runtime.
- Action: Switched to real-cluster deployment and runtime acceptance checks.
- Outcome: Stronger evidence quality for final report.

4) Local port-forward collision
- Symptom: Requested local port already in use.
- Action: Switched to a free local port and repeated tests.
- Outcome: Validation continued without blocking.

## 5. Remaining Gaps Before Final Submission

- DOKS deployment and phase-7 runtime validation are completed; report evidence packaging remains.
- Real SMTP delivery is enabled and validated (worker logs and provider delivery status).
- Add cloud monitoring dashboards/alerts evidence.
- Produce ai-session.md with concise, high-value examples and one clear AI limitation case.
- Finalize contribution mapping per member using git history.
- Final report polishing for <= 5000 words and screenshot completeness.

## 5.1 Phase 7 Assets Added (DOKS deployment readiness)

- Added DOKS overlay at `deploy/doks` (LoadBalancer service patches + cloud config patch).
- Added cloud deployment automation script: `scripts/deploy_doks.ps1`.
- Added cloud acceptance script: `scripts/validate_phase7_doks.ps1`.
- Added deployment environment template: `.env.doks.example`.
- Added CORS configurability in API for web-to-api cloud access (`CORS_ORIGIN`).

Current note:
- Cloud apply blocker has been resolved in this workspace.
- Team-verified deployment command values are:
  - Cluster: `ece1779-cluster`
  - Registry: `registry.digitalocean.com/mdgh-1779`

## 5.2 DOKS Debug Summary (report-ready)

Why this section matters for final report:
- Shows real runtime debugging in cloud environment (not only manifest rendering).
- Demonstrates corrective engineering decisions under realistic constraints (registry auth, single-node resource limits, persistent volume behavior).

Observed issues and final fixes:

1) Config patch failures in deployment script (PowerShell escaping)
- Symptom: `kubectl patch` returned JSON parse errors and malformed resource names.
- Root cause: string-escaped JSON payloads were brittle in PowerShell command context.
- Fix: replaced fragile inline patch strings with object-based patch/apply flow in script.
- Evidence: later runs no longer failed at config patch stage.

2) Image pull 401 / ImagePullBackOff on DOKS
- Symptom: `api/web/worker` pods failed to pull images from DigitalOcean registry.
- Root cause: authenticated pull secret was not consistently applied in pod templates after rollout/apply cycles.
- Fix:
  - created registry secret in namespace,
  - applied imagePullSecrets in DOKS overlay for `api/web/worker` deployment templates.
- Evidence: workloads pulled tagged registry images and progressed beyond initial pull failures.

3) DB CrashLoop on block volume mount
- Symptom: PostgreSQL failed with `directory exists but is not empty` and `lost+found` hint.
- Root cause: PostgreSQL data dir pointed at volume root mount path.
- Fix: set `PGDATA=/var/lib/postgresql/data/pgdata` and kept DB strategy as `Recreate` for single PVC safety.
- Evidence: DB deployment reached ready/running after patch.

4) Rollout deadlocks on small node capacity
- Symptom: rollouts stuck with old replicas pending termination; scheduler reported insufficient memory in events.
- Root cause: default requests/limits + rollout parallelism exceeded available allocatable memory on `s-2vcpu-2gb` node.
- Fix:
  - right-sized requests/limits in DOKS overlay,
  - used phased bring-up sequence (`db+redis` first, then `api`, `web`, `worker`) to reduce peak scheduling pressure.
- Evidence: all core pods reached running state in cloud cluster.

5) Phase-7 web reachability false negative (port mismatch)
- Symptom: validation failed at "web reachability and CORS preflight" while core pods were already running.
- Root cause: DOKS web service is exposed via LoadBalancer external IP with service port `3000`; using bare host URL without explicit port can fail.
- Fix:
  - validated using `http://<web-ip>:3000`,
  - hardened `validate_phase7_doks.ps1` to retry with `:3000` when no port is provided,
  - aligned deploy script output/config to advertise web URL with `:3000`.
- Evidence: phase-7 script returned `VALIDATION_RESULT: PASS` using cloud endpoints.

6) Deployment safety lesson (image tag update ordering)
- Symptom: rollout stuck with `ImagePullBackOff` after setting deployment image to a new tag.
- Root cause: Docker daemon/build/push failed first, but deployment image was still changed.
- Fix:
  - verify Docker daemon first,
  - build and push images successfully,
  - update deployment images only after push success,
  - use unique version tags instead of relying on `latest`.
- Outcome: cluster recovered quickly by rolling back to known-good images, then redeployed with pushed unique tags.

Cloud runtime evidence captured:
- Context: `do-tor1-ece1779-cluster`.
- External endpoints observed:
  - API: `http://152.42.147.82:3001`
  - Web: `http://152.42.147.84:3000`
- Running core services confirmed in namespace: `api`, `db`, `redis`, `web`, `worker`.

Suggested report phrasing (concise):
"During DOKS deployment, we encountered and resolved four production-like issues: script patch escaping, registry authentication for image pulls, PostgreSQL data-directory semantics on block volumes, and rollout pressure on a small node pool. We addressed these by hardening deployment scripts, enforcing imagePullSecrets in deployment templates, setting PGDATA to a subdirectory, and applying resource right-sizing with phased rollout. These fixes allowed all core services to run successfully with externally reachable API and web endpoints."

## 6. Suggested Artifacts to Prepare Next (for report quality)

- Screenshot set (local + k8s runtime + metrics).
- One architecture diagram (services + data flow + queue + k8s components).
- One verification matrix table:
  - Requirement
  - Implementation location
  - Verification method
  - Evidence (script/log/screenshot)

## 7. Quick Copy Blocks for Final README (draft-ready)

Short AI verification statement draft:
"AI tools were used for architecture exploration, API/Kubernetes scaffolding, debugging assistance, and documentation drafting. The team critically reviewed outputs, identified at least one meaningful limitation in AI-generated validation approach, and corrected it by performing runtime verification on a real Kubernetes cluster. Correctness was verified through scripts, logs, metrics, and manual end-to-end checks. Detailed interaction evidence is documented in ai-session.md."

Short deployment status draft (current state):
"The application has been validated locally with Docker Compose and on a local Kubernetes cluster (kind), and has been deployed to DOKS with public API and web endpoints. Runtime checks cover API business flow, web reachability, worker queue processing, and cloud acceptance validation."

Updated deployment status draft (after DOKS debug closure):
"The application was deployed to DOKS and reached running state for all core services (api, db, redis, web, worker). Public endpoints were provisioned, and deployment reliability was improved through fixes to registry pull authentication, PowerShell patch robustness, PostgreSQL PGDATA configuration on persistent volume, and resource right-sizing for constrained node capacity."

## 8. Post-change Operation Prototype (Runbook)

When code is changed and needs cloud release, follow this exact order:

1) Build sanity check:
- `npm --prefix web run build`

2) Docker daemon check:
- `docker info`

3) Build and push unique tags:
- build api/web images with timestamp-based tag
- push both tags to registry

4) Deployment image update:
- set image for `api`, `worker` (same api image), and `web`

5) Rollout verification:
- `kubectl rollout status deployment/api -n settleup --timeout=300s`
- `kubectl rollout status deployment/worker -n settleup --timeout=300s`
- `kubectl rollout status deployment/web -n settleup --timeout=300s`
- verify deployment image fields

6) Runtime smoke checks:
- `kubectl logs deployment/worker -n settleup --tail=120`
- health/readiness endpoint checks

7) Documentation sync:
- update README feature/user-guide/deployment notes
- update `project_note.md` and `ai-session.md` for traceability