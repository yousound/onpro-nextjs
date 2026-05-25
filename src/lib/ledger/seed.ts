import type { LedgerSeed } from "@/lib/ledger/types";

/** Master ledger data — edit here until a backend exists. */
export const LEDGER_SEED: LedgerSeed = {
  disclaimer: "Monthly payments are drawdowns against project value.",

  onpro: {
    capCents: 7_500_000,
    monthlyRetainerCents: 300_000,
    includedInCap: [
      "OnPro iOS application",
      "OnPro Next.js workspace",
      "OnPro Rails backend / API",
      "OnPro admin platform",
      "Authentication & permissions",
      "Messaging infrastructure",
      "Production workflows",
      "Production-ready foundation",
      "DevOps server setup and management",
      "Enterprise / ERP integrations",
    ],
  },

  /** Major systems — sums to $75,000. Drives accrued $ and work-finished %. */
  capSystems: [
    {
      id: "cap-ios",
      label: "OnPro iOS application",
      status: "in_progress",
      statusLabel: "95% Complete",
      completionFraction: 0.95,
      valueCents: 2_500_000,
      weight: 25,
    },
    {
      id: "cap-next",
      label: "OnPro Next.js workspace",
      status: "in_progress",
      statusLabel: "90% Complete",
      completionFraction: 0.9,
      valueCents: 2_000_000,
      weight: 20,
    },
    {
      id: "cap-rails",
      label: "OnPro Rails backend / API",
      status: "pending",
      valueCents: 2_000_000,
      weight: 20,
    },
    {
      id: "cap-admin",
      label: "OnPro admin platform",
      status: "pending",
      valueCents: 1_000_000,
      weight: 10,
    },
  ],

  /** Cap rows for phase 1/2 are derived from capSystems at load; only “included” rows live here. */
  phase1Frontend: [],

  phase2Backend: [
    {
      id: "p2-planning",
      label: "Backend + admin architecture planning",
      status: "pending",
      valueLabel: "Included",
    },
    {
      id: "p2-workflows",
      label: "Shared operational systems & workflow design",
      status: "included",
      valueLabel: "Included",
    },
  ],

  invoices: [
    {
      id: "inv-fbrc-wholesale",
      dateLabel: "TBD",
      label: "FBRC.LA — Site transfer & wholesale order expansion",
      amountCents: 150_000,
      status: "pending",
      projectId: "fbrc",
      kind: "other",
    },
    {
      id: "inv-onpro-jun-2026",
      dateLabel: "June 2026",
      label: "Monthly OnPro retainer",
      amountCents: 300_000,
      status: "pending",
      projectId: "onpro",
      kind: "retainer",
    },
    {
      id: "inv-onpro-jul-2026",
      dateLabel: "July 2026",
      label: "Monthly OnPro retainer",
      amountCents: 300_000,
      status: "pending",
      projectId: "onpro",
      kind: "retainer",
    },
  ],

  /** Dated deliverables — staggered across periods; shown below invoices for full accounting. */
  workRecords: [
    {
      id: "wr-ios-jan",
      periodLabel: "Jan 2026",
      sortKey: "2026-01",
      projectId: "onpro",
      description: "OnPro iOS application — app shell, Supabase auth, navigation",
      status: "completed",
    },
    {
      id: "wr-ios-feb",
      periodLabel: "Feb 2026",
      sortKey: "2026-02",
      projectId: "onpro",
      description: "OnPro iOS — projects, messaging, smart attachments, calendar, tab bar",
      status: "completed",
    },
    {
      id: "wr-next-scaffold",
      periodLabel: "14 May 2026",
      sortKey: "2026-05-14",
      projectId: "onpro",
      description: "OnPro Next.js workspace — desktop shell, project model parity with iOS",
      status: "completed",
    },
    {
      id: "wr-next-parity",
      periodLabel: "15 May 2026",
      sortKey: "2026-05-15a",
      projectId: "onpro",
      description: "Next.js — People, permissions, jobs, messaging, attachments",
      status: "completed",
    },
    {
      id: "wr-next-home",
      periodLabel: "15 May 2026",
      sortKey: "2026-05-15b",
      projectId: "onpro",
      description: "Next.js — Overview home, alerts, notifications",
      status: "completed",
    },
    {
      id: "wr-next-detail",
      periodLabel: "17 May 2026",
      sortKey: "2026-05-17",
      projectId: "onpro",
      description: "Project detail modules — client card, WIP, costing (mock)",
      status: "completed",
    },
    {
      id: "wr-next-production",
      periodLabel: "23 May 2026",
      sortKey: "2026-05-23",
      projectId: "onpro",
      description: "Production board, reference data, demo import pipeline",
      status: "completed",
    },
    {
      id: "wr-cap-ios",
      periodLabel: "Through May 2026",
      sortKey: "2026-05-cap-ios",
      projectId: "onpro",
      description: "OnPro iOS application — cap system (95% complete)",
      valueCents: 2_500_000,
      status: "completed",
    },
    {
      id: "wr-cap-next",
      periodLabel: "Through May 2026",
      sortKey: "2026-05-cap-next",
      projectId: "onpro",
      description: "OnPro Next.js workspace — cap system (90% complete)",
      valueCents: 2_000_000,
      status: "in_progress",
    },
    {
      id: "wr-planning",
      periodLabel: "May 2026",
      sortKey: "2026-05-plan",
      projectId: "onpro",
      description: "Backend + admin architecture planning",
      valueLabel: "Included",
      status: "pending",
    },
    {
      id: "wr-rails",
      periodLabel: "Not started",
      sortKey: "2026-99-rails",
      projectId: "onpro",
      description: "OnPro Rails backend / API",
      valueCents: 2_000_000,
      status: "pending",
    },
    {
      id: "wr-admin",
      periodLabel: "Not started",
      sortKey: "2026-99-admin",
      projectId: "onpro",
      description: "OnPro admin platform",
      valueCents: 1_000_000,
      status: "pending",
    },
    {
      id: "wr-fbrc-transfer",
      periodLabel: "TBD",
      sortKey: "2099-fbrc-transfer",
      projectId: "fbrc",
      description: "FBRC.LA — Site transfer & wholesale order expansion",
      valueCents: 150_000,
      status: "pending",
    },
  ],

  milestones: [],

  futureExpansion: [
    { id: "fe-android", label: "Android application", status: "TBD" },
    { id: "fe-ai", label: "AI systems & automation", status: "TBD" },
    { id: "fe-analytics", label: "Advanced analytics & reporting", status: "TBD" },
  ],

  expandableScope: [],

  dropx: [
    { label: "Equity structure", value: "Founder-level" },
    { label: "Current billing", value: "Deferred" },
    { label: "Cash compensation", value: "None currently" },
    { label: "Product direction", value: "Active" },
    { label: "UI / platform concepts", value: "Built" },
    { label: "Funding strategy", value: "Pending" },
    { label: "Purpose", value: "Fund ecosystem growth" },
  ],
  dropxNote:
    "DROPX is strategic founder-level ecosystem development and is not part of the OnPro payable balance.",

  fbrc: [
    {
      id: "fbrc-transfer",
      label: "Site transfer & wholesale order expansion",
      amountCents: 150_000,
      status: "Pending — site not received, work not started",
    },
  ],
  fbrcNote:
    "Awaiting site handoff from previous developer. Nothing paid to date. One scope item ($1,500), pending. FBRC payments are separate from the OnPro cap.",
};
