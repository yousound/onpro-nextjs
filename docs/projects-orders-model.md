# Projects, Orders, and Jobs

This document explains how the three layers relate in OnPro and the options under consideration after the June 2026 Projects & Jobs UX sprint.

## Concepts

| Layer | Purpose | Key fields |
|-------|---------|------------|
| **Project** | Client engagement / style family | `po_number`, client, season, shared defaults |
| **Order** | PO or delivery batch under a project | `po_number`, `client_po_number`, optional delivery notes |
| **Job** | Unit of production work (colorway, type, timeline) | `job_number`, `order_id` (optional), WIP fields |

Projects hold the client-level PO. Orders group jobs that ship or bill together. Jobs carry Development, Costing, Approvals, and Bulk Production detail.

## Current behavior (after Phase 1 fixes)

1. **Default order PO** — When a project is first opened, the seeded order inherits the project PO instead of generating a new sequence number.
2. **Job visibility** — The project Jobs overview lists all jobs for the project, not only those linked to an order.
3. **Orphan backfill** — Jobs created without an `order_id` are linked to the first order when orders exist.
4. **PO display** — Jobs list and production board show PO via fallback: job PO → order PO → project PO.

## Why Orders still exist

The team questioned whether Orders are redundant now that Jobs exist. For this sprint we **kept Orders** and fixed data/visibility bugs so Cami Tees and similar projects can be tested without a schema migration.

Orders still provide:

- Grouping multiple jobs under one client PO or ex-factory batch
- A place to attach order-level notes without duplicating on every job
- Backward compatibility with imports and existing `order_id` references

## Options after team testing

### Option A — Keep Orders (current UI)

- Project detail shows Orders section with expandable rows and jobs nested per order
- **+ Add job** on the Jobs header creates a job on the default/first order
- **+ Add job to order** remains inside each order row

### Option B — Simplify UI (future)

- Flat **Jobs** list on project detail; hide or collapse Orders accordion
- Keep `order_id` on jobs internally for PO grouping and reporting
- Default order may remain auto-seeded but invisible

No decision is required until the team validates Phase 1–3 in production. If simplification is chosen, Option B can ship as a UI-only change.

## Related files

- `src/lib/project-order-create.ts` — order seed PO inheritance
- `src/lib/project-order-edits.ts` — default orders + orphan job backfill
- `src/lib/effective-po.ts` — PO display fallback chain
- `src/components/project-orders-section.tsx` — project Jobs / Orders UI
