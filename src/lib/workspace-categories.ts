import {
  CATEGORY_CODES,
  type CategoryCodeEntry,
  dropdownLabelForCategoryCode,
} from "@/lib/reference/category-codes";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";

export function loadWorkspaceCategories(): CategoryCodeEntry[] {
  const custom = readMockLs<CategoryCodeEntry[]>(MOCK_LS.workspaceCategories) ?? [];
  const seen = new Set(CATEGORY_CODES.map((c) => c.dropdownLabel.toLowerCase()));
  const merged = [...CATEGORY_CODES];
  for (const c of custom) {
    if (!c.dropdownLabel.trim() || seen.has(c.dropdownLabel.toLowerCase())) continue;
    seen.add(c.dropdownLabel.toLowerCase());
    merged.push(c);
  }
  return merged;
}

export function addWorkspaceCategory(label: string): CategoryCodeEntry | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const existing = loadWorkspaceCategories().find(
    (c) => c.dropdownLabel.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return existing;
  const code = trimmed.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "X") || "CU";
  const entry: CategoryCodeEntry = {
    code,
    label: trimmed,
    dropdownLabel: trimmed,
  };
  const custom = readMockLs<CategoryCodeEntry[]>(MOCK_LS.workspaceCategories) ?? [];
  writeMockLs(MOCK_LS.workspaceCategories, [...custom, entry]);
  return entry;
}

export function updateWorkspaceCategory(
  oldLabel: string,
  newLabel: string,
): CategoryCodeEntry | null {
  const trimmed = newLabel.trim();
  if (!trimmed) return null;
  const custom = readMockLs<CategoryCodeEntry[]>(MOCK_LS.workspaceCategories) ?? [];
  const idx = custom.findIndex(
    (c) => c.dropdownLabel.toLowerCase() === oldLabel.trim().toLowerCase(),
  );
  if (idx < 0) return null;
  const next = [...custom];
  next[idx] = { ...next[idx]!, dropdownLabel: trimmed, label: trimmed };
  writeMockLs(MOCK_LS.workspaceCategories, next);
  return next[idx]!;
}

export function deleteWorkspaceCategory(label: string): void {
  const custom = readMockLs<CategoryCodeEntry[]>(MOCK_LS.workspaceCategories) ?? [];
  writeMockLs(
    MOCK_LS.workspaceCategories,
    custom.filter((c) => c.dropdownLabel.toLowerCase() !== label.trim().toLowerCase()),
  );
}

export function isBuiltinCategory(label: string): boolean {
  return CATEGORY_CODES.some(
    (c) => c.dropdownLabel.toLowerCase() === label.trim().toLowerCase(),
  );
}

export function resolveCategoryDropdownLabel(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return CATEGORY_CODES[0]?.dropdownLabel ?? "Tee";
  const all = loadWorkspaceCategories();
  const byLabel = all.find((c) => c.dropdownLabel.toLowerCase() === trimmed.toLowerCase());
  if (byLabel) return byLabel.dropdownLabel;
  const byCode = all.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  if (byCode) return byCode.dropdownLabel;
  return dropdownLabelForCategoryCode(trimmed) !== "Custom" ? dropdownLabelForCategoryCode(trimmed) : trimmed;
}
