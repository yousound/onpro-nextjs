/** Compact PO: ClientCode + YYMM + Seq2 — e.g. GG260601, DW260607 */

const PO_PATTERN_COMPACT = /^([A-Z0-9]{2,4})(\d{4})(\d{2})$/;
const PO_PATTERN_DASHED_MONTH = /^([A-Z0-9]{2,4})-(\d{4})-(\d{2})-(\d{2,3})$/;
const PO_PATTERN_DASHED_LEGACY = /^([A-Z0-9]{2,4})-(\d{4})-(\d{3})$/;

export type PoParts = { clientCode: string; year: number; month: number; seq: number };

function yymmFromDate(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

function yearFromYy(yy: number): number {
  return 2000 + yy;
}

function poYymm(parts: PoParts): string | null {
  if (parts.month < 1 || parts.month > 12) return null;
  return `${String(parts.year % 100).padStart(2, "0")}${String(parts.month).padStart(2, "0")}`;
}

function parsePoParts(po: string): PoParts | null {
  const trimmed = po.trim().toUpperCase();

  const compact = trimmed.match(PO_PATTERN_COMPACT);
  if (compact) {
    const yy = parseInt(compact[2].slice(0, 2), 10);
    const mm = parseInt(compact[2].slice(2, 4), 10);
    const seq = parseInt(compact[3], 10);
    if (mm < 1 || mm > 12) return null;
    return { clientCode: compact[1], year: yearFromYy(yy), month: mm, seq };
  }

  const dashed = trimmed.match(PO_PATTERN_DASHED_MONTH);
  if (dashed) {
    return {
      clientCode: dashed[1],
      year: parseInt(dashed[2], 10),
      month: parseInt(dashed[3], 10),
      seq: parseInt(dashed[4], 10),
    };
  }

  const legacy = trimmed.match(PO_PATTERN_DASHED_LEGACY);
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

export function formatPoNumber(clientCode: string, date: Date, seq: number): string {
  const code = clientCode.trim().toUpperCase();
  return `${code}${yymmFromDate(date)}${String(seq).padStart(2, "0")}`;
}

/** Generate next PO: `{ClientCode}{YYMM}{Seq}` e.g. GG260601 */
export function generatePoNumber(
  clientCode: string,
  existingPos: string[],
  date: Date = new Date(),
): string {
  const code = clientCode.trim().toUpperCase();
  const yymm = yymmFromDate(date);
  let maxSeq = 0;

  for (const po of existingPos) {
    const parts = parsePoParts(po);
    if (!parts || parts.clientCode !== code) continue;
    if (poYymm(parts) === yymm) {
      maxSeq = Math.max(maxSeq, parts.seq);
    }
  }

  return formatPoNumber(code, date, maxSeq + 1);
}

/** Keep PO when still in the same month; assign the next seq when the month changes. */
export function rollPoNumberIfNewMonth(
  currentPo: string | null | undefined,
  clientCode: string,
  existingPos: string[],
  date: Date = new Date(),
): string {
  const code = clientCode.trim().toUpperCase();
  const trimmed = currentPo?.trim();
  if (!trimmed) return generatePoNumber(code, existingPos, date);

  const parts = parsePoParts(trimmed);
  if (!parts || parts.clientCode !== code) {
    return generatePoNumber(code, existingPos, date);
  }

  const currentYymm = poYymm(parts);
  if (currentYymm && currentYymm === yymmFromDate(date)) return trimmed;
  return generatePoNumber(code, existingPos, date);
}

export function parsePoNumber(po: string): PoParts | null {
  return parsePoParts(po);
}

export function isPoNumber(value: string): boolean {
  return parsePoParts(value) !== null;
}

export function projectPoNumber(project: {
  po_number?: string | null;
  project_number?: string | null;
}): string | null {
  return project.po_number?.trim() || project.project_number?.trim() || null;
}

export function collectAllPoNumbers(
  projects: { po_number?: string | null; project_number?: string | null }[],
  jobPos: string[] = [],
): string[] {
  const out: string[] = [];
  for (const p of projects) {
    const po = projectPoNumber(p);
    if (po) out.push(po);
  }
  for (const po of jobPos) {
    if (po) out.push(po);
  }
  return out;
}
