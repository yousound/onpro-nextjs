import type { ThreadMessage, ThreadSmartAttachment } from "@/lib/mock/message-threads";
import type { Conversation } from "@/lib/types/messages";

async function parseError(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  return (err as { error?: string }).error ?? res.statusText;
}

export async function fetchConversationsViaApi(): Promise<Conversation[]> {
  const res = await fetch("/api/messages/conversations", { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { conversations: Conversation[] };
  return data.conversations;
}

export async function fetchMessagesViaApi(conversationId: number): Promise<ThreadMessage[]> {
  const res = await fetch(`/api/messages?conversationId=${conversationId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { messages: ThreadMessage[] };
  return data.messages;
}

export async function createConversationViaApi(opts: {
  name: string;
  participantContactIds: number[];
  projectId?: number | null;
}): Promise<Conversation> {
  const res = await fetch("/api/messages/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { conversation: Conversation };
  return data.conversation;
}

export async function sendMessageViaApi(opts: {
  conversationId: number;
  content?: string;
  imageUrls?: string[];
  smartAttachment?: ThreadSmartAttachment;
}): Promise<ThreadMessage> {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { message: ThreadMessage };
  return data.message;
}

export async function deleteMessageViaApi(messageId: string): Promise<void> {
  const numericId = Number(messageId);
  if (!Number.isFinite(numericId)) throw new Error("Invalid message id");
  const res = await fetch(`/api/messages/${numericId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function patchMessageImagesViaApi(
  messageId: string,
  imageUrls: string[],
): Promise<ThreadMessage> {
  const numericId = Number(messageId);
  if (!Number.isFinite(numericId)) throw new Error("Invalid message id");
  const res = await fetch(`/api/messages/${numericId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrls }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { message: ThreadMessage };
  return data.message;
}

export async function fetchConversationOwnerViaApi(
  conversationId: number,
): Promise<string> {
  const res = await fetch(`/api/messages/conversations/${conversationId}/owner`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { ownerUserId: string };
  return data.ownerUserId;
}
