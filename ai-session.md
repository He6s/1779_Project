# AI Interaction Record (ai-session.md)

This file summarizes how AI tools were used during development, where they helped, where they were limited, and how outputs were verified.

## 1. Scope of AI Usage

AI support was used for:
- Architecture and API workflow scaffolding.
- Kubernetes and deployment artifact drafting.
- Validation script drafting and iterative improvements.
- Debugging assistance and documentation organization.

## 2. Where AI Contributed Meaningfully

### 2.1 Backend and business workflow acceleration
- Helped scaffold authentication, group/member, expense, balance, settlement, and activity APIs.
- Reduced repetitive setup effort and sped up early integration.

### 2.2 Deployment asset generation
- Helped generate Kubernetes manifests and environment templates.
- Helped draft deployment scripts for cloud rollout and runtime checks.

### 2.3 Validation support
- Helped draft phase-based validation scripts.
- Encouraged script-based verification for repeatability.

## 3. Representative Limitation or Mistake

### Issue
Early Kubernetes verification focused on render-level checks (manifest rendering) rather than real runtime behavior.

### Why this was insufficient
Rendered manifests do not prove pod readiness, service connectivity, or end-to-end functionality.

### Correction taken by team
- Ran real cluster deployment on kind.
- Verified rollout status for db/redis/api/web/worker.
- Ran API end-to-end script against in-cluster endpoint.
- Inspected worker logs to confirm queue processing.

## 4. Critical Evaluation Approach

The team did not treat AI output as automatically correct. Instead, AI-generated changes were:
- Reviewed for consistency with proposal requirements.
- Tested with scripts and runtime checks.
- Corrected when mismatch or logical errors were found.

## 5. Verification Methods Used

- Automated API flow validation (`scripts/validate_phase1_2.ps1`).
- Observability validation (`scripts/validate_phase5_observability.ps1`).
- Kubernetes render and rollout checks (`scripts/validate_phase6_k8s.ps1` + runtime checks).
- Manual checks for web/API behavior.
- Worker log inspection for async processing outcomes.

## 6. Notable Fixes Found Through Verification

- Settlement net-balance formula/sign bug was identified and fixed.
- Worker Redis startup race condition was identified and mitigated.
- CORS configurability was added for cloud web-to-api access.
- Frontend migrated from temporary demo page to React for final deliverable alignment.
- DOKS rollout issues were debugged and fixed across script patching, registry image pulls, DB PGDATA pathing, and resource right-sizing.
- Expense UX improved to support member nicknames and name-based split selection for percentage/exact modes.
- Settlement UI improved to select target member by name instead of raw user id.
- Activity rendering improved to show expense description and amount from activity payload.

## 6.2 Deployment operation lesson (build/push before set-image)

Issue observed:
- Deployment images were updated to a new tag before confirming Docker build/push success.
- Result: pods entered `ImagePullBackOff` because the target image tag did not exist in registry.

Correction taken:
- Recovered by rolling back to known-good running images.
- Switched to guarded release order: daemon check -> build -> push -> `kubectl set image` -> rollout status.
- Adopted unique image tags per release to avoid ambiguity and stale-cache behavior.

Outcome:
- Cluster rollout recovered and completed successfully.
- New member-selection UX changes were deployed to cloud runtime.

## 6.3 Standard release operation sequence adopted

After this iteration, the team standardized release operations as follows:
- Local build validation first.
- Docker daemon readiness check.
- Build and push unique-tag API/Web images.
- Update Kubernetes deployment images only after push success.
- Wait for rollout success for `api`, `worker`, and `web`.
- Perform worker log and API health/readiness smoke checks.
- Sync README/project_note/ai-session documentation in the same change window.

Why this matters:
- Prevents broken rollouts from nonexistent image tags.
- Improves reproducibility and auditability of AI-assisted changes.

## 6.1 DOKS debugging case (meaningful AI-assisted iteration)

Issue cluster observed in cloud deployment:
- PowerShell patch payload parsing errors.
- ImagePullBackOff (401) on DigitalOcean registry images.
- PostgreSQL CrashLoop due to volume root `lost+found` behavior.
- Rollout stalls under single-node memory pressure.

Corrections implemented:
- Reworked script patch operations to avoid fragile escaped JSON payloads.
- Added DOKS overlay patch to enforce imagePullSecrets in deployment templates.
- Set `PGDATA` to a subdirectory under mounted volume and used safer DB rollout strategy.
- Reduced resource requests/limits and used phased rollout order to fit node capacity.

Verification outcome:
- Core cloud workloads reached running state.
- Public API/Web endpoints were observed.
- Phase-7 acceptance validation passed in cloud runtime checks.
- Real email delivery was validated with `delivered=true` worker logs and provider delivery events.
- Remaining work is report evidence packaging and contribution-table completion.

## 7. Current Status and Remaining Work

Completed:
- Core functionality implemented and validated locally.
- Local Kubernetes runtime validation completed.
- Final-report-ready documentation structure prepared.

Pending:
- Report integration of cloud evidence and screenshot packaging.
- Final cloud monitoring/alert evidence capture.
- Contribution table finalization from commit history.
