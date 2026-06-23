import type {
  BrandProductsCatalog,
  CatalogProduct,
  ManufacturerBrand,
  UpsertCatalogProductInput,
  UpsertWorkspaceProductInput,
  WorkspaceProduct,
} from "@/lib/types/brand-products";
import type { JobFinishingTask } from "@/lib/types/brand-products";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrandRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string | null;
  source: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

type CatalogRow = {
  id: string;
  user_id: string;
  manufacturer_brand_id: string;
  name: string;
  style_code: string;
  color: string | null;
  size: string | null;
  catalog_sku: string | null;
  description: string | null;
  source: string;
  external_id: string | null;
  unit_cost_cents: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  manufacturer_brands?: { name: string } | { name: string }[] | null;
};

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  workspace_sku: string | null;
  kind: string;
  catalog_product_id: string | null;
  client_id: string | null;
  blank_supplied_by: string | null;
  garment_brand: string | null;
  garment_style_number: string | null;
  garment_color: string | null;
  garment_size: string | null;
  decoration_notes: string | null;
  finishing_tasks: JobFinishingTask[] | null;
  saved: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

function brandFromRow(row: BrandRow): ManufacturerBrand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    source: row.source as ManufacturerBrand["source"],
    external_id: row.external_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function catalogFromRow(row: CatalogRow): CatalogProduct {
  const brandJoin = row.manufacturer_brands;
  const manufacturer_name = Array.isArray(brandJoin)
    ? brandJoin[0]?.name
    : brandJoin?.name;
  return {
    id: row.id,
    manufacturer_brand_id: row.manufacturer_brand_id,
    manufacturer_name,
    name: row.name,
    style_code: row.style_code,
    color: row.color,
    size: row.size,
    catalog_sku: row.catalog_sku,
    description: row.description,
    source: row.source as CatalogProduct["source"],
    external_id: row.external_id,
    unit_cost_cents: row.unit_cost_cents,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function workspaceFromRow(row: WorkspaceRow): WorkspaceProduct {
  return {
    id: row.id,
    name: row.name,
    workspace_sku: row.workspace_sku,
    kind: row.kind as WorkspaceProduct["kind"],
    catalog_product_id: row.catalog_product_id,
    client_id: row.client_id,
    blank_supplied_by: row.blank_supplied_by as WorkspaceProduct["blank_supplied_by"],
    garment_brand: row.garment_brand,
    garment_style_number: row.garment_style_number,
    garment_color: row.garment_color,
    garment_size: row.garment_size,
    decoration_notes: row.decoration_notes,
    finishing_tasks: Array.isArray(row.finishing_tasks) ? row.finishing_tasks : [],
    saved: row.saved,
    archived: row.archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchBrandProductsCatalog(
  supabase: SupabaseClient,
  workspaceOwnerId: string,
): Promise<BrandProductsCatalog> {
  const [brandsRes, catalogRes, workspaceRes] = await Promise.all([
    supabase
      .from("manufacturer_brands")
      .select("*")
      .eq("user_id", workspaceOwnerId)
      .order("name"),
    supabase
      .from("catalog_products")
      .select("*, manufacturer_brands(name)")
      .eq("user_id", workspaceOwnerId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("workspace_products")
      .select("*")
      .eq("user_id", workspaceOwnerId)
      .eq("archived", false)
      .order("updated_at", { ascending: false }),
  ]);

  if (brandsRes.error) throw brandsRes.error;
  if (catalogRes.error) throw catalogRes.error;
  if (workspaceRes.error) throw workspaceRes.error;

  return {
    brands: (brandsRes.data as BrandRow[]).map(brandFromRow),
    catalog_products: (catalogRes.data as CatalogRow[]).map(catalogFromRow),
    workspace_products: (workspaceRes.data as WorkspaceRow[]).map(workspaceFromRow),
  };
}

export async function upsertManufacturerBrand(
  supabase: SupabaseClient,
  workspaceOwnerId: string,
  input: { id?: string; name: string; source?: string; external_id?: string | null },
): Promise<ManufacturerBrand> {
  const payload = {
    user_id: workspaceOwnerId,
    name: input.name.trim(),
    slug: input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    source: input.source ?? "manual",
    external_id: input.external_id ?? null,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("manufacturer_brands")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", workspaceOwnerId)
      .select("*")
      .single();
    if (error) throw error;
    return brandFromRow(data as BrandRow);
  }

  const { data, error } = await supabase
    .from("manufacturer_brands")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return brandFromRow(data as BrandRow);
}

export async function upsertCatalogProduct(
  supabase: SupabaseClient,
  workspaceOwnerId: string,
  input: UpsertCatalogProductInput & { manufacturer_brand_id: string },
): Promise<CatalogProduct> {
  const payload = {
    user_id: workspaceOwnerId,
    manufacturer_brand_id: input.manufacturer_brand_id,
    name: input.name.trim(),
    style_code: input.style_code?.trim() ?? "",
    color: input.color?.trim() || null,
    size: input.size?.trim() || null,
    catalog_sku: input.catalog_sku?.trim() || null,
    description: input.description?.trim() || null,
    source: input.source ?? "manual",
    external_id: input.external_id ?? null,
    unit_cost_cents: input.unit_cost_cents ?? null,
    active: input.active ?? true,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("catalog_products")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", workspaceOwnerId)
      .select("*, manufacturer_brands(name)")
      .single();
    if (error) throw error;
    return catalogFromRow(data as CatalogRow);
  }

  const { data, error } = await supabase
    .from("catalog_products")
    .insert(payload)
    .select("*, manufacturer_brands(name)")
    .single();
  if (error) throw error;
  return catalogFromRow(data as CatalogRow);
}

export async function upsertWorkspaceProduct(
  supabase: SupabaseClient,
  workspaceOwnerId: string,
  input: UpsertWorkspaceProductInput,
): Promise<WorkspaceProduct> {
  const payload = {
    user_id: workspaceOwnerId,
    name: input.name.trim(),
    workspace_sku: input.workspace_sku?.trim() || null,
    kind: input.kind,
    catalog_product_id: input.catalog_product_id ?? null,
    client_id: input.client_id ?? null,
    blank_supplied_by: input.blank_supplied_by ?? null,
    garment_brand: input.garment_brand?.trim() || null,
    garment_style_number: input.garment_style_number?.trim() || null,
    garment_color: input.garment_color?.trim() || null,
    garment_size: input.garment_size?.trim() || null,
    decoration_notes: input.decoration_notes?.trim() || null,
    finishing_tasks: input.finishing_tasks ?? [],
    saved: input.saved ?? true,
    archived: input.archived ?? false,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("workspace_products")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", workspaceOwnerId)
      .select("*")
      .single();
    if (error) throw error;
    return workspaceFromRow(data as WorkspaceRow);
  }

  const { data, error } = await supabase
    .from("workspace_products")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return workspaceFromRow(data as WorkspaceRow);
}

/** Brandboom webhook payload shape (minimal — extend when integrating). */
export type BrandboomProductPayload = {
  external_id: string;
  brand_name: string;
  product_name: string;
  style_code?: string;
  color?: string;
  size?: string;
  sku?: string;
  description?: string;
  unit_cost?: number;
};

export async function ingestBrandboomProduct(
  supabase: SupabaseClient,
  workspaceOwnerId: string,
  payload: BrandboomProductPayload,
): Promise<CatalogProduct> {
  const brand = await upsertManufacturerBrand(supabase, workspaceOwnerId, {
    name: payload.brand_name,
    source: "brandboom",
    external_id: `brandboom:${payload.brand_name.toLowerCase()}`,
  });

  const unit_cost_cents =
    typeof payload.unit_cost === "number" && Number.isFinite(payload.unit_cost)
      ? Math.round(payload.unit_cost * 100)
      : null;

  const { data: existing } = await supabase
    .from("catalog_products")
    .select("id")
    .eq("user_id", workspaceOwnerId)
    .eq("source", "brandboom")
    .eq("external_id", payload.external_id)
    .maybeSingle();

  return upsertCatalogProduct(supabase, workspaceOwnerId, {
    id: existing?.id as string | undefined,
    manufacturer_brand_id: brand.id,
    name: payload.product_name,
    style_code: payload.style_code ?? "",
    color: payload.color ?? null,
    size: payload.size ?? null,
    catalog_sku: payload.sku ?? null,
    description: payload.description ?? null,
    source: "brandboom",
    external_id: payload.external_id,
    unit_cost_cents,
    active: true,
  });
}
