import { isSupabaseConfigured } from "@/lib/config/backend";

export const BACKEND_MODE_COOKIE = "onpro_backend_mode";

export type BackendMode = "live" | "mock";

declare global {
  interface Window {
    __ONPRO_LIVE_BACKEND__?: boolean;
    __ONPRO_SUPABASE__?: { url: string; anonKey: string };
  }
}

export function parseBackendMode(value: string | undefined | null): BackendMode | undefined {
  if (value === "live" || value === "mock") return value;
  return undefined;
}

/** Mock/Live toggle removed — Live whenever Supabase is configured. */
export function isLiveBackendFeatureEnabled(): boolean {
  return false;
}

/** Default mode when the Live/Mock cookie is unset. */
export function defaultBackendMode(): BackendMode {
  return shouldUseLiveBackend() ? "live" : "mock";
}

/**
 * Whether server/client should read Supabase vs mocks.
 * When Supabase env is set, always Live — mock cookie is ignored.
 * Mock only when keys are missing or `NEXT_PUBLIC_USE_SUPABASE=false`.
 */
export function shouldUseLiveBackend(_mode?: BackendMode | null): boolean {
  if (!isSupabaseConfigured()) return false;
  const forceOff = process.env.NEXT_PUBLIC_USE_SUPABASE?.trim().toLowerCase();
  if (forceOff === "false" || forceOff === "0") return false;
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

/** Clear stale mock cookie and pin Live when Supabase is configured. */
export function ensureClientLiveBackendCookie(): void {
  if (typeof document === "undefined") return;
  if (!shouldUseLiveBackend()) return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${BACKEND_MODE_COOKIE}=live; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function setClientBackendMode(mode: BackendMode): void {
  if (typeof document === "undefined") return;
  if (shouldUseLiveBackend() && mode === "mock") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${BACKEND_MODE_COOKIE}=${mode}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Client: server layout sets `window.__ONPRO_LIVE_BACKEND__`; else env check. */
export function isClientLiveBackend(): boolean {
  if (typeof window !== "undefined" && window.__ONPRO_LIVE_BACKEND__ === true) {
    return true;
  }
  return shouldUseLiveBackend();
}

export function isClientMockBackend(): boolean {
  return !isClientLiveBackend();
}
