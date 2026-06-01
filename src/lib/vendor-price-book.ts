import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";

export type VendorPriceEntry = {
  description: string;
  default_cost: number;
  last_used: string;
};

type VendorPriceStore = Record<string, VendorPriceEntry[]>;

function loadStore(): VendorPriceStore {
  return readMockLs<VendorPriceStore>(MOCK_LS.vendorPrices) ?? {};
}

function saveStore(store: VendorPriceStore): void {
  writeMockLs(MOCK_LS.vendorPrices, store);
}

function vendorKey(vendor: string): string {
  return vendor.trim().toLowerCase();
}

export function listVendorPrices(vendor: string): VendorPriceEntry[] {
  const store = loadStore();
  return store[vendorKey(vendor)] ?? [];
}

export function listAllVendors(): string[] {
  return Object.keys(loadStore()).filter(Boolean);
}

export function upsertVendorPrice(
  vendor: string,
  description: string,
  cost: number,
): void {
  const key = vendorKey(vendor);
  if (!key || !description.trim()) return;
  const store = loadStore();
  const bucket = store[key] ?? [];
  const idx = bucket.findIndex((b) => b.description.trim().toLowerCase() === description.trim().toLowerCase());
  const now = new Date().toISOString();
  if (idx >= 0) {
    bucket[idx] = { ...bucket[idx], default_cost: cost, last_used: now };
  } else {
    bucket.push({ description: description.trim(), default_cost: cost, last_used: now });
  }
  // Keep most recent 50 per vendor, newest first.
  bucket.sort((a, b) => b.last_used.localeCompare(a.last_used));
  store[key] = bucket.slice(0, 50);
  saveStore(store);
}

export function removeVendorPrice(vendor: string, description: string): void {
  const key = vendorKey(vendor);
  const store = loadStore();
  if (!store[key]) return;
  store[key] = store[key].filter(
    (b) => b.description.trim().toLowerCase() !== description.trim().toLowerCase(),
  );
  saveStore(store);
}
