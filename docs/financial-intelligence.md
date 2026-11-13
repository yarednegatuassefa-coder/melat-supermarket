# Melat Financial Intelligence

## Purpose

The Financial Intelligence workspace is an owner/manager-only, read-only analysis surface over Melat's existing local PostgreSQL accounting ledger.

It reports:
- Monthly posted revenue, COGS, operating expenses, net result and net movement across cash / settlement accounts.
- Supplier invoice exposure, calculated from confirmed supplier-payment allocations.
- Repeated expense descriptions across multiple months.
- Rule-based signals for material revenue changes, negative recorded results and recurring expense increases.

## Data boundary

The local Melat PostgreSQL database remains the only authoritative transaction ledger. The feature does not copy records to Neon, Vercel, Google Wallet, Plaid or an external AI provider. The API requires an authenticated owner or manager session.

The feature is read-only: it does not create, edit, approve, reverse or pay financial transactions. All financial postings continue through the existing audited operations.

## Interpretation rules

- Only posted journal entries are included in revenue, COGS, expense and cash movement analysis.
- Revenue is the net credit balance of revenue accounts.
- COGS is the debit balance posted to account code 5000.
- Expenses are the debit balance of expense accounts.
- Net result is revenue less all posted expense-account debits. It is not a tax filing or audited profit figure.
- Net cash movement is the net debit/credit movement across accounts 1000, 1010, 1020 and 1030. It is not a reconciled bank balance.
- Supplier exposure is posted and partly-paid supplier invoices less allocations from confirmed supplier payments.
- Recurring-cost detection groups expense journal entries by normalized description. Inconsistent descriptions can split one supplier cost into multiple groups.
- Alerts are transparent threshold-based rules, not machine-learning forecasts.

## Operational prerequisites

1. Use a current backup and a separate test database for validation.
2. Apply the feature to the local store installation only after the API build and integration tests pass against the exact local schema.
3. Verify role access with owner, manager, cashier and inventory-clerk accounts.
4. Reconcile the dashboard against the trial balance, P&L, supplier invoice register and bank/cash records.
5. Obtain owner acceptance before using it for management decisions.

## Future extension

A future AI explanation layer may summarize these already-computed metrics, but only after a privacy review and explicit approval of the data-processing boundary. Raw transaction data must not be sent to a third-party model by default.
