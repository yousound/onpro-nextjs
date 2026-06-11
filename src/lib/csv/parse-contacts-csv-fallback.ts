import { expandParsedImportRows } from "@/lib/csv/expand-import-rows";
import { extractContactsFromCsvRow } from "@/lib/csv/extract-row-contacts";
import { IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";
import { normalizeParsedImportRows } from "@/lib/csv/normalize-import-row";
import { parseCsvTable } from "@/lib/csv/parse-csv-lines";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";

export function parseContactsCsvFallback(csvText: string): ParsedImportContactRow[] {
  const { headers, rows } = parseCsvTable(csvText);
  if (headers.length === 0 || rows.length === 0) return [];

  const out: ParsedImportContactRow[] = [];
  for (const row of rows) {
    out.push(...extractContactsFromCsvRow(headers, row));
  }

  return expandParsedImportRows(normalizeParsedImportRows(out)).slice(0, IMPORT_ROW_LIMIT);
}
