BEGIN;
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS tax_rate_id uuid REFERENCES tax_rates(id);
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS tax_recoverable boolean NOT NULL DEFAULT false;
INSERT INTO schema_migrations(version,description) VALUES('011','Track supplier invoice tax recoverability')
ON CONFLICT(version) DO NOTHING;
COMMIT;
