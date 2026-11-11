BEGIN;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash'
  CHECK (payment_method IN ('cash','cbe','telebirr','card'));
CREATE TABLE IF NOT EXISTS inventory_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 adjustment_number text NOT NULL UNIQUE,
 product_id uuid NOT NULL REFERENCES products(id),
 quantity_delta numeric(18,4) NOT NULL CHECK (quantity_delta <> 0),
 unit_cost numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bank_reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_code text NOT NULL,
 statement_date date NOT NULL,
 statement_opening_balance numeric(18,4) NOT NULL,
 statement_closing_balance numeric(18,4) NOT NULL,
 book_closing_balance numeric(18,4) NOT NULL,
 difference numeric(18,4) NOT NULL,
 status text NOT NULL CHECK (status IN ('open','reconciled')),
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 reconciled_at timestamptz
);
INSERT INTO schema_migrations(version,description) VALUES('008','Add refund tender, inventory adjustment and reconciliation controls')
ON CONFLICT(version) DO NOTHING;
COMMIT;
