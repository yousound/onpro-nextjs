import type { Contact } from "@/lib/types/contact";
import { resolveClientCode } from "@/lib/reference/client-codes";

export type ClientCodeResolution = {
  /** Code used for POs, style prefixes, and order PO fields. */
  effectiveCode: string;
  /** Master-list / prefix-resolved code from the client name. */
  resolvedCode: string;
  /** Stored on the contact record (may be empty). */
  storedCode: string;
  /** Stored code differs from resolved and was not explicitly confirmed. */
  mismatch: boolean;
};

/** PO / project numbers — resolved name wins unless the contact code was confirmed. */
export function resolveEffectiveClientCode(
  clientName: string,
  storedCode?: string | null,
  confirmed?: boolean,
): ClientCodeResolution {
  const resolvedCode = resolveClientCode(clientName);
  const stored = storedCode?.trim().toUpperCase().slice(0, 4) ?? "";
  const mismatch = Boolean(stored && stored !== resolvedCode);
  const effectiveCode = confirmed && stored ? stored : resolvedCode;
  return { effectiveCode, resolvedCode, storedCode: stored, mismatch };
}

export function clientCodeFromContact(contact: Pick<Contact, "name" | "company_code" | "company_code_confirmed">): ClientCodeResolution {
  return resolveEffectiveClientCode(contact.name, contact.company_code, contact.company_code_confirmed);
}

export function clientCodeMismatchMessage(resolution: ClientCodeResolution, clientName: string): string | null {
  if (!resolution.mismatch) return null;
  return `Stored code ${resolution.storedCode} does not match master list ${resolution.resolvedCode} for “${clientName}”. Using ${resolution.effectiveCode} for POs unless you confirm the stored code.`;
}
