import assert from "node:assert/strict";
import { test } from "node:test";
import { getCheckoutIdempotencyKey } from "../../../client/src/checkout-idempotency.mjs";

test("reuses a key for an identical retry after a network failure", () => {
  const state = { current: null };
  let generated = 0;
  const createKey = () => "test-key-" + (++generated);
  const payload = { cashSessionId: "session-1", lines: [{ productId: "product-1", quantity: "2" }] };

  const first = getCheckoutIdempotencyKey(state, payload, createKey);
  const retry = getCheckoutIdempotencyKey(state, payload, createKey);

  assert.equal(first, "test-key-1");
  assert.equal(retry, first);
  assert.equal(generated, 1);
});

test("blocks payload changes while the previous checkout result is uncertain", () => {
  const state = { current: null };
  let generated = 0;
  const createKey = () => "test-key-" + (++generated);

  const first = getCheckoutIdempotencyKey(state, { quantity: "1" }, createKey);
  assert.throws(() => getCheckoutIdempotencyKey(state, { quantity: "2" }, createKey), /previous checkout may have been saved/);
  assert.equal(getCheckoutIdempotencyKey(state, { quantity: "1" }, createKey), first);
  assert.equal(generated, 1);

  // A definite 4xx rejection clears the state so the corrected request gets a fresh key.
  state.current = null;
  const corrected = getCheckoutIdempotencyKey(state, { quantity: "2" }, createKey);
  assert.equal(corrected, "test-key-2");
});
