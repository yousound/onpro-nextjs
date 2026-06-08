-- Per-user OnPro AI assistant preferences (briefing sections, remembered rules).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS assistant_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN profiles.assistant_prefs IS 'OnPro AI preferences: briefing sections, custom rules from chat';
