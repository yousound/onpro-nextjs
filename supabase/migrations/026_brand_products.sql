-- Brand & Products: manufacturer blanks catalog + operator workspace products.

CREATE TABLE IF NOT EXISTS manufacturer_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manufacturer_brands_user ON manufacturer_brands(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manufacturer_brands_external
  ON manufacturer_brands(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manufacturer_brand_id uuid NOT NULL REFERENCES manufacturer_brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  style_code text NOT NULL DEFAULT '',
  color text,
  size text,
  catalog_sku text,
  description text,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  external_payload jsonb DEFAULT '{}'::jsonb,
  unit_cost_cents integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_user ON catalog_products(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_brand ON catalog_products(manufacturer_brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_products_external
  ON catalog_products(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  workspace_sku text,
  kind text NOT NULL DEFAULT 'decorated',
  catalog_product_id uuid REFERENCES catalog_products(id) ON DELETE SET NULL,
  client_id text,
  blank_supplied_by text,
  garment_brand text,
  garment_style_number text,
  garment_color text,
  garment_size text,
  decoration_notes text,
  finishing_tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved boolean NOT NULL DEFAULT true,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_products_user ON workspace_products(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_products_sku ON workspace_products(user_id, workspace_sku);

ALTER TABLE manufacturer_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manufacturer_brands_member" ON manufacturer_brands;
CREATE POLICY "manufacturer_brands_member" ON manufacturer_brands
  FOR ALL
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "manufacturer_brands_own" ON manufacturer_brands;
CREATE POLICY "manufacturer_brands_own" ON manufacturer_brands
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "catalog_products_member" ON catalog_products;
CREATE POLICY "catalog_products_member" ON catalog_products
  FOR ALL
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "catalog_products_own" ON catalog_products;
CREATE POLICY "catalog_products_own" ON catalog_products
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_products_member" ON workspace_products;
CREATE POLICY "workspace_products_member" ON workspace_products
  FOR ALL
  USING (member_can_read_operator_contacts(user_id))
  WITH CHECK (member_can_read_operator_contacts(user_id));

DROP POLICY IF EXISTS "workspace_products_own" ON workspace_products;
CREATE POLICY "workspace_products_own" ON workspace_products
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER manufacturer_brands_updated_at BEFORE UPDATE ON manufacturer_brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER catalog_products_updated_at BEFORE UPDATE ON catalog_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER workspace_products_updated_at BEFORE UPDATE ON workspace_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
