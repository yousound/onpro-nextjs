import type { DocumentKind } from "@/lib/types/documents";

export function kindLabel(k: DocumentKind): string {
  switch (k) {
    case "invoice":
      return "Invoice";
    case "quote":
      return "Quote";
    case "tech_pack":
      return "Tech pack";
    case "image":
      return "Image";
    default:
      return "File";
  }
}
