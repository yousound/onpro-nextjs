import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  createConversationForUser,
  fetchConversationsForUser,
} from "@/lib/supabase/messages";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversations = await fetchConversationsForUser(supabase, user.id);
    return NextResponse.json({ conversations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    participantContactIds?: number[];
    projectId?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const participantContactIds = Array.isArray(body.participantContactIds)
    ? body.participantContactIds.filter((id) => Number.isFinite(id))
    : [];

  try {
    const conversation = await createConversationForUser(supabase, user.id, {
      name,
      participantContactIds,
      projectId: body.projectId ?? null,
      isGroup: participantContactIds.length > 1,
    });
    return NextResponse.json({ conversation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
