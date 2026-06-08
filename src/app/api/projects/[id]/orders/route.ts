import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchOrdersForProjectFromSupabase, upsertProjectOrderToSupabase } from "@/lib/supabase/orders";
import { createClient } from "@/lib/supabase/server";
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

  const saved = await upsertProjectOrderToSupabase(order, user.id);
  return NextResponse.json({ order: saved });
}
