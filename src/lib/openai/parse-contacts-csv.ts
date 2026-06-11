import { expandParsedImportRows } from "@/lib/csv/expand-import-rows";
import {
  filterImportRowsByCompanies,
  parseCompanyFilterText,
} from "@/lib/csv/filter-import-by-companies";
import { mergeImportLocations } from "@/lib/csv/parse-import-locations";
import { normalizeImportSegment } from "@/lib/csv/normalize-import-segment";
import { normalizeParsedImportRows } from "@/lib/csv/normalize-import-row";
import { IMPORT_AI_MAX_CHARS, IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";
import { openAiChatJson } from "@/lib/openai/chat-completion";
import type { PeopleSegment } from "@/lib/mock/people";
import type { ContactKind, TeamRole } from "@/lib/types/contact";
import type { ParsedImportContactRow, ParseContactsCsvResponse } from "@/lib/types/contact-import";

type AiPayload = {
  rows: Array<ParsedImportContactRow & { segment?: PeopleSegment | null | string }>;
  summary?: string;
};

function parseSegmentFromAi(raw: unknown): PeopleSegment | null {
  if (raw === null || raw === undefined) return null;
  return normalizeImportSegment(String(raw));
}

function normalizeKind(kind: string | undefined, segment: PeopleSegment | null): ContactKind {
  if (kind === "individual" || kind === "company") return kind;
  if (segment === "team") return "individual";
  if (segment === "vendor") return "company";
  return "company";
}

function normalizeTeamRole(raw: string | undefined): TeamRole | undefined {
  const s = raw?.trim().toLowerCase();
  if (!s) return undefined;
  if (s === "admin") return "admin";
  if (s === "manager") return "manager";
  if (s === "staff") return "staff";
  if (s === "temp") return "temp";
  return "custom";
}

export type ParseContactsCsvOptions = {
  /** When set, only return rows for these company names (flexible match). */
  companyFilter?: string;
};

export async function parseContactsCsvWithOpenAi(
  csvText: string,
  opts?: ParseContactsCsvOptions,
): Promise<ParseContactsCsvResponse> {
  const clipped =
    csvText.length > IMPORT_AI_MAX_CHARS ? csvText.slice(0, IMPORT_AI_MAX_CHARS) : csvText;
  const companyFilters = parseCompanyFilterText(opts?.companyFilter ?? "");
  const filterInstruction =
    companyFilters.length > 0
      ? `\n\nCOMPANY FILTER — return ONLY rows for these companies (include every person/contact at each company):
${companyFilters.map((name) => `- ${name}`).join("\n")}
Match flexibly on company name, contact name, notes, email domain, or any column text (partial/case-insensitive). Skip all other companies.`
      : "";

  const result = await openAiChatJson<AiPayload>(
    [
      {
        role: "system",
        content: `You extract People directory contacts from CSV exports for a production/decorating CRM (OnPro).
Return JSON only: { "rows": [...], "summary": "one sentence" }.
Each row includes segment: "team" | "vendor" | "client" | null.
- Use explicit Type/Segment/Role columns when present.
- When you can infer confidently: internal operators → team; factories/suppliers → vendor; buyers/brands → client.
- When segment is missing, blank, or ambiguous, set segment to null (do NOT guess client). Add a warning.

CRITICAL — read every column:
- Scan ALL columns in each CSV row, including numbered pairs (Contact 1 / Email 1 / Contact 2 / Email 2), first name + last name, and unnamed extra columns.
- Do not skip a person because their name or email is in a non-standard column.
- One person per row in output; wide rows with multiple people become multiple output rows.

CRITICAL — one person per row:
- Output exactly ONE row per distinct person/contact in the CSV.
- NEVER merge multiple people into one row because they share a company, domain (@gmail.com, @acme.com), or organization name.
- If one CSV row lists multiple email addresses, output MULTIPLE rows (duplicate company fields, one email each).
- Put exactly ONE email address in "email". Use other_emails only for secondary addresses on the SAME person, not for different people.
- Put a person's name in contact_name, never concatenated into the email field.

Fields per row:
- segment (team|vendor|client|null)
- kind: "company" | "individual"
- name (required), contact_name, email, phone, company_code, other_emails, notes
- team_role for team rows only
- business_structure for vendor when present
- locations: unlimited array of { label?, line1?, line2?, city?, state?, postal_code?, country? }
- Put billing/shipping/site/warehouse columns into locations (labels like "Billing", "Shipping", "Location 1", etc.)
- billing_address / shipping_address still accepted — also mirror them into locations when present
- warnings: optional string array
Map flexible headers. Skip blank rows. Max ${IMPORT_ROW_LIMIT} rows.${filterInstruction}`,
      },
      {
        role: "user",
        content: `Parse this CSV into People directory rows:\n\n${clipped}`,
      },
    ],
    { temperature: 0.2 },
  );

  const normalized = normalizeParsedImportRows(
    (result.rows ?? [])
      .filter((r) => r && (r.email?.trim() || r.name?.trim() || r.contact_name?.trim()))
      .map((r) => {
      const segment = parseSegmentFromAi(r.segment);
      const locations = mergeImportLocations(
        r.locations,
        r.billing_address,
        r.shipping_address,
      );
      return {
        ...r,
        segment,
        kind: normalizeKind(r.kind, segment),
        name: String(r.name ?? "").trim(),
        email: String(r.email ?? "").trim(),
        company_code: r.company_code?.trim().toUpperCase().slice(0, 3),
        team_role: segment === "team" ? normalizeTeamRole(r.team_role) ?? "staff" : undefined,
        locations,
        billing_address: undefined,
        shipping_address: undefined,
      };
    }),
  );

  const expanded = expandParsedImportRows(normalized);
  const filtered = filterImportRowsByCompanies(
    normalizeParsedImportRows(expanded),
    opts?.companyFilter,
  );
  const rows = filtered.slice(0, IMPORT_ROW_LIMIT);

  const labeled = rows.filter((r) => r.segment);
  const unlabeled = rows.length - labeled.length;
  const filterNote =
    companyFilters.length > 0
      ? ` Matched ${rows.length} row(s) for ${companyFilters.join(", ")}.`
      : "";

  return {
    rows,
    summary:
      result.summary?.trim() ||
      `Parsed ${rows.length} row(s) — ${labeled.filter((r) => r.segment === "client").length} client, ${labeled.filter((r) => r.segment === "vendor").length} vendor, ${labeled.filter((r) => r.segment === "team").length} team${unlabeled ? `, ${unlabeled} need a type on review` : ""}.${filterNote}`,
    source: "openai",
  };
}
