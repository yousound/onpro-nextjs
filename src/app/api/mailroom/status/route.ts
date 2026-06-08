import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerBackendMode, isLiveBackendEnabled, isSupabaseConfigured } from "@/lib/config/backend";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { isOpenAiConfigured } from "@/lib/openai/env";

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  const backendMode = await getServerBackendMode();
  const backendLive = await isLiveBackendEnabled();

  let userEmail: string | null = null;
  if (backendLive) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  }

  return NextResponse.json({
    supabaseConfigured,
    backendMode: backendMode ?? "live",
    backendLive,
    userEmail,
    openaiConfigured: isOpenAiConfigured(),
    gmailOAuthConfigured: isGmailOAuthConfigured(),
    mailroomTables: "run supabase/migrations/002_project_jobs.sql and 003_user_gmail.sql",
  });
}
