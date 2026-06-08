-- OPTIONAL — only if you already had messaging RLS from OnPro/SUPABASE_SCHEMA.sql
-- and need to replace legacy policy names. This file uses DROP POLICY (Supabase may warn).
-- Does NOT drop tables or message rows.
--
-- Skip this file on a fresh project if 009_in_app_messages.sql ran successfully.

DROP POLICY IF EXISTS "conversations_all_own" ON conversations;
DROP POLICY IF EXISTS "conversation_participants_all_own" ON conversation_participants;
DROP POLICY IF EXISTS "messages_all_own" ON messages;

-- Re-run 009_in_app_messages.sql after this if policies were dropped and not recreated.
