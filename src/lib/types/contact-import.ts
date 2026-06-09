import type { PeopleSegment } from "@/lib/mock/people";
import type { Address, ContactKind, ContactLocation, TeamRole } from "@/lib/types/contact";

/** One People row extracted from a CSV (before persisting). */
export type ParsedImportContactRow = {
  /** null = unlabeled in CSV — user picks Team / Client / Vendor on review */
  segment: PeopleSegment | null;
  kind: ContactKind;
  name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  company_code?: string;
  other_emails?: string[];
  billing_address?: Address;
  shipping_address?: Address;
  locations?: ContactLocation[];
  notes?: string;
  team_role?: TeamRole;
  business_structure?: string;
  /** Parser notes — ambiguous segment, missing field, etc. */
  warnings?: string[];
};

/** @deprecated Alias for older imports */
export type ParsedImportClientRow = ParsedImportContactRow;

export type ParseContactsCsvResponse = {
  rows: ParsedImportContactRow[];
  summary: string;
  source: "openai" | "fallback";
  /** Contacts allowed per batch. */
  rowLimit?: number;
  /** Total data rows in the full uploaded file (all batches). */
  rowsInFile?: number;
  /** Rows returned for review in this batch. */
  rowsReturned?: number;
  /** @deprecated Legacy flag; multi-batch imports use chunkIndex/chunkCount instead. */
  truncated?: boolean;
  /** True when only part of the file was sent to AI (very large CSV). */
  aiInputTruncated?: boolean;
  /** 0-based index when the server parsed one auto-chunk. */
  chunkIndex?: number;
  chunkCount?: number;
};
