BEGIN;
ALTER TABLE supplier_payments ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES cash_sessions(id);
INSERT INTO schema_migrations(version,description)
VALUES('018','Link cash supplier payments to cashier drawers')
ON CONFLICT(version) DO NOTHING;
COMMIT;
