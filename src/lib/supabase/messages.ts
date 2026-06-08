import type { ThreadMessage, ThreadSmartAttachment } from "@/lib/mock/message-threads";
import type { Conversation, ConversationParticipant } from "@/lib/types/messages";
import type { SupabaseClient } from "@supabase/supabase-js";

type ConversationRow = {
  id: number;
  user_id: string;
  project_id: number | null;
  name: string;
  avatar_url: string | null;
  is_group: boolean;
  last_message_preview: string | null;
  last_message_date: string | null;
  unread_count: number;
};

type ParticipantContact = {
  id: number;
  name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type MessageRow = {
  id: number;
  user_id: string;
  conversation_id: number;
  sender_id: number | null;
  sender_user_id: string | null;
  content: string | null;
  asset_url: string | null;
  image_urls: string[] | null;
  smart_attachment: ThreadSmartAttachment | null;
  sent_date: string;
};

function formatTimeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function imageUrlsFromRow(row: MessageRow): string[] | undefined {
  const urls = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  if (urls.length > 0) return urls;
  if (row.asset_url?.trim()) return [row.asset_url.trim()];
  return undefined;
}

export function messageRowToThread(row: MessageRow, authUserId: string): ThreadMessage {
  return {
    id: String(row.id),
    conversation_id: row.conversation_id,
    body: row.content?.trim() ?? "",
    side: row.sender_user_id === authUserId ? "outgoing" : "incoming",
    time_label: formatTimeLabel(row.sent_date),
    image_urls: imageUrlsFromRow(row),
    smart_attachment: row.smart_attachment ?? undefined,
  };
}

function participantFromContactRow(row: ParticipantContact): ConversationParticipant {
  const company = row.company_name?.trim();
  const person = row.name?.trim();
  const isCompany = row.role === "Client" && Boolean(company && !person);
  return {
    id: row.id,
    name: isCompany ? company || person || "Contact" : person || company || "Contact",
    avatar_url: row.avatar_url,
    company_name: isCompany ? undefined : company,
    is_company: isCompany,
  };
}

function selfParticipantFromProfile(
  authUserId: string,
  profile: { full_name: string | null; avatar_url: string | null; company_name: string | null; email: string | null },
  selfContactId: number | null,
): ConversationParticipant {
  const name =
    profile.full_name?.trim() ||
    profile.email?.split("@")[0]?.trim() ||
    "You";
  return {
    id: selfContactId ?? -1,
    name,
    avatar_url: profile.avatar_url,
    company_name: profile.company_name?.trim() || undefined,
  };
}

async function loadParticipantsForConversations(
  supabase: SupabaseClient,
  conversationIds: number[],
): Promise<Map<number, ParticipantContact[]>> {
  const map = new Map<number, ParticipantContact[]>();
  if (conversationIds.length === 0) return map;

  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      "conversation_id, contact_id, contacts ( id, name, company_name, avatar_url, role )",
    )
    .in("conversation_id", conversationIds);

  if (error) throw error;

  for (const raw of data ?? []) {
    const row = raw as {
      conversation_id: number;
      contacts: ParticipantContact | ParticipantContact[] | null;
    };
    const cid = row.conversation_id;
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    if (!contact) continue;
    const list = map.get(cid) ?? [];
    list.push(contact);
    map.set(cid, list);
  }
  return map;
}

export async function fetchConversationsForUser(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<Conversation[]> {
  const [convRes, profileRes] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, user_id, project_id, name, avatar_url, is_group, last_message_preview, last_message_date, unread_count",
      )
      .order("last_message_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("full_name, avatar_url, company_name, email, self_contact_id")
      .eq("id", authUserId)
      .maybeSingle(),
  ]);

  if (convRes.error) throw convRes.error;

  const rows = (convRes.data ?? []) as ConversationRow[];
  const participantMap = await loadParticipantsForConversations(
    supabase,
    rows.map((r) => r.id),
  );

  const profile = profileRes.data ?? {
    full_name: null,
    avatar_url: null,
    company_name: null,
    email: null,
    self_contact_id: null,
  };

  const self = selfParticipantFromProfile(
    authUserId,
    profile,
    profile.self_contact_id != null ? Number(profile.self_contact_id) : null,
  );

  return rows.map((row) => {
    const parts = (participantMap.get(row.id) ?? []).map(participantFromContactRow);

    const participants = [...parts, self];

    return {
      id: row.id,
      name: row.name,
      avatar_url: row.avatar_url,
      last_message_preview: row.last_message_preview,
      last_message_date: row.last_message_date,
      unread_count: row.unread_count ?? 0,
      participants,
      is_group: row.is_group,
      project_id: row.project_id,
    };
  });
}

export async function fetchMessagesForConversation(
  supabase: SupabaseClient,
  authUserId: string,
  conversationId: number,
): Promise<ThreadMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, user_id, conversation_id, sender_id, sender_user_id, content, asset_url, image_urls, smart_attachment, sent_date",
    )
    .eq("conversation_id", conversationId)
    .order("sent_date", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map((row) => messageRowToThread(row, authUserId));
}

export async function getConversationOwnerId(
  supabase: SupabaseClient,
  conversationId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

export type CreateConversationInput = {
  name: string;
  participantContactIds: number[];
  projectId?: number | null;
  isGroup?: boolean;
};

export async function createConversationForUser(
  supabase: SupabaseClient,
  authUserId: string,
  input: CreateConversationInput,
): Promise<Conversation> {
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      user_id: authUserId,
      name: input.name.trim(),
      project_id: input.projectId ?? null,
      is_group: input.isGroup ?? input.participantContactIds.length > 1,
      last_message_preview: null,
      last_message_date: new Date().toISOString(),
      unread_count: 0,
    })
    .select(
      "id, user_id, project_id, name, avatar_url, is_group, last_message_preview, last_message_date, unread_count",
    )
    .single();

  if (convErr) throw convErr;

  const contactIds = [...new Set(input.participantContactIds)].filter((id) => Number.isFinite(id));
  if (contactIds.length > 0) {
    const { error: partErr } = await supabase.from("conversation_participants").insert(
      contactIds.map((contact_id) => ({
        conversation_id: conv.id,
        contact_id,
      })),
    );
    if (partErr) throw partErr;
  }

  const list = await fetchConversationsForUser(supabase, authUserId);
  return list.find((c) => c.id === conv.id) ?? {
    id: conv.id,
    name: conv.name,
    avatar_url: conv.avatar_url,
    last_message_preview: conv.last_message_preview,
    last_message_date: conv.last_message_date,
    unread_count: conv.unread_count ?? 0,
    participants: [],
    is_group: conv.is_group,
    project_id: conv.project_id,
  };
}

export type InsertMessageInput = {
  conversationId: number;
  content?: string;
  imageUrls?: string[];
  smartAttachment?: ThreadSmartAttachment;
  senderContactId?: number | null;
};

export async function insertMessageForUser(
  supabase: SupabaseClient,
  authUserId: string,
  input: InsertMessageInput,
): Promise<ThreadMessage> {
  const ownerId = await getConversationOwnerId(supabase, input.conversationId);
  if (!ownerId) throw new Error("Conversation not found");

  const imageUrls = input.imageUrls?.filter(Boolean) ?? [];
  const content = input.content?.trim() ?? "";
  const preview =
    content ||
    (imageUrls.length
      ? `${imageUrls.length} photo${imageUrls.length === 1 ? "" : "s"}`
      : input.smartAttachment?.title ?? "");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      user_id: ownerId,
      conversation_id: input.conversationId,
      sender_user_id: authUserId,
      sender_id: input.senderContactId ?? null,
      content: content || null,
      asset_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
      smart_attachment: input.smartAttachment ?? null,
    })
    .select(
      "id, user_id, conversation_id, sender_id, sender_user_id, content, asset_url, image_urls, smart_attachment, sent_date",
    )
    .single();

  if (error) throw error;

  await supabase
    .from("conversations")
    .update({
      last_message_preview: preview.slice(0, 140),
      last_message_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId);

  return messageRowToThread(data as MessageRow, authUserId);
}

export async function deleteMessageForUser(
  supabase: SupabaseClient,
  authUserId: string,
  messageId: number,
): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from("messages")
    .select("id, sender_user_id, conversation_id, image_urls, asset_url")
    .eq("id", messageId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Message not found");
  if (row.sender_user_id !== authUserId) {
    throw new Error("You can only delete messages you sent");
  }

  const { error: delErr } = await supabase.from("messages").delete().eq("id", messageId);
  if (delErr) throw delErr;

  const { data: last } = await supabase
    .from("messages")
    .select("content, image_urls, smart_attachment, sent_date")
    .eq("conversation_id", row.conversation_id)
    .order("sent_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last) {
    const urls = Array.isArray(last.image_urls) ? last.image_urls : [];
    const preview =
      last.content?.trim() ||
      (urls.length ? `${urls.length} photo${urls.length === 1 ? "" : "s"}` : "") ||
      (last.smart_attachment as ThreadSmartAttachment | null)?.title ||
      "";
    await supabase
      .from("conversations")
      .update({
        last_message_preview: preview.slice(0, 140),
        last_message_date: last.sent_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.conversation_id);
  } else {
    await supabase
      .from("conversations")
      .update({
        last_message_preview: null,
        last_message_date: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.conversation_id);
  }
}

export async function updateMessageImagesForUser(
  supabase: SupabaseClient,
  authUserId: string,
  messageId: number,
  imageUrls: string[],
): Promise<ThreadMessage> {
  const { data: row, error: fetchErr } = await supabase
    .from("messages")
    .select("id, sender_user_id")
    .eq("id", messageId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!row || row.sender_user_id !== authUserId) {
    throw new Error("You can only edit messages you sent");
  }

  const { data, error } = await supabase
    .from("messages")
    .update({
      image_urls: imageUrls,
      asset_url: imageUrls[0] ?? null,
    })
    .eq("id", messageId)
    .select(
      "id, user_id, conversation_id, sender_id, sender_user_id, content, asset_url, image_urls, smart_attachment, sent_date",
    )
    .single();

  if (error) throw error;
  return messageRowToThread(data as MessageRow, authUserId);
}
