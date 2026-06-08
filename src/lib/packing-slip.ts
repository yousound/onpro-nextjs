import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { PackingSlipDocument, PackingSlipLine } from "@/lib/types/packing-slip";
import type { ProjectJob } from "@/lib/types/wip";
import { clientCodeByName } from "@/lib/reference/client-codes";
import {
  applyCompanyContact,
  applyShipFromContact,
  applyShipToContact,
  findPackingContactByName,
  findPackingContactForProjectClient,
} from "@/lib/packing-slip-contacts";
import { labelDescription } from "@/lib/style-number";
import type { CurrentUserDisplay } from "@/lib/current-user-display";

/** Demo letterhead when no operator company is on file (mock / empty profile). */
export const MOCK_PACKING_SLIP_ORIGIN = {
  companyName: "Connect Dots",
  shipFromName: "Connect Dots",
  shipFromAddress: "456 Industrial Blvd, Los Angeles, CA 90001",
} as const;

export type PackingSlipOrigin = {
  companyName: string;
  shipFromName: string;
  shipFromAddress: string;
};

/** Operator workspace company + business address from Supabase profile. */
export function packingSlipOriginFromUser(
  user: Pick<CurrentUserDisplay, "companyName" | "businessAddress"> | null | undefined,
): PackingSlipOrigin | null {
  const companyName = user?.companyName?.trim();
  if (!companyName) return null;
  return {
    companyName,
    shipFromName: companyName,
    shipFromAddress: user?.businessAddress?.trim() ?? "",
  };
}

/** Letterhead company name; falls back for slips saved before company_name existed. */
export function packingSlipCompanyName(slip: PackingSlipDocument): string {
  const name = slip.company_name?.trim() || slip.ship_from_name?.trim();
  return name || MOCK_PACKING_SLIP_ORIGIN.companyName;
}

export function generatePackingSlipNumber(project: Project, existing: PackingSlipDocument[]): string {
  const code = clientCodeByName(project.client.name) ?? "PL";
  const d = new Date();
  const yymmdd = [
    String(d.getFullYear()).slice(-2),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `${code}${yymmdd}`;
  let max = 0;
  for (const slip of existing) {
    const m = slip.document_number.match(new RegExp(`^${prefix}(\\d*)$`, "i"));
    if (m) max = Math.max(max, m[1] ? parseInt(m[1], 10) : 1);
  }
  const suffix = max > 0 ? String(max + 1) : "";
  return `${prefix}${suffix}`;
}

export function buildPackingSlipLinesFromJobs(jobs: ProjectJob[]): PackingSlipLine[] {
  const lines: PackingSlipLine[] = [];
  let seq = 0;

  for (const job of jobs) {
    const po = job.po_number?.trim() ?? "";
    const baseName = job.name?.trim() || job.subtitle?.trim() || "Garment";
    const desc =
      job.label_lines?.[0]?.description?.trim() ||
      labelDescription(job.category, job.colorway ?? "");
    const color = job.colorway?.trim() ?? "";

    if (job.label_lines?.length) {
      for (const ll of job.label_lines) {
        seq += 1;
        lines.push({
          id: `line-${job.id}-${ll.id}`,
          style_number: job.style_number?.trim() ?? ll.style_color_code.split("-")[0] ?? "",
          description: ll.description?.trim() || baseName,
          colorway: color,
          size: ll.size,
          quantity: 1,
          po_number: po,
          cartons: 0,
        });
      }
      continue;
    }

    const sizes = [...(job.addon_shirt_sizes ?? []), ...(job.addon_pant_sizes ?? [])];
    if (sizes.length) {
      for (const size of sizes) {
        seq += 1;
        lines.push({
          id: `line-${job.id}-${size}-${seq}`,
          style_number: job.style_number?.trim() ?? "",
          description: desc || baseName,
          colorway: color,
          size,
          quantity: 1,
          po_number: po,
          cartons: 0,
        });
      }
      continue;
    }

    seq += 1;
    lines.push({
      id: `line-${job.id}`,
      style_number: job.style_number?.trim() ?? "",
      description: desc || baseName,
      colorway: color,
      size: job.garment_size?.trim() || "OS",
      quantity: 1,
      po_number: po,
      cartons: 0,
    });
  }

  return lines;
}

export function createPackingSlipDraft(
  project: Project,
  jobs: ProjectJob[],
  contacts: Contact[],
  operatorOrigin?: PackingSlipOrigin | null,
): PackingSlipDocument {
  const existing = project.packaging_slips ?? [];
  const now = new Date().toISOString();
  const docNum = generatePackingSlipNumber(project, existing);
  const letterhead = operatorOrigin ?? MOCK_PACKING_SLIP_ORIGIN;
  const shipTo = findPackingContactForProjectClient(contacts, project);

  let slip: PackingSlipDocument = {
    id: `pl-${Date.now()}`,
    document_number: docNum,
    title: `Packing list ${docNum}`,
    created_at: now,
    updated_at: now,
    ship_date: now.slice(0, 10),
    company_name: letterhead.companyName,
    company_contact_id: null,
    ship_from_name: letterhead.shipFromName,
    ship_from_address: letterhead.shipFromAddress,
    ship_from_contact_id: null,
    ship_to_name: project.client.name,
    ship_to_address: "",
    ship_to_contact_id: null,
    carrier: project.shipping_method?.trim() ?? "",
    tracking_number: project.tracking_bol_number?.trim() ?? "",
    project_po_number: project.po_number ?? null,
    notes: null,
    lines: buildPackingSlipLinesFromJobs(jobs),
  };

  if (!operatorOrigin) {
    const shipFrom =
      findPackingContactByName(contacts, MOCK_PACKING_SLIP_ORIGIN.shipFromName) ??
      findPackingContactByName(contacts, MOCK_PACKING_SLIP_ORIGIN.companyName);
    const origin = shipFrom ?? shipTo;
    if (origin) {
      slip = applyCompanyContact(slip, origin, contacts);
      slip = applyShipFromContact(
        slip,
        shipFrom ?? origin,
        contacts,
        MOCK_PACKING_SLIP_ORIGIN.shipFromAddress,
      );
    }
  }

  if (shipTo) {
    slip = applyShipToContact(slip, shipTo, contacts);
  }

  return slip;
}

export function exportPackingSlipCsv(slip: PackingSlipDocument): void {
  const variant = slip.variant ?? "products_go";
  const baseHeaders = ["BOX"];
  if (variant === "products_go") baseHeaders.push("IID#");
  if (variant === "shipper") baseHeaders.push("WEIGHT", "DIMS");
  baseHeaders.push("STYLE #", "DESCRIPTION", "COLOR", "SIZE", "QTY", "CARTONS", "PO #");

  const rows: string[][] = [
    [packingSlipCompanyName(slip).toUpperCase(), "PACKING LIST"],
    [slip.document_number, ""],
    ["Ship date", slip.ship_date ?? ""],
    [],
    ["FROM", slip.ship_from_name],
    [slip.ship_from_address, ""],
    ["SHIP TO", slip.ship_to_name],
    [slip.ship_to_address, ""],
    ["Carrier", slip.carrier],
    ["Tracking", slip.tracking_number],
    ["Project PO", slip.project_po_number ?? ""],
    [],
    baseHeaders,
  ];

  for (const line of slip.lines) {
    const row: string[] = [String(line.box_number ?? "")];
    if (variant === "products_go") row.push(line.iid_number ?? "");
    if (variant === "shipper") {
      row.push(line.box_weight ?? "");
      row.push(line.box_dimensions ?? "");
    }
    row.push(
      line.style_number,
      line.description,
      line.colorway,
      line.size,
      String(line.quantity),
      String(line.cartons || ""),
      line.po_number,
    );
    rows.push(row);
  }

  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slip.document_number.replace(/\s+/g, "_")}_packing_list.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function totalPieces(slip: PackingSlipDocument): number {
  return slip.lines.reduce((sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0), 0);
}
