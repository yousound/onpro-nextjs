import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Server-only admin client (bypasses RLS). Requires SUPABASE_SERVICE_ROLE_KEY. */
export function createServiceClient() {
  const key = getSupabaseServiceRoleKey();
  if (!key) return null;
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Prefer service role; fall back to anon for read-only public routes if ever needed. */
export function createPrivilegedServerClient() {
  return createServiceClient() ?? createClient(getSupabaseUrl(), getSupabaseAnonKey());
}
