import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { enrichImportParseResponse } from "@/lib/csv/enrich-import-response";
import { IMPORT_API_MAX_CHARS } from "@/lib/csv/import-limits";
import {
  filterImportRowsByCompanies,
  parseCompanyFilterText,
} from "@/lib/csv/filter-import-by-companies";
import { parseContactsCsvFallback } from "@/lib/csv/parse-contacts-csv-fallback";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { parseContactsCsvWithOpenAi } from "@/lib/openai/parse-contacts-csv";
import type { ParseContactsCsvResponse } from "@/lib/types/contact-import";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();
  if (live) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    csvText?: string;
    companyFilter?: string;
    batch?: { chunkIndex?: number; chunkCount?: number; totalRowsInFile?: number };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const csvText = body.csvText?.trim();
  const companyFilter = body.companyFilter?.trim() || undefined;
  const batchMeta =
    body.batch &&
    typeof body.batch.chunkIndex === "number" &&
    typeof body.batch.chunkCount === "number" &&
    typeof body.batch.totalRowsInFile === "number"
      ? {
          chunkIndex: body.batch.chunkIndex,
          chunkCount: body.batch.chunkCount,
          totalRowsInFile: body.batch.totalRowsInFile,
        }
      : undefined;
  if (!csvText) {
    return NextResponse.json({ error: "csvText is required" }, { status: 400 });
  }
  if (csvText.length > IMPORT_API_MAX_CHARS) {
    return NextResponse.json({ error: "CSV is too large (max ~600k characters)" }, { status: 400 });
  }

  let result: ParseContactsCsvResponse;

  if (isOpenAiConfigured()) {
    try {
      result = await parseContactsCsvWithOpenAi(csvText, { companyFilter });
      return NextResponse.json(enrichImportParseResponse(result, csvText, batchMeta));
    } catch (e) {
      console.warn("[api/contacts/import] OpenAI failed, using fallback", e);
    }
  }

  const parsed = parseContactsCsvFallback(csvText);
  const rows = filterImportRowsByCompanies(parsed, companyFilter);
  const filters = parseCompanyFilterText(companyFilter ?? "");
  const filterNote =
    filters.length > 0
      ? ` Matched ${rows.length} row(s) for ${filters.join(", ")}.`
      : "";
  result = {
    rows,
    summary:
      rows.length > 0
        ? `Parsed ${rows.length} row(s) from column headers (AI unavailable).${filterNote}`
        : filters.length > 0
          ? `No rows matched ${filters.join(", ")} — check company names or upload a new CSV.`
          : "No rows found — include name, email, and ideally a Type/Segment column.",
    source: "fallback",
  };

  return NextResponse.json(enrichImportParseResponse(result, csvText, batchMeta));
}
