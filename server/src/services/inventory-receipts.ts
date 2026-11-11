import type { Pool, PoolClient } from "pg";

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

/**
 * Posts a draft goods receipt atomically.
 * Purchase orders never alter stock; only this goods-receipt posting path does.
 */
export async function postGoodsReceipt(
  pool: Pool,
  input: PostGoodsReceiptInput
): Promise<PostedReceiptResult> {
  if (!input.receiptId || !input.actorId || !input.idempotencyKey) {
    throw new Error("Receipt ID, actor ID and idempotency key are required.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const prior = await client.query(
      `SELECT operation, response_body
         FROM idempotency_keys
        WHERE key = $1
        FOR UPDATE`,
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
      `INSERT INTO idempotency_keys(key, operation)
       VALUES ($1, 'post_goods_receipt')`,
      [input.idempotencyKey]
    );

    const receiptResult = await client.query(
      `SELECT id, receipt_number, supplier_id, status
         FROM goods_receipts
        WHERE id = $1
        FOR UPDATE`,
      [input.receiptId]
    );
    if (!receiptResult.rowCount) throw new Error("Goods receipt not found.");
    const receipt = receiptResult.rows[0];
    if (receipt.status !== "draft") {
      throw new Error(`Only draft receipts can be posted; current status is ${receipt.status}.`);
    }

    const linesResult = await client.query(
      `SELECT grl.id, grl.product_id, grl.quantity_received, grl.unit_cost,
              p.tracks_expiry, p.is_active
         FROM goods_receipt_lines grl
         JOIN products p ON p.id = grl.product_id
        WHERE grl.goods_receipt_id = $1
        ORDER BY grl.product_id, grl.id
        FOR UPDATE OF grl, p`,
      [input.receiptId]
    );
    if (linesResult.rowCount === 0) throw new Error("Cannot post a receipt with no lines.");

    const productIds = [...new Set(linesResult.rows.map((line) => line.product_id))].sort();
    const lockedBalances = new Map<string, { quantity_on_hand: string; weighted_average_cost: string }>();

    for (const productId of productIds) {
      await client.query(
        `INSERT INTO inventory_balances(product_id, quantity_on_hand, weighted_average_cost)
         VALUES ($1, 0, 0)
         ON CONFLICT (product_id) DO NOTHING`,
        [productId]
      );
      const balance = await client.query(
        `SELECT quantity_on_hand::text, weighted_average_cost::text
           FROM inventory_balances
          WHERE product_id = $1
          FOR UPDATE`,
        [productId]
      );
      lockedBalances.set(productId, balance.rows[0]);
    }

    let movementCount = 0;
    for (const line of linesResult.rows) {
      if (!line.is_active) throw new Error(`Product ${line.product_id} is inactive.`);
      const quantity = String(line.quantity_received);
      const unitCost = String(line.unit_cost);
      if (Number(quantity) <= 0 || Number(unitCost) < 0) {
        throw new Error("Receipt quantities must be positive and costs cannot be negative.");
      }
      if (line.tracks_expiry && line.expiry_date === null) {
        // Expiry is supplied by batch-level receipt metadata in the next receipt-line extension.
        throw new Error(`Expiry date is required for expiry-tracked product ${line.product_id}.`);
      }

      const current = lockedBalances.get(line.product_id)!;
      const updated = await client.query(
        `UPDATE inventory_balances
            SET weighted_average_cost =
                  CASE WHEN quantity_on_hand + $2::numeric = 0 THEN 0
                       ELSE round(((quantity_on_hand * weighted_average_cost) +
                                    ($2::numeric * $3::numeric)) /
                                   (quantity_on_hand + $2::numeric), 4)
                  END,
                quantity_on_hand = quantity_on_hand + $2::numeric,
                updated_at = now()
          WHERE product_id = $1
          RETURNING quantity_on_hand::text, weighted_average_cost::text`,
        [line.product_id, quantity, unitCost]
      );
      lockedBalances.set(line.product_id, updated.rows[0]);

      const batch = await client.query(
        `INSERT INTO inventory_batches(
           product_id, received_at, original_quantity, remaining_quantity,
           acquisition_unit_cost, supplier_id
         ) VALUES ($1, now(), $2, $2, $3, $4)
         RETURNING id`,
        [line.product_id, quantity, unitCost, receipt.supplier_id]
      );

      await client.query(
        `UPDATE goods_receipt_lines SET batch_id = $2 WHERE id = $1`,
        [line.id, batch.rows[0].id]
      );

      await client.query(
        `INSERT INTO inventory_movements(
           product_id, batch_id, movement_type, quantity_delta, unit_cost,
           source_type, source_id, actor_id
         ) VALUES ($1, $2, 'receipt', $3, $4, 'goods_receipt', $5, $6)`,
        [line.product_id, batch.rows[0].id, quantity, unitCost, input.receiptId, input.actorId]
      );
      movementCount += 1;
    }

    await client.query(
      `UPDATE goods_receipts
          SET status = 'posted', posted_at = now(), posted_by = $2
        WHERE id = $1`,
      [input.receiptId, input.actorId]
    );

    const result: PostedReceiptResult = {
      receiptId: input.receiptId,
      status: "posted",
      productCount: productIds.length,
      movementCount
    };

    await client.query(
      `INSERT INTO audit_log(actor_id, action, entity_type, entity_id, after_data)
       VALUES ($1, 'post', 'goods_receipt', $2, $3::jsonb)`,
      [input.actorId, input.receiptId, JSON.stringify(result)]
    );
    await client.query(
      `UPDATE idempotency_keys
          SET response_status = 200, response_body = $2::jsonb
        WHERE key = $1`,
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
