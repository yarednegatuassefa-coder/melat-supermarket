# Local-first production deployment

## Chosen operating model

The store server and its PostgreSQL database are authoritative. Cashiers use the application over the store LAN. The checkout path does not depend on Vercel, Neon, or the public internet. Vercel publishes a static preview only; its API route deliberately returns HTTP 503 and never imports the store API or connects to a database.

Do not point Melat at the unrelated cloudlrestaurant-orders database. No cloud database is required for in-store operation.

## Store server prerequisites

- Dedicated Windows 10/11 PC on a UPS, with a reserved LAN IP address.
- PostgreSQL 18 service running locally; database melat and least-privilege role melat_app already created.
- Node.js 22 or newer and npm.
- A reliable router and private WPA2/WPA3 store Wi-Fi/Ethernet.
- Windows network profile set to Private.
- A separate encrypted backup destination. Keep at least one backup physically or logically off the store server.

## First-time local setup

From the repository root, run PowerShell as the store administrator:

    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\setup-local-melat.ps1

The setup script writes server/.env. This is deliberate: npm runs workspace scripts with server/ as the working directory, so the API, migration runner and owner bootstrap load dotenv from that directory. It prompts for the existing melat_app password and a unique 16+ character owner password, applies migrations, creates the initial owner only if one does not already exist, clears the temporary bootstrap values, starts the API and checks both PostgreSQL and schema readiness.

The API listens on 127.0.0.1:4000 only. The first local verification address is:

    http://localhost:4000

The API health check must report status=ok, database=connected, and schema=ready. If it does not, stop; do not enter store transactions.

## Enable staff access over the LAN (HTTPS only)

1. Give the store server a DHCP reservation in the router. Do not rely on a changing IP.
2. Install the official Caddy Windows binary and make sure caddy.exe is on PATH.
3. Run elevated PowerShell from the repository root:

       .\scripts\enable-lan-access.ps1

4. Configure the store router's local DNS, or each staff device's hosts file, so melat.local resolves to the reserved server IP.
5. Export the Caddy local root certificate from the server path printed by the script. Transfer it to each trusted cashier device over a controlled channel and install it into that device's Trusted Root Certification Authorities store. Never distribute the CA private key.
6. Restart the Melat Local API scheduled task. Confirm https://melat.local/api/health reports database and schema ready from each cashier terminal.

The firewall script blocks inbound TCP 4000 and 5432 and permits TCP 443 only from the local subnet on Private/Domain profiles. Do not create router port-forwarding rules. The API and PostgreSQL remain loopback-only; Caddy is the only LAN-facing service.

Caddy uses an internal CA. Each staff terminal must trust the Caddy root certificate or browsers will show a certificate warning. Do not bypass certificate warnings for a payment and inventory system.

## Public Vercel deployment

Vercel is intentionally not the transaction host. The public URL is a preview of the interface only. All /api/* requests return HTTP 503 with a clear local-only message. Never add the local PostgreSQL password, a production database URL, or a tunnel to Vercel.

## Operational acceptance before live trading

The code deployment is not the same as store acceptance. Before live use, an owner must witness and record:

- Fresh backup and a successful restore into a separate test database.
- Owner, manager, cashier and inventory-clerk permissions tested using separate accounts.
- One full purchase order → goods receipt → supplier invoice → supplier payment workflow.
- One test sale with cash and split electronic tenders; pending electronic payment must not count as settled.
- Receipt print from the actual cashier printer.
- Refund and supplier-return reversal paths.
- Cash drawer opening, movements, closing and variance review.
- Trial balance and inventory valuation reconcile with the test transactions.
- LAN checkout remains available after the internet connection is disconnected while the store server and LAN remain powered.
- Restart recovery: PostgreSQL, API and HTTPS proxy start after a server reboot.
- Backup schedule and offsite encrypted copy verified.

Use a separate test database and test products/transactions for acceptance. Do not seed live opening stock or enter actual sales until the accountant confirms the opening balances, tax configuration and inventory valuation method.

## Recovery and boundaries

If the server or its LAN fails, stop posting transactions in Melat and use the store's controlled manual receipt/stock fallback until the server is restored and reconciled. Never create a second writable database or switch to a cloud database as an improvised failover; that would split the stock and accounting ledgers.
