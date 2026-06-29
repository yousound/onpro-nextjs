/** Who supplies a blank or finishing component (e.g. client, operator, vendor). */
export type SuppliedBy = "client" | "operator" | "vendor";

export const SUPPLIED_BY_LABELS: Record<SuppliedBy, string> = {
  client: "Client supplied",
  operator: "Operator supplied",
  vendor: "Vendor supplied",
};

export type ProductSource = "manual" | "system" | "brandboom" | "import";

/** Manufacturer / mill (Gildan, Hanes, LA Apparel). */
export type ManufacturerBrand = {
  id: string;
  name: string;
  slug?: string | null;
  source: ProductSource;
  external_id?: string | null;
  created_at: string;
  updated_at: string;
};

/** Finished blank from catalog — substrate before decoration. */
export type CatalogProduct = {
  id: string;
  manufacturer_brand_id: string;
  manufacturer_name?: string;
  name: string;
  style_code: string;
  color?: string | null;
  /** Three-letter color code for style labels (e.g. BPK). */
  color_code?: string | null;
  size?: string | null;
  catalog_sku?: string | null;
  description?: string | null;
  source: ProductSource;
  external_id?: string | null;
  unit_cost_cents?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinishingPreset =
  | "folding"
  | "bagging"
  | "adding_zippers"
  | "quality_control"
  | "poly_bag"
  | "neck_print"
  | "upc_sticker"
  | "fold_bag_sticker"
  | "custom";

export const FINISHING_PRESET_LABELS: Record<Exclude<FinishingPreset, "custom">, string> = {
  folding: "Folding",
  bagging: "Bagging",
  adding_zippers: "Adding zippers",
  quality_control: "Quality control",
  poly_bag: "Poly bag",
  neck_print: "Neck print",
  upc_sticker: "UPC sticker",
  fold_bag_sticker: "Fold, bag, UPC sticker",
};

export type FinishingLineItem = {
  id: string;
  description: string;
  supplied_by?: SuppliedBy | null;
};

/** Preset task or custom section with multiple line items. */
export type JobFinishingTask =
  | {
      id: string;
      kind: "preset";
      preset: Exclude<FinishingPreset, "custom">;
      supplied_by?: SuppliedBy | null;
      notes?: string | null;
    }
  | {
      id: string;
      kind: "custom";
      section_name: string;
      items: FinishingLineItem[];
    };

export type WorkspaceProductKind = "blank" | "decorated";

/** Operator-owned product — blank only or blank + decoration recipe. */
export type WorkspaceProduct = {
  id: string;
  name: string;
  workspace_sku?: string | null;
  kind: WorkspaceProductKind;
  catalog_product_id?: string | null;
  client_id?: string | null;
  blank_supplied_by?: SuppliedBy | null;
  garment_brand?: string | null;
  garment_style_number?: string | null;
  garment_color?: string | null;
  garment_color_code?: string | null;
  garment_size?: string | null;
  decoration_notes?: string | null;
  finishing_tasks: JobFinishingTask[];
  saved: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type BrandProductsCatalog = {
  brands: ManufacturerBrand[];
  catalog_products: CatalogProduct[];
  workspace_products: WorkspaceProduct[];
};

export type UpsertCatalogProductInput = Omit<
  CatalogProduct,
  "id" | "created_at" | "updated_at" | "manufacturer_name" | "active" | "manufacturer_brand_id"
> & {
  id?: string;
  manufacturer_brand_id?: string;
  manufacturer_name?: string;
  active?: boolean;
};

export type UpsertWorkspaceProductInput = Omit<
  WorkspaceProduct,
  "id" | "created_at" | "updated_at" | "archived"
> & {
  id?: string;
  archived?: boolean;
};
