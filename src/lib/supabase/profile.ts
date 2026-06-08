import type { AccountKind } from "@/lib/types/onboarding";
import type { UserProfile, UserProfileUpdate } from "@/lib/types/profile";
import {
  isMissingOnboardingColumnError,
  isMissingProfileColumnError,
  ONBOARDING_MIGRATION_HINT,
} from "@/lib/supabase/profile-migration";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export class OnboardingSchemaError extends Error {
  constructor() {
    super(ONBOARDING_MIGRATION_HINT);
    this.name = "OnboardingSchemaError";
  }
}

const PROFILE_COLUMNS_BASE =
  "id, username, full_name, email, phone, company_name, business_address, business_phone, avatar_url";

const PROFILE_COLUMNS_ONBOARDING = `${PROFILE_COLUMNS_BASE}, onboarding_completed_at, account_kind, workspace_name, operator_role, business_type, onboarding_step, redirect_after_onboarding, self_contact_id, workflow_prefs`;

const PROFILE_COLUMNS_WITH_OPERATOR = `${PROFILE_COLUMNS_ONBOARDING}, operator_company_code`;

const PROFILE_COLUMNS_FULL = `${PROFILE_COLUMNS_WITH_OPERATOR}, workspace_welcome_dismissed_at`;

const PROFILE_FETCH_TIERS: { columns: string; defaults: Record<string, unknown> }[] = [
  { columns: PROFILE_COLUMNS_FULL, defaults: {} },
  {
    columns: PROFILE_COLUMNS_WITH_OPERATOR,
    defaults: { workspace_welcome_dismissed_at: null },
  },
  {
    columns: PROFILE_COLUMNS_ONBOARDING,
    defaults: { workspace_welcome_dismissed_at: null, operator_company_code: null },
  },
  {
    columns: PROFILE_COLUMNS_BASE,
    defaults: {
      onboarding_completed_at: null,
      account_kind: "operator",
      workspace_name: null,
      operator_company_code: null,
      operator_role: null,
      business_type: null,
      onboarding_step: 0,
      redirect_after_onboarding: null,
      self_contact_id: null,
      workspace_welcome_dismissed_at: null,
      workflow_prefs: [],
    },
  },
];

export function profileFromRow(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    username: (row.username as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    business_address: (row.business_address as string | null) ?? null,
    business_phone: (row.business_phone as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    onboarding_completed_at: (row.onboarding_completed_at as string | null) ?? null,
    account_kind: ((row.account_kind as string) || "operator") as AccountKind,
    workspace_name: (row.workspace_name as string | null) ?? null,
    operator_company_code: (row.operator_company_code as string | null) ?? null,
    operator_role: (row.operator_role as string | null) ?? null,
    business_type: (row.business_type as string | null) ?? null,
    onboarding_step: Number(row.onboarding_step ?? 0),
    redirect_after_onboarding: (row.redirect_after_onboarding as string | null) ?? null,
    self_contact_id: row.self_contact_id != null ? Number(row.self_contact_id) : null,
    workspace_welcome_dismissed_at: (row.workspace_welcome_dismissed_at as string | null) ?? null,
  };
}

function mergeProfileRow(
  row: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...defaults, ...row };
  for (const [key, value] of Object.entries(defaults)) {
    if (merged[key] === undefined) merged[key] = value;
  }
  return merged;
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const runSelect = (columns: string) =>
    supabase.from("profiles").select(columns).eq("id", userId).maybeSingle();

  let lastError: PostgrestError | null = null;

  for (const tier of PROFILE_FETCH_TIERS) {
    const { data, error } = await runSelect(tier.columns);
    if (!error) {
      if (!data) return null;
      return profileFromRow(
        mergeProfileRow(data as unknown as Record<string, unknown>, tier.defaults),
      );
    }

    lastError = error;

    if (error.code === "42P01" || error.code === "PGRST205") {
      console.warn("[profile] profiles table missing — run OnPro/SUPABASE_SCHEMA.sql");
      return null;
    }

    if (!isMissingProfileColumnError(error)) {
      if (isMissingOnboardingColumnError(error)) {
        throw new OnboardingSchemaError();
      }
      throw error;
    }
  }

  if (lastError && isMissingOnboardingColumnError(lastError)) {
    throw new OnboardingSchemaError();
  }
  if (lastError) throw lastError;
  return null;
}

/** Upsert profile row — requires migration 004 (all onboarding fields on `profiles`). */
export async function upsertProfileRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<void> {
  const attempt = async (payload: Record<string, unknown>) => {
    return supabase.from("profiles").upsert(payload, { onConflict: "id" });
  };

  let { error } = await attempt(row);
  if (error && isMissingProfileColumnError(error)) {
    const trimmed = { ...row };
    delete trimmed.operator_company_code;
    delete trimmed.workspace_welcome_dismissed_at;
    ({ error } = await attempt(trimmed));
  }

  if (error) {
    if (isMissingOnboardingColumnError(error)) {
      throw new OnboardingSchemaError();
    }
    throw error;
  }
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  patch: UserProfileUpdate,
): Promise<UserProfile> {
  const row: Record<string, unknown> = {
    id: userId,
    email,
    full_name: patch.full_name?.trim() || null,
    company_name: patch.company_name?.trim() || null,
    phone: patch.phone?.trim() || null,
    business_address: patch.business_address?.trim() || null,
    business_phone: patch.business_phone?.trim() || null,
  };
  if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url;
  if (patch.username !== undefined) row.username = patch.username.trim() || null;
  if (patch.workspace_name !== undefined) row.workspace_name = patch.workspace_name.trim() || null;
  if (patch.operator_company_code !== undefined) {
    row.operator_company_code = patch.operator_company_code.trim().toUpperCase() || null;
  }
  if (patch.operator_role !== undefined) row.operator_role = patch.operator_role.trim() || null;
  if (patch.business_type !== undefined) row.business_type = patch.business_type.trim() || null;

  await upsertProfileRow(supabase, row);
  const profile = await fetchProfile(supabase, userId);
  if (!profile) throw new Error("Profile not found after save");
  return profile;
}

export async function updateProfileFields(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await upsertProfileRow(supabase, { id: userId, email, ...fields });
}
