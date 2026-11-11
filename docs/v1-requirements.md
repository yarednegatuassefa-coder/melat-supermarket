# Melat V1.0 Requirements

## Operating model
- One physical store.
- Functional currency: ETB.
- Interface languages: English and Amharic.
- Roles: owner, manager, cashier and inventory clerk.
- Customer credit sales are disabled. Every sale must be paid immediately.

## POS and payments
- Accept cash, CBE, Telebirr and card.
- Support split tenders across supported methods.
- Cash is recognized at checkout.
- Electronic payments are not treated as received until verified/settled; pending payments cannot close a sale as paid.
- Generate printable receipts.
- Refunds must reference the original sale and preserve an audit trail.
- Returned goods must be inspected before they are returned to sellable stock.

## Inventory and costing
- Maintain an auditable inventory movement ledger.
- Use perpetual weighted-average cost (WAC) for financial COGS.
- Use FEFO physical batch selection when expiry dates apply.
- Preserve batch acquisition cost and snapshot the applicable WAC at sale.
- Inventory ledger movements and the stock projection must update atomically.
- Every adjustment, transfer-like movement, receipt, sale, return and write-off must have a reason and traceable source.

## Purchasing and suppliers
- A purchase order does not increase on-hand inventory.
- Goods receipt increases inventory.
- Supplier invoice records the liability and applicable recoverable tax.
- Supplier payment reduces accounts payable.
- Do not count the same purchase twice.
- Supplier returns decrease stock and adjust the related supplier liability with traceable documents.

## Cash and accounting
- Expected drawer = opening cash + cash received - cash refunds - cash expenses - withdrawals - bank deposits.
- Use balanced double-entry journals.
- Keep revenue, VAT/tax, COGS, inventory, cash, electronic clearing and accounts payable distinct.
- Corrections use traceable reversals or adjustments; do not silently overwrite posted financial history.
- Tax rates and tax treatment are configurable and must be confirmed by the business accountant; do not assume one universal rate.

## Security and continuity
- Enforce role-based access on the server, not only in the UI.
- Store passwords using a modern password-hashing algorithm.
- Require stronger authentication controls for privileged roles where supported.
- Record audit history for sensitive actions.
- Encrypt offsite backups and test restoration.
- Do not store card numbers or sensitive payment credentials.

## Out of scope for V1.0
- Customer credit, receivables and credit limits.
- Customer loyalty.
- Multiple branches.
- Native mobile application.
- AI-generated financial decisions.
- Advanced forecasting.

## Acceptance gates
A feature is not complete until relevant automated tests prove its behavior. At minimum:
- Journal entries balance.
- Stock ledger reconciles to stock projection.
- Purchase order, goods receipt and invoice do not double-count stock.
- Split payments reconcile to the sale total.
- Pending electronic payments are not counted as settled money.
- Cashier close matches the drawer formula.
- Refunds reverse the correct revenue, tax and cost entries.
- Supplier returns adjust stock and liability correctly.
- Bank reconciliation uses independent statement data.
- Role permissions are enforced server-side.
- Backup restoration is tested.
