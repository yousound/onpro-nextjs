-- In-app Messages (conversations + messages) for Live mode on web.
-- NON-DESTRUCTIVE: creates tables/columns/indexes/policies only when missing.
-- Does not DROP tables or delete rows.
--
-- Prerequisite: 008_workspace_memberships.sql (for member read/send policies below).
-- If you have old policies from OnPro/SUPABASE_SCHEMA.sql, run 009b after this (optional).

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  last_message_preview TEXT,
  last_message_date TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, contact_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT,
  asset_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  smart_attachment JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_delivered BOOLEAN NOT NULL DEFAULT true,
  sent_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
  ADD COLUMN IF NOT EXISTS last_message_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_date ON messages(sent_date);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_operator_all'
  ) THEN
    CREATE POLICY "conversations_operator_all" ON conversations
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF to_regclass('public.workspace_memberships') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_member_select'
     ) THEN
    CREATE POLICY "conversations_member_select" ON conversations
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM workspace_memberships wm
          WHERE wm.operator_user_id = conversations.user_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversation_participants'
      AND policyname = 'conversation_participants_operator_all'
  ) THEN
    CREATE POLICY "conversation_participants_operator_all" ON conversation_participants
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.workspace_memberships') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'conversation_participants'
         AND policyname = 'conversation_participants_member_select'
     ) THEN
    CREATE POLICY "conversation_participants_member_select" ON conversation_participants
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM conversations c
          JOIN workspace_memberships wm ON wm.operator_user_id = c.user_id
          WHERE c.id = conversation_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_operator_all'
  ) THEN
    CREATE POLICY "messages_operator_all" ON messages
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF to_regclass('public.workspace_memberships') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_member_select'
     ) THEN
    CREATE POLICY "messages_member_select" ON messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM conversations c
          JOIN workspace_memberships wm ON wm.operator_user_id = c.user_id
          WHERE c.id = messages.conversation_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
      );
  END IF;

  IF to_regclass('public.workspace_memberships') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_member_insert'
     ) THEN
    CREATE POLICY "messages_member_insert" ON messages
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM conversations c
          JOIN workspace_memberships wm ON wm.operator_user_id = c.user_id
          WHERE c.id = conversation_id
            AND c.user_id = messages.user_id
            AND wm.member_user_id = auth.uid()
            AND wm.status = 'active'
        )
        AND sender_user_id = auth.uid()
      );
  END IF;

  IF to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE NOTICE '009: workspace_memberships missing — run 008, then re-run this file for member policies.';
  END IF;
END
$policies$;

COMMENT ON COLUMN messages.image_urls IS 'Public URLs for chat photos (Supabase Storage message-images bucket)';
COMMENT ON COLUMN messages.user_id IS 'Workspace owner (operator) — used for RLS; same as conversations.user_id';
