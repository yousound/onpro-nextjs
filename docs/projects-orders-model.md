# Projects, orders, jobs, and numbering

This document describes how OnPro layers relate and how **project numbers**, **job numbers**, and **vendor POs** work after the June 2026 quoting flow sprint.

## Three identifiers (do not conflate)

| Concept | When assigned | Format | Example |
|---------|---------------|--------|---------|
| **Project number** | Project create | `ClientCode` + `YYMM` + shop monthly seq | `DW260607` |
| **Job number** | Each job added to a project | Project number + per-project suffix | `DW260607-01`, `DW260607-02` |
| **Vendor PO** | When sending a vendor quote request | `{projectNumber}-{jobSeq}{letter}` | `DW260607-1A` (embroidery), `DW260607-1B` (print), `DW260607-2A` (job 2) |

**Rules**

- Project numbers are unique shop-wide.
- Vendor POs are unique shop-wide — one PO per vendor quote request.
- The same job split across embroidery and print vendors gets **two POs** (e.g. `DW260607-02-01` and `DW260607-02-02`).

## Layers

| Layer | Purpose | Key fields |
|-------|---------|------------|
| **Project** | Client engagement | `project_number`, client, status, dates |
| **Order** | Internal grouping / shipment batch (optional UI) | `order_number`, legacy `po_number` |
| **Job** | Production unit (WIP, costing, approvals) | `job_number`, `vendor_quotes`, `estimates` |

Projects hold the **project number**. Jobs hold **job numbers** under that project. **Vendor POs** live on `VendorQuote` records when quote requests are sent.

## Quote-to-invoice flow

```
Create project (project number)
  → Add jobs (job numbers DW260607-01, -02, …)
  → Request vendor quotes (select jobs + vendors → unique vendor POs)
  → Vendor pricing received → pull into costing sheet
  → Generate client estimate → send to client → acceptance
  → Bulk production (soft gate: accepted estimate recommended)
  → Create invoice from accepted estimate
```

Entry points:

- **Request vendor quotes** — project Jobs header (`request-vendor-quotes-modal.tsx`)
- **Vendor quotes / costing / estimates** — job details modal, Costing section
- **Invoice** — “Create invoice” on accepted estimate → ledger invoice editor

## Orders (internal)

Orders remain for grouping jobs that ship or bill together. Vendor-facing POs are on quotes, not on project create. Legacy order/job `po_number` fields are kept for backward compatibility; new work uses project number + vendor quote POs.

## Related files

- `src/lib/po-number.ts` — project number format and shop monthly counter
- `src/lib/job-number.ts` — per-project job suffix (`DW260607-01`)
- `src/lib/vendor-po-number.ts` — vendor PO allocation (`DW260607-1A`, `DW260607-1B`, …)
- `src/lib/po-duplicate.ts` — uniqueness validation
- `src/components/request-vendor-quotes-modal.tsx` — quote send UX
- `src/lib/ledger/invoice-draft.ts` — `buildInvoiceDraftFromAcceptedEstimate`
