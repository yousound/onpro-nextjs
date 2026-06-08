# Mailroom — how it works (team guide)

**Last updated:** June 2026  
**Audience:** Operators, production, client services — not a developer manual.

For OpenAI billing and workspace-wide AI, see **[AI usage and costs](./AI_USAGE_AND_COSTS.md)**.

---

## What Mailroom is for

Mailroom connects your **Gmail inbox** to OnPro so you can:

- See client and vendor email threads in one place
- Let the **OnPro agent** read a thread when **you** ask it to
- Get a short **summary**, **suggested actions** (projects, jobs, POs, tasks, etc.), and optional **multi-step workflows**
- Chat with the agent about that thread after it has been summarized

Mailroom does **not** automatically read or act on every email in your inbox.

---

## The golden rule

> **No Summarize → no AI scan.**

The agent only “reads” email when someone on your team taps **Summarize this thread** (or **Regenerate summary** after new mail). Browsing the inbox, opening a thread, or leaving Mailroom open does **not** send emails to AI.

---

## Step 1 — Connect Gmail

1. Open **Mailroom** in OnPro.
2. Tap **Connect Gmail** and complete Google sign-in.
3. Your inbox loads in the thread list (up to **40 recent inbox threads** for display).

**What AI does here:** nothing. This step only links Gmail and loads messages for you to read in the app.

---

## Step 2 — Browse and read (no AI)

| What you do | What happens |
|-------------|----------------|
| Scroll the thread list | Gmail threads shown for reading and triage |
| Open a thread | Full conversation appears in the email pane — same as reading in Gmail |
| Reply from Mailroom | Your reply is handled in the app (per your Live/Mock setup) |

The agent panel may say it **hasn’t read the thread yet** until you summarize. That is expected.

---

## Step 3 — Summarize (the only AI scan)

When a thread needs triage or action:

1. Select the thread.
2. Tap **Summarize this thread**.

**What gets sent to AI (that thread only):**

- **Every message** currently in that thread in Mailroom (not the whole inbox)
- Each message body up to **5,000 characters** (very long emails are trimmed for the scan)
- Subject, participants, and any project/job links already on the thread

**What you get back:**

- An **AI summary** at the top of the thread
- **Suggested actions** (cards you can review, apply, or dismiss)
- Sometimes a **workflow plan** (ordered steps — e.g. create project → jobs → estimate)
- A **stored scan** saved for your account for up to **one year** (so we don’t pay to re-read the same unchanged thread)

**What does *not* happen:**

- Other inbox threads are not scanned
- OnPro AI (Overview) does not receive your full inbox — only threads you have summarized (see below)

---

## Step 4 — Chat with the agent (after Summarize)

After a successful summarize:

- Use the **agent chat** on that thread for questions (“any client tasks here?”) or clear requests (“create a project from this thread”).
- The agent uses the **saved scan** from Summarize — it does **not** pull a fresh copy from Gmail on every chat message.
- If you try to chat **before** Summarize, the agent will ask you to summarize first.

**Tips:**

- Ask questions in plain language; the agent won’t create drafts until you clearly ask it to.
- Use **pending suggestions** on the panel before asking for duplicates.

---

## When new emails arrive on the same thread

Example: you summarized yesterday; today **3 new replies** land in Gmail.

| Situation | What to do |
|-----------|----------------|
| You refresh / reload Mailroom and see the new messages | Tap **Regenerate summary** |
| You chat without regenerating | The agent may tell you the scan is out of date — regenerate first |

**Important:** Regenerate does **not** scan “only the 3 new emails.” It runs a **new full scan** of the whole thread (all messages now in Mailroom), then **replaces** the stored summary and scan. That keeps the agent accurate when context spans the full conversation.

After regenerate, chat uses the **new** stored scan.

---

## Summarize again vs cache (same thread, no new mail)

If **nothing new** was added to the thread and you open Summarize again:

- OnPro can return the **cached** result (no new AI charge for that thread version).
- Use **Regenerate summary** when you **want** a fresh pass (e.g. you changed your mind, or you want new suggestions).

---

## Suggested actions and workflows

After Summarize:

- **Suggestions** are drafts (project, job, vendor quote, PO, task, etc.). Review before applying.
- **Workflow** is an ordered plan when the RFQ is multi-step. Approve steps one at a time.
- **Apply** creates or updates items in OnPro per your permissions.
- Removing or dismissing suggestions updates what you see; regenerating can surface new ones.

---

## How Mailroom relates to OnPro AI (Overview)

| Area | Inbox emails | Summarized threads |
|------|----------------|-------------------|
| **Mailroom** | Listed for you to read; **not** auto-scanned | Full summarize + chat + suggestions |
| **OnPro AI (Overview)** | **Not** loaded into the assistant | Short summary + link **only for threads you already summarized** |

So the workspace assistant can mention a Mailroom thread you summarized, but it will **not** secretly read unread inbox mail.

---

## What Mailroom does not do (today)

- Scan the entire inbox with AI
- Watch Gmail in the background and auto-summarize new mail
- Read email attachments’ file contents (names may appear; not full PDF/Excel parsing in the scan)
- Guarantee the agent saw email older than what’s in the thread loaded in Mailroom (always **Regenerate** after major new replies)
- Replace legal review — suggestions are starting points for your team

---

## Recommended habits for the team

1. **Summarize once** when a thread is “ready for triage,” not on every single reply if you want to control AI cost.
2. **Regenerate** when new emails change the deal (new PO, revised qty, client approval).
3. **Chat after summarize** for follow-ups instead of re-summarizing without reason.
4. **Connect one Gmail account per operator** as designed — shared inbox practices should match how you connect Mailroom.
5. **Train new users** with this doc: opening Mailroom ≠ AI has read the email.

---

## Quick FAQ

**Does opening my inbox cost AI money?**  
No. Only **Summarize** / **Regenerate summary** on a specific thread does.

**Can the agent see emails I never summarized?**  
No. Not in Mailroom chat, and not in the full inbox via OnPro AI.

**We summarized last week; three emails came in today. What now?**  
Tap **Regenerate summary**. The agent will re-read the **full** thread and update the stored scan.

**Is the old summary merged with only the new emails?**  
No. Regenerate is a full new scan of all messages in the thread, then the cache is updated.

**How long is a scan remembered?**  
Up to **one year** for the same version of the thread. New messages = new version = regenerate.

**Who can see scans?**  
Scans are stored per **your OnPro login** (Live mode). Other users don’t share your Gmail connection unless you use a shared account.

---

## For IT / onboarding checklist

- [ ] Gmail OAuth connected in Mailroom  
- [ ] Supabase migration for scan storage applied in Live (`012_mailroom_thread_scans`)  
- [ ] OpenAI API key configured for Live AI  
- [ ] Team read this guide and **[AI usage and costs](./AI_USAGE_AND_COSTS.md)**

---

## Keeping this document accurate

When Mailroom or AI behavior changes in the product, update **this file** and the **Last updated** line at the top.

**Product behavior to re-check when editing:**

- Summarize is manual per thread only  
- Regenerate = full thread re-scan, not inbox-wide  
- Chat requires a current scan  
- Overview assistant only sees summarized threads  
- Body limit per message (currently 5,000 characters) and cache duration (currently 1 year)

*Developer cross-reference: Mailroom UI `mailroom-view.tsx`; summarize API `/api/mailroom/summarize`; chat API `/api/mailroom/chat`; scan storage `mailroom_thread_scans`.*
