import {
  contactDisplayName,
  findContactByEmail,
  isCompanyCodeTaken,
} from "@/lib/contacts-store";
import { CLIENT_CODES } from "@/lib/reference/client-codes";
import type { Contact, ContactKind } from "@/lib/types/contact";

function namesAllowCodeOverride(companyName: string, catalogName: string): boolean {
  const cn = companyName.trim().toLowerCase();
  const catalog = catalogName.trim().toLowerCase();
  if (!cn || !catalog) return false;
  return cn === catalog || cn.includes(catalog) || catalog.includes(cn);
}

export type ClientContactFieldMessages = {
  companyCode?: string;
  email?: string;
};

export type ValidateClientContactInput = {
  kind: ContactKind;
  name: string;
  email: string;
  companyCode: string;
  /** When editing an existing row, or when email matches an existing contact to update */
  excludeContactId?: string;
  /** CSV import: allow code when it matches the master-list brand name */
  importName?: string;
};

export function validateClientCompanyCode(
  contacts: readonly Contact[],
  code: string,
  excludeContactId?: string,
  opts?: {
    /** CSV/import or form company name — allow master-list code when names match */
    importName?: string;
    companyName?: string;
  },
): string | undefined {
  const c = code.trim().toUpperCase();
  if (!c) return undefined;
  if (c.length < 2 || c.length > 3) {
    return "Client code must be 2–3 letters.";
  }

  const otherContact = contacts.find(
    (x) => x.id !== excludeContactId && x.company_code.toUpperCase() === c,
  );
  if (otherContact) {
    return `Code ${c} is already used by ${contactDisplayName(otherContact)} in People.`;
  }

  const catalog = CLIENT_CODES.find((entry) => entry.code === c);
  if (!catalog) return undefined;

  // Editing an existing client: only block duplicate codes in People, not master list.
  if (excludeContactId) return undefined;

  const label = opts?.companyName?.trim() || opts?.importName?.trim();
  if (label && namesAllowCodeOverride(label, catalog.name)) {
    return undefined;
  }

  return `Code ${c} is reserved for ${catalog.name} on the master list. Pick another code or use a matching company name.`;
}

export function validateClientEmail(
  contacts: readonly Contact[],
  email: string,
  excludeContactId?: string,
): string | undefined {
  const e = email.trim();
  if (!e) return undefined;
  if (!e.includes("@") || !e.includes(".")) return undefined;

  const match = findContactByEmail(contacts, e);
  if (!match) return undefined;
  if (excludeContactId && match.id === excludeContactId) return undefined;

  if (match.segment !== "client") {
    const label = match.segment === "team" ? "team member" : "vendor";
    return `This email is already used for a ${label} (${contactDisplayName(match)}).`;
  }

  return `This email is on file for ${contactDisplayName(match)}. Saving will update that client.`;
}

/** Live field checks for client create/edit forms */
export function validateClientContactFields(
  contacts: readonly Contact[],
  input: ValidateClientContactInput,
): ClientContactFieldMessages {
  const excludeId =
    input.excludeContactId ?? findContactByEmail(contacts, input.email)?.id;

  const companyCode = validateClientCompanyCode(
    contacts,
    input.companyCode,
    excludeId,
    {
      importName: input.importName,
      companyName: input.name,
    },
  );
  const email = validateClientEmail(contacts, input.email, input.excludeContactId);

  return { companyCode, email };
}

export function clientContactFormCanSubmit(
  messages: ClientContactFieldMessages,
  input: Pick<ValidateClientContactInput, "name" | "email" | "companyCode">,
): boolean {
  if (!input.name.trim() || !input.email.trim()) return false;
  if (!input.companyCode.trim()) return false;
  if (messages.companyCode) return false;
  if (messages.email?.includes("already used for")) return false;
  return true;
}

export function isClientEmailWarning(messages: ClientContactFieldMessages): boolean {
  return Boolean(messages.email?.includes("on file for"));
}

/** Vendor / non-client directory code — unique in People, 2–3 letters. */
export function validateDirectoryCompanyCode(
  contacts: readonly Contact[],
  code: string,
  excludeContactId?: string,
): string | undefined {
  const c = code.trim().toUpperCase();
  if (!c) return "Company code is required.";
  if (c.length < 2 || c.length > 3) return "Code must be 2–3 letters.";
  if (isCompanyCodeTaken(contacts, c, excludeContactId)) {
    return `Code ${c} is already used.`;
  }
  return undefined;
}
