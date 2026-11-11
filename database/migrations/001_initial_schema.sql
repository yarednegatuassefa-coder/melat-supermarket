-- Melat V1.0 initial relational schema
-- PostgreSQL 15+; tested target is PostgreSQL 18.
-- Apply once to a new, empty Melat database. Do not run against production data without backup.

BEGIN;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','cashier','inventory_clerk')),
  is_active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  tax_identifier text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  parent_id uuid REFERENCES product_categories(id),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  barcode text UNIQUE,
  name_en text NOT NULL,
  name_am text,
  category_id uuid REFERENCES product_categories(id),
  base_unit text NOT NULL DEFAULT 'each',
  tracks_expiry boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  selling_price numeric(18,4) NOT NULL CHECK (selling_price >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid REFERENCES app_users(id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX product_prices_current_idx ON product_prices(product_id, effective_from DESC) WHERE effective_to IS NULL;

CREATE TABLE inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  expiry_date date,
  original_quantity numeric(18,4) NOT NULL CHECK (original_quantity > 0),
  remaining_quantity numeric(18,4) NOT NULL CHECK (remaining_quantity >= 0),
  acquisition_unit_cost numeric(18,4) NOT NULL CHECK (acquisition_unit_cost >= 0),
  supplier_id uuid REFERENCES suppliers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_quantity <= original_quantity)
);
CREATE INDEX inventory_batches_fefo_idx ON inventory_batches(product_id, expiry_date, received_at) WHERE remaining_quantity > 0;

CREATE TABLE inventory_balances (
  product_id uuid PRIMARY KEY REFERENCES products(id),
  quantity_on_hand numeric(18,4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  weighted_average_cost numeric(18,4) NOT NULL DEFAULT 0 CHECK (weighted_average_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','partially_received','received','cancelled')),
  ordered_at timestamptz NOT NULL DEFAULT now(),
  expected_at date,
  notes text,
  created_by uuid NOT NULL REFERENCES app_users(id),
  approved_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity_ordered numeric(18,4) NOT NULL CHECK (quantity_ordered > 0),
  expected_unit_cost numeric(18,4) NOT NULL CHECK (expected_unit_cost >= 0),
  UNIQUE(purchase_order_id, product_id)
);

CREATE TABLE goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  purchase_order_id uuid REFERENCES purchase_orders(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','reversed')),
  received_by uuid NOT NULL REFERENCES app_users(id),
  notes text
);

CREATE TABLE goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id),
  purchase_order_line_id uuid REFERENCES purchase_order_lines(id),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES inventory_batches(id),
  quantity_received numeric(18,4) NOT NULL CHECK (quantity_received > 0),
  unit_cost numeric(18,4) NOT NULL CHECK (unit_cost >= 0)
);

CREATE TABLE supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  goods_receipt_id uuid REFERENCES goods_receipts(id),
  invoice_number text NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  subtotal numeric(18,4) NOT NULL CHECK (subtotal >= 0),
  tax_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(18,4) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','partially_paid','paid','voided')),
  created_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, invoice_number),
  CHECK (total_amount = subtotal + tax_amount)
);

CREATE TABLE supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  payment_reference text NOT NULL UNIQUE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash','cbe','telebirr','card','bank_transfer')),
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('pending','confirmed','reversed')),
  recorded_by uuid NOT NULL REFERENCES app_users(id)
);

CREATE TABLE supplier_payment_allocations (
  payment_id uuid NOT NULL REFERENCES supplier_payments(id),
  invoice_id uuid NOT NULL REFERENCES supplier_invoices(id),
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  PRIMARY KEY(payment_id, invoice_id)
);

CREATE TABLE cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number text NOT NULL UNIQUE,
  cashier_id uuid NOT NULL REFERENCES app_users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_cash numeric(18,4) NOT NULL CHECK (opening_cash >= 0),
  closed_at timestamptz,
  counted_cash numeric(18,4) CHECK (counted_cash >= 0),
  expected_cash numeric(18,4) CHECK (expected_cash >= 0),
  variance numeric(18,4),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','reviewed')),
  reviewed_by uuid REFERENCES app_users(id),
  CHECK ((status = 'open' AND closed_at IS NULL) OR (status <> 'open' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_open_session_per_cashier ON cash_sessions(cashier_id) WHERE status = 'open';

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text NOT NULL UNIQUE,
  cash_session_id uuid NOT NULL REFERENCES cash_sessions(id),
  cashier_id uuid NOT NULL REFERENCES app_users(id),
  sold_at timestamptz NOT NULL DEFAULT now(),
  subtotal numeric(18,4) NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(18,4) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','partially_refunded','refunded','voided')),
  idempotency_key text NOT NULL UNIQUE,
  CHECK (discount_amount <= subtotal),
  CHECK (total_amount = subtotal - discount_amount + tax_amount)
);

CREATE TABLE sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  unit_price numeric(18,4) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total numeric(18,4) NOT NULL CHECK (line_total >= 0),
  unit_wac_snapshot numeric(18,4) NOT NULL CHECK (unit_wac_snapshot >= 0)
);

CREATE TABLE sale_line_batch_allocations (
  sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
  batch_id uuid NOT NULL REFERENCES inventory_batches(id),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  PRIMARY KEY(sale_line_id, batch_id)
);

CREATE TABLE sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  method text NOT NULL CHECK (method IN ('cash','cbe','telebirr','card')),
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending','confirmed','settled','failed','reversed')),
  provider_reference text,
  verified_by uuid REFERENCES app_users(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text NOT NULL UNIQUE,
  sale_id uuid NOT NULL REFERENCES sales(id),
  cash_session_id uuid REFERENCES cash_sessions(id),
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_inspection','approved','rejected','posted','reversed')),
  requested_by uuid NOT NULL REFERENCES app_users(id),
  approved_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL UNIQUE,
  cash_session_id uuid REFERENCES cash_sessions(id),
  description text NOT NULL,
  category text NOT NULL,
  amount numeric(18,4) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash','cbe','telebirr','card','bank_transfer')),
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES app_users(id)
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  batch_id uuid REFERENCES inventory_batches(id),
  movement_type text NOT NULL CHECK (movement_type IN ('receipt','sale','customer_return','supplier_return','adjustment_in','adjustment_out','write_off')),
  quantity_delta numeric(18,4) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES app_users(id),
  reversal_of uuid REFERENCES inventory_movements(id),
  UNIQUE(reversal_of)
);
CREATE INDEX inventory_movements_product_time_idx ON inventory_movements(product_id, occurred_at, id);
CREATE INDEX inventory_movements_source_idx ON inventory_movements(source_type, source_id);

CREATE TABLE chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_am text,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  entry_date date NOT NULL,
  description text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  posted_at timestamptz,
  posted_by uuid REFERENCES app_users(id),
  reversal_of uuid REFERENCES journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id),
  UNIQUE(reversal_of)
);

CREATE TABLE journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id),
  account_id uuid NOT NULL REFERENCES chart_of_accounts(id),
  debit numeric(18,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(18,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description text,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX journal_lines_account_idx ON journal_lines(account_id, journal_entry_id);

CREATE TABLE tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric(9,6) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  effective_from date NOT NULL,
  effective_to date,
  is_recoverable boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES app_users(id),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES app_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id text
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_log_actor_idx ON audit_log(actor_id, occurred_at DESC);

CREATE TABLE idempotency_keys (
  key text PRIMARY KEY,
  operation text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO schema_migrations(version, description)
VALUES ('001', 'Initial Melat V1 core schema');

COMMIT;
