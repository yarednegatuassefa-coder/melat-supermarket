BEGIN;
ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS statement_start_date date;
ALTER TABLE bank_reconciliations DROP CONSTRAINT IF EXISTS bank_reconciliations_date_order;
ALTER TABLE bank_reconciliations ADD CONSTRAINT bank_reconciliations_date_order
 CHECK (statement_start_date IS NULL OR statement_start_date <= statement_date);
INSERT INTO schema_migrations(version,description) VALUES('010','Add bank reconciliation period controls')
ON CONFLICT(version) DO NOTHING;
COMMIT;
