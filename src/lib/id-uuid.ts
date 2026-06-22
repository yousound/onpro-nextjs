import { createHash } from "node:crypto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Stable UUID for legacy mock ids (order-5-123…) so re-sync does not create duplicates. */
export function legacyIdToUuid(legacy: string): string {
  const hash = createHash("sha256").update(`onpro-legacy:${legacy.trim()}`).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Supabase rows require UUID primary keys. */
export function ensureUuid(id: string): string {
  const trimmed = id.trim();
  if (isUuid(trimmed)) return trimmed;
  return legacyIdToUuid(trimmed);
}

export function resolveDbOrderId(orderId: string | undefined | null): string | null {
  if (!orderId?.trim()) return null;
  return ensureUuid(orderId);
}

export function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Sync failed";
}
