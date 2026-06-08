/** Show workspace welcome after onboarding (survives refresh + router.refresh). */
export const WORKSPACE_WELCOME_PENDING_KEY = "onpro.session.workspaceWelcomePending";
export const WORKSPACE_WELCOME_PENDING_LS = "onpro.ls.workspaceWelcomePending";
export const WORKSPACE_WELCOME_QUERY = "welcome";

export function markWorkspaceWelcomePending(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(WORKSPACE_WELCOME_PENDING_KEY, "1");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(WORKSPACE_WELCOME_PENDING_LS, "1");
  }
}

export function clearWorkspaceWelcomePending(): void {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(WORKSPACE_WELCOME_PENDING_KEY);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(WORKSPACE_WELCOME_PENDING_LS);
  }
}

export function isWorkspaceWelcomePending(): boolean {
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(WORKSPACE_WELCOME_PENDING_KEY) === "1") {
    return true;
  }
  if (typeof localStorage !== "undefined" && localStorage.getItem(WORKSPACE_WELCOME_PENDING_LS) === "1") {
    return true;
  }
  return false;
}

export function hasWelcomeQueryParam(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(WORKSPACE_WELCOME_QUERY) === "1";
}
