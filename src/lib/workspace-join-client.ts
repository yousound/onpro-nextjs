import type { WorkspaceMatch } from "@/lib/types/workspace";

export async function joinWorkspaceMatch(match: WorkspaceMatch): Promise<void> {
  const res = await fetch("/api/onboarding/join-workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operator_user_id: match.operatorUserId,
      contact_id: match.contactId,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not join workspace");
  }
}
