-- Extend workspace join + project read for Team and Vendor contacts (Live push).
-- Safe to re-run: CREATE OR REPLACE functions + additive RLS policy only (no DROP).
-- Keeps existing projects_select_member from 008 for clients; adds team/vendor read access.

-- ---------------------------------------------------------------------------
-- find_workspaces_for_email — match Client, Team, and Vendor contacts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_workspaces_for_email(
  p_email TEXT,
  p_member_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  operator_user_id UUID,
  contact_id INTEGER,
  workspace_name TEXT,
  contact_display_name TEXT,
  project_count BIGINT,
  already_joined BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT LOWER(TRIM(p_email)) AS email
  ),
  matched_contacts AS (
    SELECT
      c.user_id AS operator_user_id,
      c.id AS contact_id,
      c.name AS contact_name,
      c.company_name,
      c.role,
      c.address,
      c.linked_auth_user_id
    FROM contacts c, normalized n
    WHERE c.role IN ('Client', 'Team', 'Vendor')
      AND (
        LOWER(TRIM(c.email)) = n.email
        OR (
          c.address IS NOT NULL
          AND c.address ~ '^\{'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              COALESCE(c.address::jsonb->'other_emails', '[]'::jsonb)
            ) AS oe(val)
            WHERE LOWER(TRIM(oe.val)) = n.email
          )
        )
      )
      AND (
        c.linked_auth_user_id IS NULL
        OR c.linked_auth_user_id = p_member_user_id
      )
  )
  SELECT
    mc.operator_user_id,
    mc.contact_id,
    COALESCE(p.workspace_name, p.company_name, 'Workspace') AS workspace_name,
    COALESCE(mc.company_name, mc.contact_name) AS contact_display_name,
    (
      SELECT COUNT(*)::bigint
      FROM projects pr
      WHERE pr.user_id = mc.operator_user_id
        AND (
          mc.role IN ('Team', 'Vendor')
          OR pr.client_id = mc.contact_id
          OR (
            mc.role = 'Client'
            AND mc.address IS NOT NULL
            AND mc.address ~ '^\{'
            AND (mc.address::jsonb->>'parent_company_id') ~ '^\d+$'
            AND pr.client_id = (mc.address::jsonb->>'parent_company_id')::integer
          )
        )
    ) AS project_count,
    EXISTS (
      SELECT 1
      FROM workspace_memberships wm
      WHERE wm.operator_user_id = mc.operator_user_id
        AND wm.contact_id = mc.contact_id
        AND wm.member_user_id = p_member_user_id
        AND wm.status = 'active'
    ) AS already_joined
  FROM matched_contacts mc
  LEFT JOIN profiles p ON p.id = mc.operator_user_id;
$$;

-- ---------------------------------------------------------------------------
-- join_workspace — Client, Team, and Vendor contacts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION join_workspace(
  p_operator_user_id UUID,
  p_contact_id INTEGER,
  p_member_user_id UUID,
  p_source TEXT DEFAULT 'email_claim',
  p_member_email TEXT DEFAULT NULL,
  p_member_name TEXT DEFAULT NULL
)
RETURNS workspace_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact contacts%ROWTYPE;
  v_membership workspace_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_contact
  FROM contacts
  WHERE id = p_contact_id
    AND user_id = p_operator_user_id
    AND role IN ('Client', 'Team', 'Vendor');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found in workspace';
  END IF;

  IF v_contact.linked_auth_user_id IS NOT NULL
     AND v_contact.linked_auth_user_id <> p_member_user_id THEN
    RAISE EXCEPTION 'Contact already linked to another account';
  END IF;

  INSERT INTO workspace_memberships (
    operator_user_id, member_user_id, contact_id, status, source
  )
  VALUES (
    p_operator_user_id, p_member_user_id, p_contact_id, 'active', p_source
  )
  ON CONFLICT (operator_user_id, member_user_id, contact_id)
  DO UPDATE SET
    status = 'active',
    source = EXCLUDED.source,
    updated_at = NOW()
  RETURNING * INTO v_membership;

  UPDATE contacts
  SET
    linked_auth_user_id = p_member_user_id,
    invite_status = 'joined',
    updated_at = NOW()
  WHERE id = p_contact_id;

  INSERT INTO workspace_member_events (
    operator_user_id, member_user_id, contact_id,
    event_type, member_email, member_name
  )
  VALUES (
    p_operator_user_id, p_member_user_id, p_contact_id,
    'joined', p_member_email, p_member_name
  );

  RETURN v_membership;
END;
$$;

-- ---------------------------------------------------------------------------
-- projects: team/vendor members can read all projects on the operator workspace
-- (Client access remains on projects_select_member from migration 008.)
-- ---------------------------------------------------------------------------
DO $projects_member_team_vendor_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'projects_select_member_team_vendor'
  ) THEN
    CREATE POLICY "projects_select_member_team_vendor" ON projects
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM workspace_memberships wm
          JOIN contacts c ON c.id = wm.contact_id
          WHERE wm.operator_user_id = projects.user_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
            AND c.role IN ('Team', 'Vendor')
        )
      );
  END IF;
END
$projects_member_team_vendor_policy$;

GRANT EXECUTE ON FUNCTION find_workspaces_for_email(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION join_workspace(UUID, INTEGER, UUID, TEXT, TEXT, TEXT) TO authenticated;
