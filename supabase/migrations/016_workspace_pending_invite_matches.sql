-- Pending invite matches + segment on workspace email lookup (Live push).
--
-- Supabase may warn about "destructive operations" — that is expected here.
-- This only DROP + recreates one SQL function (`find_workspaces_for_email`).
-- No tables, rows, contacts, projects, or memberships are deleted.
-- Safe to re-run. DROP is required because we add a `segment` column to the return type.

DROP FUNCTION IF EXISTS find_workspaces_for_email(TEXT, UUID);

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
  already_joined BOOLEAN,
  segment TEXT
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
      c.linked_auth_user_id,
      CASE
        WHEN c.role = 'Team' THEN 'team'
        WHEN c.role = 'Vendor' THEN 'vendor'
        ELSE 'client'
      END AS segment
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
  ),
  invite_matches AS (
    SELECT
      pi.operator_user_id,
      pi.contact_id,
      c.name AS contact_name,
      c.company_name,
      c.role,
      c.address,
      c.linked_auth_user_id,
      pi.segment
    FROM pending_invites pi
    JOIN contacts c ON c.id = pi.contact_id AND c.user_id = pi.operator_user_id
    CROSS JOIN normalized n
    WHERE LOWER(TRIM(pi.email)) = n.email
      AND pi.accepted_at IS NULL
      AND pi.expires_at > NOW()
      AND (
        c.linked_auth_user_id IS NULL
        OR c.linked_auth_user_id = p_member_user_id
      )
  ),
  all_matches AS (
    SELECT * FROM matched_contacts
    UNION
    SELECT * FROM invite_matches
  )
  SELECT DISTINCT ON (am.operator_user_id, am.contact_id)
    am.operator_user_id,
    am.contact_id,
    COALESCE(p.workspace_name, p.company_name, 'Workspace') AS workspace_name,
    COALESCE(am.company_name, am.contact_name) AS contact_display_name,
    (
      SELECT COUNT(*)::bigint
      FROM projects pr
      WHERE pr.user_id = am.operator_user_id
        AND (
          am.role IN ('Team', 'Vendor')
          OR pr.client_id = am.contact_id
          OR (
            am.role = 'Client'
            AND am.address IS NOT NULL
            AND am.address ~ '^\{'
            AND (am.address::jsonb->>'parent_company_id') ~ '^\d+$'
            AND pr.client_id = (am.address::jsonb->>'parent_company_id')::integer
          )
        )
    ) AS project_count,
    EXISTS (
      SELECT 1
      FROM workspace_memberships wm
      WHERE wm.operator_user_id = am.operator_user_id
        AND wm.contact_id = am.contact_id
        AND wm.member_user_id = p_member_user_id
        AND wm.status = 'active'
    ) AS already_joined,
    am.segment
  FROM all_matches am
  LEFT JOIN profiles p ON p.id = am.operator_user_id
  ORDER BY am.operator_user_id, am.contact_id;
$$;

GRANT EXECUTE ON FUNCTION find_workspaces_for_email(TEXT, UUID) TO authenticated;
