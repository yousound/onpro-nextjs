"use client";

import { CoverPreviewShell, OpsSectionCover } from "@/components/ops-section-cover";

type Props = {
  onAddClient: () => void;
  hasContacts?: boolean;
};

export function PeopleConnectHero({ onAddClient, hasContacts = false }: Props) {
  return (
    <OpsSectionCover
      headline={
        <>
          Your production network in <span className="text-[#7c3aed]">one place</span>
        </>
      }
      subhead="Team, vendors, and clients — everyone you coordinate with on jobs and projects. Add contacts here, then fine-tune access per project."
      cards={[
        {
          title: "Three segments",
          description: "Browse team members, vendors, and clients separately. Search by name, company, or email within each list.",
          preview: (
            <CoverPreviewShell>
              <div className="flex flex-wrap gap-1.5">
                {["Team", "Vendor", "Client"].map((s) => (
                  <span
                    key={s}
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      s === "Team" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Invite and onboard",
          description: "Add a client, vendor, or teammate and optionally send an email invite. Pending invitations show at the top until they join.",
          preview: (
            <CoverPreviewShell>
              <div className="rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-2 py-1.5 text-[10px] font-semibold text-violet-700">
                + Add client
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Project access",
          description: "Open a contact to see their projects and permissions. Per-project roles live under each project's People & access tab.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-1">
                <div className="h-2 w-full rounded bg-slate-100" />
                <p className="text-[9px] font-medium text-slate-500">People & access · Project</p>
              </div>
            </CoverPreviewShell>
          ),
        },
      ]}
      primaryAction={{
        label: hasContacts ? "Add a client" : "Add your first client",
        onClick: onAddClient,
      }}
    />
  );
}
