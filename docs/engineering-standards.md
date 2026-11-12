# Engineering standards and agent workflow

## Definition of done
A change is done only when all applicable conditions hold:
1. The behavior maps to an approved requirement and has explicit acceptance criteria.
2. Automated tests cover expected behavior, important edge cases and relevant failure paths.
3. Database changes are forward-only migrations with safe ordering, constraints and documented rollback/recovery considerations.
4. Authorization is enforced by the API, not merely hidden in the UI.
5. Logs and audit records do not expose passwords, tokens, secrets or unnecessary customer data.
6. CI tests and builds pass, and an independent reviewer has checked material changes.
7. The handoff states what was tested and what remains unverified.

## Change sizing
- Keep pull requests focused and reviewable. Prefer one business capability or tightly coupled correction per PR.
- Avoid overlapping parallel work. Define file/API/schema ownership before delegating.
- Prototype competing designs in isolated branches/worktrees when uncertainty is material; compare behavior and maintenance cost before choosing.
- Do not introduce a dependency, service, framework or infrastructure change without explaining the operational benefit and ongoing cost.

## Data and accounting controls
- Treat posted financial and inventory records as append-only facts. Correct errors with explicit reversals/adjustments, not silent mutation.
- Use database transactions for multi-record posting. Protect against duplicate requests and concurrent stock depletion with database constraints, locking and idempotency.
- Validate quantities, prices, totals, tax treatment and tender allocations at the API boundary and again where required by database constraints.
- Keep operational state distinct from settlement state. A payment initiation or pending provider status is not proof of settlement.
- Reconciliation reports must compare independently derived totals; do not reconcile a projection against itself.
- Every new journal posting path needs tests for balanced entries and correct account classification.

## Security and privacy
- Apply least privilege and deny-by-default authorization.
- Validate and normalize untrusted input. Use parameterized SQL.
- Protect sessions and privileged actions; never log authentication material.
- Review dependency changes, file uploads, process execution, secrets handling and network exposure.
- For a security audit, separate confirmed exploitable findings from hypotheses and configuration-dependent risks. Include file/line evidence, impact, prerequisites and remediation.
- Do not execute untrusted project code during an audit unless an OS-enforced sandbox is available.

## UI and workflow validation
- For UI changes, prefer browser-level Playwright tests for critical user paths when the environment supports them.
- Include evidence for empty, loading, validation-error, permission-denied and success states where relevant.
- Screenshots are supporting evidence, not substitutes for assertions about data and behavior.

## Agent review protocol
- Builder: implements against the spec and supplies test evidence.
- Fresh reviewer: receives the diff, requirements and relevant tests, but not the builder's narrative as proof. It challenges assumptions and looks for defects.
- Adjudication: builder addresses each finding; unresolved issues are explicitly escalated.
- Human owner: approves business policy, security boundaries, production release and irreversible operations.

## Required completion report
Use this structure:
- **Outcome:** what changed and why.
- **Evidence:** exact commands/workflows and results.
- **Review:** independent reviewer findings and dispositions.
- **Risks/gaps:** what is not verified or remains incomplete.
- **Release status:** PR/branch only, preview, or explicitly approved production release.
