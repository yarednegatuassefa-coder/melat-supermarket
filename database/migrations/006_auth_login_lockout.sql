-- Authentication fields used by the login throttling implementation.
BEGIN;
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;
INSERT INTO schema_migrations(version, description)
VALUES ('006', 'Add login throttling fields')
ON CONFLICT (version) DO NOTHING;
COMMIT;
