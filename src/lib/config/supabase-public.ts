export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function isValidSupabasePublicConfig(
  url: string | null | undefined,
  anonKey: string | null | undefined,
): boolean {
  const u = url?.trim();
  const k = anonKey?.trim();
  if (!u || !k) return false;
  if (u.includes("your-project") || k.includes("your-anon")) return false;
  return true;
}

/** Server / build-time env (also runtime on Vercel server). */
export function readSupabasePublicConfigFromEnv(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!isValidSupabasePublicConfig(url, anonKey)) return null;
  return { url: url!, anonKey: anonKey! };
}

/** Client runtime config injected from root layout. */
export function readSupabasePublicConfigFromWindow(): SupabasePublicConfig | null {
  if (typeof window === "undefined") return null;
  const cfg = window.__ONPRO_SUPABASE__;
  if (!isValidSupabasePublicConfig(cfg?.url, cfg?.anonKey)) return null;
  return { url: cfg!.url.trim(), anonKey: cfg!.anonKey.trim() };
}

/** Prefer injected window config, then build-time env. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return readSupabasePublicConfigFromWindow() ?? readSupabasePublicConfigFromEnv();
}

export function supabasePublicConfigScriptContent(config: SupabasePublicConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `window.__ONPRO_SUPABASE__=${json};window.__ONPRO_LIVE_BACKEND__=true;`;
}
