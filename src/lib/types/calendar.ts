export type CalendarEventType =
  | "shipping"
  | "meeting"
  | "deadline"
  | "sample_review"
  | "production"
  | "other";

export interface CalendarContact {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  role: string;
  has_unread: boolean;
  website: string | null;
  address: string | null;
  project_ids: number[] | null;
}

export type ISODate = string | null;

export interface CalendarEvent {
  id: number;
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  event_type: CalendarEventType | null;
  delivery_by: string | null;
  shipped_from: string | null;
  shipped_to: string | null;
  type_of_product: string | null;
  link_to_client: string | null;
  po: string | null;
  invoice: string | null;
  received_by: CalendarContact | null;
  department: string | null;
  notes: string | null;
  receiving_options: string | null;
  /** Google Calendar event id (Live sync). */
  external_id?: string | null;
  /** Team member / account that owns this synced event. */
  calendar_owner_email?: string | null;
  calendar_owner_name?: string | null;
  calendar_owner_user_id?: string | null;
}
