import { isPoNumber, parsePoNumber } from "@/lib/po-number";
import { resolveClientCode } from "@/lib/reference/client-codes";

export type PoPrefixMismatch = {
  mismatch: boolean;
  poCode: string | null;
  clientCode: string;
  message: string | null;
};

/** Warn when email PO prefix (e.g. VOS) does not match the selected client code (e.g. ST). */
export function poPrefixMismatch(
  clientName: string,
  clientCode: string | null | undefined,
  poNumber: string | null | undefined,
): PoPrefixMismatch {
  const po = poNumber?.trim().toUpperCase();
  const expected = (clientCode?.trim() || resolveClientCode(clientName)).toUpperCase();
  if (!po || !isPoNumber(po)) {
    return { mismatch: false, poCode: null, clientCode: expected, message: null };
  }
  const parts = parsePoNumber(po);
  if (!parts) {
    return { mismatch: false, poCode: null, clientCode: expected, message: null };
  }
  if (parts.clientCode === expected) {
    return { mismatch: false, poCode: parts.clientCode, clientCode: expected, message: null };
  }
  const name = clientName.trim() || "this client";
  return {
    mismatch: true,
    poCode: parts.clientCode,
    clientCode: expected,
    message: `PO prefix ${parts.clientCode} does not match client code ${expected} for “${name}”. Confirm the client or PO before creating the project.`,
  };
}
