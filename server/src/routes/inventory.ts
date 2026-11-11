import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { postGoodsReceipt } from "../services/inventory-receipts.js";
import { requireAuth, allowRoles } from "../security/sessions.js";

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

  return router;
}
