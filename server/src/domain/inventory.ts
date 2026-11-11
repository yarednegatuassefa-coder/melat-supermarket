import { fromMinorUnits, toMinorUnits } from "./money.js";

export interface InventoryCostState {
  quantity: string;
  weightedAverageCost: string;
}

export interface InventoryReceipt {
  quantity: string;
  unitCost: string;
}

/** Weighted-average cost is recalculated on receipt, not on issue. */
export function applyReceiptCost(
  current: InventoryCostState,
  receipt: InventoryReceipt
): InventoryCostState {
  const oldQuantity = toMinorUnits(current.quantity);
  const oldCost = toMinorUnits(current.weightedAverageCost);
  const receivedQuantity = toMinorUnits(receipt.quantity);
  const receivedCost = toMinorUnits(receipt.unitCost);

  if (oldQuantity < 0n || oldCost < 0n || receivedQuantity <= 0n || receivedCost < 0n) {
    throw new Error("Inventory quantities and costs must be non-negative; receipt quantity must be positive.");
  }

  const totalQuantity = oldQuantity + receivedQuantity;
  const totalValue = oldQuantity * oldCost + receivedQuantity * receivedCost;
  // Round to nearest 0.0001 ETB using half-up rounding.
  const averageCost = (totalValue + totalQuantity / 2n) / totalQuantity;

  return {
    quantity: fromMinorUnits(totalQuantity),
    weightedAverageCost: fromMinorUnits(averageCost)
  };
}

export function applyIssue(
  current: InventoryCostState,
  issueQuantity: string
): InventoryCostState {
  const quantity = toMinorUnits(current.quantity);
  const issue = toMinorUnits(issueQuantity);
  const cost = toMinorUnits(current.weightedAverageCost);

  if (quantity < 0n || cost < 0n || issue <= 0n) {
    throw new Error("Issue quantity must be positive and inventory state cannot be negative.");
  }
  if (issue > quantity) throw new Error("Insufficient stock.");

  return {
    quantity: fromMinorUnits(quantity - issue),
    weightedAverageCost: fromMinorUnits(quantity === issue ? 0n : cost)
  };
}

export interface FefoBatch {
  id: string;
  availableQuantity: string;
  expiryDate: string | null;
  receivedAt: string;
}

export interface BatchAllocation {
  batchId: string;
  quantity: string;
}

/**
 * Allocates earliest-expiry stock first. Expired batches are excluded.
 * Batches without an expiry date are picked after dated batches.
 */
export function allocateFefo(
  batches: FefoBatch[],
  requestedQuantity: string,
  today: string
): BatchAllocation[] {
  const requested = toMinorUnits(requestedQuantity);
  if (requested <= 0n) throw new Error("Requested quantity must be positive.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error("today must be YYYY-MM-DD.");

  const eligible = batches
    .map((batch) => ({ ...batch, available: toMinorUnits(batch.availableQuantity) }))
    .filter((batch) => {
      if (batch.available < 0n) throw new Error(`Negative batch quantity: ${batch.id}`);
      return batch.available > 0n && (!batch.expiryDate || batch.expiryDate >= today);
    })
    .sort((a, b) => {
      if (a.expiryDate === null && b.expiryDate !== null) return 1;
      if (a.expiryDate !== null && b.expiryDate === null) return -1;
      if (a.expiryDate !== null && b.expiryDate !== null) {
        const expiryOrder = a.expiryDate.localeCompare(b.expiryDate);
        if (expiryOrder !== 0) return expiryOrder;
      }
      const receivedOrder = a.receivedAt.localeCompare(b.receivedAt);
      return receivedOrder || a.id.localeCompare(b.id);
    });

  const totalAvailable = eligible.reduce((sum, batch) => sum + batch.available, 0n);
  if (totalAvailable < requested) throw new Error("Insufficient non-expired batch stock.");

  let remaining = requested;
  const allocations: BatchAllocation[] = [];
  for (const batch of eligible) {
    if (remaining === 0n) break;
    const take = batch.available < remaining ? batch.available : remaining;
    allocations.push({ batchId: batch.id, quantity: fromMinorUnits(take) });
    remaining -= take;
  }
  return allocations;
}
