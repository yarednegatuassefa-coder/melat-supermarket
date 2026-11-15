export function getCheckoutIdempotencyKey(state, payload, createKey) {
  const fingerprint = JSON.stringify(payload);
  if (!state.current || state.current.fingerprint !== fingerprint) {
    state.current = { fingerprint, key: createKey() };
  }
  return state.current.key;
}
