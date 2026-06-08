import type { AccountKind } from "@/lib/types/onboarding";

/** App user profile (`public.profiles`), extends Supabase Auth. */
export type UserProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  avatar_url: string | null;
  onboarding_completed_at: string | null;
  account_kind: AccountKind;
  workspace_name: string | null;
  /** Operator / shop code for order numbers (e.g. MAT260602). */
  operator_company_code: string | null;
  operator_role: string | null;
  business_type: string | null;
  onboarding_step: number;
  redirect_after_onboarding: string | null;
  self_contact_id: number | null;
  workspace_welcome_dismissed_at: string | null;
};

export type UserProfileUpdate = {
  username?: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  business_address?: string;
  business_phone?: string;
  avatar_url?: string | null;
  workspace_name?: string;
  operator_company_code?: string;
  operator_role?: string;
  business_type?: string;
};
