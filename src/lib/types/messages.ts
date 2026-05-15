export type ISODate = string | null;

export interface ConversationParticipant {
  id: number;
  name: string;
  avatar_url: string | null;
}

export interface Conversation {
  id: number;
  name: string;
  avatar_url: string | null;
  last_message_preview: string | null;
  last_message_date: ISODate;
  unread_count: number;
  participants: ConversationParticipant[];
  is_group: boolean;
  project_id: number | null;
}
