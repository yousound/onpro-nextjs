import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { resolveWorkspaceOwnerId } from "@/lib/server/resolve-workspace-context";
import {
  ingestBrandboomProduct,
  type BrandboomProductPayload,
} from "@/lib/supabase/brand-products";
import { createClient } from "@/lib/supabase/server";

/**
 * Brandboom (or similar) webhook — upserts catalog blanks.
 * Set BRANDBOOM_WEBHOOK_SECRET and send `x-brandboom-secret` header when wiring live.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const secret = process.env.BRANDBOOM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("x-brandboom-secret");
    if (header !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let workspaceOwnerId: string | null = null;
  const ownerHeader = request.headers.get("x-onpro-workspace-owner")?.trim();
  if (ownerHeader) {
    workspaceOwnerId = ownerHeader;
  } else if (user) {
    workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);
  }

  if (!workspaceOwnerId) {
    return NextResponse.json(
      { error: "Missing workspace — set x-onpro-workspace-owner or authenticate" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body)
    ? body
    : (body as { products?: BrandboomProductPayload[] }).products ?? [body];

  try {
    const saved = [];
    for (const raw of items) {
      const item = raw as BrandboomProductPayload;
      if (!item?.external_id || !item?.brand_name || !item?.product_name) continue;
      saved.push(await ingestBrandboomProduct(supabase, workspaceOwnerId, item));
    }
    return NextResponse.json({ ok: true, count: saved.length, products: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook ingest failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
