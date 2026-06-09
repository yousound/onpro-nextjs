import type { ParsedImportContactRow } from "@/lib/types/contact-import";

/** Split a free-text company filter into individual names. */
export function parseCompanyFilterText(text: string): string[] {
  return text
    .split(/[\n,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function stringsMatch(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** True when a parsed row belongs to one of the requested company names. */
export function rowMatchesCompanyFilter(
  row: ParsedImportContactRow,
  filters: readonly string[],
): boolean {
  if (filters.length === 0) return true;
  const candidates = [row.name, row.contact_name].filter(Boolean) as string[];
  return filters.some((filter) => candidates.some((name) => stringsMatch(name, filter)));
}

export function filterImportRowsByCompanies(
  rows: ParsedImportContactRow[],
  companyFilter?: string,
): ParsedImportContactRow[] {
  const filters = parseCompanyFilterText(companyFilter ?? "");
  if (!filters.length) return rows;
  return rows.filter((row) => rowMatchesCompanyFilter(row, filters));
}
