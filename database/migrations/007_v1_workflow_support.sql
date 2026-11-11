-- Required session, supplier, receipt and reversal metadata for V1 workflows.
BEGIN;

CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions(user_id, expires_at);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE goods_receipt_lines ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES inventory_batches(id);

CREATE TABLE IF NOT EXISTS refund_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES refunds(id),
  sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  restock_condition text NOT NULL CHECK (restock_condition IN ('restock','quarantine','discard')),
  inspected_by uuid REFERENCES app_users(id),
  inspected_at timestamptz
);

CREATE TABLE IF NOT EXISTS supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  goods_receipt_id uuid REFERENCES goods_receipts(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_by uuid NOT NULL REFERENCES app_users(id),
  posted_by uuid REFERENCES app_users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supplier_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id uuid NOT NULL REFERENCES supplier_returns(id),
  batch_id uuid NOT NULL REFERENCES inventory_batches(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(18,4) NOT NULL CHECK (unit_cost >= 0)
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code text NOT NULL,
  statement_reference text NOT NULL,
  transaction_date date NOT NULL,
  description text,
  amount numeric(18,4) NOT NULL,
  matched_source_type text,
  matched_source_id uuid,
  reconciled_by uuid REFERENCES app_users(id),
  reconciled_at timestamptz,
  UNIQUE(account_code, statement_reference)
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  storage_reference text,
  checksum_sha256 text,
  bytes_written bigint,
  initiated_by uuid REFERENCES app_users(id),
  notes text
);

CREATE TABLE IF NOT EXISTS tax_configuration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_rate_id uuid REFERENCES tax_rates(id),
  action text NOT NULL CHECK (action IN ('create','change','retire')),
  previous_rate numeric(9,6),
  new_rate numeric(9,6),
  effective_from date NOT NULL,
  approved_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version, description)
VALUES ('007', 'Add sessions, return, reconciliation and operations tables')
ON CONFLICT (version) DO NOTHING;

COMMIT;
