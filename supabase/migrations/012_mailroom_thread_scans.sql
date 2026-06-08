-- Mailroom: persist OpenAI thread scans (Summarize only). One row per user + thread + content fingerprint.
-- Retained ~1 year; used for cache hits and assistant context (no inbox-wide AI reads).

CREATE TABLE IF NOT EXISTS mailroom_thread_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL,
    content_fingerprint TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    scan_context TEXT NOT NULL DEFAULT '',
    suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
    workflow JSONB,
    project_id INTEGER,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
    UNIQUE (user_id, thread_id, content_fingerprint)
);

CREATE INDEX IF NOT EXISTS mailroom_thread_scans_user_thread_idx
    ON mailroom_thread_scans (user_id, thread_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS mailroom_thread_scans_user_expires_idx
    ON mailroom_thread_scans (user_id, expires_at);

ALTER TABLE mailroom_thread_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mailroom_thread_scans_own" ON mailroom_thread_scans;
CREATE POLICY "mailroom_thread_scans_own" ON mailroom_thread_scans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
