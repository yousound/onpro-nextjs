import { getSupabasePublicConfig } from "@/lib/config/supabase-public";

export function getSupabaseUrl(): string {
  const cfg = getSupabasePublicConfig();
  if (cfg?.url) return cfg.url;
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  const cfg = getSupabasePublicConfig();
  if (cfg?.anonKey) return cfg.anonKey;
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}
