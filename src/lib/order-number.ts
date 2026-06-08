import type { ProjectOrder } from "@/lib/types/wip";

/** MAT260602 → operator MAT, year 26, month 06, seq 02 */
const ORDER_NUMBER_PATTERN = /^([A-Z0-9]{2,4})(\d{2})(\d{2})(\d{2,3})$/;

export function parseOrderNumber(
  value: string,
): { operatorCode: string; year: number; month: number; seq: number } | null {
  const m = value.trim().toUpperCase().match(ORDER_NUMBER_PATTERN);
  if (!m) return null;
  return {
    operatorCode: m[1]!,
    year: parseInt(m[2]!, 10),
    month: parseInt(m[3]!, 10),
    seq: parseInt(m[4]!, 10),
  };
}

export function formatOrderNumber(
  operatorCode: string,
  year: number,
  month: number,
  seq: number,
): string {
  const code = operatorCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const ss = String(seq).padStart(2, "0");
  return `${code}${yy}${mm}${ss}`;
}

/**
 * Next order number for operator prefix + calendar month.
 * Scans existing orders across all projects in the workspace list provided.
 */
export function generateOrderNumber(
  operatorCode: string,
  existingOrders: ProjectOrder[],
  date: Date = new Date(),
): string {
  const code = operatorCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "OP";
  const yy = date.getFullYear() % 100;
  const mm = date.getMonth() + 1;
  let maxSeq = 0;
  for (const o of existingOrders) {
    const parts = parseOrderNumber(o.order_number);
    if (parts && parts.operatorCode === code && parts.year === yy && parts.month === mm) {
      maxSeq = Math.max(maxSeq, parts.seq);
    }
  }
  return formatOrderNumber(code, date.getFullYear(), mm, maxSeq + 1);
}

export function isOrderNumber(value: string): boolean {
  return parseOrderNumber(value) !== null;
}
