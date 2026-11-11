BEGIN;
ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS purchase_order_line_id uuid REFERENCES purchase_order_lines(id);
CREATE INDEX IF NOT EXISTS goods_receipt_lines_po_line_idx
  ON goods_receipt_lines(purchase_order_line_id) WHERE purchase_order_line_id IS NOT NULL;
INSERT INTO schema_migrations(version,description)
VALUES('012','Link goods receipt lines to purchase order lines')
ON CONFLICT(version) DO NOTHING;
COMMIT;
