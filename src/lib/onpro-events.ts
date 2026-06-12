/** Open the new-project modal (Projects page listens). */
export const OPEN_NEW_PROJECT_EVENT = "onpro:open-new-project";

/** Open the OnPro AI assistant chat overlay (DashboardShell listens). */
export const OPEN_ONPRO_AI_EVENT = "onpro:open-assistant";

/** Project removed — Projects page drops it from local state. */
export const PROJECT_DELETED_EVENT = "onpro:project-deleted";

/** Browser document library changed (mailroom import or new upload). */
export const DOCUMENTS_CHANGED_EVENT = "onpro:documents-changed";

/** App-wide transient toast (AppToastHost listens). */
export const APP_TOAST_EVENT = "onpro:app-toast";

export type AppToastDetail = { message: string };

export function dispatchAppToast(message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, { detail: { message } }));
}

export function dispatchOpenNewProject(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_NEW_PROJECT_EVENT));
}

export function dispatchOpenOnProAi(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_ONPRO_AI_EVENT));
}

export function dispatchProjectDeleted(projectId: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_DELETED_EVENT, { detail: { projectId } }));
}

export function dispatchDocumentsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DOCUMENTS_CHANGED_EVENT));
}
