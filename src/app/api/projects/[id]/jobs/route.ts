import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchJobsForProjectFromSupabase, syncProjectJobsForUser } from "@/lib/supabase/jobs";
import { syncProjectOrdersForUser } from "@/lib/supabase/orders";
import { createClient } from "@/lib/supabase/server";
import { resolveProjectWriteOperator } from "@/lib/server/project-workspace-access";
import { resolveWipWriteClient } from "@/lib/server/wip-write-client";
import { supabaseErrorMessage } from "@/lib/id-uuid";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";

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
    return NextResponse.json({ jobs: [] });
  }
  const jobs = await fetchJobsForProjectFromSupabase(projectId);
  return NextResponse.json({ jobs });
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

  const body = (await request.json()) as { jobs?: ProjectJob[]; orders?: ProjectOrder[] };
  const jobs = body.jobs;
  const orders = body.orders;
  if (!Array.isArray(jobs)) {
    return NextResponse.json({ error: "jobs array required" }, { status: 400 });
  }
  if (jobs.some((j) => j.project_id !== projectId)) {
    return NextResponse.json({ error: "Job project_id mismatch" }, { status: 400 });
  }
  if (orders != null && !Array.isArray(orders)) {
    return NextResponse.json({ error: "orders must be an array when provided" }, { status: 400 });
  }
  if (orders?.some((o) => o.project_id !== projectId)) {
    return NextResponse.json({ error: "Order project_id mismatch" }, { status: 400 });
  }

  try {
    const operatorUserId = await resolveProjectWriteOperator(supabase, user.id, projectId);
    const writeClient = resolveWipWriteClient(supabase);

    if (orders && orders.length > 0) {
      await syncProjectOrdersForUser(writeClient, projectId, operatorUserId, orders);
    }

    const saved = await syncProjectJobsForUser(writeClient, projectId, operatorUserId, jobs);
    return NextResponse.json({ ok: true, jobs: saved });
  } catch (e) {
    const msg = supabaseErrorMessage(e);
    console.error("[api/projects/jobs PUT]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
