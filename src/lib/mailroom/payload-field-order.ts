/** Reserved key for explicit field display order in Mailroom payloads. */
export const PAYLOAD_FIELD_ORDER_KEY = "_field_order";

const RESERVED_KEYS = new Set([
  PAYLOAD_FIELD_ORDER_KEY,
  "workflow_step_id",
  "auto_contact",
]);

export function isPayloadFieldKey(key: string): boolean {
  return !RESERVED_KEYS.has(key);
}

/** Seed `_field_order` from existing keys when missing. */
export function ensurePayloadFieldOrder(payload: Record<string, unknown>): string[] {
  const existing = payload[PAYLOAD_FIELD_ORDER_KEY];
  if (Array.isArray(existing)) {
    const keys = existing.filter((k): k is string => typeof k === "string" && isPayloadFieldKey(k));
    const allKeys = Object.keys(payload).filter(isPayloadFieldKey);
    const merged = [...keys];
    for (const k of allKeys) {
      if (!merged.includes(k)) merged.push(k);
    }
    return merged;
  }
  return Object.keys(payload).filter(isPayloadFieldKey);
}

export function orderedPayloadEntries(
  payload: Record<string, unknown>,
): [string, unknown][] {
  const order = ensurePayloadFieldOrder(payload);
  const seen = new Set<string>();
  const entries: [string, unknown][] = [];
  for (const key of order) {
    if (!isPayloadFieldKey(key) || seen.has(key)) continue;
    if (!(key in payload)) continue;
    seen.add(key);
    entries.push([key, payload[key]]);
  }
  for (const key of Object.keys(payload)) {
    if (!isPayloadFieldKey(key) || seen.has(key)) continue;
    entries.push([key, payload[key]]);
  }
  return entries;
}

export function payloadWithFieldOrder(
  payload: Record<string, unknown>,
  order: string[],
): Record<string, unknown> {
  const filtered = order.filter(isPayloadFieldKey);
  return { ...payload, [PAYLOAD_FIELD_ORDER_KEY]: filtered };
}

export function movePayloadField(
  order: string[],
  key: string,
  direction: "up" | "down",
): string[] {
  const idx = order.indexOf(key);
  if (idx < 0) return order;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= order.length) return order;
  const next = [...order];
  [next[idx], next[swap]] = [next[swap]!, next[idx]!];
  return next;
}

export function removeKeyFromFieldOrder(order: string[], key: string): string[] {
  return order.filter((k) => k !== key);
}

export function appendKeyToFieldOrder(order: string[], key: string): string[] {
  if (order.includes(key)) return order;
  return [...order, key];
}

/** Strip order metadata for executors that only need scalar fields. */
export function stripPayloadFieldOrder(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  delete next[PAYLOAD_FIELD_ORDER_KEY];
  return next;
}
