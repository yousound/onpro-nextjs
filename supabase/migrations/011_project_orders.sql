-- =============================================================================
-- Production orders (operator-prefixed MAT260602) + order_id on jobs
-- Run after 002_project_jobs.sql and 004_profiles_onboarding.sql
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS operator_company_code TEXT;

COMMENT ON COLUMN profiles.operator_company_code IS
  '2–4 letter operator / workspace code for order numbers (e.g. MAT260602).';

CREATE TABLE IF NOT EXISTS project_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    po_number TEXT,
    client_po_number TEXT,
    linked_order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_orders_user_id ON project_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_project_orders_project_id ON project_orders(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_orders_user_order_number
  ON project_orders(user_id, order_number);

ALTER TABLE project_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_orders_all_own" ON project_orders
    FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER project_orders_updated_at BEFORE UPDATE ON project_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_jobs
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES project_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_jobs_order_id ON project_jobs(order_id);

-- SKU uniqueness per operator workspace (stored in wip JSONB; index on expression when present)
CREATE INDEX IF NOT EXISTS idx_project_jobs_wip_sku
  ON project_jobs ((wip->>'sku'))
  WHERE (wip->>'sku') IS NOT NULL AND (wip->>'sku') <> '';
