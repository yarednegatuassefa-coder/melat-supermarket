import test from "node:test";
import assert from "node:assert/strict";
import { allocateFefo, applyIssue, applyReceiptCost } from "./inventory.js";

test("WAC receipt combines old stock value and incoming stock value", () => {
  assert.deepEqual(applyReceiptCost(
    { quantity: "10", weightedAverageCost: "5" },
    { quantity: "10", unitCost: "7" }
  ), { quantity: "20.0000", weightedAverageCost: "6.0000" });
});

test("WAC receipt uses exact arithmetic and half-up rounding", () => {
  assert.deepEqual(applyReceiptCost(
    { quantity: "1", weightedAverageCost: "1" },
    { quantity: "1", unitCost: "1.0001" }
  ), { quantity: "2.0000", weightedAverageCost: "1.0001" });
});

test("issuing stock preserves WAC until stock reaches zero", () => {
  assert.deepEqual(applyIssue(
    { quantity: "8", weightedAverageCost: "12.50" }, "3"
  ), { quantity: "5.0000", weightedAverageCost: "12.5000" });
  assert.deepEqual(applyIssue(
    { quantity: "8", weightedAverageCost: "12.50" }, "8"
  ), { quantity: "0.0000", weightedAverageCost: "0.0000" });
});

test("inventory issue rejects overselling", () => {
  assert.throws(() => applyIssue(
    { quantity: "2", weightedAverageCost: "4" }, "2.0001"
  ), /Insufficient stock/);
});

test("FEFO allocates earliest expiry first and excludes expired batches", () => {
  const result = allocateFefo([
    { id: "later", availableQuantity: "8", expiryDate: "2027-04-01", receivedAt: "2026-11-01" },
    { id: "expired", availableQuantity: "20", expiryDate: "2026-11-11", receivedAt: "2026-10-01" },
    { id: "soon", availableQuantity: "2", expiryDate: "2026-12-01", receivedAt: "2026-10-15" },
    { id: "no-date", availableQuantity: "5", expiryDate: null, receivedAt: "2026-10-01" }
  ], "6", "2026-11-12");
  assert.deepEqual(result, [
    { batchId: "soon", quantity: "2.0000" },
    { batchId: "later", quantity: "4.0000" }
  ]);
});

test("FEFO breaks equal expiry dates by receipt time", () => {
  const result = allocateFefo([
    { id: "newer", availableQuantity: "2", expiryDate: "2027-01-01", receivedAt: "2026-11-10" },
    { id: "older", availableQuantity: "2", expiryDate: "2027-01-01", receivedAt: "2026-10-10" }
  ], "3", "2026-11-12");
  assert.deepEqual(result, [
    { batchId: "older", quantity: "2.0000" },
    { batchId: "newer", quantity: "1.0000" }
  ]);
});

test("FEFO rejects request above eligible stock", () => {
  assert.throws(() => allocateFefo([
    { id: "expired", availableQuantity: "10", expiryDate: "2026-11-10", receivedAt: "2026-10-01" }
  ], "1", "2026-11-12"), /Insufficient non-expired batch stock/);
});
