import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { postGoodsReceipt } from "../services/inventory-receipts.js";
import { requireAuth, allowRoles } from "../security/sessions.js";
import { reverseInventoryMovements, reverseJournal } from "../services/reversals.js";

export function inventoryRoutes(pool: Pool) {
  const router = Router();
  router.use(requireAuth(pool));

  router.get("/products", async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.sku, p.barcode, p.name_en, p.name_am, p.base_unit,
                p.tracks_expiry, p.is_active, COALESCE(b.quantity_on_hand,0)::text AS quantity_on_hand,
                COALESCE(b.weighted_average_cost,0)::text AS weighted_average_cost,
                price.selling_price::text AS selling_price
           FROM products p
           LEFT JOIN inventory_balances b ON b.product_id = p.id
           LEFT JOIN LATERAL (
             SELECT selling_price FROM product_prices pp
              WHERE pp.product_id = p.id AND pp.effective_from <= now()
                AND (pp.effective_to IS NULL OR pp.effective_to > now())
              ORDER BY pp.effective_from DESC LIMIT 1
           ) price ON true
          ORDER BY p.name_en`
      );
      return res.json({ products: result.rows });
    } catch (error) { return next(error); }
  });

  router.get("/batches", allowRoles("owner", "manager", "inventory_clerk"), async (_req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT b.id, b.product_id, p.name_en, p.sku, b.supplier_id, s.name AS supplier_name,
                b.remaining_quantity::text, b.expiry_date, b.acquisition_unit_cost::text
           FROM inventory_batches b JOIN products p ON p.id=b.product_id
           LEFT JOIN suppliers s ON s.id=b.supplier_id
          WHERE b.remaining_quantity>0 ORDER BY b.expiry_date NULLS LAST,b.received_at LIMIT 500`
      );
      return res.json({ batches: result.rows });
    } catch (error) { return next(error); }
  });

  router.post("/products", allowRoles("owner", "manager", "inventory_clerk"), async (req, res, next) => {
    const schema = z.object({
      sku: z.string().trim().min(1).max(64),
      barcode: z.string().trim().max(64).optional().nullable(),
      nameEn: z.string().trim().min(1).max(180),
      nameAm: z.string().trim().max(180).optional().nullable(),
      baseUnit: z.string().trim().min(1).max(24).default("each"),
      tracksExpiry: z.boolean().default(false),
      sellingPrice: z.string().regex(/^\\d+(?:\\.\\d{1,4})?$/)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a valid SKU, product name and non-negative selling price." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const p = parsed.data;
      const created = await client.query(
        `INSERT INTO products(sku, barcode, name_en, name_am, base_unit, tracks_expiry)
         VALUES ($1, NULLIF($2,''), $3, NULLIF($4,''), $5, $6)
         RETURNING id, sku, barcode, name_en, name_am, base_unit, tracks_expiry`,
        [p.sku, p.barcode ?? "", p.nameEn, p.nameAm ?? "", p.baseUnit, p.tracksExpiry]
      );
      const product = created.rows[0];
      await client.query("INSERT INTO inventory_balances(product_id) VALUES ($1)", [product.id]);
      await client.query(
        "INSERT INTO product_prices(product_id, selling_price, created_by) VALUES ($1, $2, $3)",
        [product.id, p.sellingPrice, req.user!.id]
      );
      await client.query(
        `INSERT INTO audit_log(actor_id, action, entity_type, entity_id, after_data)
         VALUES ($1, 'create', 'product', $2, $3::jsonb)`,
        [req.user!.id, product.id, JSON.stringify({ ...product, sellingPrice: p.sellingPrice })]
      );
      await client.query("COMMIT");
      return res.status(201).json({ product });
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") return res.status(409).json({ error: "SKU or barcode already exists." });
      return next(error);
    } finally { client.release(); }
  });

  router.get("/movements", allowRoles("owner", "manager", "inventory_clerk"), async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT m.id, p.sku, p.name_en, m.movement_type, m.quantity_delta::text,
                m.unit_cost::text, m.source_type, m.source_id, m.occurred_at, u.username
           FROM inventory_movements m
           JOIN products p ON p.id = m.product_id
           JOIN app_users u ON u.id = m.actor_id
          ORDER BY m.occurred_at DESC, m.id DESC LIMIT 300`
      );
      return res.json({ movements: result.rows });
    } catch (error) { return next(error); }
  });

  router.post("/receipts/:receiptId/post", allowRoles("owner", "manager", "inventory_clerk"), async (req, res, next) => {
    try {
      const parsed = z.object({ idempotencyKey: z.string().trim().min(12).max(200) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A unique idempotency key is required." });
      const result = await postGoodsReceipt(pool, { receiptId: String(req.params.receiptId), actorId: req.user!.id, idempotencyKey: parsed.data.idempotencyKey });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post receipt.";
      if (message.includes("not found")) return res.status(404).json({ error: message });
      if (message.includes("draft") || message.includes("Insufficient") || message.includes("required") || message.includes("no lines")) return res.status(409).json({ error: message });
      return next(error);
    }
  });


  router.post("/receipts/:receiptId/reverse", allowRoles("owner","manager"), async (req,res,next)=>{
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const receipt=await client.query("SELECT * FROM goods_receipts WHERE id=$1 FOR UPDATE",[String(req.params.receiptId)]);
      if(!receipt.rowCount||receipt.rows[0].status!=="posted")throw new Error("Only a posted goods receipt can be reversed.");
      const invoice=await client.query("SELECT 1 FROM supplier_invoices WHERE goods_receipt_id=$1 AND status IN ('posted','partially_paid','paid') LIMIT 1",[receipt.rows[0].id]);
      if(invoice.rowCount)throw new Error("Reverse the supplier invoice before reversing its goods receipt.");
      await reverseInventoryMovements(client,req.user!.id,"goods_receipt",receipt.rows[0].id,["receipt"]);
      await reverseJournal(client,req.user!.id,"goods_receipt",receipt.rows[0].id);
      await client.query("UPDATE goods_receipts SET status='reversed' WHERE id=$1",[receipt.rows[0].id]);
      if(receipt.rows[0].purchase_order_id){
        await client.query(
          `UPDATE purchase_orders po SET status=CASE WHEN EXISTS (
             SELECT 1 FROM purchase_order_lines pol WHERE pol.purchase_order_id=po.id
              AND pol.quantity_ordered > COALESCE((SELECT sum(grl.quantity_received)
                FROM goods_receipt_lines grl JOIN goods_receipts gr ON gr.id=grl.goods_receipt_id
                WHERE grl.purchase_order_line_id=pol.id AND gr.status='posted'),0)
           ) THEN CASE WHEN EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.purchase_order_id=po.id AND gr.status='posted') THEN 'partially_received' ELSE 'approved' END
           ELSE 'received' END WHERE po.id=$1`,
          [receipt.rows[0].purchase_order_id]
        );
      }
      await client.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,after_data) VALUES($1,'reverse','goods_receipt',$2,$3::jsonb)",[req.user!.id,receipt.rows[0].id,JSON.stringify({receiptNumber:receipt.rows[0].receipt_number})]);
      await client.query("COMMIT");
      return res.json({receiptId:receipt.rows[0].id,status:"reversed"});
    }catch(error){
      await client.query("ROLLBACK");
      const message=error instanceof Error?error.message:"Receipt reversal failed.";
      if(/posted|invoice|stock|batch|inventory/i.test(message))return res.status(409).json({error:message});
      return next(error);
    }finally{client.release();}
  });

  return router;
}
