# Mailroom + job ingest fixes — 24 Jun 2026

Session follow-up from Jerry operator walkthrough.

---

## Fixes shipped

### 1. Project PO from email (Live Mailroom apply)

**Problem:** `create_project` always called `generatePoNumber()` on Live, ignoring `client_po_number` from the RFQ / subject.

**Change:** `resolveProjectNumber()` — uses email PO when it parses as a valid compact record, otherwise shop monthly sequence.

**Files:** `po-number.ts`, `execute-agent-suggestion-client.ts`

---

### 2. Full Gmail thread before Summarize

**Problem:** Inbox loads metadata/snippets only; Summarize could run before lazy full-thread fetch.

**Change:** `ensureThreadForSummarize()` fetches full thread before `/api/mailroom/summarize`.

**Files:** `mailroom-view.tsx`

---

### 3. Job qty / colors from Mailroom `create_job`

**Problem:** `execCreateJob` ignored `payload.qty` and `payload.colors`.

**Change:** `applyMailroomJobPayloadExtras()` builds `colorway_rows` from Mailroom payload.

**Files:** `job-ingest.ts`, `execute-agent-suggestion-client.ts`

---

### 4. Workflow plan reflects preview edits

**Problem:** Removing fields in AI draft preview did not update workflow step payload in the plan UI.

**Change:** `applyOneWith()` patches workflow step `payload` when override is passed.

**Files:** `mailroom-view.tsx`

---

### 5. Vendor quote documents use colorway breakdown

**Change:** One document line per colorway row; `quote.qty` from job colorway total.

**Files:** `production-document-draft.ts`, `vendor-po-number.ts`

---

### 6. PO extraction from email body (not only subject)

**Problem:** PO in thread body was missed when subject had no `PO#…`.

**Change:**
- `extractClientPoFromText()` / `extractClientPoFromBodies()` / `extractClientPoFromThread()` — subject first, then message bodies newest-first
- Wired through RFQ intake, `normalizeRfqProjectPayload`, `enrichSuggestionPayloadForThread`, and `execCreateProject` via `threadBodies`

**Files:** `client-from-rfq.ts`, `rfq-intake.ts`, `enrich-suggestion-payload.ts`, `agent-suggestion-resolve.ts`, `mailroom-view.tsx`

---

### 7. Amber warning when PO prefix ≠ client code

**Problem:** VOS PO on Suited client created silently with wrong prefix.

**Change:** `poPrefixMismatch()` in `po-client-code.ts` — amber warnings in:
- RFQ intake card (Client PO field)
- Workflow plan `create_project` step
- New project modal (under project number)
- Toast note on project create from Mailroom apply

**Files:** `po-client-code.ts`, `mailroom-rfq-intake-card.tsx`, `mailroom-workflow-plan.tsx`, `new-project-modal.tsx`, `projects-page-content.tsx`, `execute-agent-suggestion-client.ts`

---

### 8. Supplier on primary job

**Problem:** Supplier dropdown hidden on the first/primary job (`!isPrimaryJob`).

**Change:** Supplier always shown in job overview fields.

**Files:** `job-overview-fields.tsx`

---

## Still open

| Item | Notes |
|------|--------|
| Glowgang contact import | Not reproduced; import groups by company code |
| Job modal save → Supabase | Pre-existing |
| Auto-fix PO prefix mismatch | Warning only — does not block create |

---

## Test checklist

### PO from email

- [ ] Subject `PO#GG260601` → Create project → PO is **GG260601**
- [ ] PO only in **body** (not subject) → RFQ intake + workflow pick it up after Summarize
- [ ] No PO anywhere → auto `ClientCode+YYMM+Seq`

### PO prefix mismatch warning

- [ ] RFQ intake: client **Suited**, PO **VOS260413** → amber warning under Client PO
- [ ] Workflow plan `create_project` step shows same warning
- [ ] Manual new project: select Suited, type VOS PO → warning under project number
- [ ] Run create anyway → success toast includes “PO prefix VOS does not match…” note
- [ ] Matching prefix (GG client + GG PO) → **no** warning

### Full thread summarize

- [ ] Summarize immediately after opening thread → summary uses older message details
- [ ] Re-summarize after new reply includes new content

### Job qty / colors

- [ ] `create_job` with `qty: 36` → colorway total **36**
- [ ] `colors: "navy, off-white"` + qty → two colorway rows

### Workflow preview edits

- [ ] Remove supplier in preview → plan payload updates; job has no supplier

### Vendor quotes / Financials

- [ ] 2 colorways on job → vendor quote draft shows **2 lines** with correct qtys

### Supplier on primary job

- [ ] Project with **one** job → open job details → **Supplier** dropdown visible and usable
- [ ] Add second job → both jobs show supplier field

### Regression

- [ ] Mock Mailroom workflow runs
- [ ] `npm run build` passes

---

## Quick test data

1. **Glowgang** — PO in subject, multi-message thread  
2. **Suited LA36** — qty 36 in body, PO in body only  
3. **Voice Star / Suited mismatch** — VOS PO + Suited client (warning path)
