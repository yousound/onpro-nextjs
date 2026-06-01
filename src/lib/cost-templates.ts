import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { CostingSheet } from "@/lib/types/wip";

export type CostingTemplate = {
  id: string;
  name: string;
  category_code: string;
  sheet: CostingSheet;
  created_at: string;
};

type CostTemplateStore = Record<string, CostingTemplate[]>;

function loadStore(): CostTemplateStore {
  return readMockLs<CostTemplateStore>(MOCK_LS.costTemplates) ?? {};
}

function saveStore(store: CostTemplateStore): void {
  writeMockLs(MOCK_LS.costTemplates, store);
}

export function listCostTemplates(categoryCode?: string): CostingTemplate[] {
  const store = loadStore();
  if (!categoryCode) {
    return Object.values(store).flat();
  }
  return store[categoryCode] ?? [];
}

export function saveCostTemplate(
  categoryCode: string,
  name: string,
  sheet: CostingSheet,
): CostingTemplate {
  const store = loadStore();
  const id = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const template: CostingTemplate = {
    id,
    name: name.trim() || "Untitled template",
    category_code: categoryCode,
    sheet: JSON.parse(JSON.stringify(sheet)) as CostingSheet,
    created_at: new Date().toISOString(),
  };
  const bucket = store[categoryCode] ?? [];
  store[categoryCode] = [...bucket, template];
  saveStore(store);
  return template;
}

export function deleteCostTemplate(categoryCode: string, id: string): void {
  const store = loadStore();
  const bucket = store[categoryCode];
  if (!bucket) return;
  store[categoryCode] = bucket.filter((t) => t.id !== id);
  saveStore(store);
}
