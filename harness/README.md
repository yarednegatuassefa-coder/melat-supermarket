# Melat Harness

## Initialization
1. Read AGENTS.md and this guide.
2. Read docs/v1-requirements.md, docs/business-rules.md, docs/architecture.md, docs/acceptance-plan.md and docs/engineering-standards.md.
3. Inspect branch/status and relevant migrations/tests.
4. Read feature-list.json and latest progress entry.
5. Check Node/npm versions, dependencies and TEST_DATABASE_URL presence without printing its value.
6. Use only disposable PostgreSQL test databases. Never point automated tests at the store database.

## Commands
- npm run harness:check
- npm test — domain and PostgreSQL integration tests (requires isolated TEST_DATABASE_URL).
- npm run build — server and client production builds.

## Domain gates
- ETB monetary arithmetic must use exact decimal/minor-unit representations.
- Journal entries must balance; inventory ledger and projections must update atomically.
- Goods receipt changes stock once; supplier invoice must not duplicate stock.
- Pending electronic payments are not settled cash.
- Split tender, sale posting and refunds must be idempotent and traceable.
- FEFO picking and weighted-average-cost valuation are distinct rules.
- Never apply migrations, seeds, resets, destructive commands or load tests to production/shared databases.
- Backup and restore are not proven until a restore has actually been tested.
- V1 acceptance requires store-machine and owner acceptance; CI success is not production readiness.

## Task closure
Record exact commands, database isolation evidence, results, unrun checks and rollback plan in progress.md. Do not mark a financial/inventory feature verified from mocked tests alone when PostgreSQL integration coverage is required.
