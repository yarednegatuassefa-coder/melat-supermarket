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
The first production target is a small, reliable local server on the store LAN with PostgreSQL on that server or a securely managed database reachable over the LAN. Workstations access the app through the LAN. External internet is not required for browser-to-local-server POS traffic. Remote access, if later needed, must use a secure VPN or controlled gateway.

Vercel is suitable for preview deployments, documentation or a separate public-facing site. It is not the default host for the authoritative LAN database or offline-resilient in-store POS.

## Security baseline
- Server-side authorization for every protected operation.
- Parameterized SQL and strict input validation.
- Secure password hashing and session handling.
- CSRF protection where cookie-based sessions are used.
- Rate limits on authentication endpoints.
- Audit records for privileged and financial actions.
- Secrets only in environment variables or a managed secret store.
