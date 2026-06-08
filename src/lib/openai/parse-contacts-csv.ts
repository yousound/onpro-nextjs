import { expandParsedImportRows } from "@/lib/csv/expand-import-rows";
import { normalizeImportSegment } from "@/lib/csv/normalize-import-segment";
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

export async function parseContactsCsvWithOpenAi(csvText: string): Promise<ParseContactsCsvResponse> {
  const clipped =
    csvText.length > IMPORT_AI_MAX_CHARS ? csvText.slice(0, IMPORT_AI_MAX_CHARS) : csvText;

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
- billing_address / shipping_address when columns exist
- warnings: optional string array
Map flexible headers. Skip blank rows. Max ${IMPORT_ROW_LIMIT} rows.`,
      },
      {
        role: "user",
        content: `Parse this CSV into People directory rows:\n\n${clipped}`,
      },
    ],
    { temperature: 0.2 },
  );

  const normalized = (result.rows ?? [])
    .filter((r) => r && (r.email?.trim() || r.name?.trim()))
    .map((r) => {
      const segment = parseSegmentFromAi(r.segment);
      return {
        ...r,
        segment,
        kind: normalizeKind(r.kind, segment),
        name: String(r.name ?? "").trim(),
        email: String(r.email ?? "").trim(),
        company_code: r.company_code?.trim().toUpperCase().slice(0, 3),
        team_role: segment === "team" ? normalizeTeamRole(r.team_role) ?? "staff" : undefined,
      };
    });

  const rows = expandParsedImportRows(normalized).slice(0, IMPORT_ROW_LIMIT);

  const labeled = rows.filter((r) => r.segment);
  const unlabeled = rows.length - labeled.length;

  return {
    rows,
    summary:
      result.summary?.trim() ||
      `Parsed ${rows.length} row(s) — ${labeled.filter((r) => r.segment === "client").length} client, ${labeled.filter((r) => r.segment === "vendor").length} vendor, ${labeled.filter((r) => r.segment === "team").length} team${unlabeled ? `, ${unlabeled} need a type on review` : ""}.`,
    source: "openai",
  };
}
