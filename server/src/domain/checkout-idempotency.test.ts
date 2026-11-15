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

test("creates a new key when the checkout payload changes", () => {
  const state = { current: null };
  let generated = 0;
  const createKey = () => "test-key-" + (++generated);

  const first = getCheckoutIdempotencyKey(state, { quantity: "1" }, createKey);
  const changed = getCheckoutIdempotencyKey(state, { quantity: "2" }, createKey);

  assert.equal(first, "test-key-1");
  assert.equal(changed, "test-key-2");
  assert.notEqual(changed, first);
});
