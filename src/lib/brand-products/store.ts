import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { defaultBrandProductsCatalog, findOrCreateBrandName } from "@/lib/brand-products/catalog-seed";
import type {
  BrandProductsCatalog,
  CatalogProduct,
  UpsertCatalogProductInput,
  UpsertWorkspaceProductInput,
  WorkspaceProduct,
} from "@/lib/types/brand-products";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";

const LS_KEY = MOCK_LS.brandProducts;

function readMockCatalog(): BrandProductsCatalog {
  const stored = readMockLs<BrandProductsCatalog>(LS_KEY);
  if (stored?.brands?.length) return stored;
  const seed = defaultBrandProductsCatalog();
  writeMockLs(LS_KEY, seed);
  return seed;
}

function writeMockCatalog(catalog: BrandProductsCatalog): void {
  writeMockLs(LS_KEY, catalog);
}

export async function loadBrandProductsCatalog(): Promise<BrandProductsCatalog> {
  if (!isClientLiveBackend()) {
    return readMockCatalog();
  }
  const res = await fetch("/api/brand-products", { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not load brand products");
  }
  return (await res.json()) as BrandProductsCatalog;
}

export async function saveWorkspaceProductToStore(
  input: UpsertWorkspaceProductInput,
): Promise<WorkspaceProduct> {
  if (!isClientLiveBackend()) {
    const catalog = readMockCatalog();
    const now = new Date().toISOString();
    const id = input.id ?? `wp-${Date.now().toString(36)}`;
    const existingIdx = catalog.workspace_products.findIndex((p) => p.id === id);
    const row: WorkspaceProduct = {
      id,
      name: input.name.trim(),
      workspace_sku: input.workspace_sku?.trim() || null,
      kind: input.kind,
      catalog_product_id: input.catalog_product_id ?? null,
      client_id: input.client_id ?? null,
      blank_supplied_by: input.blank_supplied_by ?? null,
      garment_brand: input.garment_brand ?? null,
      garment_style_number: input.garment_style_number ?? null,
      garment_color: input.garment_color ?? null,
      garment_size: input.garment_size ?? null,
      decoration_notes: input.decoration_notes ?? null,
      finishing_tasks: input.finishing_tasks ?? [],
      saved: input.saved ?? true,
      archived: input.archived ?? false,
      created_at: existingIdx >= 0 ? catalog.workspace_products[existingIdx]!.created_at : now,
      updated_at: now,
    };
    if (existingIdx >= 0) catalog.workspace_products[existingIdx] = row;
    else catalog.workspace_products.unshift(row);
    writeMockCatalog(catalog);
    return row;
  }

  const res = await fetch("/api/brand-products", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert_workspace", product: input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not save product");
  }
  const data = (await res.json()) as { product: WorkspaceProduct };
  return data.product;
}

export async function saveCatalogProductToStore(
  input: UpsertCatalogProductInput & { brand_name: string },
): Promise<CatalogProduct> {
  if (!isClientLiveBackend()) {
    const catalog = readMockCatalog();
    const brand = findOrCreateBrandName(catalog, input.brand_name);
    const now = new Date().toISOString();
    const id = input.id ?? `cat-${Date.now().toString(36)}`;
    const row: CatalogProduct = {
      id,
      manufacturer_brand_id: brand.id,
      manufacturer_name: brand.name,
      name: input.name.trim(),
      style_code: input.style_code?.trim() ?? "",
      color: input.color ?? null,
      color_code: input.color_code ?? null,
      size: input.size ?? null,
      catalog_sku: input.catalog_sku ?? null,
      description: input.description ?? null,
      source: input.source ?? "manual",
      external_id: input.external_id ?? null,
      unit_cost_cents: input.unit_cost_cents ?? null,
      active: input.active ?? true,
      created_at: now,
      updated_at: now,
    };
    const idx = catalog.catalog_products.findIndex((p) => p.id === id);
    if (idx >= 0) catalog.catalog_products[idx] = row;
    else catalog.catalog_products.unshift(row);
    writeMockCatalog(catalog);
    return row;
  }

  const res = await fetch("/api/brand-products", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert_catalog", product: input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Could not save catalog product");
  }
  const data = (await res.json()) as { product: CatalogProduct };
  return data.product;
}
