import type {
  BrandProductsCatalog,
  CatalogProduct,
  ManufacturerBrand,
} from "@/lib/types/brand-products";

const now = () => new Date().toISOString();

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function brandId(slug: string): string {
  return `brand-${slug}`;
}

function catalogId(slug: string): string {
  return `cat-${slug}`;
}

/** Starter blanks — Gildan, Hanes, LA Apparel — for mock / first-time workspace seed. */
export function defaultBrandProductsCatalog(): BrandProductsCatalog {
  const t = now();
  const brands: ManufacturerBrand[] = [
    {
      id: brandId("gildan"),
      name: "Gildan",
      slug: "gildan",
      source: "system",
      external_id: null,
      created_at: t,
      updated_at: t,
    },
    {
      id: brandId("hanes"),
      name: "Hanes",
      slug: "hanes",
      source: "system",
      external_id: null,
      created_at: t,
      updated_at: t,
    },
    {
      id: brandId("la-apparel"),
      name: "LA Apparel",
      slug: "la-apparel",
      source: "system",
      external_id: null,
      created_at: t,
      updated_at: t,
    },
  ];

  const catalog_products: CatalogProduct[] = [
    {
      id: catalogId("gildan-2000-black"),
      manufacturer_brand_id: brandId("gildan"),
      manufacturer_name: "Gildan",
      name: "Gildan 2000 Ultra Cotton Tee",
      style_code: "2000",
      color: "Black",
      size: null,
      catalog_sku: "G2000-BLK",
      description: "Heavy cotton crew neck tee",
      source: "system",
      external_id: "gildan-2000",
      unit_cost_cents: null,
      active: true,
      created_at: t,
      updated_at: t,
    },
    {
      id: catalogId("gildan-2000-white"),
      manufacturer_brand_id: brandId("gildan"),
      manufacturer_name: "Gildan",
      name: "Gildan 2000 Ultra Cotton Tee",
      style_code: "2000",
      color: "White",
      size: null,
      catalog_sku: "G2000-WHT",
      description: "Heavy cotton crew neck tee",
      source: "system",
      external_id: "gildan-2000-white",
      unit_cost_cents: null,
      active: true,
      created_at: t,
      updated_at: t,
    },
    {
      id: catalogId("hanes-5280-navy"),
      manufacturer_brand_id: brandId("hanes"),
      manufacturer_name: "Hanes",
      name: "Hanes Beefy-T",
      style_code: "5280",
      color: "Navy",
      size: null,
      catalog_sku: "H5280-NVY",
      description: "Premium cotton tee",
      source: "system",
      external_id: "hanes-5280",
      unit_cost_cents: null,
      active: true,
      created_at: t,
      updated_at: t,
    },
    {
      id: catalogId("laa-1801-black"),
      manufacturer_brand_id: brandId("la-apparel"),
      manufacturer_name: "LA Apparel",
      name: "LA Apparel 1801 Garment Dye Tee",
      style_code: "1801",
      color: "Black",
      size: null,
      catalog_sku: "LAA1801-BLK",
      description: "Garment-dyed tee",
      source: "system",
      external_id: "laa-1801",
      unit_cost_cents: null,
      active: true,
      created_at: t,
      updated_at: t,
    },
  ];

  return { brands, catalog_products, workspace_products: [] };
}

export function findOrCreateBrandName(
  catalog: BrandProductsCatalog,
  name: string,
): ManufacturerBrand {
  const trimmed = name.trim();
  const existing = catalog.brands.find(
    (b) => b.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  const slug = slugify(trimmed) || `brand-${Date.now().toString(36)}`;
  const brand: ManufacturerBrand = {
    id: brandId(slug),
    name: trimmed,
    slug,
    source: "manual",
    external_id: null,
    created_at: now(),
    updated_at: now(),
  };
  catalog.brands.push(brand);
  return brand;
}
