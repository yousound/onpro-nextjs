import type {
  BrandProductsCatalog,
  CatalogProduct,
  WorkspaceProduct,
} from "@/lib/types/brand-products";
import type { ProjectJob } from "@/lib/types/wip";

export function catalogProductToJobFields(
  product: CatalogProduct,
  brandName?: string,
): Partial<ProjectJob> {
  return {
    catalog_product_id: product.id,
    workspace_product_id: null,
    garment_brand: brandName ?? product.manufacturer_name ?? "",
    garment_style_number: product.style_code,
    garment_color: product.color ?? "",
    garment_size: product.size ?? "",
  };
}

export function workspaceProductToJobFields(product: WorkspaceProduct): Partial<ProjectJob> {
  return {
    workspace_product_id: product.id,
    catalog_product_id: product.catalog_product_id ?? null,
    garment_brand: product.garment_brand ?? "",
    garment_style_number: product.garment_style_number ?? "",
    garment_color: product.garment_color ?? "",
    garment_size: product.garment_size ?? "",
    blank_supplied_by: product.blank_supplied_by ?? null,
    finishing_tasks: product.finishing_tasks?.length
      ? JSON.parse(JSON.stringify(product.finishing_tasks))
      : [],
    description: product.decoration_notes?.trim()
      ? product.decoration_notes
      : undefined,
  };
}

export function jobToWorkspaceProductDraft(
  job: ProjectJob,
  catalog: BrandProductsCatalog,
  options: { name: string; workspace_sku?: string; saved: boolean },
): Omit<WorkspaceProduct, "id" | "created_at" | "updated_at" | "archived"> {
  const catalogProduct = job.catalog_product_id
    ? catalog.catalog_products.find((p) => p.id === job.catalog_product_id)
    : null;

  return {
    name: options.name.trim(),
    workspace_sku: options.workspace_sku?.trim() || job.sku?.trim() || null,
    kind: job.description?.trim() || (job.finishing_tasks?.length ?? 0) > 0 ? "decorated" : "blank",
    catalog_product_id: job.catalog_product_id ?? catalogProduct?.id ?? null,
    client_id: null,
    blank_supplied_by: job.blank_supplied_by ?? null,
    garment_brand: job.garment_brand ?? catalogProduct?.manufacturer_name ?? "",
    garment_style_number: job.garment_style_number ?? catalogProduct?.style_code ?? "",
    garment_color: job.garment_color ?? catalogProduct?.color ?? "",
    garment_size: job.garment_size ?? catalogProduct?.size ?? "",
    decoration_notes: job.description?.trim() || null,
    finishing_tasks: job.finishing_tasks?.length
      ? JSON.parse(JSON.stringify(job.finishing_tasks))
      : [],
    saved: options.saved,
  };
}

export function catalogDisplayLabel(product: CatalogProduct): string {
  const parts = [
    product.manufacturer_name ?? "",
    product.style_code,
    product.color,
    product.size,
  ].filter(Boolean);
  return parts.join(" · ") || product.name;
}
