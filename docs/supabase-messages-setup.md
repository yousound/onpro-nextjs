# Supabase setup — in-app Messages (Live mode)

The **Messages** page uses Supabase in **Live** mode only. **Mock** mode keeps using demo data + `localStorage`.

## 1. Run SQL migrations

In **Supabase Dashboard → SQL Editor**, run these files in order (paste full file contents):

| Order | File |
|-------|------|
| 1 | `supabase/migrations/008_workspace_memberships.sql` |
| 2 | `supabase/migrations/009_in_app_messages.sql` — **safe / non-destructive** (no `DROP TABLE`, no row deletes) |
| 3 | `supabase/migrations/010_storage_message_images.sql` |

`009` only adds tables, columns, and policies **if missing**. Supabase should not show a destructive warning for `009`.

Optional (only if you used the full iOS `SUPABASE_SCHEMA.sql` with old policy names like `conversations_all_own`):

| | `009b_in_app_messages_rls_refresh.sql` — **drops old policies only**; then run `009` again |

If you already applied the full schema from `OnPro/SUPABASE_SCHEMA.sql`, run `009` first; use `009b` only if you hit duplicate or conflicting RLS policy errors.

**Requires** (from earlier migrations):

- `profiles`, `contacts`, `projects`

**If `010` failed with `workspace_memberships does not exist`:** run `008` first, then **run `010` again** (it is idempotent). Operator photo uploads work after the first `010` run; client/member uploads need `008` + the second `010` run.

## 2. Storage bucket

Public bucket **`message-images`**:

| Setting | Value |
|---------|--------|
| Max size | **3 MB** |
| MIME types | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

Create it in the Dashboard or run `010_storage_message_images.sql` (syncs the same limits). Upload paths:

```text
{operator_user_id}/{conversation_id}/{uuid}.jpg
```

If the bucket already exists in the Dashboard, run the full `010` file — it syncs limits via `ON CONFLICT` and only **adds** missing policies (no destructive warning).

Optional `010b_storage_message_images_policies_refresh.sql` only if you must **replace** broken policies (uses `DROP POLICY`).

**Minimum for operator-only chat photos:** `009` + `010` (with `008` skipped, member storage policies are skipped until you run `008` and re-run `010`).

## 3. App env (already used for Live)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Toggle **Live** in the app (not Mock). Sign in as an operator.

## 4. What gets stored

| Data | Table / storage |
|------|------------------|
| Threads | `conversations` |
| People in thread | `conversation_participants` → `contacts` |
| Text + smart cards | `messages.content`, `messages.smart_attachment` |
| Photos | `messages.image_urls` (JSON array of public URLs) + `message-images` bucket |

Deletes in Live **remove rows from `messages`** (and update `conversations.last_message_preview`). Only messages you sent (`sender_user_id` = your auth user) can be deleted.

## 5. Quick test

1. Live mode → **People** — ensure you have at least one contact.
2. **Messages** → New message → pick a contact → send text.
3. Attach a photo (image icon) — should upload then appear in the thread.
4. Click photo → dark fullscreen viewer; use **Download**.
5. Hover your message → delete image or whole message; refresh — changes should persist.

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| Empty inbox in Live | Run `009`; confirm signed-in user owns rows in `conversations` or has `workspace_memberships` |
| “Failed to load messages” | RLS: `messages_operator_all` / `messages_member_select` |
| Image upload fails | Run `010`; bucket `message-images`; path must match `{ownerId}/{conversationId}/...` |
| Schema cache errors | Re-run migration; Settings → API → reload schema in Supabase |

## 7. Not wired yet

- Realtime subscriptions (refresh is manual after send/delete)
- Add-member → `conversation_participants` API (still local in Mock)
- Stream Chat (see `docs/MESSAGING_DECISION.md`)
