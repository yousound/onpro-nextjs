import { NextResponse } from "next/server";
import { syncGmailHistoryForUser, resolveHistoryStartId } from "@/lib/gmail/history-sync";
import {
  getGmailConnectionForUserService,
  getValidGmailAccessToken,
} from "@/lib/supabase/gmail-connection";
import { getUserIdByGmailEmail } from "@/lib/supabase/gmail-inbox-cache";

export const maxDuration = 60;

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
  };
  subscription?: string;
};

function decodePubSubData(data: string): { emailAddress?: string; historyId?: string } | null {
  try {
    const json = Buffer.from(data, "base64").toString("utf8");
    return JSON.parse(json) as { emailAddress?: string; historyId?: string };
  } catch {
    return null;
  }
}

/** Gmail Pub/Sub push — incremental inbox sync. Configure GMAIL_PUBSUB_TOPIC + push subscription. */
export async function POST(request: Request) {
  let body: PubSubPushBody;
  try {
    body = (await request.json()) as PubSubPushBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const encoded = body.message?.data;
  if (!encoded) {
    return NextResponse.json({ ok: true, skipped: "no_data" });
  }

  const notification = decodePubSubData(encoded);
  if (!notification?.emailAddress || !notification.historyId) {
    return NextResponse.json({ ok: true, skipped: "invalid_payload" });
  }

  const userId = await getUserIdByGmailEmail(notification.emailAddress);
  if (!userId) {
    return NextResponse.json({ ok: true, skipped: "unknown_user" });
  }

  const connection = await getGmailConnectionForUserService(userId);
  if (!connection) {
    return NextResponse.json({ ok: true, skipped: "no_connection" });
  }

  try {
    const { accessToken } = await getValidGmailAccessToken(connection, { admin: true });
    const startId = await resolveHistoryStartId(userId, notification.historyId);
    if (!startId) {
      return NextResponse.json({ ok: true, skipped: "no_history_id" });
    }

    const result = await syncGmailHistoryForUser(userId, accessToken, startId);

    return NextResponse.json({
      ok: true,
      threadsUpdated: result.threadsUpdated,
      historyId: result.historyId,
    });
  } catch (e) {
    console.error("[api/mailroom/gmail/push]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}
