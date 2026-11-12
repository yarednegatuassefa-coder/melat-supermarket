# Melat Supermarket Management System

A single-store management and point-of-sale system for Melat Supermarket in Addis Ababa, Ethiopia.

## V1.0 scope

- One store; ETB currency; English interface with Amharic product-name fields. Full Amharic UI localization remains outstanding.
- Roles: owner, manager, cashier, inventory clerk.
- Point of sale with immediate payment, split tenders and printable receipts.
- Payment methods: cash, CBE, Telebirr and card.
- Inventory ledger with perpetual weighted-average costing (WAC).
- FEFO batch selection where expiry dates apply.
- Purchasing, goods receiving, supplier invoices, supplier payments and supplier returns.
- Cash drawer reconciliation, expenses, accounting journals and operational reports.
- Auditable corrections, role-based permissions, backup and restore procedures.

## Explicit exclusions

Customer credit and receivables, multi-branch support, customer loyalty, native mobile apps, AI financial decisions and unapproved enterprise scope are not part of V1.0.

## Architecture and deployment

The authoritative production system is **local-first**: PostgreSQL and the API run on a dedicated store PC, and cashier devices connect over the store LAN through HTTPS. In-store transactions do not depend on Vercel, Neon or public internet connectivity.

Vercel hosts a static interface preview only. Its API route deliberately returns HTTP 503 and never connects to the store database. Do not configure a cloud database as a second writable ledger.

- client/: React + TypeScript + Vite browser application.
- server/: Node.js + TypeScript API (modular monolith).
- database/: PostgreSQL schema and versioned migrations.
- docs/: architecture, business rules, operations and acceptance tests.

See docs/local-deployment.md before installing the system.

## Development status

Features are not considered production-ready until code, automated tests and store acceptance evidence exist. A successful Vercel build is not proof that the store POS is operational.

## Security

Do not commit passwords, API keys, database dumps, customer data, production credentials or real payment credentials. Use .env.example as a template and keep actual .env files untracked.
