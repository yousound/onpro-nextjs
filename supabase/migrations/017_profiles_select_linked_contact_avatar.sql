-- Allow workspace operators to read profile rows for users linked to their CRM contacts
-- (needed to show the member's own avatar instead of operator-assigned contact avatar).
-- Safe to re-run: additive policy only.

DO $profiles_linked_select$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_linked_contact'
  ) THEN
    CREATE POLICY "profiles_select_linked_contact" ON profiles
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM contacts c
          WHERE c.user_id = auth.uid()
            AND c.linked_auth_user_id = profiles.id
        )
      );
  END IF;
END
$profiles_linked_select$;
