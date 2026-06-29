import { isOperatorWorkspaceEmail } from "@/lib/client-email";
import type { EmailThread, MailroomRfqParticipantRole } from "@/lib/types/agent";

export type ParticipantRole = MailroomRfqParticipantRole;

/** Default role on operator→vendor RFQ threads (no end client on thread). */
export function defaultParticipantRole(email: string): ParticipantRole {
  if (isOperatorWorkspaceEmail(email)) return "team";
  return "vendor";
}

function resolveParticipantRole(
  email: string,
  overrides?: Record<string, ParticipantRole>,
): ParticipantRole {
  const key = email.trim().toLowerCase();
  return overrides?.[key] ?? defaultParticipantRole(email);
}

export function threadParticipantRoles(
  thread: EmailThread,
  overrides?: Record<string, ParticipantRole>,
): Array<{ name: string; email: string; role: ParticipantRole }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; email: string; role: ParticipantRole }> = [];
  for (const p of thread.participants) {
    const email = p.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      name: p.name?.trim() || p.email.trim(),
      email: p.email.trim(),
      role: resolveParticipantRole(p.email, overrides),
    });
  }
  const from = thread.messages[0]?.from;
  if (from?.email) {
    const email = from.email.trim().toLowerCase();
    if (!seen.has(email)) {
      out.unshift({
        name: from.name?.trim() || from.email,
        email: from.email.trim(),
        role: resolveParticipantRole(from.email, overrides),
      });
    }
  }
  return out;
}

export function inferVendorNameFromThread(
  thread: EmailThread,
  overrides?: Record<string, ParticipantRole>,
): string | null {
  const vendor = threadParticipantRoles(thread, overrides).find((p) => p.role === "vendor");
  return vendor?.name ?? null;
}

export function inferTeamContactFromThread(
  thread: EmailThread,
  overrides?: Record<string, ParticipantRole>,
): { name: string; email: string } | null {
  const team = threadParticipantRoles(thread, overrides).find((p) => p.role === "team");
  if (!team) return null;
  return { name: team.name, email: team.email };
}
