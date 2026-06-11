import type { CompanyMemberDraft } from "@/lib/company-members";
import { findContactByEmail, loadContacts } from "@/lib/contacts-store";
import {
  commitClientWithMembers,
  commitSingleContact,
} from "@/lib/data/commit-contacts";
import {
  previewToContact,
  resolvedCodeForImportRow,
  validateImportCodeForContact,
  type ImportContactRowPreview,
} from "@/lib/csv/import-client-rows";
import type { Contact } from "@/lib/types/contact";

function partitionImportRows(rows: ImportContactRowPreview[]): {
  clientRows: ImportContactRowPreview[];
  otherRows: ImportContactRowPreview[];
} {
  const clientRows: ImportContactRowPreview[] = [];
  const otherRows: ImportContactRowPreview[] = [];
  for (const row of rows) {
    if (row.segment === "client") clientRows.push(row);
    else otherRows.push(row);
  }
  return { clientRows, otherRows };
}

function looksLikeCompanyName(name: string): boolean {
  return /\b(LLC|L\.L\.C\.|Inc|Corp|Corporation|Ltd|Studio|Worldwide|Company|Co\.)\b/i.test(
    name,
  );
}

function pickCompanyParentRow(group: ImportContactRowPreview[]): ImportContactRowPreview {
  const explicit = group.find((r) => r.kind === "company");
  if (explicit) return explicit;
  const named = group.find((r) => looksLikeCompanyName(r.name));
  if (named) return named;
  return group.reduce((best, row) =>
    row.name.trim().length >= best.name.trim().length ? row : best,
  );
}

function groupClientRows(rows: ImportContactRowPreview[]): ImportContactRowPreview[][] {
  const byCode = new Map<string, ImportContactRowPreview[]>();
  for (const row of rows) {
    const code = resolvedCodeForImportRow(row);
    const list = byCode.get(code) ?? [];
    list.push(row);
    byCode.set(code, list);
  }

  const groups: ImportContactRowPreview[][] = [];
  for (const list of byCode.values()) {
    if (list.length === 1) {
      groups.push(list);
      continue;
    }

    const companyRows = list.filter((r) => r.kind === "company");
    if (companyRows.length > 1) {
      for (const row of companyRows) groups.push([row]);
      const memberLike = list.filter((r) => r.kind !== "company");
      if (memberLike.length > 0) groups.push(memberLike);
      continue;
    }

    groups.push(list);
  }
  return groups;
}

function memberDraftFromRow(row: ImportContactRowPreview, existing?: Contact): CompanyMemberDraft {
  const name =
    row.kind === "individual"
      ? row.contact_name?.trim() || row.name.trim()
      : row.contact_name?.trim() || row.name.trim() || row.email.trim();
  return {
    id: existing?.id ?? row.rowKey,
    name,
    email: row.email.trim(),
    phone: row.phone?.trim() ?? "",
    isNew: !existing,
  };
}

function replaceWorking(working: Contact[], next: Contact[]): void {
  working.length = 0;
  working.push(...next);
}

async function commitClientGroup(
  group: ImportContactRowPreview[],
  working: Contact[],
): Promise<{ saved: number; failures: string[] }> {
  const failures: string[] = [];
  let saved = 0;

  if (group.length === 1) {
    const row = group[0]!;
    const existing = findContactByEmail(working, row.email);
    const contact = previewToContact(row, existing);
    const codeErr = validateImportCodeForContact(working, contact, {
      excludeContactId: existing?.id,
    });
    if (codeErr) {
      failures.push(`${row.name}: ${codeErr}`);
      return { saved, failures };
    }
    try {
      await commitSingleContact(contact);
      replaceWorking(working, loadContacts());
      saved++;
    } catch (e) {
      failures.push(`${row.name}: ${e instanceof Error ? e.message : "Save failed"}`);
    }
    return { saved, failures };
  }

  const companyRow = pickCompanyParentRow(group);
  const memberRows = group.filter(
    (r) => r !== companyRow && r.email.trim().toLowerCase() !== companyRow.email.trim().toLowerCase(),
  );
  const companyExisting = findContactByEmail(working, companyRow.email);

  const companyContact = previewToContact(
    { ...companyRow, kind: "company" },
    companyExisting,
  );
  const codeErr = validateImportCodeForContact(working, companyContact, {
    excludeContactId: companyExisting?.id,
  });
  if (codeErr) {
    failures.push(`${companyRow.name}: ${codeErr}`);
    return { saved, failures };
  }

  const drafts: CompanyMemberDraft[] = [];
  for (const row of memberRows) {
    const existing = findContactByEmail(working, row.email);
    drafts.push(memberDraftFromRow(row, existing ?? undefined));
  }

  if (drafts.length === 0 && companyRow.contact_name?.trim()) {
    drafts.push(memberDraftFromRow(companyRow, companyExisting ?? undefined));
  }

  try {
    const persisted = await commitClientWithMembers(working, companyContact, drafts);
    replaceWorking(working, loadContacts());
    saved += 1 + (persisted.member_contact_ids?.length ?? 0);
  } catch (e) {
    failures.push(`${companyRow.name}: ${e instanceof Error ? e.message : "Save failed"}`);
  }

  return { saved, failures };
}

export async function commitImportRows(
  rows: ImportContactRowPreview[],
  initialContacts: Contact[],
): Promise<{ saved: number; failures: string[] }> {
  const working = [...initialContacts];
  const failures: string[] = [];
  let saved = 0;

  const { clientRows, otherRows } = partitionImportRows(rows);

  for (const row of otherRows) {
    const existing = findContactByEmail(working, row.email);
    const contact = previewToContact(row, existing);
    const codeErr = validateImportCodeForContact(working, contact, {
      excludeContactId: existing?.id,
    });
    if (codeErr) {
      failures.push(`${row.name}: ${codeErr}`);
      continue;
    }
    try {
      await commitSingleContact(contact);
      replaceWorking(working, loadContacts());
      saved++;
    } catch (e) {
      failures.push(`${row.name}: ${e instanceof Error ? e.message : "Save failed"}`);
    }
  }

  for (const group of groupClientRows(clientRows)) {
    const result = await commitClientGroup(group, working);
    saved += result.saved;
    failures.push(...result.failures);
  }

  return { saved, failures };
}
