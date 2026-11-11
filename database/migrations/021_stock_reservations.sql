BEGIN;
ALTER TABLE inventory_balances
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric(18,4) NOT NULL DEFAULT 0;
ALTER TABLE inventory_balances
  ADD CONSTRAINT inventory_balances_reserved_bounds
  CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity_on_hand);
INSERT INTO schema_migrations(version,description)
VALUES('021','Track pending checkout stock reservations')
ON CONFLICT(version) DO NOTHING;
COMMIT;
