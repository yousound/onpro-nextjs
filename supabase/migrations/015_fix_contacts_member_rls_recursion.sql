-- Fix infinite recursion (42P17): RLS policies must not JOIN contacts from within contacts/projects policies.
-- SECURITY DEFINER helpers read contacts without re-entering RLS.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contacts_select_member_team" ON contacts;

CREATE OR REPLACE FUNCTION member_can_read_operator_contacts(p_operator_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_memberships wm
    JOIN contacts mc ON mc.id = wm.contact_id
    WHERE wm.operator_user_id = p_operator_user_id
      AND wm.member_user_id = auth.uid()
      AND wm.status = 'active'
      AND mc.role IN ('Team', 'Vendor')
  );
$$;

GRANT EXECUTE ON FUNCTION member_can_read_operator_contacts(UUID) TO authenticated;

CREATE POLICY "contacts_select_member_team" ON contacts
  FOR SELECT USING (member_can_read_operator_contacts(user_id));

-- ---------------------------------------------------------------------------
-- projects (team/vendor member read)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_member_team_vendor" ON projects;

CREATE POLICY "projects_select_member_team_vendor" ON projects
  FOR SELECT USING (member_can_read_operator_contacts(user_id));

-- ---------------------------------------------------------------------------
-- projects (client member read)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "projects_select_member" ON projects;

CREATE OR REPLACE FUNCTION member_can_read_client_project(
  p_operator_user_id UUID,
  p_client_id INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM workspace_memberships wm
    JOIN contacts c ON c.id = wm.contact_id
    WHERE wm.operator_user_id = p_operator_user_id
      AND wm.member_user_id = auth.uid()
      AND wm.status = 'active'
      AND (
        p_client_id = wm.contact_id
        OR (
          c.address IS NOT NULL
          AND c.address ~ '^\{'
          AND (c.address::jsonb->>'parent_company_id') ~ '^\d+$'
          AND p_client_id = (c.address::jsonb->>'parent_company_id')::integer
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION member_can_read_client_project(UUID, INTEGER) TO authenticated;

CREATE POLICY "projects_select_member" ON projects
  FOR SELECT USING (member_can_read_client_project(user_id, client_id));
