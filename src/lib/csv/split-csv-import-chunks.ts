import { IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";

export type CsvImportChunkPlan = {
  /** Full mini-CSV strings (header + up to IMPORT_ROW_LIMIT data rows each). */
  chunks: string[];
  totalDataRows: number;
  chunkCount: number;
};

/** Split a CSV into import-sized chunks (header repeated per chunk). */
export function planCsvImportChunks(
  csvText: string,
  chunkSize = IMPORT_ROW_LIMIT,
): CsvImportChunkPlan {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { chunks: [], totalDataRows: 0, chunkCount: 0 };
  }

  const header = lines[0];
  const dataLines = lines.slice(1);
  const chunks: string[] = [];

  for (let i = 0; i < dataLines.length; i += chunkSize) {
    const slice = dataLines.slice(i, i + chunkSize);
    chunks.push([header, ...slice].join("\n"));
  }

  return {
    chunks,
    totalDataRows: dataLines.length,
    chunkCount: chunks.length,
  };
}

export function chunkRowRange(
  chunkIndex: number,
  chunkSize: number,
  totalRows: number,
): { start: number; end: number } {
  const start = chunkIndex * chunkSize + 1;
  const end = Math.min((chunkIndex + 1) * chunkSize, totalRows);
  return { start, end };
}
