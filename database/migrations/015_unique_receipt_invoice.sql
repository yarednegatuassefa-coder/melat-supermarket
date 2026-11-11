BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_one_active_per_receipt
  ON supplier_invoices(goods_receipt_id)
  WHERE goods_receipt_id IS NOT NULL AND status <> 'voided';
INSERT INTO schema_migrations(version,description)
VALUES('015','Prevent duplicate active supplier invoices per goods receipt')
ON CONFLICT(version) DO NOTHING;
COMMIT;
