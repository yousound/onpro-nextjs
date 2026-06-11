-- Gmail inbox thread cache + push sync state (Mailroom performance)
-- Run in Supabase Dashboard → SQL → New query

CREATE TABLE IF NOT EXISTS gmail_inbox_threads (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gmail_thread_id TEXT NOT NULL,
    thread_data JSONB NOT NULL,
    last_message_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS gmail_inbox_threads_user_last_msg_idx
    ON gmail_inbox_threads (user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS gmail_sync_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    history_id TEXT,
    watch_expiration TIMESTAMPTZ,
    last_inbox_sync_at TIMESTAMPTZ,
    next_page_token TEXT,
    inbox_estimate INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gmail_inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gmail_inbox_threads_own" ON gmail_inbox_threads;
CREATE POLICY "gmail_inbox_threads_own" ON gmail_inbox_threads
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gmail_sync_state_own" ON gmail_sync_state;
CREATE POLICY "gmail_sync_state_own" ON gmail_sync_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS gmail_sync_state_updated_at ON gmail_sync_state;
CREATE TRIGGER gmail_sync_state_updated_at BEFORE UPDATE ON gmail_sync_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
