import type { Project } from "@/lib/types/project";

const LS_KEY = "onpro-deleted-projects-v1";
const COOKIE_NAME = "onpro_deleted_projects";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function parseDeletedProjectIds(raw: string | null | undefined): Set<number> {
  if (!raw?.trim()) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === "number"));
  } catch {
    return new Set();
  }
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const hit = document.cookie
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(name.length + 1));
  } catch {
    return hit.slice(name.length + 1);
  }
}

function writeCookie(ids: Set<number>): void {
  if (typeof document === "undefined") return;
  const json = JSON.stringify([...ids]);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** Client: localStorage + cookie (migrates legacy LS-only deletes to cookie). */
export function readDeletedProjectIds(): Set<number> {
  if (typeof window === "undefined") return new Set();

  let fromLs = new Set<number>();
  try {
    fromLs = parseDeletedProjectIds(localStorage.getItem(LS_KEY));
  } catch {
    fromLs = new Set();
  }

  const fromCookie = parseDeletedProjectIds(readCookieValue(COOKIE_NAME));
  if (fromLs.size === 0) return fromCookie;
  if (fromCookie.size === 0 && fromLs.size > 0) {
    writeCookie(fromLs);
    return fromLs;
  }
  const merged = new Set([...fromCookie, ...fromLs]);
  if (merged.size !== fromCookie.size) writeCookie(merged);
  return merged;
}

export function markProjectDeleted(id: number): void {
  if (typeof window === "undefined") return;
  const deleted = readDeletedProjectIds();
  deleted.add(id);
  const json = JSON.stringify([...deleted]);
  localStorage.setItem(LS_KEY, json);
  writeCookie(deleted);
}

export function filterVisibleProjects(
  projects: Project[],
  deletedIds?: Set<number>,
): Project[] {
  const deleted = deletedIds ?? readDeletedProjectIds();
  if (deleted.size === 0) return projects;
  return projects.filter((p) => !deleted.has(p.id));
}

/** Parse deleted ids from the Cookie request header (server components / route handlers). */
export function readDeletedProjectIdsFromCookieHeader(
  cookieHeader: string | null | undefined,
): Set<number> {
  if (!cookieHeader) return new Set();
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${COOKIE_NAME}=`)) continue;
    const raw = trimmed.slice(COOKIE_NAME.length + 1);
    try {
      return parseDeletedProjectIds(decodeURIComponent(raw));
    } catch {
      return parseDeletedProjectIds(raw);
    }
  }
  return new Set();
}
