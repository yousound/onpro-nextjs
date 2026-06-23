import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { seedLiveDocumentsCache } from "@/lib/data/persist-documents";
import { removeLiveProject } from "@/lib/data/live-cache";
import { deleteExtraDocumentsForProject } from "@/lib/documents/delete-documents";
import { fetchAllDocumentsViaApi } from "@/lib/supabase/upload-project-document";
import { markProjectDeleted } from "@/lib/deleted-projects";
import { dispatchWorkspaceDataChanged } from "@/lib/execute-agent-suggestion-client";
import { pruneMailroomStateForDeletedProjects } from "@/lib/mailroom-state";
import { deleteProjectLocally, removeSessionProject } from "@/lib/mock/project-session";

/** Removes a project and its jobs/orders/docs/mailroom links — never deletes Contacts rows. */
export async function commitDeleteProject(id: number): Promise<void> {
  if (isClientLiveBackend()) {
    const res = await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not delete project");
    }
    removeLiveProject(id);
    removeSessionProject(id);
    markProjectDeleted(id);
    pruneMailroomStateForDeletedProjects([id]);
    const fresh = await fetchAllDocumentsViaApi();
    seedLiveDocumentsCache(fresh);
    dispatchWorkspaceDataChanged();
    return;
  }
  deleteProjectLocally(id);
  pruneMailroomStateForDeletedProjects([id]);
  await deleteExtraDocumentsForProject(id);
  dispatchWorkspaceDataChanged();
}
