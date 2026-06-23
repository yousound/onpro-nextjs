import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  fetchDocumentsForProjectFromSupabase,
  insertProjectDocumentsForUser,
  syncProjectDocumentsForUser,
} from "@/lib/supabase/project-documents";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectWriteOperator } from "@/lib/server/project-workspace-access";
import type { DocumentRow } from "@/lib/types/documents";
import { normalizeDocumentRow } from "@/lib/documents/document-preview";

type CreatePayload = {
  row: DocumentRow;
  content_base64?: string;
  content_type?: string;
};

function decodeBase64(input: string): Uint8Array {
  const binary = Buffer.from(input, "base64");
  return new Uint8Array(binary);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ documents: [] });
  }
  const documents = await fetchDocumentsForProjectFromSupabase(projectId);
  return NextResponse.json({ documents });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ error: "Live backend required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { documents?: CreatePayload[] };
  const items = body.documents ?? [];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "documents required" }, { status: 400 });
  }

  try {
    const operatorUserId = await resolveProjectWriteOperator(supabase, user.id, projectId);
    const inputs = items.map((item) => {
      const row = normalizeDocumentRow({
        ...item.row,
        project_id: projectId,
        file_data_url: null,
        blob_ref: null,
      });
      const fileBytes = item.content_base64 ? decodeBase64(item.content_base64) : null;
      return {
        row,
        fileBytes,
        contentType: item.content_type,
      };
    });

    const documents = await insertProjectDocumentsForUser(supabase, operatorUserId, inputs);
    return NextResponse.json({ ok: true, documents });
  } catch (e) {
    console.error("[api/projects/documents POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save documents" },
      { status: 400 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
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
    const operatorUserId = await resolveProjectWriteOperator(supabase, user.id, projectId);
    const saved = await syncProjectDocumentsForUser(supabase, operatorUserId, documents);
    return NextResponse.json({ ok: true, documents: saved });
  } catch (e) {
    console.error("[api/projects/documents PUT]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not sync documents" },
      { status: 400 },
    );
  }
}
