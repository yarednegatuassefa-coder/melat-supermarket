-- Authentication sessions, privileged MFA enrollment metadata, and account controls.
BEGIN;
CREATE TABLE app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);
CREATE INDEX app_sessions_active_user_idx ON app_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
INSERT INTO schema_migrations(version, description)
VALUES ('006', 'Add secure application sessions and account controls')
ON CONFLICT (version) DO NOTHING;
COMMIT;
