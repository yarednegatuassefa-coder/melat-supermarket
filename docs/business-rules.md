# Business Rules and Invariants

## Sales
- A sale is paid in full at checkout; customer credit is not supported.
- Sum of confirmed tender allocations must equal the amount due.
- Cash tender is recorded as cash received.
- Electronic tender is only recognized as settled after verification; pending status is not settlement.
- A sale cannot be posted twice. Use an idempotency key and unique posting reference.
- A refund must reference the original sale and cannot exceed the refundable balance.

## Inventory
- Stock on hand is derived from the posted movement ledger.
- A sale consumes stock and posts COGS in one transaction.
- WAC is the financial costing method. FEFO determines which eligible physical batch is picked where expiry tracking applies.
- A stock adjustment requires a reason, actor and timestamp.
- A return is not sellable until inspected and explicitly dispositioned.

## Purchasing
- Purchase order: commitment only; no stock increase and no supplier liability by itself.
- Goods receipt: physical stock increase.
- Supplier invoice: payable and applicable tax recognition; it must link to receipt(s).
- Supplier payment: reduces payable; it does not change inventory.
- Supplier return: reduces stock and adjusts payable/credit note balance.

## Cash control
Expected closing drawer:
opening cash + cash sales received + other cash in - cash refunds - cash expenses - withdrawals - bank deposits.
Non-cash tenders are reconciled separately against provider/bank settlement records.

## Accounting
- Every posted journal entry must balance: total debits = total credits.
- Posted entries are immutable; correct with reversal and replacement entries.
- Tax configuration is effective-dated and accountant-approved.
- Financial reports use posted journal entries, not UI totals or unverified payment intents.
