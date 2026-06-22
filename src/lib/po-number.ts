/**
 * Compact record / PO: ClientCode + YYMM + Seq (2+ digits).
 * Examples: GG260601, MAT260618, YOU2606100 (seq continues past 99 — no wrap to 01).
 *
 * Monthly sequence is workspace-wide (shop counter for the month), not per client.
 */

const PO_PATTERN_DASHED_MONTH = /^([A-Z0-9]{2,4})-(\d{4})-(\d{2})-(\d{2,})$/;
const PO_PATTERN_DASHED_LEGACY = /^([A-Z0-9]{2,4})-(\d{4})-(\d{3})$/;
const INVOICE_SUFFIX_PATTERN = /^([A-Z0-9]{2,4}\d{6,})([ATS])$/;

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

/** Strip invoice type suffix (A/T/S) so LM260608A parses as LM260608. */
function stripInvoiceCodingSuffix(value: string): string {
  const m = value.match(INVOICE_SUFFIX_PATTERN);
  return m != null ? m[1]! : value;
}

function parseCompactRecord(trimmed: string): PoParts | null {
  if (trimmed.length < 8) return null;
  for (let clientLen = Math.min(4, trimmed.length - 6); clientLen >= 2; clientLen--) {
    const clientCode = trimmed.slice(0, clientLen);
    const digits = trimmed.slice(clientLen);
    if (!/^[A-Z0-9]+$/.test(clientCode)) continue;
    if (!/^\d{6,}$/.test(digits)) continue;
    const yymm = digits.slice(0, 4);
    const seqStr = digits.slice(4);
    if (seqStr.length < 2) continue;
    const yy = parseInt(yymm.slice(0, 2), 10);
    const mm = parseInt(yymm.slice(2, 4), 10);
    const seq = parseInt(seqStr, 10);
    if (mm < 1 || mm > 12 || !Number.isFinite(seq) || seq < 1) continue;
    return { clientCode, year: yearFromYy(yy), month: mm, seq };
  }
  return null;
}

function parsePoParts(po: string): PoParts | null {
  const trimmed = stripInvoiceCodingSuffix(po.trim().toUpperCase());

  const compact = parseCompactRecord(trimmed);
  if (compact) return compact;

  const dashed = trimmed.match(PO_PATTERN_DASHED_MONTH);
  if (dashed) {
    const seq = parseInt(dashed[4], 10);
    if (!Number.isFinite(seq) || seq < 1) return null;
    return {
      clientCode: dashed[1],
      year: parseInt(dashed[2], 10),
      month: parseInt(dashed[3], 10),
      seq,
    };
  }

  const legacy = trimmed.match(PO_PATTERN_DASHED_LEGACY);
  if (legacy) {
    const seq = parseInt(legacy[3], 10);
    if (!Number.isFinite(seq) || seq < 1) return null;
    return {
      clientCode: legacy[1],
      year: parseInt(legacy[2], 10),
      month: 0,
      seq,
    };
  }
  return null;
}

/** Format monthly sequence: 01–99 padded; 100+ uses natural length. */
export function formatRecordSeq(seq: number): string {
  if (!Number.isFinite(seq) || seq < 1) return "01";
  if (seq < 100) return String(seq).padStart(2, "0");
  return String(seq);
}

export function formatPoNumber(clientCode: string, date: Date, seq: number): string {
  const code = clientCode.trim().toUpperCase();
  return `${code}${yymmFromDate(date)}${formatRecordSeq(seq)}`;
}

/** Highest record sequence for the given month across all compact PO/job numbers. */
export function maxMonthlyRecordSeq(existingValues: string[], date: Date = new Date()): number {
  const yymm = yymmFromDate(date);
  let maxSeq = 0;

  for (const value of existingValues) {
    const parts = parsePoParts(value);
    if (!parts) continue;
    if (poYymm(parts) === yymm) {
      maxSeq = Math.max(maxSeq, parts.seq);
    }
  }

  return maxSeq;
}

/** Next PO: `{ClientCode}{YYMM}{Seq}` — shop-wide monthly counter + client prefix. */
export function generatePoNumber(
  clientCode: string,
  existingPos: string[],
  date: Date = new Date(),
): string {
  const code = clientCode.trim().toUpperCase();
  const nextSeq = maxMonthlyRecordSeq(existingPos, date) + 1;
  return formatPoNumber(code, date, nextSeq);
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

/** True when the value is worth checking for duplicates while typing. */
export function shouldValidateProjectNumber(value: string): boolean {
  return value.trim().length > 0;
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

/** Invoice / PO coding suffix by job category (spreadsheet A / T / S columns). */
export type InvoiceCodingSuffix = "A" | "T" | "S";

export function invoiceCodingSuffixForJobType(
  jobType: string | null | undefined,
): InvoiceCodingSuffix | null {
  const t = jobType?.trim().toLowerCase() ?? "";
  if (t.includes("sample")) return "S";
  if (t.includes("art") || t.includes("design") || t.includes("creative")) return "A";
  if (t.includes("development") || t.includes("tech")) return "T";
  return null;
}

export function formatInvoiceCoding(baseRecordNumber: string, suffix: InvoiceCodingSuffix): string {
  const base = baseRecordNumber.trim().toUpperCase();
  if (!base) return "";
  const stripped = stripInvoiceCodingSuffix(base);
  return `${stripped}${suffix}`;
}
