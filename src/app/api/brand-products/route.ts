import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { defaultBrandProductsCatalog } from "@/lib/brand-products/catalog-seed";
import { resolveWorkspaceOwnerId } from "@/lib/server/resolve-workspace-context";
import {
  fetchBrandProductsCatalog,
  upsertCatalogProduct,
  upsertManufacturerBrand,
  upsertWorkspaceProduct,
} from "@/lib/supabase/brand-products";
import { createClient } from "@/lib/supabase/server";
import type {
  UpsertCatalogProductInput,
  UpsertWorkspaceProductInput,
} from "@/lib/types/brand-products";

type PostBody =
  | { action: "upsert_workspace"; product: UpsertWorkspaceProductInput }
  | { action: "upsert_catalog"; product: UpsertCatalogProductInput & { brand_name: string } };

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(defaultBrandProductsCatalog());
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ownerId = await resolveWorkspaceOwnerId(supabase, user.id);
    const catalog = await fetchBrandProductsCatalog(supabase, ownerId);
    if (catalog.brands.length === 0) {
      const seed = defaultBrandProductsCatalog();
      for (const brand of seed.brands) {
        const saved = await upsertManufacturerBrand(supabase, ownerId, {
          name: brand.name,
          source: brand.source,
          external_id: brand.external_id,
        });
        for (const product of seed.catalog_products.filter(
          (p) => p.manufacturer_name === brand.name,
        )) {
          await upsertCatalogProduct(supabase, ownerId, {
            manufacturer_brand_id: saved.id,
            name: product.name,
            style_code: product.style_code,
            color: product.color,
            size: product.size,
            catalog_sku: product.catalog_sku,
            description: product.description,
            source: product.source,
            external_id: product.external_id,
            unit_cost_cents: product.unit_cost_cents,
            active: true,
          });
        }
      }
      return NextResponse.json(await fetchBrandProductsCatalog(supabase, ownerId));
    }
    return NextResponse.json(catalog);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as PostBody;

  try {
    const ownerId = await resolveWorkspaceOwnerId(supabase, user.id);

    if (body.action === "upsert_workspace") {
      const product = await upsertWorkspaceProduct(supabase, ownerId, body.product);
      return NextResponse.json({ ok: true, product });
    }

    if (body.action === "upsert_catalog") {
      const brand = await upsertManufacturerBrand(supabase, ownerId, {
        name: body.product.brand_name,
        source: body.product.source ?? "manual",
      });
      const product = await upsertCatalogProduct(supabase, ownerId, {
        ...body.product,
        manufacturer_brand_id: brand.id,
      });
      return NextResponse.json({ ok: true, product });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
