import type { Address } from "@/lib/types/contact";

/** Single-line mailing address for labels, packing lists, etc. */
export function formatContactAddressOneLine(addr?: Address | null): string {
  if (!addr) return "";
  const cityState = [addr.city?.trim(), addr.state?.trim()].filter(Boolean).join(", ");
  const parts = [
    addr.line1?.trim(),
    addr.line2?.trim(),
    cityState || undefined,
    addr.postal_code?.trim(),
    addr.country?.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}
