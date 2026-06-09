import {
  validateClientCompanyCode,
  validateClientContactFields,
  validateDirectoryCompanyCode,
} from "@/lib/contact-field-validation";
import { resolveClientCode } from "@/lib/reference/client-codes";
import { findContactByEmail, newContactId } from "@/lib/contacts-store";
import type { PeopleSegment } from "@/lib/mock/people";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import type { Address, Contact, ContactLocation } from "@/lib/types/contact";
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

function locationLabelNorm(label: string | undefined): string {
  return (label ?? "").trim().toLowerCase();
}

function locationToAddress(loc: ContactLocation): Address {
  const { label: _label, ...addr } = loc;
  return addr;
}

function legacyAddressesFromLocations(locations: ContactLocation[] | undefined): {
  billing_address?: Address;
  shipping_address?: Address;
} {
  if (!locations?.length) return {};
  const billing = locations.find((loc) => {
    const label = locationLabelNorm(loc.label);
    return label === "billing" || label.includes("bill");
  });
  const shipping = locations.find((loc) => {
    const label = locationLabelNorm(loc.label);
    return label === "shipping" || label.includes("ship");
  });
  return {
    billing_address: billing ? locationToAddress(billing) : undefined,
    shipping_address: shipping ? locationToAddress(shipping) : undefined,
  };
}

function suggestImportCompanyCode(row: ParsedImportContactRow): string | undefined {
  if (row.segment !== "client" && row.segment !== "vendor") return row.company_code;
  if (row.segment === "client") {
    return resolveClientCode(row.name);
  }
  return row.company_code?.trim().toUpperCase().slice(0, 3) || deriveCompanyCode(row.name);
}

function withSuggestedCompanyCode(row: ParsedImportContactRow): ParsedImportContactRow {
  if (row.segment !== "client" && row.segment !== "vendor") return row;
  return { ...row, company_code: suggestImportCompanyCode(row) };
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
    const hinted = withSuggestedCompanyCode(row);
    const rowKey = `${i}-${hinted.email || hinted.name}`;
    const check = validateImportRow(hinted, existingContacts);
    return { ...hinted, rowKey, ...check };
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
  const locations = row.locations?.filter(
    (loc) =>
      loc.label?.trim() ||
      loc.line1?.trim() ||
      loc.line2?.trim() ||
      loc.city?.trim() ||
      loc.state?.trim() ||
      loc.postal_code?.trim() ||
      loc.country?.trim(),
  );
  const legacyAddresses = legacyAddressesFromLocations(locations);

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
    billing_address: row.billing_address ?? legacyAddresses.billing_address,
    shipping_address: row.shipping_address ?? legacyAddresses.shipping_address,
    locations: locations?.length ? locations : undefined,
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
  const merged = {
    ...row,
    ...patch,
    segment,
    kind,
    company_code:
      patch.company_code !== undefined
        ? patch.company_code.toUpperCase().slice(0, 3)
        : row.company_code,
    team_role: segment === "team" ? (patch.team_role ?? row.team_role ?? "staff") : undefined,
  };
  const hinted =
    patch.company_code === undefined && (patch.segment !== undefined || patch.name !== undefined)
      ? withSuggestedCompanyCode(merged)
      : merged;
  return revalidateImportPreview(hinted as ImportContactRowPreview, contacts);
}
