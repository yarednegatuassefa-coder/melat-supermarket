# Agent Code-Mode Architecture — Melat Supermarket

Status: architecture target; no AI authority over the store ledger is introduced.

## Workflow boundary
Use the Home portfolio [Code-Mode Agent Engineering Standard](https://github.com/yarednegatuassefa-coder/home/blob/main/standards/code-mode-agent-engineering.md). Preserve Melat's local-first architecture: the store's local PostgreSQL/API is authoritative; Vercel remains a static preview and must not become a second writable ledger.

## Apply the pattern
- Keep POS posting, tax, exact ETB arithmetic, weighted-average cost, FEFO, stock movements, cash reconciliation, journals, refunds and supplier liabilities entirely deterministic.
- For any future assistant, expose narrow read-only aggregate tools for approved inventory, sales, purchasing and cash reports.
- Filter and aggregate inside local server/database code; do not transfer transaction-level records or full ledgers to a model.
- Keep offline operation independent of cloud model availability.
- Poll backup/restore or import jobs with bounded code loops; never let an agent trigger a destructive restore or database reset.

## Privacy and safety
- Never expose customer, employee, supplier, payment, transaction or financial records to external models by default.
- AI may summarize approved aggregates or draft operational hypotheses only. It must never post journals, adjust stock, approve refunds, settle tenders, set tax treatment or make financial decisions.
- Any write remains behind role authorization, explicit human confirmation and audit trail.
- No cloud database is added as a second writable store.

## Verification
Test with disposable PostgreSQL only. Verify exact-money invariants, balanced journals, stock atomicity, idempotency, role denial, bounded report output and offline operation. Store-machine and owner acceptance remain separate from code-mode tests.
