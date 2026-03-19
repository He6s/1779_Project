# SettleUp Final Report (README Draft Template)

Report status: Draft template
Target length: <= 5000 words
Last updated: 2026-03-19

## Final Deliverable Checklist

- Final report in README.md
- Complete source code
- AI interaction record in ai-session.md
- Video demo

---

## 1. Team Information

Fill in all members with active emails for clarification requests.

| Name | Student Number | Preferred Email | Role Summary |
|---|---|---|---|
| Hao-Chih Huang | 1006907037 | TODO | TODO |
| George Cao | 1005556426 | TODO | TODO |
| Lihao Xue | 1011809875 | TODO | TODO |
| Zuhao Zhang | 1005828080 | TODO | TODO |

## 2. Motivation

Describe why this project was chosen, the problem it addresses, and why it matters.

Draft content:
- Small groups often need transparent and fair shared-expense tracking.
- Existing ad hoc methods are error-prone and hard to audit.
- A cloud-native expense-splitting system supports reliability, scalability, and easier deployment operations.

## 3. Objectives

State the project objectives and what the team aimed to achieve.

Draft objectives:
- Build a full-stack expense-splitting platform with secure authentication and group-level access control.
- Support equal, percentage, and exact split modes with strong validation.
- Provide balance computation, debt graph insight, settlement recording, and activity traceability.
- Containerize services for local reproducible development and provide Kubernetes deployment capability.
- Add observability and verification workflows for correctness and operations.

## 4. Technical Stack

Describe all technologies used, including orchestration approach and key tools.

Implemented stack:
- Frontend: React (Vite build) served by Express in production container
- API: Node.js + Express
- Database: PostgreSQL
- Cache and queue: Redis
- Authentication: JWT + bcrypt
- Email pipeline: Async worker + queue + nodemailer interface
- Observability: Structured JSON logs with request IDs, Prometheus-compatible metrics endpoint
- Local orchestration: Docker Compose
- Container orchestration: Kubernetes manifests with kustomization, Service, Ingress, HPA, PVC

Planned vs implemented note:
- Initial proposal mentioned React-based frontend.
- During intermediate development, a temporary non-React demo page was used for fast integration testing.
- Final deliverable implementation uses React frontend.

## 5. Features

Outline major application features and how they satisfy requirements.

Implemented features:
- User registration and login with password hashing and JWT authentication.
- Group creation and membership management with authorization checks.
- Expense creation with split-mode validation (equal, percentage, exact).
- Group balances and debt graph computation.
- Settlement recording between members.
- Activity logs for auditable actions.
- Asynchronous notification queue and worker processing.
- Health and readiness checks.
- Prometheus-compatible metrics endpoint.
- Kubernetes deployment artifacts for all core services.

## 6. User Guide

Provide clear usage instructions for each major feature.

Suggested end-to-end user flow:
1. Register two users.
2. Create a group as user A.
3. Add user B to the group.
4. Create an expense with one split mode.
5. View balances and debt graph.
6. Record settlement from debtor to creditor.
7. Verify balances return to expected state.
8. View activity history.

Suggested screenshots:
- Registration and login success
- Group and member management
- Expense creation request and response
- Balances before and after settlement
- Activity timeline
- Metrics endpoint output

## 7. Development Guide

Explain how to set up and run the project locally.

### 7.1 Prerequisites
- Docker Desktop
- Docker Compose
- Node.js (if running services outside containers)
- kubectl and kind (for local Kubernetes validation)

### 7.2 Environment Configuration
- Copy environment template and fill required values.
- Ensure database, JWT, and email-related variables are configured.

### 7.3 Local Run (Compose)
1. Start all services.
2. Confirm health and readiness endpoints.
3. Run validation scripts.

### 7.4 Data and Storage
- PostgreSQL stores users, groups, expenses, splits, settlements, and activity logs.
- Redis is used for queue-based async notifications.
- DB schema and constraints are initialized via SQL scripts.

### 7.5 Local Verification
Use reproducible checks such as:
- API workflow validation script
- Observability validation script
- Kubernetes validation script

## 8. Deployment Information

Provide the live URL and deployment details.

Current verified status:
- Local Docker Compose runtime verified.
- Local Kubernetes (kind) rollout and in-cluster API flow verified.
- DOKS deployment completed and validated in runtime checks.
- Real email delivery is enabled via SendGrid SMTP in cloud deployment.

Live URL (current deployment at report time):
- Application URL: `http://152.42.147.84:3000`
- API URL: `http://152.42.147.82:3001`

DOKS command example (team-verified values):
```powershell
./scripts/deploy_doks.ps1 -ClusterName "ece1779-cluster" -Registry "registry.digitalocean.com/mdgh-1779"
./scripts/validate_phase7_doks.ps1 -ApiBaseUrl "http://152.42.147.82:3001" -WebUrl "http://152.42.147.84:3000"
```

Environment note for report wording:
- `localhost` URLs are for local demo on the current machine.
- Cloud demo uses DOKS LoadBalancer URLs and may change after redeploy.

## 9. AI Assistance and Verification (Summary)

Provide concise high-level summary only. Do not paste full AI prompts or full AI responses here.
Detailed examples belong in ai-session.md.

### 9.1 Where AI Meaningfully Contributed
- Architecture exploration and endpoint scaffolding.
- Docker Compose and Kubernetes configuration drafting.
- Debugging assistance and iterative fixes.
- Documentation and verification script drafting.

### 9.2 One Representative AI Limitation or Mistake
Example to include:
- Early Kubernetes validation was render-level and not sufficient for runtime proof.
- Team corrected this by performing real cluster deployment and runtime checks.

### 9.3 How Correctness Was Verified
- Script-based API end-to-end validation.
- Real Kubernetes rollout checks.
- Health and readiness checks.
- Log and metrics inspection.
- Manual functional spot checks.

Reference:
- Detailed AI interaction evidence: ai-session.md

## 10. Individual Contributions

Describe each member's concrete contribution and align with commit history.

Suggested format:
- Member A: modules, files, major features, validation evidence
- Member B: modules, files, major features, validation evidence
- Member C: modules, files, major features, validation evidence
- Member D: modules, files, major features, validation evidence

Contribution table template:

| Member | Key Contributions | Related Files or Areas | Evidence (Commits or PRs) |
|---|---|---|---|
| TODO | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO |

## 11. Lessons Learned and Concluding Remarks

Draft points:
- Runtime validation quality is more reliable than superficial pass indicators.
- Distributed-service startup race conditions require explicit readiness handling.
- Structured logs, request IDs, and metrics greatly accelerate debugging.
- Incremental milestone delivery with verification reduces integration risk.

Concluding paragraph template:
- Summarize what was built.
- Summarize what was validated.
- Mention final remaining operational improvements, if any.

---

## Appendix A. Verification Evidence Notes (Optional)

This appendix can be removed if the report is near the word limit.

Validated milestones observed in current stage:
- Phase 1 and 2 API validation passed.
- Settlement balance formula defect was identified and fixed, then retested successfully.
- Kubernetes workloads rolled out successfully in local cluster.
- In-cluster API flow validation passed.
- Worker processed queue jobs after startup-race hardening.
- DOKS phase-7 validation passed with externally reachable API and web endpoints.
- Real email delivery validation completed (`delivered=true`) in worker logs and provider-side events.

Pending final evidence to add before submission:
- Cloud monitoring dashboard or alert evidence
