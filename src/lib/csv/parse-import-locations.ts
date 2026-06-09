import type { Address, ContactLocation } from "@/lib/types/contact";

function headerIndex(headers: string[], aliases: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  return lower.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));
}

function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? row[idx].trim() : "";
}

function hasAddress(addr: Address): boolean {
  return Boolean(
    addr.line1?.trim() ||
      addr.line2?.trim() ||
      addr.city?.trim() ||
      addr.state?.trim() ||
      addr.postal_code?.trim() ||
      addr.country?.trim(),
  );
}

function parseAddressGroup(
  headers: string[],
  row: string[],
  prefixAliases: string[],
): Address {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const prefixIdx = lower.findIndex((h) =>
    prefixAliases.some((a) => h === a || h.startsWith(`${a} `) || h.startsWith(`${a}_`)),
  );
  if (prefixIdx < 0) return {};

  const prefix = lower[prefixIdx];
  const line1Idx = lower.findIndex(
    (h, i) =>
      i === prefixIdx ||
      (h.startsWith(prefix) &&
        (h.includes("line1") || h.includes("line 1") || h.includes("street") || h === `${prefix} address`)),
  );
  const line2Idx = lower.findIndex(
    (h) => h.startsWith(prefix) && (h.includes("line2") || h.includes("line 2") || h.includes("suite")),
  );
  const cityIdx = lower.findIndex((h) => h.startsWith(prefix) && h.includes("city"));
  const stateIdx = lower.findIndex(
    (h) => h.startsWith(prefix) && (h.includes("state") || h.includes("province") || h.includes("region")),
  );
  const postalIdx = lower.findIndex(
    (h) =>
      h.startsWith(prefix) &&
      (h.includes("postal") || h.includes("zip") || h.includes("postcode")),
  );
  const countryIdx = lower.findIndex((h) => h.startsWith(prefix) && h.includes("country"));

  const singleCol = cell(row, prefixIdx);
  if (
    line1Idx < 0 &&
    cityIdx < 0 &&
    singleCol &&
    !singleCol.includes("@") &&
    singleCol.length > 4
  ) {
    return parseFreeformAddress(singleCol);
  }

  return {
    line1: cell(row, line1Idx >= 0 ? line1Idx : prefixIdx) || undefined,
    line2: cell(row, line2Idx) || undefined,
    city: cell(row, cityIdx) || undefined,
    state: cell(row, stateIdx) || undefined,
    postal_code: cell(row, postalIdx) || undefined,
    country: cell(row, countryIdx) || undefined,
  };
}

function parseFreeformAddress(text: string): Address {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const [line1, city, rest] = parts;
    const stateZip = rest?.split(/\s+/).filter(Boolean) ?? [];
    return {
      line1,
      city,
      state: stateZip[0],
      postal_code: stateZip.slice(1).join(" ") || undefined,
      country: parts[3],
    };
  }
  return { line1: trimmed };
}

function parseNumberedLocationColumns(headers: string[], row: string[]): ContactLocation[] {
  const locations: ContactLocation[] = [];
  const lower = headers.map((h) => h.toLowerCase().trim());

  const numbered = new Map<number, { labelIdx?: number; addrIdx?: number }>();
  for (let i = 0; i < lower.length; i++) {
    const h = lower[i]!;
    const match =
      h.match(/^(?:location|site|warehouse|office|store|address)\s*[_#-]?\s*(\d+)(?:\s|$|_)/) ??
      h.match(/^(?:location|site|warehouse|office|store|address)\s+(\d+)$/);
    if (!match) continue;
    const n = Number(match[1]);
    if (!Number.isFinite(n)) continue;
    const entry = numbered.get(n) ?? {};
    if (h.includes("name") || h.includes("label") || h.includes("title")) {
      entry.labelIdx = i;
    } else {
      entry.addrIdx = i;
    }
    numbered.set(n, entry);
  }

  for (const n of [...numbered.keys()].sort((a, b) => a - b)) {
    const { labelIdx, addrIdx } = numbered.get(n)!;
    const raw = cell(row, addrIdx ?? -1);
    if (!raw) continue;
    locations.push({
      label: cell(row, labelIdx ?? -1) || `Location ${n}`,
      ...parseFreeformAddress(raw),
    });
  }

  return locations;
}

function dedupeLocations(locations: ContactLocation[]): ContactLocation[] {
  const seen = new Set<string>();
  const out: ContactLocation[] = [];
  for (const loc of locations) {
    if (!hasAddress(loc) && !loc.label?.trim()) continue;
    const key = [
      loc.label?.trim().toLowerCase() ?? "",
      loc.line1?.trim().toLowerCase() ?? "",
      loc.city?.trim().toLowerCase() ?? "",
      loc.postal_code?.trim().toLowerCase() ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

/** Extract unlimited named locations from flexible CSV headers. */
export function parseImportLocationsFromRow(headers: string[], row: string[]): ContactLocation[] {
  const locations: ContactLocation[] = [];

  const billing = parseAddressGroup(headers, row, ["billing", "bill to", "bill_to"]);
  const shipping = parseAddressGroup(headers, row, ["shipping", "ship to", "ship_to"]);
  if (hasAddress(billing)) locations.push({ label: "Billing", ...billing });
  if (hasAddress(shipping)) locations.push({ label: "Shipping", ...shipping });

  locations.push(...parseNumberedLocationColumns(headers, row));

  const locationIdx = headerIndex(headers, ["location", "locations", "site", "warehouse", "office"]);
  if (locationIdx >= 0) {
    const raw = cell(row, locationIdx);
    if (raw && !raw.includes("@")) {
      const header = headers[locationIdx]?.trim();
      const isGeneric = /^(location|locations|site|warehouse|office)s?$/i.test(header ?? "");
      locations.push({
        label: isGeneric ? undefined : header,
        ...parseFreeformAddress(raw),
      });
    }
  }

  return dedupeLocations(locations);
}

export function mergeImportLocations(
  existing: ContactLocation[] | undefined,
  fromBilling?: Address,
  fromShipping?: Address,
  fromLocations?: ContactLocation[],
): ContactLocation[] | undefined {
  const merged = [
    ...(existing ?? []),
    ...(fromLocations ?? []),
  ];

  if (fromBilling && hasAddress(fromBilling)) {
    merged.push({ label: "Billing", ...fromBilling });
  }
  if (fromShipping && hasAddress(fromShipping)) {
    merged.push({ label: "Shipping", ...fromShipping });
  }

  const deduped = dedupeLocations(merged);
  return deduped.length ? deduped : undefined;
}
