-- Receipt posting controls and supporting indexes.
BEGIN;

ALTER TABLE goods_receipts ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES app_users(id);

CREATE INDEX IF NOT EXISTS goods_receipt_lines_product_idx
  ON goods_receipt_lines(goods_receipt_id, product_id);
CREATE INDEX IF NOT EXISTS inventory_batches_product_expiry_idx
  ON inventory_batches(product_id, expiry_date, received_at, id)
  WHERE remaining_quantity > 0;

-- A posted receipt is immutable. Corrections must use an explicit reversal workflow.
CREATE OR REPLACE FUNCTION melat_prevent_posted_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted goods receipts are immutable; use a reversal workflow'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goods_receipts_immutable_after_posting ON goods_receipts;
CREATE TRIGGER goods_receipts_immutable_after_posting
BEFORE UPDATE OR DELETE ON goods_receipts
FOR EACH ROW EXECUTE FUNCTION melat_prevent_posted_receipt_mutation();

INSERT INTO schema_migrations(version, description)
VALUES ('003', 'Add controlled goods receipt posting state')
ON CONFLICT (version) DO NOTHING;

COMMIT;
