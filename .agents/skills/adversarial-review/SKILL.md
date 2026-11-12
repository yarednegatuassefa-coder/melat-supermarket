---
name: adversarial-review
description: Independently review Melat changes for correctness, security, accounting integrity and regressions.
---

# Adversarial review

Review the proposed diff in a fresh context. Do not treat the builder's explanation or green tests as proof.

Prioritize:
1. Money arithmetic, tax classification, balanced journals and reversal correctness.
2. Inventory ledger/projection consistency, WAC snapshots, FEFO eligibility and concurrent stock depletion.
3. Purchase order / receipt / invoice separation and duplicate posting.
4. Pending versus settled payments, split tender totals, cash drawer and bank reconciliation.
5. API authorization, session handling, input validation, SQL safety, secrets and audit-log privacy.
6. Migration safety, idempotency, transaction boundaries, error handling and rollback/recovery.
7. User-visible regressions and missing tests.

For each finding provide severity (critical/high/medium/low), exact file and line, realistic trigger/preconditions, impact, and a concrete fix. Distinguish confirmed defects from questions or hypotheses. Do not manufacture findings to fill a quota. If no material issue is found, state review scope and limitations.

Do not approve deployment. If a safe execution sandbox is unavailable, perform source-only review and mark runtime behavior as unverified.
