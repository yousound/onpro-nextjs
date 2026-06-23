import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchAllDocumentsFromSupabase } from "@/lib/supabase/project-documents";
import { createClient } from "@/lib/supabase/server";
import { deleteProjectDocumentsByIds } from "@/lib/supabase/project-documents";

export async function GET() {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ documents: [] });
  }
  try {
    const documents = await fetchAllDocumentsFromSupabase();
    return NextResponse.json({ documents });
  } catch (e) {
    console.error("[api/documents GET]", e);
    return NextResponse.json({ error: "Could not load documents" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ error: "Live backend required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { ids?: number[] };
  const ids = body.ids ?? [];
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  try {
    const removed = await deleteProjectDocumentsByIds(supabase, ids);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    console.error("[api/documents DELETE]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not delete documents" },
      { status: 400 },
    );
  }
}
