## Session Title
Kubernetes Verification: Moving from Render Checks to Real Runtime Validation

### Prompt (we sent to AI)

```text
How should we validate our Kubernetes milestone in a repeatable way?
```

### AI Response (trimmed)

```text
Suggested approach:
- Run `kubectl kustomize k8s` or `kubectl apply -k k8s --dry-run=client`
- Confirm that rendered output includes Deployment, Service, Ingress, HPA, and PVC objects
- Check that required environment variables and probes are present
- Optionally add a simple script to automate these manifest checks
```

### What Your Team Did With It

- Useful:
  - The suggestion helped us quickly create a first-pass validation script for Kubernetes artifacts and confirmed that required objects existed in rendered output.
- Incorrect, misleading, or not sufficient:
  - This was not enough to prove that the system actually worked. Manifest rendering does not verify pod readiness, service connectivity, worker behavior, or end-to-end application flow.
- How we verified, modified, or replaced it:
  - We kept the render-level checks, but treated them only as an initial gate.
  - We then upgraded our verification approach by deploying to a real `kind` cluster, checking rollout for `db`, `redis`, `api`, `web`, and `worker`, and running actual runtime acceptance checks.
  - This correction is reflected in our project scripts and notes, especially `scripts/validate_phase6_k8s.ps1`, `scripts/validate_phase1_2.ps1`, and `project_note.md`.

---

## Session Title
Expense Workflow and Real-Time UX Improvements

### Prompt (we sent to AI)

```text
How should we improve expense entry, member selection, and live updates in our Node/React app?
```

### AI Response (trimmed)

```text
Recommended direction:
- Add an explicit `payer_id` field for expense creation and validate it on the backend
- Replace raw ID input in the UI with member-based dropdowns or selectors
- Use either polling or Server-Sent Events for lightweight live updates
- Update settlement forms to clearly distinguish payer and receiver
- Re-test balances and activity flows after UX changes
```

### What Your Team Did With It

- Useful:
  - The AI suggestion aligned well with our actual product goals and helped structure the next round of workflow improvements.
  - It highlighted that UX changes in financial flows should be paired with backend validation, not just frontend changes.
- Incorrect, misleading, or not applicable:
  - Some options, such as generic polling, were not the best fit for our project once we considered responsiveness and simplicity.
  - The AI did not know our exact schema and therefore could not supply a drop-in final implementation.
- How we verified, modified, or replaced it:
  - We implemented explicit payer support through `payer_id`, improved settlement handling with `from_user` and `to_user`, and added frontend member-based selection instead of raw IDs.
  - For live updates, we chose Server-Sent Events rather than polling and connected them to group/user update flows in the React frontend.
  - We verified the final behavior through manual UI testing, balance/settlement checks, and phase-based validation scripts.
  - The resulting implementation appears in `api/src/index.js`, `web/src/App.jsx`, and is summarized in `project_note.md`.

