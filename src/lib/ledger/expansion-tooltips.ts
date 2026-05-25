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
  "fe-ai": {
    title: "AI systems & automation",
    summary:
      "What this could realistically become later—assisted workflows across production, messaging, and documents.",
    sections: [
      {
        heading: "Production assistance",
        items: [
          "Generate production timelines",
          "Flag delays and stalled jobs",
          "Surface missing approvals",
        ],
      },
      {
        heading: "Messaging automation",
        items: [
          "Draft replies and summarize threads",
          "Extract action items and follow-up reminders",
        ],
      },
      {
        heading: "Document intelligence",
        items: [
          "Parse invoices and POs",
          "Extract shipment details from attachments",
          "Auto-fill operational forms",
        ],
      },
      {
        heading: "Operational recommendations",
        items: [
          "Suggest vendors and turnaround times",
          "Highlight bottlenecks and overdue milestones",
        ],
      },
    ],
  },
};
