# OnPro backend (system of record)

The **canonical backend** for OnPro is **Supabase** (Auth + PostgreSQL + RLS). The desktop app (`onpro-nextjs`) and the iOS app (`OnPro`) share the same project and schema.

## Canonical documentation (iOS repo)

| Document | Path (relative to `OnPro/`) |
|----------|-----------------------------|
| Stack overview | [README.md](../OnPro/README.md) |
| Postgres schema + RLS | [SUPABASE_SCHEMA.sql](../OnPro/SUPABASE_SCHEMA.sql) |
| Jobs / WIP extension (desktop) | [supabase/migrations/002_project_jobs.sql](./supabase/migrations/002_project_jobs.sql) |
| Auth setup | [SUPABASE_SETUP.md](../OnPro/SUPABASE_SETUP.md) |
| Service layer | [OnPro/Services/SupabaseService.swift](../OnPro/OnPro/Services/SupabaseService.swift) |
| Third-party services | [THIRD_PARTY_INTEGRATIONS.md](../OnPro/THIRD_PARTY_INTEGRATIONS.md) |
| Messaging options | [CHAT_MESSAGING_GUIDE.md](../OnPro/CHAT_MESSAGING_GUIDE.md) |

## Desktop integration

| Area | Location | Notes |
|------|----------|--------|
| Env vars | [.env.example](./.env.example) | `NEXT_PUBLIC_SUPABASE_*`; never commit `.env.local` |
| Feature flag | [src/lib/config/backend.ts](./src/lib/config/backend.ts) | `isSupabaseConfigured()` — falls back to mocks when unset |
| Supabase clients | [src/lib/supabase/](./src/lib/supabase/) | Browser, server, middleware helpers |
| Data loaders | [src/lib/data/](./src/lib/data/) | `fetchProjects`, `fetchContacts` |
| Auth UI | [src/app/login/](./src/app/login/) | Sign in; shares session with iOS |
| Mailroom API | [src/app/api/mailroom/](./src/app/api/mailroom/) | Server-only Gmail/agent stubs; apply uses Supabase when configured |

## Messaging decision (interim)

Until the team picks **Stream Chat** vs **Supabase Realtime** for in-app messages:

- **Auth, contacts, projects, jobs (JSONB)** → Supabase
- **In-app Messages UI** → still mock on web; metadata can live in `conversations` when wired
- **Mailroom** → Next.js API routes + optional Supabase persistence; email is separate from in-app chat

See [docs/MESSAGING_DECISION.md](./docs/MESSAGING_DECISION.md).

## Phased rollout

1. **P0** — Supabase auth on web (middleware + login)
2. **P1** — Projects + contacts read from Supabase (mock fallback)
3. **P2** — `project_jobs` table + job payloads (after job UI spec is stable)
4. **P3** — Messages stack decision + wire UI
5. **P4** — Mailroom server routes + context-aware apply (`project_id` on threads)

## Mock fallback

When Supabase env vars are missing, the app behaves as before: `src/lib/mock/*` and `localStorage` (`onpro.mock.v1.*` keys). This keeps local UI development working without a live project.

## Public demo / GitHub deploy (Mock only)

For a hosted preview that must **not** use Live data:

1. **Do not** set `NEXT_PUBLIC_SUPABASE_*` (or any server secrets) on the host — the app stays Mock; the Live/Mock toggle is hidden.
2. Or set `NEXT_PUBLIC_USE_SUPABASE=false` to force Mock even if keys exist.
3. In **production** (Vercel), Supabase keys → **Live only** (toggle hidden; mock cookie ignored). **Development** (`npm run dev`) shows the Live/Mock toggle when Supabase is in `.env.local`.

| Env | Production | Development |
|-----|------------|-------------|
| No Supabase keys | Mock | Mock |
| Keys configured | Live only | Live (toggle) |
| `NEXT_PUBLIC_USE_SUPABASE=false` | Mock | Mock |

Never commit `.env.local`. See [.env.example](./.env.example).
