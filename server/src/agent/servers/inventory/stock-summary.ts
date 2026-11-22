import type { Pool } from "pg";

export const name = "inventory.stock_summary";
export const description = "Return aggregate active-product and zero-stock counts. No supplier, customer or transaction rows are returned.";

export async function run(pool: Pool) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE p.is_active = true)::int AS active_products,
       COUNT(*) FILTER (WHERE p.is_active = true AND COALESCE(b.quantity_on_hand, 0) <= 0)::int AS zero_stock_products
     FROM products p
     LEFT JOIN inventory_balances b ON b.product_id = p.id`
  );
  return { ...result.rows[0], source: "products + inventory_balances", note: "Aggregate operational indicator only; verify batches and reservations before replenishment decisions." };
}
