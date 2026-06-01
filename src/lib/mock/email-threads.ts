import type {
  AgentSuggestion,
  EmailThread,
} from "@/lib/types/agent";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();

export const MOCK_EMAIL_THREADS: EmailThread[] = [
  {
    id: "th-ss-quote-tee",
    subject: "RE: Glo Gang FT28127 — S&S blanks quote",
    category: "vendor_quote",
    participants: [
      { name: "Aaron @ S&S Activewear", email: "aaron@ssactivewear.com" },
      { name: "Jerry M", email: "jerry@connectdots.la" },
    ],
    messages: [
      {
        id: "msg-ss-1",
        from: { name: "Jerry M", email: "jerry@connectdots.la" },
        at: hoursAgo(48),
        body: "Hey Aaron — can you quote 250 ea on the FT28127 baby pink blank? Need by Friday.",
      },
      {
        id: "msg-ss-2",
        from: { name: "Aaron @ S&S Activewear", email: "aaron@ssactivewear.com" },
        at: hoursAgo(46),
        body: "Confirmed inventory. Pricing below:\n\n- FT28127 baby pink — **$3.85/ea** at 250\n- Lead time: 3 business days\n\nLMK if you want me to drop a sample.",
      },
    ],
    status: "unread",
    related: { vendor: "S&S Activewear" },
  },
  {
    id: "th-mim-screen",
    subject: "Quote — 5C plastisol print, 250 ea",
    category: "vendor_quote",
    participants: [
      { name: "MIM Printing", email: "ops@mimprinting.com" },
      { name: "Jerry M", email: "jerry@connectdots.la" },
    ],
    messages: [
      {
        id: "msg-mim-1",
        from: { name: "MIM Printing", email: "ops@mimprinting.com" },
        at: hoursAgo(30),
        body:
          "5-color plastisol screen print, front + back placement.\n\nQty 250 ea: **$2.40/ea**\nIncludes screens. 7 business days from approved strike off.",
      },
    ],
    status: "unread",
    related: { vendor: "MIM Printing" },
  },
  {
    id: "th-glo-rfq",
    subject: "Drop 03 — need quote on tees and hoodies",
    category: "client",
    participants: [
      { name: "Glo Gang Ops", email: "ops@glogang.com" },
      { name: "Jerry M", email: "jerry@connectdots.la" },
    ],
    messages: [
      {
        id: "msg-glo-1",
        from: { name: "Glo Gang Ops", email: "ops@glogang.com" },
        at: hoursAgo(72),
        body:
          "Yo Jerry — for Drop 03 we need pricing on:\n\n- 4 tees @ 250 ea\n- 2 hoodies @ 150 ea\n\nNeed it by next Friday. Same printer as last drop is fine.",
      },
    ],
    status: "unread",
    related: { vendor: undefined },
  },
  {
    id: "th-glo-po",
    subject: "PO for Skeletor tee shipment",
    category: "client",
    participants: [
      { name: "Glo Gang Ops", email: "ops@glogang.com" },
    ],
    messages: [
      {
        id: "msg-glo-po-1",
        from: { name: "Glo Gang Ops", email: "ops@glogang.com" },
        at: hoursAgo(20),
        body:
          "Hey — our PO for the Skeletor tee is **GG-INT-26-051**. Use that on the packing list.",
      },
    ],
    status: "unread",
  },
  {
    id: "th-charming-1st",
    subject: "1st sample shipped today",
    category: "shipping",
    participants: [
      { name: "Charming Art", email: "factory@charmingart.cn" },
    ],
    messages: [
      {
        id: "msg-ca-1",
        from: { name: "Charming Art", email: "factory@charmingart.cn" },
        at: hoursAgo(6),
        body:
          "1st samples for GGJ01 Glo Gang Satin Bomber shipped today.\n\nDHL tracking: 5821 0942 1167\nETA: 3 days",
      },
    ],
    status: "unread",
    related: { vendor: "Charming Art" },
  },
  {
    id: "th-doris-strike",
    subject: "Strike-off approved",
    category: "vendor_quote",
    participants: [
      { name: "Doris Embroidery", email: "doris@dorisemb.com" },
    ],
    messages: [
      {
        id: "msg-doris-1",
        from: { name: "Doris Embroidery", email: "doris@dorisemb.com" },
        at: hoursAgo(54),
        body: "Strike-off approved for the HCH01 Homecoming Hat. Moving to production.",
      },
    ],
    status: "read",
    related: { vendor: "Doris Embroidery" },
  },
  {
    id: "th-nissi-caps",
    subject: "Caps pricing",
    category: "vendor_quote",
    participants: [
      { name: "Nissi Caps", email: "sales@nissicaps.com" },
    ],
    messages: [
      {
        id: "msg-nissi-1",
        from: { name: "Nissi Caps", email: "sales@nissicaps.com" },
        at: hoursAgo(120),
        body:
          "Pricing for HCH01:\n\n- 150 ea: **$6.20/ea**\n- 250 ea: $5.80/ea\n\nLead time 14 days.",
      },
    ],
    status: "read",
    related: { vendor: "Nissi Caps" },
  },
  {
    id: "th-101-blanks",
    subject: "101 Apparel — blank pricing update",
    category: "vendor_quote",
    participants: [
      { name: "101 Apparel", email: "wholesale@101.apparel" },
    ],
    messages: [
      {
        id: "msg-101-1",
        from: { name: "101 Apparel", email: "wholesale@101.apparel" },
        at: hoursAgo(180),
        body: "Latest pricing list attached. T1234 heavy tee is now $4.10/ea at 200+.",
      },
    ],
    status: "read",
    related: { vendor: "101 Apparel" },
  },
  {
    id: "th-tagtime-trims",
    subject: "Tagtime — woven labels reorder",
    category: "vendor_quote",
    participants: [
      { name: "Tagtime Trims", email: "orders@tagtimetrims.com" },
    ],
    messages: [
      {
        id: "msg-tt-1",
        from: { name: "Tagtime Trims", email: "orders@tagtimetrims.com" },
        at: hoursAgo(200),
        body:
          "Woven main labels 4-color, 2000 pcs — **$0.18/ea**. Reorder turnaround 12-14 days.",
      },
    ],
    status: "read",
    related: { vendor: "Tagtime Trims" },
  },
  {
    id: "th-fedex-track",
    subject: "FedEx — tracking update",
    category: "shipping",
    participants: [
      { name: "FedEx", email: "no-reply@fedex.com" },
    ],
    messages: [
      {
        id: "msg-fed-1",
        from: { name: "FedEx", email: "no-reply@fedex.com" },
        at: hoursAgo(12),
        body: "Tracking 7748 1023 9912 — out for delivery to Glo Gang.",
      },
    ],
    status: "read",
  },
  {
    id: "th-team-pietra",
    subject: "Can someone follow up with Pietra?",
    category: "internal",
    participants: [
      { name: "Lara C", email: "lara@connectdots.la" },
      { name: "Jerry M", email: "jerry@connectdots.la" },
    ],
    messages: [
      {
        id: "msg-team-1",
        from: { name: "Lara C", email: "lara@connectdots.la" },
        at: hoursAgo(4),
        body:
          "Pietra still hasn't sent the strike-off approval. Can someone ping her by EOD?",
      },
    ],
    status: "unread",
  },
  {
    id: "th-cam-dims",
    subject: "Camber — packing list dims/weight",
    category: "client",
    participants: [
      { name: "Camber Logistics", email: "ops@camber.shipping" },
    ],
    messages: [
      {
        id: "msg-cam-1",
        from: { name: "Camber Logistics", email: "ops@camber.shipping" },
        at: hoursAgo(40),
        body:
          "We'll need dimensions and gross weight per carton on your next packing list.\n\nBox 1: 24x14x14, 25 lbs\nBox 2: 24x14x14, 23 lbs",
      },
    ],
    status: "read",
  },
  {
    id: "th-santi-pack",
    subject: "Santigold — basic packing list ok",
    category: "client",
    participants: [
      { name: "Santi Ops", email: "ops@santigold.com" },
    ],
    messages: [
      {
        id: "msg-santi-1",
        from: { name: "Santi Ops", email: "ops@santigold.com" },
        at: hoursAgo(36),
        body: "Don't need IIDs or dims — just style/size/qty per box. Thanks.",
      },
    ],
    status: "read",
  },
  {
    id: "th-bank-deposit",
    subject: "Stripe — payout received",
    category: "other",
    participants: [{ name: "Stripe", email: "no-reply@stripe.com" }],
    messages: [
      {
        id: "msg-stripe-1",
        from: { name: "Stripe", email: "no-reply@stripe.com" },
        at: hoursAgo(15),
        body: "$8,250.00 deposited from Glo Gang Drop 02.",
      },
    ],
    status: "read",
  },
  {
    id: "th-invoice-req",
    subject: "Need invoice for Drop 02 balance",
    category: "client",
    participants: [{ name: "Glo Gang Ops", email: "ops@glogang.com" }],
    messages: [
      {
        id: "msg-inv-1",
        from: { name: "Glo Gang Ops", email: "ops@glogang.com" },
        at: hoursAgo(8),
        body:
          "Hey send over the invoice for the Drop 02 balance so I can get it paid this week.",
      },
    ],
    status: "unread",
  },
];

/** Suggestion templates the agent would surface for the threads above. */
export function suggestionsForThread(thread: EmailThread): AgentSuggestion[] {
  switch (thread.id) {
    case "th-ss-quote-tee":
      return [
        {
          id: "sug-ss-1",
          thread_id: thread.id,
          kind: "add_vendor_quote",
          title: "Add S&S vendor quote — FT28127 baby pink $3.85/ea × 250",
          payload: {
            vendor: "S&S Activewear",
            item_description: "FT28127 baby pink blank tee",
            unit_cost: 3.85,
            qty: 250,
            notes: "3 business day lead",
          },
          status: "pending",
          created_at: hoursAgo(45),
        },
      ];
    case "th-mim-screen":
      return [
        {
          id: "sug-mim-1",
          thread_id: thread.id,
          kind: "add_vendor_quote",
          title: "Add MIM 5C plastisol — $2.40/ea × 250",
          payload: {
            vendor: "MIM Printing",
            item_description: "5-color plastisol screen print (front + back)",
            unit_cost: 2.4,
            qty: 250,
            notes: "Screens included.",
          },
          status: "pending",
          created_at: hoursAgo(29),
        },
      ];
    case "th-glo-rfq":
      return [
        {
          id: "sug-glo-1",
          thread_id: thread.id,
          kind: "create_project",
          title: "Create project: Glo Gang Drop 03",
          payload: {
            client: "Glo Gang",
            name: "Glo Gang Drop 03",
            notes: "4 tees × 250 + 2 hoodies × 150",
          },
          status: "pending",
          created_at: hoursAgo(70),
        },
        {
          id: "sug-glo-2",
          thread_id: thread.id,
          kind: "create_job",
          title: "Add 4 tee jobs + 2 hoodie jobs (Drop 03)",
          payload: { count: 6 },
          status: "pending",
          created_at: hoursAgo(70),
        },
      ];
    case "th-glo-po":
      return [
        {
          id: "sug-glo-po-1",
          thread_id: thread.id,
          kind: "update_client_po",
          title: "Set client PO GG-INT-26-051 on the Skeletor job",
          payload: { client_po_number: "GG-INT-26-051", job_hint: "Skeletor" },
          status: "pending",
          created_at: hoursAgo(19),
        },
      ];
    case "th-charming-1st":
      return [
        {
          id: "sug-ca-1",
          thread_id: thread.id,
          kind: "update_sample_milestone",
          title: "Mark 1st sample shipped for GGJ01 (DHL 5821 0942 1167)",
          payload: {
            milestone: "1st_shipped",
            tracking: "5821 0942 1167",
            job_hint: "GGJ01",
          },
          status: "pending",
          created_at: hoursAgo(5),
        },
      ];
    case "th-doris-strike":
      return [
        {
          id: "sug-doris-1",
          thread_id: thread.id,
          kind: "update_sample_milestone",
          title: "Mark strike-off approved for HCH01",
          payload: { milestone: "strike_off_approved", job_hint: "HCH01" },
          status: "pending",
          created_at: hoursAgo(53),
        },
      ];
    case "th-nissi-caps":
      return [
        {
          id: "sug-nissi-1",
          thread_id: thread.id,
          kind: "add_vendor_quote",
          title: "Add Nissi Caps quote — $6.20/ea × 150",
          payload: {
            vendor: "Nissi Caps",
            item_description: "HCH01 cap",
            unit_cost: 6.2,
            qty: 150,
          },
          status: "pending",
          created_at: hoursAgo(119),
        },
      ];
    case "th-cam-dims":
      return [
        {
          id: "sug-cam-1",
          thread_id: thread.id,
          kind: "log_packing_list",
          title: "Switch packing list to Shipper variant (Camber dims/weight)",
          payload: { variant: "shipper" },
          status: "pending",
          created_at: hoursAgo(39),
        },
      ];
    case "th-santi-pack":
      return [
        {
          id: "sug-santi-1",
          thread_id: thread.id,
          kind: "log_packing_list",
          title: "Switch packing list to Basic variant (no IID, no dims)",
          payload: { variant: "basic" },
          status: "pending",
          created_at: hoursAgo(35),
        },
      ];
    case "th-team-pietra":
      return [
        {
          id: "sug-team-1",
          thread_id: thread.id,
          kind: "team_note",
          title: "Add task: ping Pietra for strike-off approval",
          payload: { assignee: "Lara", body: "Follow up with Pietra by EOD." },
          status: "pending",
          created_at: hoursAgo(3),
        },
      ];
    case "th-invoice-req":
      return [
        {
          id: "sug-inv-1",
          thread_id: thread.id,
          kind: "create_invoice",
          title: "Draft invoice — Drop 02 balance for Glo Gang",
          payload: { client: "Glo Gang", reference: "Drop 02 balance" },
          status: "pending",
          created_at: hoursAgo(7),
        },
      ];
    default:
      return [];
  }
}
