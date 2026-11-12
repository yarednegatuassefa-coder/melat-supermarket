# Melat agent operating instructions

## Mission
Build a dependable, auditable, single-store retail system for Melat Supermarket in Addis Ababa. Optimize for correct money, stock and operational records—not code volume or visual polish.

## Source of truth
Before changing code, read the relevant parts of:
- `docs/v1-requirements.md`
- `docs/business-rules.md`
- `docs/architecture.md`
- `docs/acceptance-plan.md`
- `docs/engineering-standards.md`

Existing code and migrations are authoritative for current implementation; documented requirements are authoritative for intended behavior. If they conflict, stop and report the conflict rather than silently choosing.

## Non-negotiable business invariants
- Currency is ETB. Store money in exact decimal/minor-unit representations; never use binary floating-point for monetary calculations.
- Every posted journal entry balances (total debits = total credits).
- Purchase orders do not change stock. Goods receipts change stock once. Supplier invoices establish liabilities; they must not receive stock a second time.
- Perpetual weighted-average cost (WAC) is the financial valuation method. FEFO is the physical batch-picking rule where expiry applies. Preserve batch acquisition costs and snapshot cost at sale.
- A sale is not complete until the full amount is confirmed as paid. Pending CBE, Telebirr or card tenders are not settled cash and must not be represented as received funds.
- Split tender allocations must equal the sale total. Posting must be idempotent.
- Refunds reference the original sale, cannot exceed the refundable amount and reverse the appropriate tax, revenue and cost. Inspect returned goods before restocking.
- Cash drawer expected balance = opening cash + cash received − cash refunds − cash expenses − withdrawals − bank deposits.
- Inventory movements and their authoritative stock projection must be updated atomically and remain traceable.
- Tax treatment is configurable and must be confirmed by the accountant; never hardcode a universal VAT rate.
- Customer credit, receivables, loyalty, multi-branch, AI financial decisions and unapproved enterprise scope are excluded from V1.

## Required task protocol
1. Inspect the repository and relevant tests before proposing a change.
2. Write a short task spec: objective, business reason, constraints, out-of-scope items, acceptance criteria and verification command(s).
3. Identify data migration, security, accounting, concurrency and rollback risks before implementation.
4. Make the smallest coherent change. Do not refactor unrelated code or expand scope without an explicit reason.
5. Add or update tests before/with implementation. Financial, inventory, auth and permission changes require PostgreSQL integration coverage where practical—not only mocks.
6. Run the relevant tests, then `npm test` and `npm run build` for meaningful application changes. Run the Windows package validation workflow when changing installer/package files.
7. Request an independent review in a fresh context. The reviewer should focus on correctness, security, data integrity and regressions, not style. Resolve or explicitly document every material finding.
8. Report changed files, commit/PR, commands run, pass/fail evidence, known gaps and anything not verified.

## Hard boundaries
- Never run migrations against a production database or any database not explicitly identified as disposable/test without human approval.
- Never deploy to production, change production secrets, delete data, force-push, rewrite history or run destructive database commands autonomously.
- Never add real credentials, personal/customer data, database dumps or payment credentials to the repository.
- Do not claim a feature, security control, backup, restore, deployment or acceptance test works unless it was actually exercised and evidence is available.
- If no OS-enforced sandbox is available, do source-only security review; do not execute untrusted repository-controlled code as part of the audit.
- Keep production readiness separate from CI green status. Human acceptance and store-machine verification remain required.

## Verification commands
From repository root:
- `npm test` — domain and PostgreSQL integration tests (requires test DB configuration used by CI).
- `npm run build` — API and client production builds.
- GitHub Actions `Melat CI` — authoritative hosted PostgreSQL test/build and Windows bundle validation.

If a command cannot run in the current environment, state that plainly. Never substitute an assumed pass.
