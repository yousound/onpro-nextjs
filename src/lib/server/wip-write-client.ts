import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

/** Prefer service role for WIP writes so team members and RLS gaps do not block saves. */
export function resolveWipWriteClient(userClient: SupabaseClient): SupabaseClient {
  return createServiceClient() ?? userClient;
}
