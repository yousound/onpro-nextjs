import {
  countCsvDataRows,
  IMPORT_AI_MAX_CHARS,
  IMPORT_ROW_LIMIT,
} from "@/lib/csv/import-limits";
import type { ParseContactsCsvResponse } from "@/lib/types/contact-import";

export type ImportParseBatchMeta = {
  chunkIndex: number;
  chunkCount: number;
  totalRowsInFile: number;
};

export function enrichImportParseResponse(
  result: ParseContactsCsvResponse,
  csvText: string,
  batch?: ImportParseBatchMeta,
): ParseContactsCsvResponse {
  const rowsReturned = result.rows.length;
  const rowsInChunk = countCsvDataRows(csvText);
  const rowsInFile = batch?.totalRowsInFile ?? rowsInChunk;
  const chunkCount = batch?.chunkCount ?? 1;
  const chunkIndex = batch?.chunkIndex ?? 0;
  const multiBatch = chunkCount > 1;

  let summary = result.summary;
  if (multiBatch) {
    summary = `${summary} Batch ${chunkIndex + 1} of ${chunkCount}.`;
  } else if (rowsInChunk > IMPORT_ROW_LIMIT) {
    summary = `${summary} Showing the first ${IMPORT_ROW_LIMIT} of ${rowsInChunk} rows.`;
  }

  return {
    ...result,
    summary,
    rowLimit: IMPORT_ROW_LIMIT,
    rowsInFile,
    rowsReturned,
    truncated: !batch && rowsInChunk > IMPORT_ROW_LIMIT,
    aiInputTruncated: csvText.length > IMPORT_AI_MAX_CHARS,
    chunkIndex: multiBatch ? chunkIndex : undefined,
    chunkCount: multiBatch ? chunkCount : undefined,
  };
}
