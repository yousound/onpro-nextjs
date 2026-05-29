const PO_PATTERN_WITH_MONTH = /^([A-Z0-9]{2,3})-(\d{4})-(\d{2})-(\d{3})$/;
const PO_PATTERN_LEGACY = /^([A-Z0-9]{2,3})-(\d{4})-(\d{3})$/;

function parsePoParts(po: string): { clientCode: string; year: number; month: number; seq: number } | null {
  const trimmed = po.trim();
  const withMonth = trimmed.match(PO_PATTERN_WITH_MONTH);
  if (withMonth) {
    return {
      clientCode: withMonth[1],
      year: parseInt(withMonth[2], 10),
      month: parseInt(withMonth[3], 10),
      seq: parseInt(withMonth[4], 10),
    };
  }
  const legacy = trimmed.match(PO_PATTERN_LEGACY);
  if (legacy) {
    return {
      clientCode: legacy[1],
      year: parseInt(legacy[2], 10),
      month: 0,
      seq: parseInt(legacy[3], 10),
    };
  }
  return null;
}

/** Generate next PO: `{ClientCode}-{Year}-{Month}-{Seq}` e.g. GG-2026-05-001 */
export function generatePoNumber(
  clientCode: string,
  existingPos: string[],
  date: Date = new Date(),
): string {
  const code = clientCode.trim().toUpperCase();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  let maxSeq = 0;
  for (const po of existingPos) {
    const parts = parsePoParts(po);
    if (parts && parts.clientCode === code && parts.year === year && parts.month === parseInt(month, 10)) {
      maxSeq = Math.max(maxSeq, parts.seq);
    }
  }
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `${code}-${year}-${month}-${seq}`;
}

export function parsePoNumber(
  po: string,
): { clientCode: string; year: number; month: number; seq: number } | null {
  return parsePoParts(po);
}

export function isPoNumber(value: string): boolean {
  return parsePoParts(value) !== null;
}

export function collectAllPoNumbers(
  projects: { po_number?: string | null; project_number?: string | null }[],
  jobPos: string[] = [],
): string[] {
  const out: string[] = [];
  for (const p of projects) {
    if (p.po_number) out.push(p.po_number);
    if (p.project_number && isPoNumber(p.project_number)) out.push(p.project_number);
  }
  for (const po of jobPos) {
    if (po) out.push(po);
  }
  return out;
}
