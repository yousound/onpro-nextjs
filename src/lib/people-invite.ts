import type { PendingInvite, PeopleSegment } from "@/lib/mock/people";
import { segmentLabel } from "@/lib/mock/people";
import { teamRoleLabel, type TeamRole } from "@/lib/types/contact";

export function buildPendingInvite(params: {
  email: string;
  segment: PeopleSegment;
  note?: string;
  clientCompanyName?: string;
  teamRole?: TeamRole;
  teamRoleCustom?: string;
  contactName?: string;
  phone?: string;
}): PendingInvite {
  const roleLabel =
    params.segment === "team" && params.teamRole
      ? teamRoleLabel(params.teamRole, params.teamRoleCustom)
      : null;
  const invited_label =
    params.note?.trim() ||
    (params.segment === "client" && params.clientCompanyName
      ? `Client · ${params.clientCompanyName.trim()}`
      : params.segment === "team" && roleLabel
        ? `Team · ${roleLabel}`
        : `${segmentLabel(params.segment)} · ${
            params.segment === "team"
              ? "Workspace member"
              : params.segment === "vendor"
                ? "Vendor lane"
                : "Client access"
          }`);

  return {
    id: `inv-${Date.now()}`,
    email: params.email.trim(),
    segment: params.segment,
    invited_label,
    sent_at: new Date().toISOString().slice(0, 10),
    ...(params.segment === "team" && params.teamRole
      ? {
          team_role: params.teamRole,
          ...(params.teamRole === "custom" && params.teamRoleCustom?.trim()
            ? { team_role_custom: params.teamRoleCustom.trim() }
            : {}),
          ...(params.contactName?.trim() ? { contact_name: params.contactName.trim() } : {}),
          ...(params.phone?.trim() ? { phone: params.phone.trim() } : {}),
        }
      : {}),
  };
}
