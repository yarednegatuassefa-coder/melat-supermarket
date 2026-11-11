# Local installation and operations

## Deployment model

The authoritative POS runs on the store's local network. The browser client and Node API must run on the same trusted LAN as PostgreSQL. A Vercel preview is for reviewing the interface only; it is not a production POS server and must not hold live customer, payment or inventory data.

## Requirements

- Windows 10/11 or Linux server supported by Node.js 22
- PostgreSQL 15 or newer (PostgreSQL 18 is the current tested target)
- Node.js 22 LTS
- A reliable local network and UPS-backed server/router

## First-time setup

1. Create a dedicated empty PostgreSQL database named `melat` and a least-privilege database role.
2. Copy `server/.env.example` to `server/.env`; set DATABASE_URL and a unique initial owner password. Keep this file private.
3. From the repository root, install dependencies with `npm install`.
4. Run `npm run db:migrate --workspace server`.
5. Run `npm run db:bootstrap --workspace server` once to create the first owner. Remove OWNER_INITIAL_PASSWORD from the environment immediately afterwards.
6. Run `npm run dev` for a development session, or build with `npm run build` and start the API with `npm run start --workspace server`.
7. Open the client from the store LAN and sign in. Change the initial password immediately.

## Database migrations

Migrations are numbered and recorded in `schema_migrations`. Run them only against the dedicated Melat database. Back up the database before applying migrations to any database containing business data. Never point the migration runner at the unrelated `command` database.

## Security

- Use a unique password of at least 12 characters; 16+ is recommended.
- Restrict PostgreSQL to localhost and the trusted store LAN.
- Configure a firewall to allow only required LAN traffic.
- Set COOKIE_SECURE=true when serving over HTTPS.
- Do not expose the API or database directly to the public internet.
- Backups must be encrypted and stored offsite; test restoration before relying on them.
- Never use real customer or payment information in preview environments.

## Current functional boundary

The API currently includes login, logout, current-user lookup, owner-created staff accounts, password changes, product/stock lookup, movement history and atomic goods-receipt posting. The complete POS checkout, sales refunds, supplier invoice/AP workflows, cash-session close, bank reconciliation and financial reports are not yet implemented. Do not use this build as the live system of record until the remaining workflows and acceptance tests are complete.
