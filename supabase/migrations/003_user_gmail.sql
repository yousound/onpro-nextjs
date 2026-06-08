-- Gmail OAuth tokens for Mailroom (per authenticated user)
-- Run in Supabase Dashboard → SQL → New query

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS user_gmail_connections (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    scopes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_gmail_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_gmail_own" ON user_gmail_connections;
CREATE POLICY "user_gmail_own" ON user_gmail_connections
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_gmail_updated_at ON user_gmail_connections;
CREATE TRIGGER user_gmail_updated_at BEFORE UPDATE ON user_gmail_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
