/** Optional detail for future-expansion rows (by seed id). */
export type ExpansionTooltipSection = {
  heading: string;
  items: string[];
};

export type ExpansionTooltipContent = {
  title: string;
  summary: string;
  /** Flat list when a single group is enough */
  examples?: string[];
  /** Grouped bullets for longer context */
  sections?: ExpansionTooltipSection[];
};

export const EXPANSION_TOOLTIPS: Record<string, ExpansionTooltipContent> = {
  "fe-android": {
    title: "Android application",
    summary:
      "Native Android expansion of the OnPro mobile platform with operational workflow parity across devices.",
  },
  "fe-analytics": {
    title: "Advanced analytics",
    summary:
      "Interpreting operational data to produce business intelligence—not just dashboards.",
    examples: [
      "Production bottleneck analysis",
      "Vendor performance scoring",
      "Margin analysis across products and jobs",
      "Capacity and load modeling",
      "Trend analysis on repeat operational issues",
      "Team productivity metrics",
      "Operational heatmaps (workflow congestion)",
    ],
  },
};
