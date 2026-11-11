# V1.0 Acceptance Plan

## Foundation
- [ ] Fresh database can be created from migrations.
- [ ] Migrations can be applied in order and schema version is recorded.
- [ ] Automated test database is isolated from development data.

## Identity and permissions
- [ ] Owner, manager, cashier and inventory clerk permissions are explicit.
- [ ] API rejects unauthorized actions even if called outside the UI.
- [ ] Passwords are never stored in plaintext.
- [ ] Sensitive actions are audit logged.

## Purchasing and stock
- [ ] Purchase order does not increase on-hand quantity.
- [ ] Goods receipt increases stock exactly once.
- [ ] Supplier invoice creates liability without duplicate stock.
- [ ] WAC recalculates correctly after receipts and approved adjustments.
- [ ] FEFO chooses the earliest eligible expiry batch.
- [ ] Ledger totals reconcile with stock projection.
- [ ] Supplier returns decrease stock and adjust payable correctly.

## POS and cash
- [ ] Sale requires full confirmed payment; no customer credit path exists.
- [ ] Split tender allocations equal the sale amount.
- [ ] Pending electronic payments do not count as settled.
- [ ] Sale posting is idempotent.
- [ ] Receipt can be printed.
- [ ] Refund references original sale and cannot exceed refundable amount.
- [ ] Cash drawer expected balance follows the documented formula.
- [ ] Cashier close variance is recorded and reviewed.

## Accounting and reporting
- [ ] Every journal entry balances.
- [ ] Revenue, tax, COGS, inventory, cash, clearing and payables are separated.
- [ ] Refunds reverse the appropriate revenue, tax and cost.
- [ ] Bank reconciliation compares internal records with independent statements.
- [ ] Reports derive from posted records.

## Operations
- [ ] Backup is encrypted and stored offsite.
- [ ] Restore procedure is documented and tested.
- [ ] LAN POS works when external internet is unavailable but local server is available.
