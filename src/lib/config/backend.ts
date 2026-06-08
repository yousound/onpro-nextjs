import type { BackendMode } from "@/lib/config/backend-mode";
import { shouldUseLiveBackend } from "@/lib/config/backend-mode";
import { getSupabasePublicConfig } from "@/lib/config/supabase-public";

/**
 * Backend feature flags. When Supabase env is missing, the app uses mocks (see BACKEND.md).
 * On Vercel, server injects `window.__ONPRO_SUPABASE__` so Live works at runtime without rebuild.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() != null;
}

/**
 * When `mode` is passed (from cookie), respects Live vs Mock toggle.
 * When omitted, uses env only (legacy).
 */
export function isSupabaseBackendEnabled(mode?: BackendMode | null): boolean {
  if (mode !== undefined && mode !== null) {
    return shouldUseLiveBackend(mode);
  }
  const flag = process.env.NEXT_PUBLIC_USE_SUPABASE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return isSupabaseConfigured();
  return isSupabaseConfigured();
}

export async function getServerBackendMode(): Promise<BackendMode | undefined> {
  const { cookies } = await import("next/headers");
  const { BACKEND_MODE_COOKIE, parseBackendMode } = await import("@/lib/config/backend-mode");
  const store = await cookies();
  return parseBackendMode(store.get(BACKEND_MODE_COOKIE)?.value);
}

export async function isLiveBackendEnabled(): Promise<boolean> {
  return shouldUseLiveBackend();
}

