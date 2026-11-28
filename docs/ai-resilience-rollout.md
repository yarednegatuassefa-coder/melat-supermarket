# Melat Supermarket AI and Resilience Rollout

## Approved pilot: aggregate operations summary

**Mode:** reviewed copilot, synthetic or approved aggregate data only.

**Purpose:** draft explanations of approved aggregate reports such as stockout counts, expiry-loss totals, gross-margin trends and cash-variance summaries.

**Authoritative sources:** deterministic reports produced by the POS/ERP. The model must not calculate the ledger of record or infer missing transactions.

**Allowed output:** a draft narrative with report period, source report identifiers and explicit limitations for owner/manager review.

**Forbidden actions:** post journals, alter stock, settle tenders, approve purchases, change supplier balances, issue refunds, modify permissions or write to production data.

**Failure path:** the underlying reports remain available without AI. Model failure, stale data or ambiguous totals produces a visible “review required” result rather than a retry loop.

**Evaluation cases:** balanced report summary, conflicting totals, pending electronic tender exclusion, missing report period, prompt injection in a product name and provider timeout.

**Measures:** summary correction rate, time to review, unsupported-claim rate, cost per approved summary and reconciliation exceptions discovered by review.

## Existing resilience to preserve

Keep local-first PostgreSQL authority, atomic sale/inventory operations, WAC/FEFO rules, role permissions, audit trails, backup/restore procedures and store acceptance evidence. No cloud AI dependency may become a second writable ledger.
