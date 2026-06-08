import {
  validateClientCompanyCode,
  validateClientContactFields,
} from "@/lib/contact-field-validation";
import { findContactByEmail, isCompanyCodeTaken, newContactId } from "@/lib/contacts-store";
import type { PeopleSegment } from "@/lib/mock/people";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import type { Contact } from "@/lib/types/contact";
import { deriveCompanyCode } from "@/lib/types/contact";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";

export type ImportContactRowPreview = ParsedImportContactRow & {
  rowKey: string;
  selected: boolean;
  status: "ready" | "skip" | "error" | "needs_segment";
  statusMessage?: string;
};

/** @deprecated */
export type ImportClientRowPreview = ImportContactRowPreview;

function resolvedCode(row: ParsedImportContactRow): string {
  return (row.company_code?.trim() || deriveCompanyCode(row.name)).toUpperCase().slice(0, 3);
}

function validateDirectoryCompanyCode(
  contacts: readonly Contact[],
  code: string,
): string | undefined {
  const c = code.trim().toUpperCase();
  if (c.length < 2 || c.length > 3) return "Code must be 2–3 letters.";
  if (isCompanyCodeTaken(contacts, c)) return `Code ${c} is already used.`;
  return undefined;
}

export function validateImportRow(
  row: ParsedImportContactRow,
  contacts: readonly Contact[],
): Pick<ImportContactRowPreview, "status" | "statusMessage" | "selected"> {
  const email = row.email.trim();
  const name = row.name.trim();

  if (!name) {
    return { selected: false, status: "error", statusMessage: "Name is required." };
  }
  if (!email) {
    return {
      selected: false,
      status: "error",
      statusMessage: "Email is required to import into People.",
    };
  }

  if (!row.segment) {
    return {
      selected: false,
      status: "needs_segment",
      statusMessage: "Mark as Team, Client, or Vendor.",
    };
  }

  const dup = findContactByEmail(contacts, email);
  if (dup) {
    return {
      selected: false,
      status: "skip",
      statusMessage: `Already in People as ${dup.segment} (${dup.name}).`,
    };
  }

  const code = resolvedCode(row);

  if (row.segment === "client") {
    const fieldErrors = validateClientContactFields(contacts, {
      kind: row.kind,
      name,
      email,
      companyCode: code,
      importName: name,
    });
    if (fieldErrors.companyCode) {
      return { selected: false, status: "error", statusMessage: fieldErrors.companyCode };
    }
    if (fieldErrors.email?.includes("already used for")) {
      return { selected: false, status: "error", statusMessage: fieldErrors.email };
    }
  } else {
    const codeErr = validateDirectoryCompanyCode(contacts, code);
    if (codeErr) {
      return { selected: false, status: "error", statusMessage: codeErr };
    }
  }

  return { selected: true, status: "ready" };
}

export function buildImportPreviews(
  rows: ParsedImportContactRow[],
  existingContacts: Contact[],
): ImportContactRowPreview[] {
  return rows.map((row, i) => {
    const rowKey = `${i}-${row.email || row.name}`;
    const check = validateImportRow(row, existingContacts);
    return { ...row, rowKey, ...check };
  });
}

export function revalidateImportPreview(
  row: ImportContactRowPreview,
  contacts: readonly Contact[],
): ImportContactRowPreview {
  const { rowKey: _rk, selected: _s, status: _st, statusMessage: _m, ...parsed } = row;
  const check = validateImportRow(parsed, contacts);
  return { ...parsed, rowKey: row.rowKey, ...check };
}

export function previewToContact(row: ImportContactRowPreview): Contact {
  if (!row.segment) {
    throw new Error("Cannot import a row without a segment");
  }
  const segment = row.segment;
  const now = new Date().toISOString();
  const name = row.name.trim();
  const email = row.email.trim();
  const code = resolvedCode(row);

  const base: Contact = {
    id: newContactId(),
    segment,
    kind: row.segment === "team" ? "individual" : row.kind,
    company_code: code,
    name,
    contact_name:
      segment === "team"
        ? name
        : row.kind === "company"
          ? row.contact_name?.trim() || undefined
          : undefined,
    email,
    phone: row.phone?.trim() || undefined,
    other_emails: row.other_emails?.filter(Boolean),
    billing_address: row.billing_address,
    shipping_address: row.shipping_address,
    notes: row.notes?.trim() || undefined,
    avatar_url: null,
    member_contact_ids: [],
    permissions: defaultPermissionsForSegment(segment),
    created_at: now,
    updated_at: now,
  };

  if (segment === "team") {
    return {
      ...base,
      kind: "individual",
      contact_name: name,
      team_role: row.team_role ?? "staff",
    };
  }

  if (segment === "vendor") {
    return {
      ...base,
      kind: "company",
      business_structure: row.business_structure,
      documents: [],
    };
  }

  return {
    ...base,
    contact_name: row.kind === "company" ? row.contact_name?.trim() || undefined : undefined,
  };
}

export function validateImportCodeForContact(
  contacts: readonly Contact[],
  contact: Contact,
): string | undefined {
  if (contact.segment === "client") {
    return validateClientCompanyCode(contacts, contact.company_code, undefined, {
      importName: contact.name,
    });
  }
  return validateDirectoryCompanyCode(contacts, contact.company_code);
}

export function patchImportPreview(
  row: ImportContactRowPreview,
  patch: Partial<ParsedImportContactRow>,
  contacts: readonly Contact[],
): ImportContactRowPreview {
  let kind = patch.kind ?? row.kind;
  const segment = patch.segment !== undefined ? patch.segment : row.segment;
  if (segment) {
    kind =
      segment === "team"
        ? "individual"
        : segment === "vendor"
          ? "company"
          : row.kind;
  }
  return revalidateImportPreview(
    {
      ...row,
      ...patch,
      segment,
      kind,
      company_code:
        patch.company_code !== undefined
          ? patch.company_code.toUpperCase().slice(0, 3)
          : row.company_code,
      team_role: segment === "team" ? (patch.team_role ?? row.team_role ?? "staff") : undefined,
    },
    contacts,
  );
}
