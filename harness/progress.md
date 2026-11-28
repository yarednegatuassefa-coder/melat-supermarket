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

## 2026-11-25 — HARN-005
- **Objective:** Remove binary floating-point arithmetic from cash drawer availability and close variance calculations.
- **Branch:** feature/apply-workflow-quality
- **Changed:** Cash drawer service now aggregates exact 1/10,000 ETB units using BigInt; availability checks compare exact units; drawer close persists exact expected cash and variance strings; added regression tests for a 0.0001 ETB boundary and cash-only settlement filtering; updated PostgreSQL integration expectation.
- **Verification:** Pending GitHub Actions for domain tests, disposable PostgreSQL integration and build. No local project runtime was available in this operation.
- **Not run / blocked:** No store PC, production database, migration, financial posting, deployment or live cash drawer was accessed.
- **Approval boundary:** Store acceptance remains owner-led; no financial transaction was created.
- **Next action:** Review CI results and independent diff review before merge; then perform owner-led store acceptance on the local-first installation.

## 2026-11-28 — LETTER5-PILOT-002
- **Objective:** Add a reviewed, draft-only aggregate-report summary seam without allowing AI to calculate or mutate the accounting, payment or inventory ledger.
- **Branch:** feat/letter-5-ai-resilience
- **Changed:** `server/src/domain/aggregate-summary-pilot.ts` and its synthetic tests; allowlisted report facts, period/source requirements, pending-tender exclusion, review markers and action-claim refusals.
- **Verification:** `npm run harness:check` passed. Targeted synthetic tests are runnable through the repository’s normal `tsx` test command when dependencies are installed; this checkout lacks the local runtime dependency, so direct Node source execution was not available for the `.js` ESM import convention.
- **Not run / blocked:** `npm test`, `npm run build` and `npm run architecture:check` require the repository’s declared dependencies and/or an isolated PostgreSQL test database. No store database, financial posting, migration, provider, paid API or production data was accessed.
- **Decision:** Keep this policy seam disconnected from authoritative reports and write paths until CI and owner/accountant review are complete.
- **Next action:** Review CI results and perform independent financial/inventory safety review before any integration.
