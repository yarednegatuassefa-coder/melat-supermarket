BEGIN;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS posted_at timestamptz;
INSERT INTO schema_migrations(version,description)
VALUES('013','Add refund posting timestamp')
ON CONFLICT(version) DO NOTHING;
COMMIT;
