import { NextResponse } from "next/server";
import { isLiveBackendEnabled, isSupabaseConfigured } from "@/lib/config/backend";
import { fetchProjects } from "@/lib/data/projects";
import {
  deleteProjectFromSupabase,
  insertProjectForUser,
  updateProjectForUser,
  type CreateProjectInput,
} from "@/lib/supabase/projects";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceOwnerId } from "@/lib/server/resolve-workspace-context";
import type { Project, ProjectStatus } from "@/lib/types/project";
import { migrateProjectStatus, PROJECT_STATUS_OPTIONS } from "@/lib/project-status";

/** Live: project list for client hydration when RSC payload is empty or stale. */
export async function GET() {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ projects: [], source: "mock" });
  }
  try {
    const projects = await fetchProjects();
    return NextResponse.json({ projects, source: "live" });
  } catch (e) {
    console.error("[api/projects GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load projects" },
      { status: 500 },
    );
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

  const body = (await request.json()) as CreateProjectInput;
  const name = body.name?.trim();
  const clientId = Number(body.clientId);
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  if (!Number.isFinite(clientId)) {
    return NextResponse.json({ error: "Valid client is required" }, { status: 400 });
  }

  const status = PROJECT_STATUS_OPTIONS.includes(body.status as ProjectStatus)
    ? (body.status as ProjectStatus)
    : migrateProjectStatus(body.status ?? "Intake");

  const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);

  try {
    const project = await insertProjectForUser(supabase, workspaceOwnerId, {
      name,
      description: body.description?.trim() || null,
      clientId,
      status,
      projectNumber: body.projectNumber?.trim() || null,
      dueDate: body.dueDate || null,
      leadTeamMember: body.leadTeamMember?.trim() || null,
      leadVendor: body.leadVendor?.trim() || null,
    });
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { id?: number; patch?: Partial<Project> };
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  if (!body.patch || typeof body.patch !== "object") {
    return NextResponse.json({ error: "Patch payload required" }, { status: 400 });
  }

  const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);

  try {
    const project = await updateProjectForUser(supabase, workspaceOwnerId, id, body.patch);
    return NextResponse.json({ ok: true, project });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    await deleteProjectFromSupabase(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
