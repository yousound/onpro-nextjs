import type { ProjectPermissionFlags } from "@/lib/project-permissions";

/** Mirrors iOS `UserRole` segments — workspace directory (mock). */
export type PeopleSegment = "team" | "vendor" | "client";

export type DirectoryPerson = {
  id: string;
  segment: PeopleSegment;
  name: string;
  email: string;
  company: string | null;
  phone?: string;
  notes?: string;
};

export type PendingInvite = {
  id: string;
  email: string;
  segment: PeopleSegment;
  invited_label: string;
  sent_at: string;
  /** Permissions they'll get when they accept (mock). */
  permissions?: ProjectPermissionFlags;
};

export const MOCK_DIRECTORY_PEOPLE: DirectoryPerson[] = [
  {
    id: "p1",
    segment: "team",
    name: "Jordan Lee",
    email: "jordan@onpro.test",
    company: "OnPro",
    phone: "+1 415 555 0101",
    notes: "Product — can grant permissions on owned projects",
  },
  {
    id: "p2",
    segment: "team",
    name: "Sam Rivera",
    email: "sam@onpro.test",
    company: "OnPro",
    phone: "+1 415 555 0102",
  },
  {
    id: "p3",
    segment: "vendor",
    name: "Alex Chen",
    email: "alex@millworks.co",
    company: "Millworks Collective",
    phone: "+86 21 5555 8821",
  },
  {
    id: "p4",
    segment: "vendor",
    name: "Priya Natarajan",
    email: "priya@voidstarfabrics.com",
    company: "Void Star Fabrics",
  },
  {
    id: "p5",
    segment: "client",
    name: "Morgan Ellis",
    email: "morgan@fillo.design",
    company: "Fillo Product Design",
    phone: "+1 212 555 0144",
  },
  {
    id: "p6",
    segment: "client",
    name: "Taylor Brooks",
    email: "taylor@glogang.co",
    company: "Glo Gang",
  },
];

export const MOCK_PENDING_INVITES: PendingInvite[] = [
  {
    id: "inv1",
    email: "new.vendor@example.com",
    segment: "vendor",
    invited_label: "Vendor · QC lane",
    sent_at: "2026-05-13",
  },
  {
    id: "inv2",
    email: "buyer@retailer.test",
    segment: "client",
    invited_label: "Client · Fillo follow-on",
    sent_at: "2026-05-12",
  },
  {
    id: "inv3",
    email: "ops.lead@onpro.test",
    segment: "team",
    invited_label: "Team · Workspace admin",
    sent_at: "2026-05-11",
  },
  {
    id: "inv4",
    email: "production@millworks.co",
    segment: "vendor",
    invited_label: "Vendor · Cut & sew",
    sent_at: "2026-05-10",
  },
  {
    id: "inv5",
    email: "creative.director@studio.co",
    segment: "client",
    invited_label: "Client · Lookbook sign-off",
    sent_at: "2026-05-09",
  },
  {
    id: "inv6",
    email: "freelance.pm@designhaus.io",
    segment: "team",
    invited_label: "Team · Project coordinator",
    sent_at: "2026-05-08",
  },
];

export function segmentLabel(s: PeopleSegment): string {
  switch (s) {
    case "team":
      return "Team";
    case "vendor":
      return "Vendors";
    case "client":
      return "Clients";
  }
}

/** Soft badge for cards and modal headers — team indigo, vendor amber, client emerald. */
export function segmentBadgeSoftClass(s: PeopleSegment): string {
  switch (s) {
    case "team":
      return "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300/70";
    case "vendor":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-400/55";
    case "client":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-400/55";
  }
}

/** Selected segment pill (filters, toggles) — matching saturated hues. */
export function segmentPillSelectedClass(s: PeopleSegment): string {
  switch (s) {
    case "team":
      return "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-700/40";
    case "vendor":
      return "bg-amber-500 text-white shadow-sm ring-1 ring-amber-700/40";
    case "client":
      return "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-800/35";
  }
}

/** Per-project role + permission summaries (mock — aligns with iOS Person Permissions sections). */
export type PersonProjectPermissionGroup = {
  title: string;
  lines: string[];
};

export type PersonProjectAccess = {
  project_id: number;
  project_name: string;
  role_on_project: string;
  permission_groups: PersonProjectPermissionGroup[];
};

export const MOCK_PERSON_PROJECT_ACCESS: Record<string, PersonProjectAccess[]> = {
  p1: [
    {
      project_id: 1,
      project_name: "Glo Gang",
      role_on_project: "Team",
      permission_groups: [
        {
          title: "General messages",
          lines: ["Accept messages from team", "Accept messages from vendors"],
        },
        {
          title: "Project",
          lines: [
            "Can upload images & video",
            "Can send links",
            "Can create & edit projects",
            "Can approve / deny / edit tasks",
          ],
        },
        {
          title: "Invoices",
          lines: ["Can send invoices", "Can receive invoices"],
        },
        {
          title: "Calendar",
          lines: ["Can view calendar", "Can create / delete / edit events"],
        },
        { title: "Grant rights", lines: ["Can grant permissions for team"] },
      ],
    },
    {
      project_id: 5,
      project_name: "Void Star Tee",
      role_on_project: "Team",
      permission_groups: [
        {
          title: "General messages",
          lines: ["Accept messages from team"],
        },
        {
          title: "Project",
          lines: ["Can upload images & video", "Can send links", "Can approve / deny / edit tasks"],
        },
        { title: "Invoices", lines: ["Can send invoices"] },
        { title: "Calendar", lines: ["Can view calendar", "Can create / delete / edit events"] },
      ],
    },
  ],
  p2: [
    {
      project_id: 3,
      project_name: "LNQ Hoodie",
      role_on_project: "Team",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video", "Can send links"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
    {
      project_id: 6,
      project_name: "Mind Body Mastery",
      role_on_project: "Team",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
  ],
  p3: [
    {
      project_id: 1,
      project_name: "Glo Gang",
      role_on_project: "Vendor",
      permission_groups: [
        {
          title: "General messages",
          lines: ["Accept messages from team", "Accept messages from vendors"],
        },
        {
          title: "Project",
          lines: ["Can upload images & video", "Can send links", "Can send quotes", "Can send estimates"],
        },
        { title: "Invoices", lines: ["Can send invoices", "Can receive invoices"] },
        { title: "Calendar", lines: ["Can view calendar", "Can create / delete / edit events"] },
      ],
    },
    {
      project_id: 5,
      project_name: "Void Star Tee",
      role_on_project: "Vendor",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video", "Can send quotes"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
  ],
  p4: [
    {
      project_id: 3,
      project_name: "LNQ Hoodie",
      role_on_project: "Vendor",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can send estimates", "Can send quotes"] },
        { title: "Invoices", lines: ["Can send invoices"] },
      ],
    },
  ],
  p5: [
    {
      project_id: 6,
      project_name: "Mind Body Mastery",
      role_on_project: "Client",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video", "Can send links"] },
        { title: "Invoices", lines: ["Can receive invoices"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
    {
      project_id: 4,
      project_name: "Homeward Capsule",
      role_on_project: "Client",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
  ],
  p6: [
    {
      project_id: 1,
      project_name: "Glo Gang",
      role_on_project: "Client",
      permission_groups: [
        { title: "General messages", lines: ["Accept messages from team"] },
        { title: "Project", lines: ["Can upload images & video", "Can send links"] },
        { title: "Invoices", lines: ["Can receive invoices"] },
        { title: "Calendar", lines: ["Can view calendar"] },
      ],
    },
  ],
};

export function projectsForPerson(personId: string): PersonProjectAccess[] {
  return MOCK_PERSON_PROJECT_ACCESS[personId] ?? [];
}
