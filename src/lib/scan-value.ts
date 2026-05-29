/** Legacy `i` + 6 digits, or plain 6-digit scan IDs (team inventory). */
const SCAN_VALUE_PATTERN = /^(?:i)?(\d{6})$/i;

export function scanValueDigits(value: string): string | null {
  const m = value.trim().match(SCAN_VALUE_PATTERN);
  return m ? m[1] : null;
}

export function isScanValue(value: string): boolean {
  return scanValueDigits(value) !== null;
}

/** Normalize stored scan value to 6 digits (no `i` prefix). */
export function normalizeScanValue(value: string): string {
  const digits = scanValueDigits(value);
  return digits ?? value.trim();
}

/** Value encoded in Code128 — plain 6-digit ID. */
export function barcodeEncodeValue(scanValue: string): string {
  return normalizeScanValue(scanValue);
}

/** Next sequential scan ID across jobs (6 digits). */
export function generateScanValue(existingValues: string[]): string {
  let max = 0;
  for (const raw of existingValues) {
    const digits = scanValueDigits(raw);
    if (digits) max = Math.max(max, parseInt(digits, 10));
  }
  return String(max + 1).padStart(6, "0");
}

export function collectScanValuesFromJobs(
  jobs: { barcode?: string; label_lines?: { scan_value?: string }[] }[],
): string[] {
  const out: string[] = [];
  for (const job of jobs) {
    if (job.barcode && isScanValue(job.barcode)) out.push(normalizeScanValue(job.barcode));
    for (const line of job.label_lines ?? []) {
      if (line.scan_value && isScanValue(line.scan_value)) out.push(normalizeScanValue(line.scan_value));
    }
  }
  return out;
}
