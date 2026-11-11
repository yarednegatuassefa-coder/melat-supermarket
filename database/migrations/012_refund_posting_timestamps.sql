BEGIN;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
INSERT INTO schema_migrations(version,description) VALUES('012','Track refund posting and reversal dates')
ON CONFLICT(version) DO NOTHING;
COMMIT;
