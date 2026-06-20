export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Invoice line items — always show cents. */
export function formatUsdDetailed(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseUsdInput(value: string): number {
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatUsdRange(lowCents: number, highCents?: number): string {
  if (highCents == null || highCents === lowCents) return formatUsd(lowCents);
  return `${formatUsd(lowCents)}–${formatUsd(highCents)}`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}
