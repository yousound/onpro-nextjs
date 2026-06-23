-- Team-visible log of outbound Gmail sends (vendor RFQs, estimates, etc.)

CREATE TABLE IF NOT EXISTS outbound_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id bigint REFERENCES projects(id) ON DELETE SET NULL,
  job_id text,
  vendor_quote_id text,
  estimate_id text,
  category text NOT NULL DEFAULT 'vendor_quote',
  gmail_thread_id text NOT NULL,
  gmail_message_id text NOT NULL,
  mailroom_thread_id text NOT NULL,
  to_email text NOT NULL,
  to_name text,
  cc_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL,
  body_preview text,
  html_body text,
  attachment_manifest jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_attachment_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_project ON outbound_messages(project_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_operator ON outbound_messages(operator_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_gmail_thread ON outbound_messages(gmail_thread_id);

ALTER TABLE outbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outbound_messages_all_own" ON outbound_messages;
CREATE POLICY "outbound_messages_all_own" ON outbound_messages
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "outbound_messages_select_member_team" ON outbound_messages;
CREATE POLICY "outbound_messages_select_member_team" ON outbound_messages
  FOR SELECT USING (member_can_read_operator_contacts(operator_user_id));

DROP POLICY IF EXISTS "outbound_messages_select_via_project" ON outbound_messages;
CREATE POLICY "outbound_messages_select_via_project" ON outbound_messages
  FOR SELECT USING (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = outbound_messages.project_id
        AND (
          p.user_id = auth.uid()
          OR member_can_read_operator_contacts(p.user_id)
          OR member_can_read_client_project(p.user_id, p.client_id)
        )
    )
  );
