-- =============================================================================
-- OnPro project jobs (desktop WIP model)
-- Run after OnPro/SUPABASE_SCHEMA.sql (projects + contacts must exist).
-- Job section payloads live in JSONB until team finalizes per-field columns.
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    job_number TEXT,
    name TEXT NOT NULL DEFAULT 'Untitled job',
    subtitle TEXT DEFAULT '',
    job_type TEXT DEFAULT 'custom',
    status TEXT NOT NULL DEFAULT 'In progress',
    due_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    /** Full ProjectJob shape from onpro-nextjs src/lib/types/wip.ts (minus id/project_id). */
    wip JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_project_jobs_user_id ON project_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_project_jobs_project_id ON project_jobs(project_id);

ALTER TABLE project_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_jobs_all_own" ON project_jobs
    FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER project_jobs_updated_at BEFORE UPDATE ON project_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- Mailroom persistence (Next.js desktop — optional run with core schema)
-- =============================================================================

CREATE TABLE IF NOT EXISTS mailroom_threads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    channel TEXT DEFAULT 'email',
    category TEXT,
    status TEXT DEFAULT 'unread',
    related JSONB DEFAULT '{}'::jsonb,
    linked_message_conversation_id INTEGER,
    participants JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mailroom_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES mailroom_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    from_name TEXT,
    from_email TEXT,
    body TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    attachments JSONB DEFAULT '[]'::jsonb,
    is_outbound BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS mailroom_generated_items (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES mailroom_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    deep_link TEXT,
    source_suggestion_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mailroom_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailroom_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailroom_generated_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mailroom_threads_own" ON mailroom_threads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mailroom_messages_own" ON mailroom_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "mailroom_generated_own" ON mailroom_generated_items FOR ALL USING (auth.uid() = user_id);
