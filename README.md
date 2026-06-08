# OnPro — Desktop (Next.js)

See **[PROJECT_STATS.md](./PROJECT_STATS.md)** for lines of code, first-commit dates, and when source files were first created on disk (both this repo and the iOS app).

**Backend:** Supabase is the system of record when `.env.local` is configured — see **[BACKEND.md](./BACKEND.md)**. **Vercel / production:** set Supabase env vars for Live-only data (no mock toggle); omit keys or set `NEXT_PUBLIC_USE_SUPABASE=false` for a mock-only demo.

## AI usage and OpenAI costs (client)

OnPro uses **OpenAI** for the workspace assistant, Mailroom summarize/chat, and optional CSV import parsing. Default model: **`gpt-4o-mini`**.

- **Full guide (features, pricing bands, caches, team planning):** **[docs/AI_USAGE_AND_COSTS.md](./docs/AI_USAGE_AND_COSTS.md)**
- **Monitor spend:** [OpenAI Usage](https://platform.openai.com/usage) → your OnPro API key; set billing alerts there.
- **Rough planning:** light use ~$20–100/mo for 7 users; heavy Mailroom-heavy use ~$200–350/mo — see the doc for assumptions and controls.
- **Mailroom (team guide):** **[docs/MAILROOM.md](./docs/MAILROOM.md)** — when AI reads email, Summarize vs Regenerate, chat, FAQs.
- **Mailroom (technical):** AI only on **Summarize** per thread; scans cached 1 year in Supabase (`012_mailroom_thread_scans.sql`).
- **All docs index:** **[docs/README.md](./docs/README.md)**

## Partner development ledger (private)

**Not part of the OnPro product UI** — hidden from the main sidebar.

- URL: [http://localhost:3000/ledger](http://localhost:3000/ledger) (password in `.env.local` as `LEDGER_PASSWORD`, default `jerryonpro`)
- **Edit baseline data:** [`src/lib/ledger/seed.ts`](src/lib/ledger/seed.ts) (phases, scope, invoices, DROPX, FBRC)
- **Sprint work notes (for seed updates):** [`docs/development-ledger/`](docs/development-ledger/) — current: [June 2026](./docs/development-ledger/sprint-2026-06.md)  
  - *June sprint (synced 2 Jun):* Live Supabase, Mailroom (**conversational agent chat**), onboarding, OnPro AI, **Contacts** (rename, CSV import with auto-chunk batches, modal polish), Live projects API, section covers, jobs UX, assistant full snapshot. Ledger: June retainer **line items** + per-task **detail** on `/ledger` invoices. Caps **94%** / **72%**. Open: job save to Supabase, Messages/calendar/documents in DB, pending invites in DB.
- **Day-to-day in the UI:** mark invoices paid (OnPro only — FBRC is separate), toggle cap systems on Engineering → Milestones
- **Accrued $ and work-finished %** are calculated from `completionFraction` × system value in `capSystems` (not a manual number)
- **Invoices page:** billing rows plus **Work accounted for by period** (`workRecords` in seed) — dated deliverables through the project timeline
- **Reset local changes:** “Reset to seed” in the ledger sidebar

Desktop shell for **OnPro**: dark chrome + light canvas, **OnPro AI** assistant, **Projects** (Live Supabase or mock), **Production** / jobs board, **Messages**, **Mailroom** (Gmail), **People**, **Calendar**, **Documents**. Project detail and job modals share the iOS-aligned `Project` / WIP model (`OnPro/Models/Project.swift`). Use the header **Live / Mock** toggle when Supabase is configured — see [BACKEND.md](./BACKEND.md).

**June 2026 (high level):** Live path + Mailroom Gmail; Contacts directory with CSV import (batched); conversational Mailroom chat; create/edit projects in Live; jobs modal + picker; OnPro AI on full ops snapshot; partner ledger June invoice broken into line items + deliverable detail rows (see [sprint doc](./docs/development-ledger/sprint-2026-06.md)).

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) — `/` redirects to `/projects`.

## Node version

The app builds on **Node 18.18+**. **Node 20 LTS** is recommended for parity with current Next.js and tooling releases.

## Security baseline

- **Framework**: Next.js **15.5.18** (patched 15.x line). Re-run `npm audit` before releases and upgrade when advisories require it.
- **Secrets**: use `.env.local` only (see `.env.example`). Never expose service keys to the client bundle.
- **Headers**: `next.config.ts` sets `X-Frame-Options: DENY` and `Referrer-Policy: strict-origin-when-cross-origin` on all routes.
- **Dependencies**: Dependabot or Renovate on the repo is recommended.

## Layout reference

Visual structure follows the internal dashboard reference (dark top bar, KPI header, light content). Metrics on Projects are derived only from mock `Project` fields (status, due dates, milestone fill), not placeholder domains like generic tasks or budget.
