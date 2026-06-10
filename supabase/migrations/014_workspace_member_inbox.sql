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

DO $contacts_member_team_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_select_member_team'
  ) THEN
    CREATE POLICY "contacts_select_member_team" ON contacts
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM workspace_memberships wm
          JOIN contacts mc ON mc.id = wm.contact_id
          WHERE wm.operator_user_id = contacts.user_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
            AND mc.role IN ('Team', 'Vendor')
        )
      );
  END IF;
END
$contacts_member_team_policy$;
