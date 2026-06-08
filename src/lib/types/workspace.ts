import type { PeopleSegment } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";

export type WorkspaceMatch = {
  operatorUserId: string;
  contactId: number;
  workspaceName: string;
  contactDisplayName: string;
  projectCount: number;
  alreadyJoined: boolean;
};

export type WorkspaceMembership = {
  id: number;
  operatorUserId: string;
  memberUserId: string;
  contactId: number;
  status: "pending" | "active" | "revoked";
  source: "invite" | "email_claim" | "owner_added";
  createdAt: string;
  updatedAt: string;
};

export type PendingInviteRow = {
  id: string;
  token: string;
  operatorUserId: string;
  contactId: number;
  email: string;
  segment: PeopleSegment;
  invitedLabel: string | null;
  permissions: ProjectPermissionFlags | null;
  redirectAfter: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type WorkspaceMemberEvent = {
  id: number;
  operatorUserId: string;
  memberUserId: string | null;
  contactId: number | null;
  eventType: "joined" | "revoked";
  memberEmail: string | null;
  memberName: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ResolvedInvite = {
  valid: boolean;
  expired?: boolean;
  accepted?: boolean;
  email?: string;
  segment?: PeopleSegment;
  redirectAfter?: string | null;
  workspaceName?: string;
  contactDisplayName?: string;
  operatorUserId?: string;
  contactId?: number;
};
