import { isSupabaseConfigured } from "@/lib/config/backend";

export const BACKEND_MODE_COOKIE = "onpro_backend_mode";

export type BackendMode = "live" | "mock";

export function parseBackendMode(value: string | undefined | null): BackendMode | undefined {
  if (value === "live" || value === "mock") return value;
  return undefined;
}

/**
 * Show the Live/Mock sidebar toggle (local development only — hidden on Vercel/production).
 */
export function isLiveBackendFeatureEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!isSupabaseConfigured()) return false;
  const forceOff = process.env.NEXT_PUBLIC_USE_SUPABASE?.trim().toLowerCase();
  if (forceOff === "false" || forceOff === "0") return false;
  return true;
}

/** Default mode when the Live/Mock cookie is unset. */
export function defaultBackendMode(): BackendMode {
  return shouldUseLiveBackend(undefined) ? "live" : "mock";
}

/** Whether server/client should read Supabase vs mocks for this mode. */
export function shouldUseLiveBackend(mode: BackendMode | undefined | null): boolean {
  if (!isSupabaseConfigured()) return false;
  const forceOff = process.env.NEXT_PUBLIC_USE_SUPABASE?.trim().toLowerCase();
  if (forceOff === "false" || forceOff === "0") return false;

  // Production (Vercel): Live only — no mock toggle.
  if (process.env.NODE_ENV === "production") return true;

  if (!isLiveBackendFeatureEnabled()) return false;
  if (mode === "mock") return false;
  return true;
}

export function readBackendModeFromCookieString(cookieHeader: string | undefined): BackendMode | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${BACKEND_MODE_COOKIE}=(live|mock)`));
  return parseBackendMode(match?.[1]);
}

export function clientBackendMode(): BackendMode | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${BACKEND_MODE_COOKIE}=(live|mock)`));
  return parseBackendMode(match?.[1]);
}

export function setClientBackendMode(mode: BackendMode): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${BACKEND_MODE_COOKIE}=${mode}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** True when the Live/Mock toggle is on Live (or unset with Supabase configured). */
export function isClientLiveBackend(): boolean {
  return shouldUseLiveBackend(clientBackendMode());
}

export function isClientMockBackend(): boolean {
  return !isClientLiveBackend();
}
