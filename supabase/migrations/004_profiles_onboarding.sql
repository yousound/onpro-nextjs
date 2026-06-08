-- Onboarding + workspace fields on profiles (operator vs client invitee).
--
-- Run in Supabase Dashboard → SQL Editor (paste this entire file, then Run).
-- Fixes: "Could not find the 'onboarding_step' column of 'profiles' in the schema cache"

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'operator',
  ADD COLUMN IF NOT EXISTS workspace_name TEXT,
  ADD COLUMN IF NOT EXISTS operator_role TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS workflow_prefs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redirect_after_onboarding TEXT,
  ADD COLUMN IF NOT EXISTS self_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

COMMENT ON COLUMN profiles.account_kind IS 'operator = workspace owner; client = invited client user';
COMMENT ON COLUMN profiles.onboarding_step IS '0=welcome, 1-4 operator wizard, client uses 1-2';
