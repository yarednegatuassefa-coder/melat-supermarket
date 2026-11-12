-- Privileged MFA enrollment metadata. Enforcement requires a configured authenticator workflow.
BEGIN;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
INSERT INTO schema_migrations(version,description)
VALUES('023','Add privileged account MFA enrollment metadata')
ON CONFLICT(version) DO NOTHING;
COMMIT;
