const PO_PATTERN = /^([A-Z0-9]{2,3})-(\d{4})-(\d{3})$/;

/** Generate next PO: `{ClientCode}-{Year}-{Seq}` e.g. GG-2026-001 */
export function generatePoNumber(
  clientCode: string,
  existingPos: string[],
  year = new Date().getFullYear(),
): string {
  const code = clientCode.trim().toUpperCase();
  let maxSeq = 0;
  for (const po of existingPos) {
    const m = po.trim().match(PO_PATTERN);
    if (m && m[1] === code && parseInt(m[2], 10) === year) {
      maxSeq = Math.max(maxSeq, parseInt(m[3], 10));
    }
  }
  const seq = String(maxSeq + 1).padStart(3, "0");
  return `${code}-${year}-${seq}`;
}

export function parsePoNumber(po: string): { clientCode: string; year: number; seq: number } | null {
  const m = po.trim().match(PO_PATTERN);
  if (!m) return null;
  return { clientCode: m[1], year: parseInt(m[2], 10), seq: parseInt(m[3], 10) };
}

export function collectAllPoNumbers(projects: { po_number?: string | null; project_number?: string | null }[]): string[] {
  const out: string[] = [];
  for (const p of projects) {
    if (p.po_number) out.push(p.po_number);
    if (p.project_number && PO_PATTERN.test(p.project_number)) out.push(p.project_number);
  }
  return out;
}
