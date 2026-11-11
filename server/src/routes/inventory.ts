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
      const result = await postGoodsReceipt(pool, { receiptId: req.params.receiptId, actorId: req.user!.id, idempotencyKey: parsed.data.idempotencyKey });
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
