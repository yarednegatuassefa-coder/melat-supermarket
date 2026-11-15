export function getCheckoutIdempotencyKey(state, payload, createKey) {
  const fingerprint = JSON.stringify(payload);
  if (state.current && state.current.fingerprint !== fingerprint) {
    throw new Error("A previous checkout may have been saved. Retry the unchanged checkout or reconcile pending sales before changing this cart.");
  }
  if (!state.current) state.current = { fingerprint, key: createKey() };
  return state.current.key;
}
