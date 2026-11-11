# Melat Supermarket Management System

A single-store management and point-of-sale system for Melat Supermarket in Addis Ababa, Ethiopia.

## V1.0 scope

- One store; ETB currency; English and Amharic interface.
- Roles: owner, manager, cashier, inventory clerk.
- Point of sale with immediate payment, split tenders and printable receipts.
- Payment methods: cash, CBE, Telebirr and card.
- Inventory ledger with perpetual weighted-average costing (WAC).
- FEFO batch selection where expiry dates apply.
- Purchasing, goods receiving, supplier invoices, supplier payments and supplier returns.
- Cash drawer reconciliation, expenses, accounting journals and operational reports.
- Auditable corrections, role-based permissions, backup and restore procedures.

## Explicit exclusions

Customer credit and receivables, multi-branch support, customer loyalty, native mobile apps, AI financial decisions and advanced forecasting are not part of V1.0.

## Architecture

- `client/`: React + TypeScript browser application.
- `server/`: Node.js + TypeScript API (modular monolith).
- `database/`: PostgreSQL schema and versioned migrations.
- `docs/`: architecture, business rules, operations and acceptance tests.

The initial deployment target is a local-network application. Vercel may be used for preview builds or selected web components, but it is not the production POS server or authoritative database. POS operation must not depend on external internet when the local server and LAN are available.

## Development status

This repository contains the approved project baseline and architecture. Features are not considered implemented until code, automated tests and acceptance evidence exist.

## Security

Do not commit passwords, API keys, database dumps, customer data, production credentials or real payment credentials. Use `.env.example` as a template and keep actual `.env` files untracked.

## Project decisions

- [V1 requirements](docs/v1-requirements.md)
- [Architecture](docs/architecture.md)
- [Business rules](docs/business-rules.md)
- [Acceptance plan](docs/acceptance-plan.md)
