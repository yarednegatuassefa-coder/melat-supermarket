export type CheckoutKeyState = { current: { fingerprint: string; key: string } | null };
export function getCheckoutIdempotencyKey<T>(state: CheckoutKeyState, payload: T, createKey: () => string): string;
