"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectJob } from "@/lib/types/wip";
import type {
  BrandProductsCatalog,
  CatalogProduct,
  SuppliedBy,
  WorkspaceProduct,
} from "@/lib/types/brand-products";
import { SUPPLIED_BY_LABELS } from "@/lib/types/brand-products";
import {
  catalogDisplayLabel,
  catalogProductToJobFields,
  jobToWorkspaceProductDraft,
  workspaceProductToJobFields,
} from "@/lib/brand-products/apply-to-job";
import {
  loadBrandProductsCatalog,
  saveCatalogProductToStore,
  saveWorkspaceProductToStore,
} from "@/lib/brand-products/store";
import { suppliedBySelectOptions } from "@/lib/brand-products/finishing";
import { JobFinishingSection } from "@/components/job-finishing-section";
import { VendorFieldSelect } from "@/components/vendor-select";
import type { Contact } from "@/lib/types/contact";
import { dispatchAppToast } from "@/lib/onpro-events";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

type ProductPickerMode = "catalog" | "saved" | "manual";

export function JobBrandProductsSection({
  draft,
  patch,
  vendors,
  isPrimaryJob: _isPrimaryJob,
  fieldClass,
}: {
  draft: ProjectJob;
  patch: (partial: Partial<ProjectJob>) => void;
  vendors: Contact[];
  isPrimaryJob: boolean;
  fieldClass: string;
}) {
  const [catalog, setCatalog] = useState<BrandProductsCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerMode, setPickerMode] = useState<ProductPickerMode>("catalog");
  const [search, setSearch] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadBrandProductsCatalog();
      setCatalog(data);
    } catch (e) {
      console.warn("[brand-products]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.catalog_products.filter((p) => {
      if (!q) return true;
      const hay = [
        p.name,
        p.style_code,
        p.color,
        p.catalog_sku,
        p.manufacturer_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, search]);

  const filteredSaved = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.workspace_products.filter((p) => {
      if (!p.saved || p.archived) return false;
      if (!q) return true;
      const hay = [p.name, p.workspace_sku, p.garment_brand, p.garment_style_number]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, search]);

  function applyCatalogProduct(product: CatalogProduct) {
    const brandName =
      product.manufacturer_name ??
      catalog?.brands.find((b) => b.id === product.manufacturer_brand_id)?.name;
    patch(catalogProductToJobFields(product, brandName));
    setSaveName(product.name);
  }

  function applyWorkspaceProduct(product: WorkspaceProduct) {
    patch(workspaceProductToJobFields(product));
    setSaveName(product.name);
    setSaveToLibrary(false);
  }

  async function handleSaveProduct() {
    if (!catalog) return;
    const name = saveName.trim() || draft.name?.trim() || "Product";
    setSaving(true);
    try {
      const draftProduct = jobToWorkspaceProductDraft(draft, catalog, {
        name,
        workspace_sku: draft.sku ?? undefined,
        saved: true,
      });
      const saved = await saveWorkspaceProductToStore(draftProduct);
      patch({ workspace_product_id: saved.id });
      await refreshCatalog();
      dispatchAppToast(`Saved “${saved.name}” to Brand & Products`);
      setSaveToLibrary(false);
    } catch (e) {
      dispatchAppToast(e instanceof Error ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveManualBlank() {
    const brand = draft.garment_brand?.trim();
    const style = draft.garment_style_number?.trim();
    if (!brand || !style) {
      dispatchAppToast("Enter manufacturer and style # first");
      return;
    }
    setSaving(true);
    try {
      const product = await saveCatalogProductToStore({
        brand_name: brand,
        name: `${brand} ${style}`,
        style_code: style,
        color: draft.garment_color?.trim() || null,
        size: draft.garment_size?.trim() || null,
        catalog_sku: null,
        description: null,
        source: "manual",
      });
      patch(catalogProductToJobFields(product, brand));
      await refreshCatalog();
      dispatchAppToast(`Added ${catalogDisplayLabel(product)} to catalog`);
    } catch (e) {
      dispatchAppToast(e instanceof Error ? e.message : "Could not save blank");
    } finally {
      setSaving(false);
    }
  }

  const finishingTasks = draft.finishing_tasks ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-slate-800">Product library</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Pick a manufacturer blank (Gildan, Hanes, etc.) or a saved decorated product. Catalog
          blanks sync from integrations like Brandboom when connected.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["catalog", "Catalog blanks"],
              ["saved", "My products"],
              ["manual", "Enter manually"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPickerMode(mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                pickerMode === mode
                  ? "bg-[#7c3aed] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[#7c3aed]/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {pickerMode !== "manual" ? (
        <div className="space-y-3">
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={pickerMode === "catalog" ? "Search blanks…" : "Search saved products…"}
          />
          {loading ? (
            <p className="text-sm text-slate-500">Loading catalog…</p>
          ) : pickerMode === "catalog" ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {filteredCatalog.length === 0 ? (
                <li className="px-2 py-3 text-sm text-slate-500">No blanks match.</li>
              ) : (
                filteredCatalog.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => applyCatalogProduct(product)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 ${
                        draft.catalog_product_id === product.id
                          ? "bg-violet-50 font-semibold text-[#7c3aed]"
                          : "text-slate-800"
                      }`}
                    >
                      {catalogDisplayLabel(product)}
                      {product.catalog_sku ? (
                        <span className="ml-2 text-xs text-slate-500">{product.catalog_sku}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {filteredSaved.length === 0 ? (
                <li className="px-2 py-3 text-sm text-slate-500">
                  No saved products yet — configure a job and save it below.
                </li>
              ) : (
                filteredSaved.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => applyWorkspaceProduct(product)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 ${
                        draft.workspace_product_id === product.id
                          ? "bg-violet-50 font-semibold text-[#7c3aed]"
                          : "text-slate-800"
                      }`}
                    >
                      {product.name}
                      {product.workspace_sku ? (
                        <span className="ml-2 text-xs text-slate-500">{product.workspace_sku}</span>
                      ) : null}
                      <span className="ml-2 text-[10px] uppercase text-slate-400">
                        {product.kind}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Blank / substrate
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Manufacturer
            <input
              className={fieldClass}
              value={draft.garment_brand ?? ""}
              onChange={(e) =>
                patch({
                  garment_brand: e.target.value,
                  catalog_product_id: null,
                  workspace_product_id: null,
                })
              }
              placeholder="e.g. Gildan, Hanes, LA Apparel"
            />
          </label>
          <label className={labelClass}>
            Style #
            <input
              className={fieldClass}
              value={draft.garment_style_number ?? ""}
              onChange={(e) =>
                patch({ garment_style_number: e.target.value, catalog_product_id: null })
              }
              placeholder="e.g. 2000"
            />
          </label>
          <label className={labelClass}>
            Color
            <input
              className={fieldClass}
              value={draft.garment_color ?? ""}
              onChange={(e) => patch({ garment_color: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Size
            <input
              className={fieldClass}
              value={draft.garment_size ?? ""}
              onChange={(e) => patch({ garment_size: e.target.value })}
              placeholder="Optional — often per order"
            />
          </label>
        </div>

        <label className={labelClass}>
          Blank supplied by
          <select
            className={fieldClass}
            value={draft.blank_supplied_by ?? ""}
            onChange={(e) =>
              patch({ blank_supplied_by: (e.target.value || null) as SuppliedBy | null })
            }
          >
            {suppliedBySelectOptions().map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">
            Who provides the garment blank — {SUPPLIED_BY_LABELS.client.toLowerCase()}, your shop, or
            a vendor.
          </p>
        </label>

        <VendorFieldSelect
          label="Blank vendor (optional)"
          vendors={vendors}
          value={draft.lead_vendor}
          onChange={(name) => patch({ lead_vendor: name ?? "" })}
          emptyLabel="Select vendor…"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveManualBlank()}
            className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#7c3aed] hover:text-[#7c3aed] disabled:opacity-50"
          >
            Save blank to catalog
          </button>
        </div>
      </div>

      <label className={labelClass}>
        Job / workspace SKU
        <input
          className={fieldClass}
          value={draft.sku ?? ""}
          placeholder="Your SKU for this style (optional)"
          onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
        />
        <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">
          Unique per workspace — use for your decorated product code (e.g. GGT148).
        </p>
      </label>

      <label className={labelClass}>
        Decoration notes
        <textarea
          className={`${fieldClass} min-h-[4.5rem] resize-y`}
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Print locations, colors, oversize notes — feeds vendor RFQs"
          rows={3}
        />
      </label>

      <JobFinishingSection
        tasks={finishingTasks}
        onChange={(tasks) => patch({ finishing_tasks: tasks })}
        fieldClass={fieldClass}
      />

      <div className="rounded-2xl border border-dashed border-[#7c3aed]/30 bg-violet-50/40 p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={saveToLibrary}
            onChange={(e) => setSaveToLibrary(e.target.checked)}
          />
          Save this setup as a workspace product
        </label>
        {saveToLibrary ? (
          <div className="mt-3 space-y-3">
            <label className={labelClass}>
              Product name
              <input
                className={fieldClass}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={draft.name?.trim() || "e.g. GGT148 Cross Tee"}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveProduct()}
              className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save to library"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-600">
            Saved products include blank, decoration notes, and finishing — recall them on future
            jobs.
          </p>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use JobBrandProductsSection */
export const JobBrandSection = JobBrandProductsSection;
