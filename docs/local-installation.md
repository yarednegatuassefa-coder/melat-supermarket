# Melat local-network installation and operations

## Deployment model

The authoritative point-of-sale system runs on the store's local network. The Vercel site is a preview/API deployment only; it is not the store's system of record and must not hold live inventory, customer, supplier or payment data.

The production topology is:
- One always-on store computer runs PostgreSQL and the Melat Node API.
- The API serves the compiled React client on the same host.
- Cashier and owner devices access the application through the store LAN using the local HTTPS hostname.
- The PostgreSQL port is never exposed to the LAN or public internet; only the API is reachable by staff devices.

The POS remains available during an external internet outage only while the local server, LAN, power and database remain operational. It is not a browser-only offline application.

## Requirements

- Windows 10/11 or supported Linux server
- Node.js 22 LTS
- PostgreSQL 15+ (PostgreSQL 18 target)
- Caddy reverse proxy for local HTTPS
- UPS-backed server and router
- age encryption utility and PostgreSQL client tools for encrypted backups

## First-time setup

On Windows, the repository includes a guided bootstrap script. From the repository root, run `powershell -ExecutionPolicy Bypass -File .\\scripts\\setup-local-melat.ps1`. It prompts for the existing PostgreSQL application password and a new owner password without printing them, then installs dependencies, builds, applies migrations, creates the first owner and starts the local UI. It writes the root `.env` file used by both the migration runner and API, and refuses to overwrite an existing `.env`.

1. Create a dedicated empty PostgreSQL database named melat and a least-privilege role named melat_app.
2. If configuring manually, copy `.env.example` to the repository-root `.env`. Set the real DATABASE_URL, owner name and a unique initial owner password. Never commit this file.
3. From the repository root run npm install, then npm run build.
4. Apply migrations only to the dedicated Melat database: npm run db:migrate --workspace server.
5. Bootstrap the first owner once: npm run db:bootstrap --workspace server. Remove OWNER_INITIAL_PASSWORD from the environment immediately after the account is created.
6. Configure Caddy using deploy/Caddyfile. Map melat.local to the server's LAN IP in the router DNS or each client device. Install Caddy's local root certificate on each trusted device.
7. Start the API from the repository root with npm run start --workspace server. It serves the UI and API on port 4000. Configure Windows Task Scheduler or a Linux service manager to start it after PostgreSQL.
8. Allow inbound HTTPS from the store LAN only. Do not expose PostgreSQL port 5432.
9. Open https://melat.local, sign in as owner and immediately replace the temporary password.
10. Create staff accounts with least-privilege roles and test a sale/refund/close sequence with training products before loading live stock.

## HTTPS and cookies

Caddy terminates TLS and reverse-proxies to 127.0.0.1:4000. Set COOKIE_SECURE=true in the server environment. Do not use plain HTTP for staff logins. The Caddy internal CA root certificate must be trusted on every workstation/tablet that accesses the system.

## Database migrations

Migrations are numbered and recorded in schema_migrations. Run them only against the dedicated Melat database. Back up the database before applying migrations to any database containing business data. Never point the migration runner at the unrelated command database.

## Backup and restore

1. Create an age public/private key pair. Keep the private identity offline and the public recipient on the server.
2. Set BACKUP_AGE_RECIPIENT and DATABASE_URL in the root `.env`, then run scripts/backup-melat.ps1.
3. Copy the encrypted .dump.age file and its .sha256 file to independent offsite storage. Do not treat a second folder on the same computer as offsite.
4. For a restore drill, set DATABASE_ADMIN_URL and BACKUP_AGE_IDENTITY_FILE, then run scripts/restore-test-melat.ps1 -EncryptedBackup <file> -RestoreDatabase melat_restore_test.
5. The restore script refuses any target name other than melat_restore_test and never drops an existing database. Inspect the restored schema and row counts before declaring the drill successful.
6. Register the daily 8:00 PM Windows backup task with `powershell -ExecutionPolicy Bypass -File .\\scripts\\register-backup-task.ps1` (the current user must be logged in). Record the drill date, backup age, checksum, table counts and restore duration in the operations log.

A script is provided; a restore is not considered tested until the store operator has run the drill successfully against a real backup. No backup is created or uploaded by the Vercel preview.

## Security

- Use unique passwords of 16+ characters.
- Restrict PostgreSQL to localhost.
- Firewall the API to the trusted LAN and expose it through HTTPS only.
- Do not expose the API or database directly to the public internet.
- Store encryption private keys separately from the backup host.
- Do not use real customer/payment data in preview environments.

## Current implementation boundary

The repository now contains API foundations for authentication, products, stock receipts, POS checkout, split tenders, payment verification, receipt printing, cash sessions, cash movements, suppliers, purchase orders, supplier invoices/payments/returns, tax configuration, refunds, stock adjustments, expenses, accounting reports and bank-statement matching.

These modules still require the PostgreSQL integration suite and store acceptance tests to pass. The Vercel deployment does not have a configured production database or owner account. Do not use it for live transactions. The local install and encrypted restore scripts are committed, but the restore drill has not yet been executed.
