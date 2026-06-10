-- Member inbox notifications + team members can read operator contacts when switching workspace view.
-- Safe to re-run: additive RLS policies only.

DO $wme_member_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_member_events'
      AND policyname = 'wme_member_select'
  ) THEN
    CREATE POLICY "wme_member_select" ON workspace_member_events
      FOR SELECT USING (auth.uid() = member_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_member_events'
      AND policyname = 'wme_member_update'
  ) THEN
    CREATE POLICY "wme_member_update" ON workspace_member_events
      FOR UPDATE USING (auth.uid() = member_user_id);
  END IF;
END
$wme_member_policies$;

-- contacts member read policy moved to 015 — inline JOIN contacts caused RLS recursion.
