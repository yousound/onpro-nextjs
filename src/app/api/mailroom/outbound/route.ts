import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchOutboundMessagesForProject } from "@/lib/supabase/outbound-messages";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ messages: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = Number(url.searchParams.get("projectId"));
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const messages = await fetchOutboundMessagesForProject(supabase, projectId);
  return NextResponse.json({ messages });
}
