# Initial data model notes

## Source-of-truth records

- Inventory movement ledger records every stock event. `inventory_balances` is a transactionally maintained projection, not an independent source of truth.
- Batch balances support physical FEFO picking. Financial cost of goods sold uses the sale-line WAC snapshot, not the batch's historical acquisition cost.
- Purchase orders are commitments. Goods receipts record physical arrival. Supplier invoices establish liabilities. Supplier payments settle allocated liabilities.
- Sales and sale tenders are separate so split tender is supported. Pending electronic tender is not settlement.
- Journal entries and lines are the accounting record. Posted journal entries must be immutable and balanced.
- Audit log records actor, action, entity and before/after snapshots.

## Important transaction boundaries

A sale posting transaction must lock affected product balances, validate available stock, allocate eligible FEFO batches, snapshot WAC, write sale lines and confirmed tenders, write inventory movements, update balances, and post balanced journal entries atomically.

A goods receipt transaction must create/attach batches, write receipt movements, update stock balances and recalculate WAC atomically. A purchase order must not create stock movements. Supplier invoice posting must not create a second receipt.

A supplier payment transaction must lock the supplier invoices being allocated, reject allocations exceeding outstanding balances, record confirmed payment and post the corresponding journal.

## Items requiring implementation-level controls

PostgreSQL CHECK constraints cannot validate totals across child rows. Domain services must enforce:
- journal debit total equals credit total before posting;
- confirmed sale tenders equal sale total before sale completion;
- supplier payment allocations do not exceed payment or invoice outstanding amount;
- refund totals do not exceed original sale refundable balance;
- sum of inventory movements equals the balance projection;
- FEFO allocations follow expiry-date order where expiry tracking applies.

Use SERIALIZABLE transactions or explicit row locks and unique idempotency references for concurrent posting paths. Retry serialization failures safely.
