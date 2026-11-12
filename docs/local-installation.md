# Melat local-network installation and operations

## Deployment model

The authoritative point-of-sale system runs on the store's local network. The Vercel site is a visual preview only; it has no configured production database or owner account and must not hold live inventory, supplier, sales or payment data.

Production topology:
- One always-on store computer runs PostgreSQL and the Melat Node API.
- The API serves the compiled React client from the same host.
- Staff devices access the application through the store LAN using a local HTTPS hostname.
- PostgreSQL port 5432 is never exposed to the LAN or public internet; staff devices reach only the HTTPS reverse proxy.

The POS can tolerate an external internet outage only while the local server, LAN, power and database remain operational. This is not a browser-only offline application.

## Requirements

- Windows with PostgreSQL 18 and Node.js 22 LTS, or a separately configured supported Linux host
- Caddy for local HTTPS
- UPS-backed server and router for store availability
- age encryption utility and PostgreSQL client tools for encrypted backups

## First-time Windows setup

The repository includes a guided setup script. From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-melat.ps1
```

It checks the PostgreSQL 18 service, prompts for the existing `melat_app` database password and a new 16+ character owner password, uses the included prebuilt application when present (so no npm registry download is needed), otherwise installs dependencies and builds from source, then applies migrations, creates the first owner and starts the local application. It writes `server/.env` because workspace scripts load dotenv from the server workspace. It refuses to overwrite an existing `server/.env`.

Before running it:
1. Create a dedicated empty PostgreSQL database named `melat` and the least-privilege role `melat_app`. The script does not create or modify database roles and never targets the unrelated `command` database.
2. Confirm PostgreSQL is accepting connections on localhost:5432.
3. Ensure npm can reach the package registry. If the network blocks npm, setup stops before database migrations.

For manual setup, copy `server/.env.example` to `server/.env`, replace the database password and owner bootstrap values, then run `npm install`, `npm run build`, `npm run db:migrate --workspace server`, and `npm run db:bootstrap --workspace server` from the repository root. Remove `OWNER_INITIAL_PASSWORD` from the environment immediately after bootstrap.

The guided script starts a localhost-only verification instance over HTTP. This is not the staff LAN deployment. Do not expose it to other devices until Caddy HTTPS, firewall rules and trusted device certificates are configured.

## Staff LAN HTTPS

1. Configure Caddy using `deploy/Caddyfile` and map `melat.local` to the store server's LAN IP using router DNS or each trusted device's hosts file.
2. Install and trust Caddy's local root certificate on every staff device.
3. Set `APP_BASE_URL=https://melat.local` and `COOKIE_SECURE=true` in `server/.env`.
4. The Node API binds to `127.0.0.1:4000`; configure Caddy to terminate TLS and proxy to that loopback address. Do not change `BIND_HOST` to a LAN interface.
5. Set the Windows network profile to Private. From an elevated PowerShell window, run `scripts/configure-lan-firewall.ps1`; this blocks inbound ports 4000 and 5432 and allows HTTPS only from the local subnet on Private/Domain profiles.
6. Register automatic API startup with `powershell -ExecutionPolicy Bypass -File .\\scripts\\register-local-api-task.ps1`. The task starts after the configured Windows user signs in and waits for PostgreSQL. Open `https://melat.local`.
7. Sign in as owner, replace the initial password, create least-privilege staff accounts and test checkout/refund/cash-close with training products before loading real stock.

## Database migrations

Migrations are numbered and recorded in `schema_migrations`. The CI integration test applies the complete migration chain to an isolated PostgreSQL test database. On the store server, run migrations only against the dedicated Melat database. Take a backup before applying future migrations to a database containing business data.

## Backup and restore

1. Install `age` and create an age public/private key pair. Keep the private identity offline and the public recipient on the server.
2. Set `BACKUP_AGE_RECIPIENT` and `BACKUP_OFFSITE_DIRECTORY` in `server/.env`, then run `scripts/backup-melat.ps1`.
3. The script creates a PostgreSQL custom-format dump, encrypts it, writes a SHA-256 checksum and removes the temporary plaintext dump. Configure the offsite directory to an independent protected destination; a second folder on the same computer is not offsite.
4. Set `DATABASE_ADMIN_URL` and `BACKUP_AGE_IDENTITY_FILE` in `server/.env`, then run `scripts/restore-test-melat.ps1 -EncryptedBackup <file> -RestoreDatabase melat_restore_test`.
5. The restore script verifies the checksum, decrypts to a temporary file, refuses any target name other than `melat_restore_test`, and never drops an existing database. Inspect the restored schema and row counts.
6. Register the daily 8:00 PM task using `powershell -ExecutionPolicy Bypass -File .\scripts\register-backup-task.ps1`. Its default security context requires the Windows user to be logged in.

A restore is not considered tested until a real encrypted backup has been restored successfully on the store server. The scripts are committed; no backup or restore drill has been executed in this remote development session.

## Security and operating limits

- Use unique passwords of 16+ characters and restrict database access to localhost.
- Do not expose the API or database directly to the public internet.
- Keep encryption private keys separate from the backup host.
- Do not use real customer/payment data in preview environments.
- Reconcile electronic payments against independent CBE, Telebirr and card settlement statements; a pending payment is not money received.

## Current implementation boundary

The repository contains API and UI foundations for authentication, products, inventory receipts, POS checkout, split tender, payment verification, receipt HTML/printing, purchasing, supplier invoices/payments/returns, cash drawers, refunds, adjustments, accounting journals, tax configuration, financial reports and bank reconciliation.

The PostgreSQL integration test covers migration installation, WAC receipt valuation, pending electronic tender, FEFO allocation, stock decrement, balanced sale journals and a refund/reversal exercise. The 14-test PostgreSQL/domain suite and API/client TypeScript build passed in GitHub Actions on commit `6e65a99444e1b45499c542af9ecd751350e15152`; the Windows installation bundle is generated from a successful CI run. More acceptance tests and store-side restore/operational drills remain outstanding.

The Vercel preview does not host this Node API or a production database. Login on the Vercel preview is therefore not expected to work. Use the local server only after the guided setup and health check succeed; do not use the preview for real transactions.
