import { extractEmailsFromText } from "@/lib/csv/expand-import-rows";
import { parseImportLocationsFromRow } from "@/lib/csv/parse-import-locations";
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

function headerLooksLikeEmail(header: string): boolean {
  return /e-?mail|mail address|email address/i.test(header);
}

function headerLooksLikeCompany(header: string): boolean {
  return /company|organization|org\b|account|client|brand|label/i.test(header);
}

function headerLooksLikePersonName(header: string): boolean {
  return (
    /^(contact|name|full name|person|rep|member|attn|attention)\b/i.test(header) ||
    /contact\s*\d+|name\s*\d+|person\s*\d+|rep\s*\d+/i.test(header) ||
    /first\s*name|last\s*name|fname|lname|given|surname/i.test(header)
  );
}

function columnNumberSuffix(header: string): string | null {
  const m = header.match(/(\d+)\s*$/);
  return m ? m[1]! : null;
}

function contactNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._+-]+/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function combinedFirstLastName(headers: string[], row: string[]): string {
  const firstIdx = headerIndex(headers, ["first name", "firstname", "first_name", "fname", "given"]);
  const lastIdx = headerIndex(headers, ["last name", "lastname", "last_name", "lname", "surname", "family"]);
  const first = cell(row, firstIdx);
  const last = cell(row, lastIdx);
  return `${first} ${last}`.trim();
}

function personNameForEmailColumn(headers: string[], row: string[], emailColIdx: number): string {
  const suffix = columnNumberSuffix(headers[emailColIdx] ?? "");
  if (suffix) {
    for (let i = 0; i < headers.length; i++) {
      if (i === emailColIdx) continue;
      const h = headers[i] ?? "";
      if (!headerLooksLikePersonName(h)) continue;
      if (columnNumberSuffix(h) !== suffix) continue;
      const value = cell(row, i);
      if (value && !value.includes("@")) return value;
    }
  }

  if (emailColIdx > 0) {
    const leftHeader = headers[emailColIdx - 1] ?? "";
    const left = cell(row, emailColIdx - 1);
    if (left && !left.includes("@") && headerLooksLikePersonName(leftHeader)) return left;
  }

  const combined = combinedFirstLastName(headers, row);
  if (combined) return combined;

  const nameIdx = headerIndex(headers, [
    "name",
    "contact",
    "contact name",
    "full name",
    "person",
    "rep",
    "member",
  ]);
  const generic = cell(row, nameIdx);
  if (generic && !generic.includes("@")) return generic;

  return "";
}

function sharedRowFields(
  headers: string[],
  row: string[],
): Pick<ParsedImportContactRow, "phone" | "notes" | "company_code" | "locations" | "segment" | "team_role"> {
  const codeIdx = headerIndex(headers, ["code", "company code", "client code", "abbrev"]);
  const phoneIdx = headerIndex(headers, ["phone", "tel", "mobile", "cell"]);
  const notesIdx = headerIndex(headers, ["notes", "note", "comments"]);
  const segmentIdx = headerIndex(headers, [
    "segment",
    "type",
    "role",
    "category",
    "contact type",
    "people type",
  ]);
  const segmentRaw = segmentIdx >= 0 ? cell(row, segmentIdx) : "";
  const segment = normalizeImportSegment(segmentRaw);
  const displayName = cell(row, headerIndex(headers, ["company", "company name", "organization", "org"])) ||
    cell(row, headerIndex(headers, ["name", "contact", "contact name", "full name"]));
  const codeRaw = cell(row, codeIdx);
  const company_code = codeRaw
    ? codeRaw.toUpperCase().slice(0, 3)
    : deriveCompanyCode(displayName || "Unknown");

  return {
    phone: cell(row, phoneIdx) || undefined,
    notes: cell(row, notesIdx) || undefined,
    company_code,
    locations: (() => {
      const locations = parseImportLocationsFromRow(headers, row);
      return locations.length ? locations : undefined;
    })(),
    segment,
    team_role: segment === "team" ? "staff" : undefined,
  };
}

/** Extract every person/email pair from a wide CSV row (all columns). */
export function extractContactsFromCsvRow(
  headers: string[],
  row: string[],
): ParsedImportContactRow[] {
  const companyIdx = headerIndex(headers, ["company", "company name", "organization", "org", "account", "client", "brand"]);
  const company = companyIdx >= 0 ? cell(row, companyIdx) : "";
  const shared = sharedRowFields(headers, row);
  const hasCompanyCol = companyIdx >= 0 && company !== "";

  const emailColumns = new Set<number>();
  headers.forEach((header, idx) => {
    const value = cell(row, idx);
    if (headerLooksLikeEmail(header) || extractEmailsFromText(value).length > 0) {
      emailColumns.add(idx);
    }
  });

  const out: ParsedImportContactRow[] = [];
  const seenEmails = new Set<string>();

  for (const colIdx of emailColumns) {
    const emails = extractEmailsFromText(cell(row, colIdx));
    for (const email of emails) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      const personName = personNameForEmailColumn(headers, row, colIdx);
      const name = company || personName || contactNameFromEmail(email);
      const contact_name =
        company && personName && personName !== company ? personName : undefined;
      const parsedKind: ParsedImportContactRow["kind"] =
        shared.segment === "team"
          ? "individual"
          : shared.segment === "vendor"
            ? "company"
            : hasCompanyCol || contact_name
              ? "company"
              : "individual";

      const warnings: string[] = [];
      if (!shared.segment) {
        warnings.push("No type column — mark Team, Client, or Vendor on review.");
      }

      out.push({
        segment: shared.segment,
        kind: parsedKind,
        name,
        contact_name,
        email,
        phone: shared.phone,
        company_code: shared.company_code,
        locations: shared.locations,
        notes: shared.notes,
        team_role: shared.team_role,
        warnings: warnings.length ? warnings : undefined,
      });
    }
  }

  if (out.length > 0) return out;

  const email = cell(row, headerIndex(headers, ["email", "e-mail", "mail"])) ||
    row.find((c) => c.includes("@"))?.trim() ||
    "";
  const personName = combinedFirstLastName(headers, row) ||
    personNameForEmailColumn(headers, row, Math.max(0, headerIndex(headers, ["email", "e-mail", "mail"])));
  const name = company || personName;
  if (!email && !name) return [];

  const parsedKind: ParsedImportContactRow["kind"] =
    shared.segment === "team"
      ? "individual"
      : shared.segment === "vendor"
        ? "company"
        : hasCompanyCol || (personName && company && personName !== company)
          ? "company"
          : "individual";

  const warnings: string[] = [];
  if (!email) warnings.push("No email — fix or skip before import.");
  if (!name) warnings.push("Missing name — using email local part.");
  if (!shared.segment) warnings.push("No type column — mark Team, Client, or Vendor on review.");

  return [
    {
      segment: shared.segment,
      kind: parsedKind,
      name: name || contactNameFromEmail(email) || "Unknown",
      contact_name: company && personName && personName !== company ? personName : undefined,
      email,
      phone: shared.phone,
      company_code: shared.company_code,
      locations: shared.locations,
      notes: shared.notes,
      team_role: shared.team_role,
      warnings: warnings.length ? warnings : undefined,
    },
  ];
}
