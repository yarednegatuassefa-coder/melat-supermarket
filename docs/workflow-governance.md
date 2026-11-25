# Melat Supermarket Workflow Governance

This project follows the portfolio [Workflow Quality and Evaluation Standard](https://github.com/yarednegatuassefa-coder/home/blob/main/standards/workflow-quality.md), supplemented by the Melat-specific invariants in `AGENTS.md`, business rules and acceptance plan.

## Priority workflows

| Workflow | Required invariant | Primary measures |
|---|---|---|
| POS sale and tender | Sale posts atomically; split tenders equal the sale total; unsettled electronic tenders are not cash received | Posting success, tender variance, void/refund rate |
| Inventory ledger | Movement and stock projection update atomically; every change is traceable | Inventory accuracy, adjustment rate, stockout rate |
| Goods receiving | Purchase order does not move stock; goods receipt moves stock exactly once | Receiving discrepancy, duplicate receipt rate |
| Supplier invoice/payment | Liability and settlement are distinct from physical receipt; approval and audit trail retained | Invoice match rate, payable aging, payment variance |
| Cash drawer close | Expected balance follows the documented reconciliation equation | Cash variance per shift, unresolved variance age |
| Costing and pricing | WAC is used for financial valuation; FEFO is used for physical batch selection where applicable | Margin by SKU, costing exceptions, expiry loss |
| Returns and refunds | Refund references original sale, is capped at refundable amount and reverses appropriate entries | Refund exception rate, reconciliation variance |

## Evaluation gates

- Use synthetic fixtures and a disposable PostgreSQL test database.
- Test balanced journals, exact ETB arithmetic, split-tender mismatch, duplicate posting, concurrent sale/stock updates, duplicate receiving, refunds above refundable value, FEFO selection and WAC recalculation.
- Test cash reconciliation against the documented formula and ensure pending CBE/Telebirr/card tenders are not counted as settled cash.
- Verify audit history and role denial for each financially material operation.
- Require store-machine acceptance evidence separately from CI results.

## Approval boundaries

AI may summarize approved aggregate reports or draft explanations. It must not autonomously post journals, alter stock, settle tenders, approve purchases, change supplier balances, issue refunds or make financial decisions. Production migrations, backups/restores, deployment and destructive operations require explicit human authorization.

## Measurement

Use gross margin, stockout rate, inventory accuracy and turnover, shrinkage/expiry loss, cash variance, reconciliation exceptions and supplier-payment timeliness. Define formulas and source records before reporting. Never send customer, supplier, employee, payment or transaction-level records to external agents.

## Current implementation status

This is a workflow evaluation plan, not evidence that each workflow is implemented or accepted. Track test evidence, store acceptance and unresolved exceptions in the project harness.
