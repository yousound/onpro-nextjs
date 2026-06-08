import type { CurrentUserDisplay } from "@/lib/current-user-display";
import type { Conversation, ConversationParticipant } from "@/lib/types/messages";

export function isSelfParticipant(
  participant: ConversationParticipant,
  user: CurrentUserDisplay | null,
): boolean {
  const selfName = user?.fullName?.trim();
  if (selfName && participant.name.trim() === selfName) return true;
  const emailLocal = user?.email?.split("@")[0]?.trim();
  if (emailLocal && participant.name.trim().toLowerCase() === emailLocal.toLowerCase()) return true;
  return participant.name.trim() === "Jerry M";
}

export function peerParticipant(
  conversation: Conversation,
  user: CurrentUserDisplay | null,
): ConversationParticipant {
  const peer = conversation.participants.find((p) => !isSelfParticipant(p, user));
  if (peer) return peer;
  return {
    id: 0,
    name: conversation.name,
    avatar_url: conversation.avatar_url,
  };
}

export function selfParticipant(
  conversation: Conversation,
  user: CurrentUserDisplay | null,
): ConversationParticipant {
  const self = conversation.participants.find((p) => isSelfParticipant(p, user));
  if (self) return self;
  return {
    id: -1,
    name: user?.fullName?.trim() || user?.email?.split("@")[0] || "You",
    avatar_url: user?.avatarUrl ?? null,
    company_name: user?.companyName?.trim() || undefined,
  };
}

export function conversationListAvatar(
  conversation: Conversation,
  user: CurrentUserDisplay | null,
): { name: string; avatarUrl: string | null } {
  const peer = peerParticipant(conversation, user);
  return {
    name: conversation.name,
    avatarUrl: conversation.avatar_url ?? peer.avatar_url,
  };
}
