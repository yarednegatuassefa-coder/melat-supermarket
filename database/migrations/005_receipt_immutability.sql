-- Make posted receipts immutable while permitting a controlled reversal status transition.
BEGIN;

CREATE OR REPLACE FUNCTION melat_prevent_posted_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed') THEN
    IF TG_OP = 'UPDATE'
       AND NEW.status = 'reversed'
       AND NEW.id = OLD.id
       AND NEW.receipt_number = OLD.receipt_number
       AND NEW.purchase_order_id IS NOT DISTINCT FROM OLD.purchase_order_id
       AND NEW.supplier_id = OLD.supplier_id
       AND NEW.received_at = OLD.received_at
       AND NEW.received_by = OLD.received_by
       AND NEW.notes IS NOT DISTINCT FROM OLD.notes
       AND NEW.posted_at IS NOT DISTINCT FROM OLD.posted_at
       AND NEW.posted_by IS NOT DISTINCT FROM OLD.posted_by THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Posted goods receipts are immutable; use the controlled reversal workflow'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION melat_prevent_posted_receipt_line_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_status text;
  parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.goods_receipt_id ELSE NEW.goods_receipt_id END;
  SELECT status INTO parent_status FROM goods_receipts WHERE id = parent_id;
  IF parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Lines belonging to a posted goods receipt are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goods_receipt_lines_immutable_after_posting ON goods_receipt_lines;
CREATE TRIGGER goods_receipt_lines_immutable_after_posting
BEFORE INSERT OR UPDATE OR DELETE ON goods_receipt_lines
FOR EACH ROW EXECUTE FUNCTION melat_prevent_posted_receipt_line_mutation();

INSERT INTO schema_migrations(version, description)
VALUES ('005', 'Protect posted receipt and line records')
ON CONFLICT (version) DO NOTHING;

COMMIT;
