# Architecture

## Shape
Use a modular monolith: one API application with clear domain modules and one browser client. Avoid microservices, Redis, RabbitMQ and Electron in V1.0 unless measured requirements later justify them.

## Components
- Client: React + TypeScript + Vite.
- API: Node.js + TypeScript; HTTP REST endpoints; validation at API boundaries.
- Database: PostgreSQL; migrations are version-controlled and applied deliberately.
- Tests: unit tests for domain rules, integration tests against PostgreSQL, API tests and end-to-end acceptance tests.

## Domain modules
1. Identity and access control
2. Product catalogue and units
3. Inventory ledger and batches
4. Suppliers and purchasing
5. Goods receiving and supplier invoices
6. POS sales and tenders
7. Refunds and supplier returns
8. Cash sessions and expenses
9. Accounting journal and reconciliation
10. Reporting and audit

## Transaction boundaries
Operations that affect money and stock must be committed in a single database transaction where they represent one business event. Use database constraints and idempotency protections to prevent duplicate posting. Posted financial events are corrected by reversal/adjustment, not destructive edits.

## Deployment
The authoritative production target is a local store server with PostgreSQL and the API on the same machine. The API binds to loopback and is exposed to trusted store devices only through a local HTTPS reverse proxy (Caddy). Workstations access the application through the LAN. Browser-to-local-server POS traffic does not require external internet.

Vercel is a static interface preview only. Its API route returns an explicit 503 local-only response and must never import the store API, receive the store database URL, or become a second writable ledger. Neon is not part of the live transaction path. Remote access, if later required, must use a separately reviewed VPN or controlled gateway; do not expose PostgreSQL or the API directly to the internet.

## Security baseline
- Server-side authorization for every protected operation.
- Parameterized SQL and strict input validation.
- Secure password hashing and session handling.
- HTTPS for LAN browser traffic; secure, HTTP-only session cookies behind the HTTPS proxy.
- Proxy trust is disabled unless the explicitly configured local reverse proxy is used.
- CORS must remain allowlisted; do not use wildcard credentialed CORS.
- Rate limits on authentication endpoints.
- Audit records for privileged and financial actions.
- Secrets only in the server/.env file or a managed secret store.
