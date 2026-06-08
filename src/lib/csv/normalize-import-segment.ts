import type { PeopleSegment } from "@/lib/mock/people";

const UNLABELED = new Set([
  "",
  "?",
  "-",
  "—",
  "n/a",
  "na",
  "none",
  "unknown",
  "unsure",
  "ambiguous",
  "tbd",
  "other",
  "unassigned",
  "unset",
]);

/** Returns null when the CSV has no type or it is explicitly unknown — user assigns on review. */
export function normalizeImportSegment(raw: string | undefined): PeopleSegment | null {
  const s = raw?.trim().toLowerCase() ?? "";
  if (UNLABELED.has(s)) return null;

  if (
    s === "team" ||
    s === "internal" ||
    s === "staff" ||
    s === "employee" ||
    s === "operator" ||
    s.includes("team")
  ) {
    return "team";
  }
  if (
    s === "vendor" ||
    s === "supplier" ||
    s === "factory" ||
    s === "mill" ||
    s === "decorator" ||
    s.includes("vendor")
  ) {
    return "vendor";
  }
  if (
    s === "client" ||
    s === "customer" ||
    s === "buyer" ||
    s === "brand" ||
    s === "retailer" ||
    s.includes("client")
  ) {
    return "client";
  }

  return null;
}
