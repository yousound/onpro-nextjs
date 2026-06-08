# OnPro AI — usage and cost guide

This document is for the **OnPro client team** operating a private deployment. It explains what the built-in AI does, what it costs on OpenAI, and how we keep usage efficient.

## What uses OpenAI

All AI features use **Chat Completions** with structured JSON output. The default model is **`gpt-4o-mini`** (set in server env as `OPENAI_MODEL`; if unset, the code defaults to mini).

| Feature | Where in the app | When it calls OpenAI |
|--------|------------------|----------------------|
| **Workspace brief** | OnPro AI (Overview) | First visit per calendar day; optional **Update me** (user-initiated refresh) |
| **Assistant chat** | OnPro AI | Each message you send in the assistant panel |
| **Mailroom summarize** | Mailroom → Summarize on a thread | When you tap Summarize (or Regenerate) |
| **Mailroom side chat** | Mailroom agent panel | Each message while viewing a thread |
| **CSV contact import** | People → Import | When AI parsing is used for a batch (up to 200 rows / 120k characters per request) |

If `OPENAI_API_KEY` is missing or invalid, the app falls back to **rule-based / live snapshot text** where possible — no API charge for those responses.

## Typical OpenAI pricing (gpt-4o-mini)

Check [OpenAI pricing](https://openai.com/api/pricing/) for current numbers. As of mid-2026, list rates are approximately:

| | Per 1M tokens |
|--|----------------|
| Input | $0.15 |
| Output | $0.60 |

**Example:** 150,000 tokens in a month ≈ **$0.04–$0.12** depending on input/output mix. Heavy Mailroom testing with long email threads can reach **~$1–2 per user per day** before optimizations.

## What drives cost

1. **Input size** — Each assistant chat sends a **workspace snapshot** (projects, jobs, contacts, recent Gmail threads). Mailroom sends **email thread text**. Longer threads and more contacts = more tokens.
2. **Request count** — Every chat message and every summarize is a separate API call.
3. **Regenerations** — Summarize again or **Update me** on the brief intentionally bypass caches and call OpenAI again.

Mailroom and import are usually the **largest single calls**; overview chat adds up when many messages are sent in one session.

## Cost controls built into OnPro

These are implemented in the application (June 2026):

| Control | Effect |
|--------|--------|
| **Default model `gpt-4o-mini`** | Much cheaper than GPT-4o full size for the same features |
| **Summarize-only Mailroom AI** | OpenAI never reads the inbox. Only the thread you tap **Summarize** is scanned (all messages in that thread, 5000 chars per message). |
| **1-year scan cache** | Summarize results stored in Supabase (`mailroom_thread_scans`) and reused; Regenerate bypasses when content changed |
| **Overview assistant mailroom** | Only **summarized** thread subjects/summaries appear in workspace context — not live inbox bodies |
| **Workspace snapshot cache (10 min)** | Briefing + assistant chat reuse one snapshot per user instead of rebuilding from Supabase/Gmail on every message |
| **Daily briefing cache** | One OpenAI brief per user per calendar day; navigation back to Overview does not re-bill until the next day |
| **Update me** | Bypasses daily cache when the user explicitly asks for a fresh brief |
| **Mailroom summarize cache (1 year)** | Same thread content returns cached summary/suggestions without a new API call; **Regenerate** bypasses cache |
| **Manual summarize** | AI does not run until the user taps Summarize |
| **Live fallbacks** | If OpenAI fails, deterministic snapshot replies avoid retry loops |

Server caches are **in-memory per app instance** (suitable for a single Node server or low-traffic deploy). For multi-region serverless at scale, the same keys could be moved to Redis or Supabase later.

## Planning for your team size

Rough **monthly OpenAI spend** for **gpt-4o-mini** (order of magnitude, not a guarantee):

| Usage pattern | Per user / month | 7 users / month |
|---------------|------------------|-----------------|
| Light (brief + occasional chat) | $3–15 | $20–100 |
| Typical production | $15–40 | $100–280 |
| Heavy (Mailroom all day, many summarizes) | $40–50 | $280–350 |

Your OpenAI dashboard (**Usage → API keys → OnPro**) is the source of truth. Set **spend alerts** in the OpenAI billing UI.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Server-only; required for Live AI |
| `OPENAI_MODEL` | Optional override (default `gpt-4o-mini`) |

Never put the API key in `NEXT_PUBLIC_*` variables.

## Operational recommendations

1. **Set a monthly budget alert** on the OpenAI project (e.g. $50 / $100 / $250).
2. **Use one API key** named for OnPro so usage is easy to read.
3. **Train the team**: Summarize once per thread; use chat for follow-ups; use **Update me** only when the day’s brief should refresh.
4. **Review usage weekly** during rollout; adjust if summarize or import dominates spend.
5. **CSV import**: Large files are batched; very wide CSVs cost more per batch — clean columns before import when possible.

## Changing cost vs quality

| Lever | Tradeoff |
|-------|----------|
| Keep `gpt-4o-mini` | Best cost; sufficient for briefs, triage, and structured suggestions |
| Upgrade to `gpt-4o` for summarize only | Better nuance on complex RFQs; ~10× higher token cost for those calls |
| Disable OpenAI | Mock/live fallbacks only; no API spend |

Contact your development partner before changing model defaults in production.

## How Mailroom AI works (important)

**Team-readable guide:** **[MAILROOM.md](./MAILROOM.md)** (keep in sync when behavior changes).

| Layer | Behavior |
|-------|----------|
| **Inbox list** | Gmail loads up to 40 inbox threads for **display only** — no OpenAI call. |
| **Summarize** | You tap **Summarize this thread** → that thread only is sent to OpenAI (all messages in the thread, each body up to **5000 characters**). Result is cached **1 year** in Supabase (`mailroom_thread_scans`). |
| **Agent chat** | Uses the **stored scan** from Summarize — not a fresh read of the inbox. Chat before Summarize is blocked with a prompt to summarize first. |
| **OnPro AI overview** | Does **not** scan the inbox. Only threads you already summarized appear as short summaries + links. |
| **Regenerate** | New email on the thread → **full thread** re-scan (not “new messages only”); updates the stored cache. |

**Database:** run `supabase/migrations/012_mailroom_thread_scans.sql` on your Supabase project for Live scan persistence.

## Related docs

- [BACKEND.md](../BACKEND.md) — Supabase and Live vs Mock
- [development-ledger/sprint-2026-06.md](./development-ledger/sprint-2026-06.md) — feature delivery notes
