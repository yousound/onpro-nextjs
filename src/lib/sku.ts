import { categoryCodeForDropdown } from "@/lib/reference/category-codes";
import type { ProjectJob } from "@/lib/types/wip";

/** SKU = operator company code + category code + style identifier (style # sans client prefix when possible). */
export function buildSku(
  operatorCode: string,
  categoryDropdownLabel: string,
  styleNumber: string,
): string {
  const op = operatorCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const cat = categoryCodeForDropdown(categoryDropdownLabel).toUpperCase();
  const style = styleNumber.trim().toUpperCase().replace(/\s/g, "");
  if (!op || !style) return "";
  return `${op}${cat}${style}`;
}

export function normalizeSku(value: string): string {
  return value.trim().toUpperCase().replace(/\s/g, "");
}

export function findDuplicateSku(
  sku: string,
  jobs: ProjectJob[],
  excludeJobId?: string,
): ProjectJob | undefined {
  const key = normalizeSku(sku);
  if (!key) return undefined;
  return jobs.find(
    (j) => j.id !== excludeJobId && j.sku && normalizeSku(j.sku) === key,
  );
}

export function collectAllSkusFromJobsMap(
  jobsByProject: Map<number, ProjectJob[]> | Record<number, ProjectJob[]>,
): string[] {
  const out: string[] = [];
  const entries =
    jobsByProject instanceof Map
      ? jobsByProject.values()
      : Object.values(jobsByProject);
  for (const jobs of entries) {
    for (const j of jobs) {
      if (j.sku?.trim()) out.push(normalizeSku(j.sku));
    }
  }
  return out;
}
