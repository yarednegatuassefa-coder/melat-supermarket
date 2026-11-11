import type { Pool } from "pg";

export interface PostGoodsReceiptInput {
  receiptId: string;
  actorId: string;
  idempotencyKey: string;
}

export interface PostedReceiptResult {
  receiptId: string;
  status: "posted";
  productCount: number;
  movementCount: number;
}

/** Posts a draft receipt atomically. Purchase orders never alter stock. */
export async function postGoodsReceipt(
  pool: Pool,
  input: PostGoodsReceiptInput
): Promise<PostedReceiptResult> {
  if (!input.receiptId || !input.actorId || !input.idempotencyKey.trim()) {
    throw new Error("Receipt ID, actor ID and idempotency key are required.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const prior = await client.query(
      "SELECT operation, response_body FROM idempotency_keys WHERE key = $1 FOR UPDATE",
      [input.idempotencyKey]
    );
    if (prior.rowCount) {
      if (prior.rows[0].operation !== "post_goods_receipt") {
        throw new Error("Idempotency key was already used for a different operation.");
      }
      if (prior.rows[0].response_body) {
        await client.query("COMMIT");
        return prior.rows[0].response_body as PostedReceiptResult;
      }
      throw new Error("A matching receipt request is already being processed.");
    }

    await client.query(
      "INSERT INTO idempotency_keys(key, operation) VALUES ($1, 'post_goods_receipt')",
      [input.idempotencyKey]
    );

    const receiptResult = await client.query(
      "SELECT id, receipt_number, supplier_id, status FROM goods_receipts WHERE id = $1 FOR UPDATE",
      [input.receiptId]
    );
    if (!receiptResult.rowCount) throw new Error("Goods receipt not found.");
    const receipt = receiptResult.rows[0];
    if (receipt.status !== "draft") {
      throw new Error(`Only draft receipts can be posted; current status is ${receipt.status}.`);
    }

    const linesResult = await client.query(
      `SELECT grl.id, grl.product_id, grl.quantity_received::text,
              grl.unit_cost::text, grl.expiry_date,
              p.tracks_expiry, p.is_active
         FROM goods_receipt_lines grl
         JOIN products p ON p.id = grl.product_id
        WHERE grl.goods_receipt_id = $1
        ORDER BY grl.product_id, grl.id
        FOR UPDATE OF grl, p`,
      [input.receiptId]
    );
    if (linesResult.rowCount === 0) throw new Error("Cannot post a receipt with no lines.");

    const productIds = [...new Set<string>(linesResult.rows.map((line) => line.product_id))].sort();
    for (const productId of productIds) {
      await client.query(
        `INSERT INTO inventory_balances(product_id, quantity_on_hand, weighted_average_cost)
         VALUES ($1, 0, 0) ON CONFLICT (product_id) DO NOTHING`,
        [productId]
      );
      await client.query(
        "SELECT product_id FROM inventory_balances WHERE product_id = $1 FOR UPDATE",
        [productId]
      );
    }

    for (const line of linesResult.rows) {
      if (!line.is_active) throw new Error(`Product ${line.product_id} is inactive.`);
      if (line.tracks_expiry && !line.expiry_date) {
        throw new Error(`Expiry date is required for expiry-tracked product ${line.product_id}.`);
      }

      const updated = await client.query(
        `UPDATE inventory_balances
            SET weighted_average_cost =
                  round(((quantity_on_hand * weighted_average_cost) +
                         ($2::numeric * $3::numeric)) /
                        (quantity_on_hand + $2::numeric), 4),
                quantity_on_hand = quantity_on_hand + $2::numeric,
                updated_at = now()
          WHERE product_id = $1
            AND $2::numeric > 0 AND $3::numeric >= 0
          RETURNING quantity_on_hand::text, weighted_average_cost::text`,
        [line.product_id, line.quantity_received, line.unit_cost]
      );
      if (updated.rowCount !== 1) {
        throw new Error("Receipt quantity must be positive and unit cost cannot be negative.");
      }

      const batch = await client.query(
        `INSERT INTO inventory_batches(
           product_id, received_at, expiry_date, original_quantity,
           remaining_quantity, acquisition_unit_cost, supplier_id
         ) VALUES ($1, now(), $2, $3, $3, $4, $5)
         RETURNING id`,
        [line.product_id, line.expiry_date, line.quantity_received, line.unit_cost, receipt.supplier_id]
      );

      await client.query(
        "UPDATE goods_receipt_lines SET batch_id = $2 WHERE id = $1",
        [line.id, batch.rows[0].id]
      );
      await client.query(
        `INSERT INTO inventory_movements(
           product_id, batch_id, movement_type, quantity_delta, unit_cost,
           source_type, source_id, actor_id
         ) VALUES ($1, $2, 'receipt', $3, $4, 'goods_receipt', $5, $6)`,
        [line.product_id, batch.rows[0].id, line.quantity_received, line.unit_cost, input.receiptId, input.actorId]
      );
    }

    const result: PostedReceiptResult = {
      receiptId: input.receiptId,
      status: "posted",
      productCount: productIds.length,
      movementCount: linesResult.rowCount
    };

    await client.query(
      "UPDATE goods_receipts SET status = 'posted', posted_at = now(), posted_by = $2 WHERE id = $1",
      [input.receiptId, input.actorId]
    );
    await client.query(
      `INSERT INTO audit_log(actor_id, action, entity_type, entity_id, after_data)
       VALUES ($1, 'post', 'goods_receipt', $2, $3::jsonb)`,
      [input.actorId, input.receiptId, JSON.stringify(result)]
    );
    await client.query(
      "UPDATE idempotency_keys SET response_status = 200, response_body = $2::jsonb WHERE key = $1",
      [input.idempotencyKey, JSON.stringify(result)]
    );

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
