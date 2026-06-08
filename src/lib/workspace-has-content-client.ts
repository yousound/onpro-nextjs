import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { loadContacts } from "@/lib/contacts-store";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { loadMailroomState } from "@/lib/mailroom-state";

/** Client-side check for mock / hydrated live cache. */
export function workspaceHasContentFromClientCache(): boolean {
  if (getLiveCachedProjects().length > 0) return true;

  if (loadContacts().length > 1) return true;

  if (isClientMockBackend()) {
    const mailroom = loadMailroomState();
    if (mailroom?.oauth_connected) return true;
  }

  return false;
}

export function shouldUseClientWorkspaceContentCheck(): boolean {
  return isClientMockBackend() || isClientLiveBackend();
}
