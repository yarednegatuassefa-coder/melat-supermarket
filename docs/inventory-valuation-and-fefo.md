# Inventory valuation and batch-picking policy

## Financial valuation: perpetual weighted-average cost

For each product, maintain quantity on hand and weighted-average unit cost at four decimal places.

On a receipt:

`new WAC = ((old quantity × old WAC) + (received quantity × receipt unit cost)) / (old quantity + received quantity)`

Round the resulting unit cost to four decimal places using a documented half-up rule. The inventory value is quantity multiplied by WAC. When the product has zero stock, the next receipt establishes its WAC.

On an issue (sale, write-off or supplier return), use the current WAC snapshot for financial valuation. An issue reduces quantity but does not recalculate WAC while stock remains. If stock reaches zero, reset the stored WAC to zero; the next receipt establishes a new WAC.

Do not use batch acquisition cost as financial COGS. Batch costs are retained for traceability and receipt valuation; WAC is the V1.0 financial valuation method.

## Physical picking: FEFO

For products marked as expiry-tracked:
1. Exclude expired batches from sale allocation.
2. Sort eligible batches by earliest expiry date.
3. For equal expiry dates, pick the oldest received batch first.
4. Use batches without an expiry date only after dated eligible batches.
5. Reject a sale if eligible batch quantities cannot satisfy the requested quantity.

The UI must show the cashier/inventory clerk when stock is unavailable because it is expired or insufficient. Expired inventory must be routed to an authorized write-off/return workflow, not silently sold.

## Transaction and concurrency requirements

The production inventory service must perform stock validation, row locking, batch allocation, ledger insertion and balance projection updates in one database transaction. Lock products in deterministic product-ID order to reduce deadlocks. Use idempotency keys for retried sale and receipt requests.

The pure TypeScript domain functions are calculation helpers, not a substitute for transactional database enforcement. Do not expose them as direct public API endpoints until the database transaction service and authorization checks are implemented.

## Test coverage

The domain test suite covers:
- WAC recalculation on receipt.
- WAC preservation on issue and reset at zero.
- Rejection of overselling.
- FEFO ordering, receipt-time tie-breaking and expired-batch exclusion.
- Insufficient eligible batch stock.
