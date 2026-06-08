# Messaging stack decision (OnPro)

**Status:** Interim — not final. Recorded 2026-06 for cross-team alignment.

## Options

| | Supabase (`messages` table + Realtime) | Stream Chat |
|--|--|--|
| **Pros** | Single vendor with auth/projects; `conversations.project_id`; Mailroom can share Postgres | Production chat UX (typing, receipts, push) with less custom code |
| **Cons** | More in-house chat polish; push via Edge Functions | Second system; sync metadata in Supabase |

## Interim choice (until product sign-off)

1. **Supabase** remains system of record for **conversation metadata** (`conversations`, participants, `project_id`).
2. **In-app message bodies** on web stay on **mock data** until P3; iOS README still lists Stream as the long-term chat target.
3. **Mailroom** (email) is a **separate channel** in Next.js (`email_threads` / API routes), with optional `project_id` / `job_id` on threads for context-aware agent apply.

## When to finalize

- Schedule a short review with iOS + ops stakeholders.
- Update [OnPro/README.md](../OnPro/README.md) and [SupabaseService.swift](../OnPro/OnPro/Services/SupabaseService.swift) header once chosen.
- Remove conflicting guidance between [CHAT_MESSAGING_GUIDE.md](../OnPro/CHAT_MESSAGING_GUIDE.md) and [THIRD_PARTY_INTEGRATIONS.md](../OnPro/THIRD_PARTY_INTEGRATIONS.md).
