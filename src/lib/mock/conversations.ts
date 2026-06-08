import type { Conversation } from "@/lib/types/messages";

export const mockConversations: Conversation[] = [
  {
    id: 1,
    name: "Glo Gang",
    avatar_url: null,
    last_message_preview: "Great! Moving forward with production.",
    last_message_date: "2026-05-14T10:15:00.000Z",
    unread_count: 2,
    participants: [
      { id: 1, name: "Glo Gang", avatar_url: null, is_company: true },
      {
        id: 2,
        name: "Jerry M",
        avatar_url: "/user-avatar-demo.png",
        company_name: "OnPro",
      },
    ],
    is_group: false,
    project_id: 1,
  },
  {
    id: 2,
    name: "LNQ",
    avatar_url: null,
    last_message_preview: "Invoice received. Thanks!",
    last_message_date: "2026-05-01T09:00:00.000Z",
    unread_count: 0,
    participants: [
      { id: 3, name: "LNQ", avatar_url: null, is_company: true },
      {
        id: 2,
        name: "Jerry M",
        avatar_url: "/user-avatar-demo.png",
        company_name: "OnPro",
      },
    ],
    is_group: false,
    project_id: 2,
  },
  {
    id: 3,
    name: "VOID STAR + Connect Dots",
    avatar_url: null,
    last_message_preview: "Ship date confirmed.",
    last_message_date: "2026-04-20T14:22:00.000Z",
    unread_count: 0,
    participants: [
      { id: 4, name: "VOID STAR", avatar_url: null, is_company: true },
      {
        id: 2,
        name: "Jerry M",
        avatar_url: "/user-avatar-demo.png",
        company_name: "OnPro",
      },
      { id: 5, name: "Connect Dots", avatar_url: null, is_company: true },
    ],
    is_group: true,
    project_id: 3,
  },
];

export function getConversations(): Conversation[] {
  return mockConversations;
}
