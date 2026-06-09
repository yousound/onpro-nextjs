import { countCsvDataRows } from "@/lib/csv/import-limits";

const STORAGE_KEY = "onpro-people-import-csv";

export type SavedImportCsvSession = {
  fileName: string;
  csvText: string;
  companyFilter: string;
  savedAt: string;
  totalDataRows: number;
};

export function loadImportCsvSession(): SavedImportCsvSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedImportCsvSession>;
    if (!parsed.fileName?.trim() || !parsed.csvText?.trim()) return null;
    return {
      fileName: parsed.fileName.trim(),
      csvText: parsed.csvText,
      companyFilter: parsed.companyFilter?.trim() ?? "",
      savedAt: parsed.savedAt ?? new Date().toISOString(),
      totalDataRows: parsed.totalDataRows ?? countCsvDataRows(parsed.csvText),
    };
  } catch {
    return null;
  }
}

export function saveImportCsvSession(input: {
  fileName: string;
  csvText: string;
  companyFilter?: string;
}): SavedImportCsvSession {
  const session: SavedImportCsvSession = {
    fileName: input.fileName.trim() || "import.csv",
    csvText: input.csvText,
    companyFilter: input.companyFilter?.trim() ?? "",
    savedAt: new Date().toISOString(),
    totalDataRows: countCsvDataRows(input.csvText),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export function updateImportCsvCompanyFilter(companyFilter: string): void {
  const existing = loadImportCsvSession();
  if (!existing) return;
  saveImportCsvSession({
    fileName: existing.fileName,
    csvText: existing.csvText,
    companyFilter,
  });
}

export function clearImportCsvSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
