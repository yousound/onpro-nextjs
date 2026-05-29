/** Generated packing list / slip for outbound shipment (project-level). */

export type PackingSlipLine = {
  id: string;
  style_number: string;
  description: string;
  colorway: string;
  size: string;
  quantity: number;
  po_number: string;
  cartons: number;
};

export type PackingSlipDocument = {
  id: string;
  /** e.g. GG240816 or PL-GG-20260528 */
  document_number: string;
  title: string;
  created_at: string;
  updated_at: string;
  ship_date: string | null;
  /** Letterhead on the packing list (e.g. Connect Dots). */
  company_name: string;
  company_contact_id?: string | null;
  ship_from_name: string;
  ship_from_address: string;
  ship_from_contact_id?: string | null;
  ship_to_name: string;
  ship_to_address: string;
  ship_to_contact_id?: string | null;
  carrier: string;
  tracking_number: string;
  project_po_number: string | null;
  notes: string | null;
  lines: PackingSlipLine[];
};
