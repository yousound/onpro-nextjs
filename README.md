# OnPro — Desktop (Next.js)

See **[PROJECT_STATS.md](./PROJECT_STATS.md)** for lines of code, first-commit dates, and when source files were first created on disk (both this repo and the iOS app).

## Partner development ledger (private)

**Not part of the OnPro product UI** — hidden from the main sidebar.

- URL: [http://localhost:3000/ledger](http://localhost:3000/ledger) (password in `.env.local` as `LEDGER_PASSWORD`, default `jerryonpro`)
- **Edit baseline data:** [`src/lib/ledger/seed.ts`](src/lib/ledger/seed.ts) (phases, scope, invoices, DROPX, FBRC)
- **Day-to-day in the UI:** mark invoices paid (OnPro only — FBRC is separate), toggle cap systems on Engineering → Milestones
- **Accrued $ and work-finished %** are calculated from `completionFraction` × system value in `capSystems` (not a manual number)
- **Invoices page:** billing rows plus **Work accounted for by period** (`workRecords` in seed) — dated deliverables through the project timeline
- **Reset local changes:** “Reset to seed” in the ledger sidebar

UI-only desktop shell for **OnPro**: dark chrome + light canvas, **Projects** overview with field-backed KPIs and cards, **Production** board (TanStack Table + inspector), **project detail** modules backed by the same `Project` shape as the iOS app (`OnPro/Models/Project.swift`). Mock data lives under `src/lib/mock/`.

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
