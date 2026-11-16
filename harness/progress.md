# Melat Harness Progress

## 2026-11-16 — HARN-BASELINE
- **Objective:** Establish a domain-aware harness with durable state and explicit database isolation.
- **Branch / commit:** feat/portfolio-harness-engineering
- **Changed:** harness/README.md, harness/feature-list.json, harness/progress.md; executable preflight and CI gate are included in this change set.
- **Verification:** Pending GitHub Actions on the pull request.
- **Not run / blocked:** No store database, local PostgreSQL or Windows installation was accessed or tested.
- **Decisions:** CI database must remain disposable; live store migrations and acceptance require separate approval.
- **Risks / approvals:** Financial correctness, inventory atomicity, payment settlement and restore remain high-risk.
- **Feature ledger updates:** Initial harness adoption tasks recorded.
- **Next action:** Verify CI evidence, then complete owner-led store acceptance and restore testing.
