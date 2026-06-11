import type { ParsedImportContactRow } from "@/lib/types/contact-import";

/** Best display / validation name for an import row. */
export function displayNameForImportRow(row: ParsedImportContactRow): string {
  return (
    row.name.trim() ||
    row.contact_name?.trim() ||
    row.email.split("@")[0]?.trim() ||
    "Unknown"
  );
}

/** Coalesce name / contact_name so rows are not dropped or marked invalid. */
export function normalizeParsedImportRow(
  row: ParsedImportContactRow,
): ParsedImportContactRow | null {
  const email = row.email?.trim() ?? "";
  let name = row.name?.trim() ?? "";
  let contact_name = row.contact_name?.trim() || undefined;

  if (!email && !name && !contact_name) return null;

  if (!name && contact_name) {
    if (row.kind === "company" && row.segment !== "team") {
      name = contact_name;
      contact_name = undefined;
    } else {
      name = contact_name;
      contact_name = undefined;
    }
  }

  if (row.kind === "company" && name && contact_name && name === contact_name) {
    contact_name = undefined;
  }

  if (!name) {
    name = email ? email.split("@")[0] ?? "Unknown" : "Unknown";
  }

  return { ...row, name, email, contact_name };
}

export function normalizeParsedImportRows(
  rows: ParsedImportContactRow[],
): ParsedImportContactRow[] {
  return rows
    .map(normalizeParsedImportRow)
    .filter((row): row is ParsedImportContactRow => row != null);
}
