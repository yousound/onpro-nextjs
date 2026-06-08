import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import type { ThreadSmartAttachment } from "@/lib/mock/message-threads";
import {
  fetchMessagesForConversation,
  insertMessageForUser,
} from "@/lib/supabase/messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const conversationId = Number(new URL(request.url).searchParams.get("conversationId"));
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const messages = await fetchMessagesForConversation(supabase, user.id, conversationId);
    return NextResponse.json({ messages });
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
    conversationId?: number;
    content?: string;
    imageUrls?: string[];
    smartAttachment?: ThreadSmartAttachment;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = body.conversationId;
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  try {
    const message = await insertMessageForUser(supabase, user.id, {
      conversationId: conversationId!,
      content: body.content,
      imageUrls: body.imageUrls,
      smartAttachment: body.smartAttachment,
    });
    return NextResponse.json({ message });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
