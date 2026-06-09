import { expandParsedImportRows } from "@/lib/csv/expand-import-rows";
import { IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";
import { parseImportLocationsFromRow } from "@/lib/csv/parse-import-locations";
import { parseCsvTable } from "@/lib/csv/parse-csv-lines";
import { normalizeImportSegment } from "@/lib/csv/normalize-import-segment";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";
import { deriveCompanyCode } from "@/lib/types/contact";

function headerIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  return lower.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
}

function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? row[idx].trim() : "";
}

function pickEmail(row: string[], headers: string[]): string {
  const idx = headerIndex(headers, ["email", "e-mail", "mail"]);
  if (idx >= 0) return cell(row, idx);
  return row.find((c) => c.includes("@"))?.trim() ?? "";
}

function pickName(row: string[], headers: string[]): { name: string; contactName?: string } {
  const companyIdx = headerIndex(headers, ["company", "company name", "organization", "org"]);
  const nameIdx = headerIndex(headers, ["name", "contact", "contact name", "full name"]);
  const company = cell(row, companyIdx);
  const person = cell(row, nameIdx);
  if (company && person && company !== person) {
    return { name: company, contactName: person };
  }
  const single = company || person || row.find((c) => c && !c.includes("@")) || "";
  return { name: single };
}

export function parseContactsCsvFallback(csvText: string): ParsedImportContactRow[] {
  const { headers, rows } = parseCsvTable(csvText);
  if (headers.length === 0 || rows.length === 0) return [];

  const codeIdx = headerIndex(headers, ["code", "company code", "client code", "abbrev"]);
  const phoneIdx = headerIndex(headers, ["phone", "tel", "mobile"]);
  const notesIdx = headerIndex(headers, ["notes", "note", "comments"]);
  const segmentIdx = headerIndex(headers, [
    "segment",
    "type",
    "role",
    "category",
    "contact type",
    "people type",
  ]);
  const companyColIdx = headerIndex(headers, ["company", "company name", "organization", "org"]);

  const out: ParsedImportContactRow[] = [];

  for (const row of rows) {
    const email = pickEmail(row, headers);
    const { name, contactName } = pickName(row, headers);
    if (!email && !name) continue;

    const segmentRaw = segmentIdx >= 0 ? cell(row, segmentIdx) : "";
    const segment = normalizeImportSegment(segmentRaw);
    const hasCompanyCol = companyColIdx >= 0 && cell(row, companyColIdx) !== "";
    const parsedKind: ParsedImportContactRow["kind"] =
      segment === "team"
        ? "individual"
        : segment === "vendor"
          ? "company"
          : hasCompanyCol || contactName
            ? "company"
            : "individual";

    const warnings: string[] = [];
    if (!email) warnings.push("No email — fix or skip before import.");
    if (!name) warnings.push("Missing name — using email local part.");
    if (!segment) {
      warnings.push(
        segmentIdx < 0
          ? "No type column — mark Team, Client, or Vendor on review."
          : "Type not set — mark Team, Client, or Vendor on review.",
      );
    }

    const displayName = name || email.split("@")[0] || "Unknown";

    const locations = parseImportLocationsFromRow(headers, row);

    out.push({
      segment,
      kind: parsedKind,
      name: displayName,
      contact_name: contactName,
      email: email || "",
      phone: cell(row, phoneIdx) || undefined,
      company_code: codeRaw(cell(row, codeIdx), displayName),
      locations: locations.length ? locations : undefined,
      notes: cell(row, notesIdx) || undefined,
      team_role: segment === "team" ? "staff" : undefined,
      warnings: warnings.length ? warnings : undefined,
    });
  }

  return expandParsedImportRows(out).slice(0, IMPORT_ROW_LIMIT);
}

function codeRaw(raw: string, displayName: string): string {
  const c = raw.trim();
  return c ? c.toUpperCase().slice(0, 3) : deriveCompanyCode(displayName);
}
