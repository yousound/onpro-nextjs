import type { FinancialDocMode } from "@/components/financial-document-fullscreen";

export type FinancialsDeepLink = {
  docId: string;
  mode?: FinancialDocMode;
};

export function financialDocIdForQuote(quoteId: string): string {
  return `vq-${quoteId}`;
}

export function parseFinancialsDeepLink(params: URLSearchParams): FinancialsDeepLink | null {
  const docId = params.get("finDoc")?.trim();
  if (!docId) return null;
  const modeRaw = params.get("finMode");
  const mode: FinancialDocMode | undefined =
    modeRaw === "send" || modeRaw === "edit" || modeRaw === "preview" ? modeRaw : undefined;
  return { docId, mode };
}

export function applyFinancialsDeepLink(
  params: URLSearchParams,
  link: FinancialsDeepLink,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.set("module", "financials");
  next.set("finDoc", link.docId);
  if (link.mode && link.mode !== "preview") {
    next.set("finMode", link.mode);
  } else {
    next.delete("finMode");
  }
  return next;
}

export function clearFinancialsDeepLink(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete("finDoc");
  next.delete("finMode");
  return next;
}
