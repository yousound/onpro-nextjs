import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";

/** Mock thread lines for Messages UI (not on iOS Conversation model). */
/** Optional smart attachment bubble (mirrors iOS OnProMessage.smartAttachment at a glance). */
export type ThreadSmartAttachment = {
  kind: string;
  title: string;
  subtitle?: string;
  badge?: string;
  /** Full composer snapshot for reopen / edit (mock). */
  composer_draft?: AttachmentComposerDraft;
};

export type ThreadMessage = {
  id: string;
  conversation_id: number;
  body: string;
  side: "incoming" | "outgoing";
  time_label: string;
  /** Optional placeholder “images” count for demo bubbles */
  image_slots?: number;
  smart_attachment?: ThreadSmartAttachment;
};

export const mockThreadMessages: ThreadMessage[] = [
  {
    id: "m1",
    conversation_id: 1,
    side: "incoming",
    body: "Hey — can we confirm the strike-off timeline?",
    time_label: "10:12 AM",
  },
  {
    id: "m2",
    conversation_id: 1,
    side: "outgoing",
    body: "Yes, targeting Friday for approvals on our side.",
    time_label: "10:14 AM",
  },
  {
    id: "m2a-job",
    conversation_id: 1,
    side: "outgoing",
    body: "",
    time_label: "10:15 AM",
    smart_attachment: {
      kind: "job",
      title: "Cut & sew batch #12",
      subtitle: "Due · Apr 2 · Factory floor",
      badge: "In progress",
    },
  },
  {
    id: "m2b-inv",
    conversation_id: 1,
    side: "outgoing",
    body: "",
    time_label: "10:16 AM",
    smart_attachment: {
      kind: "invoice",
      title: "Invoice INV-2026-0142",
      subtitle: "Fillo Product Design",
      badge: "$3,000.00",
    },
  },
  {
    id: "m3",
    conversation_id: 1,
    side: "incoming",
    body: "Here are the two ref shots from the mill.",
    time_label: "10:18 AM",
    image_slots: 2,
  },
  {
    id: "m4",
    conversation_id: 2,
    side: "incoming",
    body: "Invoice received. Thanks!",
    time_label: "9:00 AM",
  },
  {
    id: "m5",
    conversation_id: 3,
    side: "outgoing",
    body: "Ship date confirmed for next week.",
    time_label: "2:22 PM",
  },
];

export type MockAttachment = {
  id: string;
  conversation_id: number;
  name: string;
  ext: "pdf" | "doc" | "ppt" | "xls";
  size: string;
  date: string;
};

export const mockAttachments: MockAttachment[] = [
  {
    id: "a1",
    conversation_id: 1,
    name: "Strike-off schedule",
    ext: "pdf",
    size: "2.4 MB",
    date: "Mar 24, 10:20 AM",
  },
  {
    id: "a2",
    conversation_id: 1,
    name: "Color standards",
    ext: "doc",
    size: "180 KB",
    date: "Mar 24, 9:05 AM",
  },
];

export function messagesForConversation(conversationId: number): ThreadMessage[] {
  return mockThreadMessages.filter((m) => m.conversation_id === conversationId);
}

export function attachmentsForConversation(conversationId: number): MockAttachment[] {
  return mockAttachments.filter((a) => a.conversation_id === conversationId);
}
