import { IMPORT_CSV_MAX_BYTES } from "@/lib/csv/import-limits";

export async function readCsvFileAsText(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
    throw new Error("Please choose a .csv file.");
  }
  if (file.size > IMPORT_CSV_MAX_BYTES) {
    throw new Error("CSV must be 2 MB or smaller.");
  }
  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("That file is empty.");
  return trimmed;
}
