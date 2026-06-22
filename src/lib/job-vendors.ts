import { vendorDisplayName } from "@/lib/contacts-store";
import type { Contact } from "@/lib/types/contact";
import type { ProjectJob } from "@/lib/types/wip";

function normName(name: string): string {
  return name.trim().toLowerCase();
}

/** Names already used on this job (lead supplier, quotes, costing lines). */
export function inferJobVendorNames(job: ProjectJob): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw?: string | null) => {
    const name = raw?.trim();
    if (!name) return;
    const key = normName(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  add(job.lead_vendor);
  for (const n of job.job_vendors ?? []) add(n);
  for (const q of job.vendor_quotes ?? []) add(q.vendor);
  for (const l of job.costing_sheet?.lines ?? []) add(l.vendor);

  return out;
}

export function jobVendorNames(job: ProjectJob): string[] {
  const base =
    job.job_vendors !== undefined && job.job_vendors.length > 0
      ? [...job.job_vendors]
      : inferJobVendorNames(job);
  const seen = new Set(base.map(normName));
  const out = [...base];
  const lead = job.lead_vendor?.trim();
  if (lead && !seen.has(normName(lead))) out.unshift(lead);
  return out;
}

export function vendorsForJobPicker(
  allVendors: Contact[],
  assignedNames: string[],
  ensureNames: string[] = [],
): Contact[] {
  const keys = new Set(
    [...assignedNames, ...ensureNames].filter(Boolean).map(normName),
  );
  if (keys.size === 0) return allVendors;
  return allVendors.filter((v) => keys.has(normName(vendorDisplayName(v))));
}

/** Pick vendor for a new quote row — prefers job suppliers not already quoted. */
export function defaultVendorForNewQuote(job: ProjectJob, quotes: { vendor: string }[]): string {
  const used = new Set(quotes.map((q) => normName(q.vendor)).filter(Boolean));
  const candidates = jobVendorNames(job);
  for (const name of candidates) {
    if (!used.has(normName(name))) return name;
  }
  const lead = job.lead_vendor?.trim();
  if (lead && !used.has(normName(lead))) return lead;
  return candidates[0] ?? lead ?? "";
}

export function jobVendorsMissingQuotes(
  job: ProjectJob,
  quotes: { vendor: string }[],
): string[] {
  const used = new Set(quotes.map((q) => normName(q.vendor)).filter(Boolean));
  return jobVendorNames(job).filter((name) => !used.has(normName(name)));
}

export function addJobVendorName(names: string[], name: string): string[] {
  const next = name.trim();
  if (!next) return names;
  if (names.some((n) => normName(n) === normName(next))) return names;
  return [...names, next];
}

export function removeJobVendorName(names: string[], name: string): string[] {
  const key = normName(name);
  return names.filter((n) => normName(n) !== key);
}
