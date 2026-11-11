-- Capture expiry dates on receipt lines so each created batch can retain its own expiry.
BEGIN;
ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS expiry_date date;

INSERT INTO schema_migrations(version, description)
VALUES ('004', 'Capture expiry dates on goods receipt lines')
ON CONFLICT (version) DO NOTHING;
COMMIT;
