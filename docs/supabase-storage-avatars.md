# Supabase Storage — avatars (step by step)

Use this when wiring profile/contact avatars to a real bucket instead of base64 in Postgres.

## Prerequisites

- Supabase project already has `profiles` / auth working (`NEXT_PUBLIC_SUPABASE_*` in `.env.local`).
- Migrations `004_profiles_onboarding.sql` already applied.

---

## Step 1 — Create the bucket (Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Storage** → **Buckets** → **New bucket**.
3. Settings:
   - **Name:** `avatars`
   - **Public bucket:** **On** (simplest; URLs work in `<img src>` everywhere)
   - **File size limit:** `5` MB (optional; migration also sets 5MB)
   - **Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp` (optional)
4. Click **Create bucket**.

You can skip the UI and use only Step 2 SQL — it creates the bucket too.

---

## Step 2 — Policies (SQL Editor)

1. **SQL Editor** → **New query**.
2. Paste the full contents of:

   `supabase/migrations/005_storage_avatars.sql`

3. Click **Run**.
4. Confirm under **Storage** → **Policies** you see policies on `storage.objects` for bucket `avatars`.

**Path rule:** files must live at `{your-user-uuid}/avatar.jpg` (first folder = `auth.uid()`).

---

## Step 3 — Reload API schema (if needed)

**Project Settings** → **API** → **Reload schema** (same as after migration 004).

---

## Step 4 — No new env vars

Storage uses the same project URL and anon key:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Service role is **not** required for user uploads when RLS policies are correct.

---

## Step 5 — App upload helper (already in repo)

File: `src/lib/supabase/upload-avatar.ts`

- Uploads to `avatars/{userId}/avatar.{ext}`
- Returns public URL for `profiles.avatar_url` / `contacts.avatar_url`

---

## Step 6 — Wire the UI

Call `uploadAvatarForUser(file)` before saving profile/onboarding:

| Screen | When |
|--------|------|
| Operator onboarding step 1 | On **Next**, upload file then save URL in `avatar_url` |
| Client onboarding step 1 | Same |
| Settings (optional) | On profile save |
| People modals (optional) | On contact save — path `{userId}/contacts/{contactId}.ext` later |

Replace `FileReader` / `createObjectURL` flows so the DB stores an `https://...supabase.co/storage/v1/object/public/avatars/...` URL, not base64.

---

## Step 7 — Test

1. Sign in (Live mode, not Mock).
2. Onboarding step 1 → pick a small JPG → continue.
3. **Storage** → **avatars** → folder = your user UUID → file `avatar.jpg` (or `.png`).
4. **Table Editor** → `profiles` → `avatar_url` should be the public storage URL.
5. Sidebar / Settings should show the image after refresh.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `new row violates row-level security` | Path must start with `auth.uid()`; user must be signed in. |
| `Bucket not found` | Run `005_storage_avatars.sql` or create bucket `avatars`. |
| `payload too large` | Use image &lt; 5MB or raise `file_size_limit` on bucket. |
| Image broken in UI | Bucket must be **public**, or switch to signed URLs. |

---

## Optional: private bucket

1. Set bucket **public** = off.
2. After upload, use `createSignedUrl` (e.g. 1 year) and store that URL, or store path only and sign on read.
3. Remove `avatars_public_read` policy; add authenticated `SELECT` on own folder only.

---

## iOS parity

Store the same public URL in `profiles.avatar_url` from Swift using `supabase.storage.from("avatars").upload(...)`. Same path convention keeps one avatar per user across web and iOS.
