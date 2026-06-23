import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { syncProjectDocumentsForUser } from "@/lib/supabase/project-documents";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectWriteOperator } from "@/lib/server/project-workspace-access";
import type { DocumentRow } from "@/lib/types/documents";
import { normalizeDocumentRow } from "@/lib/documents/document-preview";

/** Sync document metadata updates across projects (job assignment, etc.). */
export async function PUT(request: Request) {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ error: "Live backend required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { documents?: DocumentRow[] };
  const documents = (body.documents ?? []).map(normalizeDocumentRow);
  if (!Array.isArray(documents)) {
    return NextResponse.json({ error: "documents required" }, { status: 400 });
  }

  try {
    const byProject = new Map<number, DocumentRow[]>();
    for (const doc of documents) {
      if (doc.project_id == null || doc.id <= 0) continue;
      const list = byProject.get(doc.project_id) ?? [];
      list.push(doc);
      byProject.set(doc.project_id, list);
    }

    const saved: DocumentRow[] = [];
    for (const [projectId, rows] of byProject) {
      const operatorUserId = await resolveProjectWriteOperator(supabase, user.id, projectId);
      const patched = await syncProjectDocumentsForUser(supabase, operatorUserId, rows);
      saved.push(...patched);
    }

    return NextResponse.json({ ok: true, documents: saved });
  } catch (e) {
    console.error("[api/documents/sync PUT]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not sync documents" },
      { status: 400 },
    );
  }
}
