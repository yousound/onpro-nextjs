/** Active workspace for multi-team members — cookie + client session. */

export const ACTIVE_WORKSPACE_COOKIE = "onpro_active_workspace";

export type WorkspaceView = {
  mode: "self" | "team";
  operatorUserId: string;
  workspaceName: string;
  contactId?: number;
};

export function parseActiveWorkspaceCookie(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || raw === "self") return null;
  return raw;
}

export function activeWorkspaceCookieValue(operatorUserId: string | null): string {
  return operatorUserId?.trim() || "self";
}

const SESSION_KEY = "onpro_active_workspace";

export function readActiveWorkspaceSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return parseActiveWorkspaceCookie(raw);
  } catch {
    return null;
  }
}

export function writeActiveWorkspaceSession(operatorUserId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, activeWorkspaceCookieValue(operatorUserId));
  } catch {
    /* ignore */
  }
}
