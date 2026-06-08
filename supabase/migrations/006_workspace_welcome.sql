-- First workspace visit assistant modal (dismiss once).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS workspace_welcome_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.workspace_welcome_dismissed_at IS 'When set, skip post-onboarding workspace welcome / quick-start modal';
