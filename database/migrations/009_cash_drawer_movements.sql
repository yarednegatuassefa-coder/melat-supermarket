BEGIN;
CREATE TABLE IF NOT EXISTS cash_drawer_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cash_session_id uuid NOT NULL REFERENCES cash_sessions(id),
 movement_type text NOT NULL CHECK (movement_type IN ('withdrawal','bank_deposit','cash_addition','cash_drop')),
 amount numeric(18,4) NOT NULL CHECK (amount > 0),
 reference text,
 reason text NOT NULL,
 recorded_by uuid NOT NULL REFERENCES app_users(id),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_drawer_movements_session_idx ON cash_drawer_movements(cash_session_id,occurred_at);
INSERT INTO schema_migrations(version,description) VALUES('009','Add auditable cash drawer movements')
ON CONFLICT(version) DO NOTHING;
COMMIT;
