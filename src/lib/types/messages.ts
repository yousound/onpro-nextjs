export type ISODate = string | null;

export interface ConversationParticipant {
  id: number;
  /** Person or company display name */
  name: string;
  avatar_url: string | null;
  /** Organization shown smaller under the contact name (individuals only). */
  company_name?: string | null;
  /** When true, `name` is a company — no subtitle row. */
  is_company?: boolean;
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
