# Melat V1.0 verification status

## PostgreSQL integration suite

The automated PostgreSQL test creates a dedicated database whose name must include `test`, applies every numbered migration, and exercises:

- Migration ordering and required workflow columns.
- Chart of accounts, including goods received not invoiced (GRNI).
- Two goods receipts with weighted-average cost (WAC) valuation and balanced GRNI journals.
- A checkout split across cash, CBE and Telebirr.
- No stock deduction while electronic tenders remain pending.
- FEFO batch selection and WAC snapshot at checkout.
- Balanced sale journal posting.
- Customer refund inventory restoration and balanced journal reversal.
- Expected cash drawer balance and overdraw prevention.
- Cash drawer expected balance and prevention of cash overdraw.

GitHub Actions runs this suite against an isolated PostgreSQL 18 service and then builds the API and client.

## Not yet signed off

The integration suite does not yet provide end-to-end route coverage for supplier invoice/payment/return posting, bank-statement reconciliation, tax reports, role permissions, cash-session close, or thermal receipt hardware. Privileged-account MFA and complete Amharic UI localization are also not implemented. Those require additional development and acceptance tests.

Encrypted backup and isolated restore scripts exist, but no real backup/restore drill has been executed in this session. The local LAN setup and firewall scripts also require execution on the store computer.

The Vercel deployment is a frontend preview only. It has no configured production database or API and must not be used for live transactions. A successful Vercel frontend build is not proof that the Node API or PostgreSQL workflows are production-ready.
