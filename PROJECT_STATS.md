# OnPro project statistics

Snapshot of both codebases: **when work started** (filesystem), **when it was committed** (git), and **lines of code**. Generated from local machine metadata and git history on **24 May 2026**.

Paths:

| Project | Repository |
|---------|------------|
| **Desktop (Next.js)** | `/Users/ric/Projects/onpro-nextjs` (this repo) |
| **iOS** | `/Users/ric/Projects/OnPro` |

---

## Summary

| | **First code on disk** | **First git commit** | **Days before first commit** | **App source (LOC)** | **Git commits** |
|--|------------------------|----------------------|------------------------------|----------------------|-----------------|
| **onpro-nextjs** | 14 May 2026, ~12:11 PDT | 14 May 2026, 12:11 PDT | Same day | ~19,700 (TS/TSX in `src/`) | 5 |
| **OnPro (iOS)** | 14 Jan 2026, ~12:59 PST | 18 Feb 2026, 11:33 PST | **~35 days** | ~21,200 (Swift in `OnPro/`) | 2 |

---

## onpro-nextjs (this repo)

Desktop shell — Next.js 15, TypeScript/React, mock data under `src/lib/mock/`.

### First code written (filesystem birth time)

macOS records when each file was **created on disk** (not when it was committed). Copying or re-creating a file resets this.

| Milestone | When | File / note |
|-----------|------|-------------|
| Scaffold (Create Next App) | **14 May 2026, 12:11:23 PDT** | `src/app/layout.tsx`, `package.json`, etc. |
| First OnPro-specific code | **14 May 2026, 12:17:27 PDT** | `src/lib/types/project.ts` |
| Latest uncommitted work (at snapshot) | **24 May 2026** | e.g. `project-person-permissions.ts`, job modals |

**Files created by day (birth date):**

| Date | Files created |
|------|---------------|
| 14 May 2026 | 59 |
| 15 May 2026 | 32 |
| 23 May 2026 | 13 |
| 24 May 2026 | 11 |

### Git commits

| Date (committed) | Message |
|------------------|---------|
| 2026-05-14 12:11:57 -0700 | Initial commit from Create Next App |
| 2026-05-15 14:00:30 -0700 | Add OnPro desktop shell with mock data parity to iOS workflows. |
| 2026-05-15 15:55:00 -0700 | Expand workspace parity: People, permissions, jobs, and attachments. |
| 2026-05-15 19:13:55 -0700 | Expand desktop shell: Overview home, alerts, notifications, and messaging. |
| 2026-05-17 10:39:48 -0700 | Move project detail summary into client card. |

Author and committer dates match on all commits (no backdated author times).

### Lines of code

| Category | Lines | Files |
|----------|------:|------:|
| **TypeScript / TSX (`src/`)** | **~19,654** | ~90 |
| CSS | ~67 | 1 |
| Python (`scripts/`) | ~341 | 1 |
| Markdown (docs) | ~35 | 3 |
| `package-lock.json` | ~6,287 | 1 (dependencies, not app code) |

**Practical app total:** ~**20,000** lines (TS/TSX + CSS + scripts), excluding lockfile.

---

## OnPro iOS (`/Users/ric/Projects/OnPro`)

Native SwiftUI app — Supabase auth, Stream Chat–ready, mock data and project workflows.

### First code written (filesystem birth time)

| Milestone | When | File / note |
|-----------|------|-------------|
| **First line of app code** | **14 Jan 2026, 12:59:21 PST** | `OnPro/App/OnProApp.swift` |
| Same session start | 14 Jan 2026, 12:59:22 PST | `OnPro/App/ContentView.swift` |
| End of first major session | 14 Jan 2026, ~20:11 PST | App icon assets (96 files that day) |
| More files before commit | 15–18 Feb 2026 | 38 files (prep for initial commit) |
| Second commit day | 23 Feb 2026 | 9 files |

**Gap:** most of the app shell was written **~35 days** before the first git commit.

**Files created by day (birth date):**

| Date | Files created |
|------|---------------|
| 14 Jan 2026 | 96 |
| 15 Jan 2026 | 1 |
| 15 Feb 2026 | 2 |
| 17 Feb 2026 | 26 |
| 18 Feb 2026 | 10 |
| 23 Feb 2026 | 9 |

### Git commits

| Date (committed) | Message |
|------------------|---------|
| 2026-02-18 11:33:07 -0800 | Initial commit: OnPro iOS app with Supabase auth, Stream Chat ready, third-party integrations guide |
| 2026-02-23 18:40:21 -0800 | App icon, Supreme asset, smart attachments, calendar, tab bar, messages, docs, profile |

### Lines of code

| Category | Lines | Files |
|----------|------:|------:|
| **Swift (`OnPro/`)** | **~21,236** | ~84 |
| Markdown (setup / integration docs) | ~1,753 | 12 |
| plist / json config | ~260 | — |

**Practical app total:** ~**21,200** lines of Swift.

---

## How these numbers were measured

- **First code:** oldest macOS **file birth time** among project source files (excludes `node_modules`, `.git`, `.next`).
- **Commits:** `git log` on each repository.
- **LOC:** `wc -l` on source extensions; excludes `node_modules` and generated `.next` output.

### Caveats

- Birth time reflects **this machine**; clones, copies, or “Save As” can reset it.
- Code written elsewhere before the repo existed will not appear.
- **onpro-nextjs** had substantial **uncommitted** changes at the time of this snapshot; LOC counts include the working tree, not only what is in git.
- `package-lock.json` inflates total file counts for the Next.js repo but is not application code.

---

## Regenerating

From the Next.js repo root:

```bash
# Lines in src/
find ./src -name '*.ts' -o -name '*.tsx' | xargs wc -l | tail -1

# Oldest source file (birth time)
find ./src -name '*.ts' -o -name '*.tsx' | while read f; do stat -f '%B %SB %N' "$f"; done | sort -n | head -3

# Commits
git log --format='%ai | %s'
```

For iOS, run the same patterns under `/Users/ric/Projects/OnPro` with `*.swift` and `./OnPro`.

---

## Related

Partner financial tracking lives in the private **[Development Ledger](/ledger)** — see [README.md](./README.md#partner-development-ledger-private).
