/** Max contacts parsed and imported per batch (AI + fallback). Larger files are auto-chunked. */
export const IMPORT_ROW_LIMIT = 200;

/** Max CSV file size in the browser upload control (full file; we chunk client-side). */
export const IMPORT_CSV_MAX_BYTES = 2_000_000;

/** Max characters sent to OpenAI for one parse request. */
export const IMPORT_AI_MAX_CHARS = 120_000;

/** Max characters accepted by the import API. */
export const IMPORT_API_MAX_CHARS = 600_000;

export function countCsvDataRows(csvText: string): number {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return Math.max(0, lines.length - 1);
}

export function importBatchHint(rowCount: number): string {
  if (rowCount <= IMPORT_ROW_LIMIT) {
    return `This file has ${rowCount} row${rowCount === 1 ? "" : "s"}.`;
  }
  const batches = Math.ceil(rowCount / IMPORT_ROW_LIMIT);
  return `This file has ${rowCount} rows — we'll process it in ${batches} batches of up to ${IMPORT_ROW_LIMIT} (review and import each batch in order).`;
}
