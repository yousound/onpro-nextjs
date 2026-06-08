import type { PostgrestError } from "@supabase/supabase-js";

const ONBOARDING_COLUMN_HINTS = [
  "onboarding_step",
  "onboarding_completed_at",
  "account_kind",
  "workspace_name",
  "operator_role",
  "business_type",
  "workflow_prefs",
  "redirect_after_onboarding",
  "self_contact_id",
] as const;

/** PostgREST / Postgres errors when required onboarding columns (004) are not migrated yet. */
export function isMissingOnboardingColumnError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  if (error.code !== "42703" && error.code !== "PGRST204") {
    return msg.includes("schema cache") && ONBOARDING_COLUMN_HINTS.some((c) => msg.includes(c));
  }
  return ONBOARDING_COLUMN_HINTS.some((c) => msg.includes(c));
}

/** Column missing — safe to retry fetch with a narrower select list. */
export function isMissingProfileColumnError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const msg = error.message?.toLowerCase() ?? "";
  return msg.includes("schema cache");
}

export const ONBOARDING_MIGRATION_HINT =
  "Run supabase/migrations/004_profiles_onboarding.sql in the Supabase SQL Editor (paste the SQL file contents, not the filename). Optional: 011_project_orders.sql adds operator_company_code for order numbers.";

/** Keys that require migration 004 on `profiles`. */
export const ONBOARDING_PROFILE_KEYS = new Set([
  "onboarding_completed_at",
  "account_kind",
  "workspace_name",
  "operator_role",
  "business_type",
  "workflow_prefs",
  "onboarding_step",
  "redirect_after_onboarding",
  "self_contact_id",
]);

export function splitProfilePatch(row: Record<string, unknown>): {
  base: Record<string, unknown>;
  extended: Record<string, unknown>;
} {
  const base: Record<string, unknown> = {};
  const extended: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" || key === "email") {
      base[key] = value;
      continue;
    }
    if (ONBOARDING_PROFILE_KEYS.has(key)) {
      extended[key] = value;
    } else {
      base[key] = value;
    }
  }
  return { base, extended };
}
