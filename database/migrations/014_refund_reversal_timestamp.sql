BEGIN;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
INSERT INTO schema_migrations(version,description)
VALUES('014','Add refund reversal timestamp')
ON CONFLICT(version) DO NOTHING;
COMMIT;
