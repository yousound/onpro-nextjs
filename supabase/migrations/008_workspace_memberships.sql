-- Workspace memberships: link client/vendor/team auth users to operator CRM contacts.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE; policies created only when missing.
-- Run in Supabase Dashboard → SQL Editor after prior migrations.

-- ---------------------------------------------------------------------------
-- contacts: link claimed auth user
-- ---------------------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linked_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_status TEXT NOT NULL DEFAULT 'uninvited';

COMMENT ON COLUMN contacts.linked_auth_user_id IS 'Auth user who claimed this CRM contact via invite or email match';
COMMENT ON COLUMN contacts.invite_status IS 'uninvited | invited | joined';

CREATE INDEX IF NOT EXISTS idx_contacts_linked_auth_user ON contacts(linked_auth_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON contacts((LOWER(TRIM(email))));

-- ---------------------------------------------------------------------------
-- workspace_memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_memberships (
  id SERIAL PRIMARY KEY,
  operator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  source TEXT NOT NULL DEFAULT 'email_claim' CHECK (source IN ('invite', 'email_claim', 'owner_added')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operator_user_id, member_user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_operator ON workspace_memberships(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_wm_member ON workspace_memberships(member_user_id);
CREATE INDEX IF NOT EXISTS idx_wm_contact ON workspace_memberships(contact_id);

ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;

DO $wm_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_memberships' AND policyname = 'wm_select_operator'
  ) THEN
    CREATE POLICY "wm_select_operator" ON workspace_memberships
      FOR SELECT USING (auth.uid() = operator_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_memberships' AND policyname = 'wm_select_member'
  ) THEN
    CREATE POLICY "wm_select_member" ON workspace_memberships
      FOR SELECT USING (auth.uid() = member_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_memberships' AND policyname = 'wm_insert_member'
  ) THEN
    CREATE POLICY "wm_insert_member" ON workspace_memberships
      FOR INSERT WITH CHECK (auth.uid() = member_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_memberships' AND policyname = 'wm_update_operator'
  ) THEN
    CREATE POLICY "wm_update_operator" ON workspace_memberships
      FOR UPDATE USING (auth.uid() = operator_user_id);
  END IF;
END
$wm_policies$;

-- ---------------------------------------------------------------------------
-- pending_invites (replaces mock localStorage queue in Live)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  operator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'client' CHECK (segment IN ('client', 'team', 'vendor')),
  invited_label TEXT,
  permissions JSONB,
  redirect_after TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_invites_operator ON pending_invites(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_token ON pending_invites(token);
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON pending_invites((LOWER(TRIM(email))));

ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

DO $pi_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pending_invites' AND policyname = 'pending_invites_operator_all'
  ) THEN
    CREATE POLICY "pending_invites_operator_all" ON pending_invites
      FOR ALL USING (auth.uid() = operator_user_id)
      WITH CHECK (auth.uid() = operator_user_id);
  END IF;
END
$pi_policy$;

-- ---------------------------------------------------------------------------
-- workspace_member_events (owner notifications: joined / revoked)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_member_events (
  id SERIAL PRIMARY KEY,
  operator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('joined', 'revoked')),
  member_email TEXT,
  member_name TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wme_operator_unread ON workspace_member_events(operator_user_id);

ALTER TABLE workspace_member_events ENABLE ROW LEVEL SECURITY;

DO $wme_policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_member_events' AND policyname = 'wme_operator_select'
  ) THEN
    CREATE POLICY "wme_operator_select" ON workspace_member_events
      FOR SELECT USING (auth.uid() = operator_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_member_events' AND policyname = 'wme_operator_update'
  ) THEN
    CREATE POLICY "wme_operator_update" ON workspace_member_events
      FOR UPDATE USING (auth.uid() = operator_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspace_member_events' AND policyname = 'wme_insert_service'
  ) THEN
    CREATE POLICY "wme_insert_service" ON workspace_member_events
      FOR INSERT WITH CHECK (true);
  END IF;
END
$wme_policies$;

-- ---------------------------------------------------------------------------
-- projects: members can read projects for their linked client contact
-- ---------------------------------------------------------------------------
DO $projects_member_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'projects_select_member'
  ) THEN
    CREATE POLICY "projects_select_member" ON projects
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM workspace_memberships wm
          JOIN contacts c ON c.id = wm.contact_id
          WHERE wm.operator_user_id = projects.user_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
            AND (
              projects.client_id = wm.contact_id
              OR (
                c.address IS NOT NULL
                AND c.address ~ '^\{'
                AND (c.address::jsonb->>'parent_company_id') ~ '^\d+$'
                AND projects.client_id = (c.address::jsonb->>'parent_company_id')::integer
              )
            )
        )
      );
  END IF;
END
$projects_member_policy$;

-- ---------------------------------------------------------------------------
-- find_workspaces_for_email — cross-operator lookup (SECURITY DEFINER)
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
    WHERE c.role = 'Client'
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
          pr.client_id = mc.contact_id
          OR (
            mc.address IS NOT NULL
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
-- join_workspace — claim contact + create membership + notify operator
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
    AND role = 'Client';

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
-- revoke_workspace_membership
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION revoke_workspace_membership(
  p_membership_id INTEGER,
  p_operator_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wm workspace_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_wm
  FROM workspace_memberships
  WHERE id = p_membership_id
    AND operator_user_id = p_operator_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  UPDATE workspace_memberships
  SET status = 'revoked', updated_at = NOW()
  WHERE id = p_membership_id;

  UPDATE contacts
  SET linked_auth_user_id = NULL, invite_status = 'uninvited', updated_at = NOW()
  WHERE id = v_wm.contact_id
    AND linked_auth_user_id = v_wm.member_user_id;

  INSERT INTO workspace_member_events (
    operator_user_id, member_user_id, contact_id,
    event_type, member_email
  )
  SELECT
    v_wm.operator_user_id, v_wm.member_user_id, v_wm.contact_id,
    'revoked', pr.email
  FROM profiles pr
  WHERE pr.id = v_wm.member_user_id;
END;
$$;

DO $wm_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'workspace_memberships_updated_at'
  ) THEN
    CREATE TRIGGER workspace_memberships_updated_at
      BEFORE UPDATE ON workspace_memberships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END
$wm_trigger$;

-- Public invite preview (token only — no auth required)
CREATE OR REPLACE FUNCTION resolve_invite_token(p_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  expired BOOLEAN,
  accepted BOOLEAN,
  email TEXT,
  segment TEXT,
  redirect_after TEXT,
  workspace_name TEXT,
  contact_display_name TEXT,
  operator_user_id UUID,
  contact_id INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    TRUE AS valid,
    (pi.expires_at < NOW()) AS expired,
    (pi.accepted_at IS NOT NULL) AS accepted,
    pi.email,
    pi.segment,
    pi.redirect_after,
    COALESCE(pr.workspace_name, pr.company_name, 'Workspace') AS workspace_name,
    COALESCE(c.company_name, c.name, pi.email) AS contact_display_name,
    pi.operator_user_id,
    pi.contact_id
  FROM pending_invites pi
  LEFT JOIN profiles pr ON pr.id = pi.operator_user_id
  LEFT JOIN contacts c ON c.id = pi.contact_id
  WHERE pi.token = TRIM(p_token)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION find_workspaces_for_email(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION join_workspace(UUID, INTEGER, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_workspace_membership(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_invite_token(TEXT) TO anon, authenticated;

