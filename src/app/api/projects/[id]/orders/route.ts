import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  fetchOrdersForProjectFromSupabase,
  syncProjectOrdersForUser,
  upsertProjectOrderForUser,
} from "@/lib/supabase/orders";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceOwnerId } from "@/lib/server/resolve-workspace-context";
import { assertCanWriteOperatorWorkspace } from "@/lib/server/workspace-write-access";
import { resolveWipWriteClient } from "@/lib/server/wip-write-client";
import { supabaseErrorMessage } from "@/lib/id-uuid";
import type { ProjectOrder } from "@/lib/types/wip";

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
    return NextResponse.json({ orders: [] });
  }
  const orders = await fetchOrdersForProjectFromSupabase(projectId);
  return NextResponse.json({ orders });
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

  const body = (await request.json()) as { order?: ProjectOrder };
  const order = body.order;
  if (!order || order.project_id !== projectId) {
    return NextResponse.json({ error: "Invalid order payload" }, { status: 400 });
  }

  const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);

  try {
    await assertCanWriteOperatorWorkspace(supabase, user.id, workspaceOwnerId);
    const writeClient = resolveWipWriteClient(supabase);
    const saved = await upsertProjectOrderForUser(writeClient, order, workspaceOwnerId);
    return NextResponse.json({ order: saved });
  } catch (e) {
    const msg = supabaseErrorMessage(e);
    return NextResponse.json({ error: msg }, { status: 400 });
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

  const body = (await request.json()) as { orders?: ProjectOrder[] };
  const orders = body.orders;
  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: "orders array required" }, { status: 400 });
  }
  if (orders.some((o) => o.project_id !== projectId)) {
    return NextResponse.json({ error: "Order project_id mismatch" }, { status: 400 });
  }

  const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);

  try {
    await assertCanWriteOperatorWorkspace(supabase, user.id, workspaceOwnerId);
    const writeClient = resolveWipWriteClient(supabase);
    const saved = await syncProjectOrdersForUser(writeClient, projectId, workspaceOwnerId, orders);
    return NextResponse.json({ ok: true, orders: saved });
  } catch (e) {
    const msg = supabaseErrorMessage(e);
    console.error("[api/projects/orders PUT]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
