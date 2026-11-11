BEGIN;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted'
  CHECK (status IN ('posted','reversed'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
INSERT INTO schema_migrations(version,description)
VALUES('019','Add controlled expense reversal state')
ON CONFLICT(version) DO NOTHING;
COMMIT;
