# Demo Feedback System

A minimal MVP for a demo submission and feedback system. Users log in with Twitch, submit SoundCloud demos, and earn XP for participation; curators review submissions and manage sessions (open/close). Queue position can be improved by spending XP.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Supabase** (PostgreSQL + Auth storage)
- **Twitch OAuth** (Authentication)
- **Resend** (Email service)
- **Tailwind CSS** (Styling)
- **Vercel** (Deployment)

## Features

### Authentication & roles
- Twitch OAuth authentication
- Role-based access: **user**, **curator**, **tester**
- Cookie-based session management

### Submissions & reviews
- Demo submission (SoundCloud URLs only), with optional description, artist name, song title
- Server-side URL validation (abuse-resistant)
- Edit pending submissions via `/submit?edit=<id>`
- Curator panel: review pending submissions (sound, structure, mix, vibe 0–10), submit reviews
- User dashboard: view own submissions, scores, and reviewed tracks
- SoundCloud oEmbed for in-app playback

### Sessions & carryover
- **Submission sessions**: curator can open/close submissions. When closed, the current session ends.
- **Carryover**: Pending submissions from a closed session are held and automatically join the next session when submissions open again. See `CARRYOVER_BEHAVIOR.md`.

### XP system
- **Per-user XP** stored in `users.xp`
- **Earning XP**: time-based (+5 XP per 5 min when stream is live and submissions open), follow bonus (+10), sub/donation (+20), curator ratings (average 0–10 → 0–60 XP), audience score (0–10 → 0–20 XP)
- **Queue movement**: spend 100 XP per position move (max 3 moves per session); tie-break by presence time
- **Carryover bonus**: +25 XP when your carried-over submission is in the next session
- Curator: **Clear all XP**, **Adjust XP** (tester/curator), **Grant donation XP**
- **XP log**: per-user history of XP changes (source, amount, description)

### Other
- Email confirmation via Resend
- Submissions open/closed controlled via `app_config` (curator toggles in app)

## Prerequisites

1. **Node.js 18+** installed
2. **Supabase account** (free tier)
3. **Twitch Developer account** with OAuth app
4. **Resend account** (free tier)
5. **Vercel account** (for deployment)

## How It Works

### Core Features Overview

**Authentication flow**
- Users sign in via Twitch OAuth. Session is stored in cookies. User records (display name, role, XP) live in the `users` table. Curators and testers are regular users with a different `role` value.

**Submission flow**
- Users submit SoundCloud URLs on `/submit`. Each submission is validated server-side (URL format, domain) and tagged with the current session number. Duplicate prevention applies per user/session/URL. Pending submissions appear in the queue and can be edited before review.

**Review flow**
- Curators fetch pending submissions, rate them (sound, structure, mix, vibe 0–10), and submit reviews. Submissions move to `status: reviewed`. The submitter is awarded curator XP based on the average score.

**Session flow**
- Submissions are open or closed via `app_config.submissions_open`. When closed, the session ends (`ended_at` is set). Pending submissions from that session become carryover. When submissions open again, a new session starts and carryover tracks automatically join it; each carryover user receives +25 XP.

**Queue order**
- The queue is ordered by submit time (`created_at`) by default. When a user clicks "Use my XP", the system reapplies XP-based movement, updates `queue_position` on submissions, and persists `moves_used_this_session` per user.

---

### XP System (Detailed)

XP is a fairness system that lets users improve their position in the queue. It is tied to the Twitch account and persists across sessions.

#### Earning XP

| Source | Amount | Conditions |
|--------|--------|------------|
| **Time XP** | +5 per 5 min | MikeGTC is live on Twitch, submissions are open, and user has a pending track in the queue. Granted when the queue is fetched (per tick of 5 min elapsed since last tick or submit time). |
| **Follow bonus** | +10 | One-time. Granted when `/api/xp/status` detects the user follows MikeGTC and `follow_bonus_granted` is false. |
| **Sub** | +20 | Once per session. Auto-granted when queue is fetched if user is subscribed to MikeGTC and `sub_xp_granted` is false. |
| **Donation** | +20 | Once per session. Curator manually grants via "Grant donation XP" in the curator panel. |
| **Carryover** | +25 | When a pending submission moves to carryover (session closes) and later joins the next session (submissions open). |
| **Curator review** | 10–60 | Based on average of sound, structure, mix, vibe (each 0–10). 9–10 → 60 XP, 8–8.9 → 40, 7–7.9 → 25, 6–6.9 → 10, &lt;6 → 0. Granted when the curator submits the review. XP applies to *future* submissions only (historical behavior). |
| **Audience review** | 0–20 | Based on audience score (0–10). 8–10 → 20 XP, 6–7.9 → 10 XP, &lt;6 → 0. |

#### Spending XP (Queue Movement)

- **Cost**: 100 XP per position move.
- **Limit**: Max 3 moves per session (300 XP total usable per session).
- **Mechanism**: User clicks "Use my XP" on the dashboard. The system:
  1. Loads the current queue ordered by `queue_position` then `created_at`.
  2. Applies movement rules: each user can move up only if they have ≥100 XP per move remaining, have not used their 3 moves, and can pass the person above (XP gap or tie-break).
  3. **XP gap**: You cannot pass someone with ≥100 more XP than you.
  4. **Tie-break**: When XP difference is &lt;100, the user with higher `presence_minutes` in the current session may move above.
  5. Updates `queue_position` on submissions and `moves_used_this_session` in `user_session_xp`.

#### XP Log

- Every XP change is recorded in `xp_log` (source, amount, description). Users can view their log on the dashboard.

#### Curator XP Actions

- **Clear all XP**: Sets every user's XP to 0. Irreversible.
- **Adjust XP**: Add or subtract XP for a user (tester/curator only). Used for testing or corrections.
- **Grant donation XP**: Add +20 XP to a user once per session, representing an in-stream donation.

---

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/twitch` | GET | Start Twitch OAuth |
| `/api/auth/twitch/callback` | GET | Twitch OAuth callback |
| `/api/auth/me` | GET | Current user |
| `/api/auth/logout` | POST | Logout |
| `/api/sessions` | GET | List/current session (curator) |
| `/api/sessions/delete` | POST | Delete session (curator) |
| `/api/settings/submissions` | GET, POST | Submissions open/closed (GET public); POST toggles (curator). Opening moves carryover into new session. |
| `/api/submissions` | GET, POST | User's submissions, create submission |
| `/api/submissions/[id]` | GET | Single submission (owner) |
| `/api/submissions/pending` | GET | Pending submissions (curator) |
| `/api/submissions/queue` | GET | Queue for current session |
| `/api/submissions/reviewed` | GET | Reviewed submissions (user) |
| `/api/submissions/carryover` | GET | Carryover submissions (pending from closed sessions) |
| `/api/reviews` | POST | Submit review (curator) |
| `/api/soundcloud/oembed` | GET | SoundCloud oEmbed proxy |
| `/api/xp` | GET | Current user XP |
| `/api/xp/status` | GET | XP status (time XP, follow) |
| `/api/xp/adjust` | POST | Adjust user XP (curator/tester) |
| `/api/xp/use` | POST | Use XP for queue move |
| `/api/xp/clear-all` | POST | Clear all users' XP (curator) |
| `/api/xp/grant-donation` | POST | Grant donation XP (curator) |
| `/api/xp/log` | GET | Current user XP log |
| `/api/test-db` | GET | Test DB connection |

## Database Schema

**Base schema** (`supabase/schema.sql`):

- **users** – Twitch OAuth user data, `role` (user/curator/tester). After XP setup: `xp`, `follow_bonus_granted`
- **submissions** – Demo submissions (SoundCloud URL, description, artist_name, song_title), `status` (pending/reviewed), `session_number`, `queue_position`
- **reviews** – Curator ratings per submission (sound, structure, mix, vibe)
- **submission_sessions** – Session tracking (`session_number`, `started_at`, `ended_at`); RPCs `get_or_create_current_session()`, `close_current_session()`
- **app_config** – Single row: `submissions_open` (boolean)

**XP additions** (from `supabase/XP_SQL_GUIDE.md`):

- **users**: `xp`, `follow_bonus_granted`
- **user_tokens**, **user_session_xp**, **xp_log** (and related columns on submissions)

RLS is disabled; auth is Twitch OAuth + API with service role server-side.

## Project Structure

```
demo-feedback-system/
├── app/
│   ├── api/                 # API routes (auth, sessions, settings, submissions, reviews, xp, soundcloud, test-db)
│   ├── components/          # Carryover, DashboardFooter, Footer, Queue, XpHelpModal
│   ├── curator/             # Curator panel page
│   ├── dashboard/           # User dashboard page
│   ├── submit/              # Submit / edit submission page
│   ├── layout.tsx
│   ├── page.tsx             # Home / Twitch login
│   └── globals.css
├── lib/
│   ├── supabase/            # admin, client, server
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── resend.ts
│   ├── twitch.ts
│   ├── validators.ts
│   └── xp.ts                # XP constants, queue movement, rating→XP
├── supabase/
│   ├── schema.sql           # Canonical base schema (run first)
│   ├── migrations/          # Optional migration files (XP, tester, etc.)
│   ├── APPLY_TO_SUPABASE.md # How to apply schema
│   └── XP_SQL_GUIDE.md      # XP blocks to run after schema.sql
├── middleware.ts
└── README.md
```

## Documentation

- **supabase/APPLY_TO_SUPABASE.md** – How to apply and change the schema
- **supabase/XP_SQL_GUIDE.md** – XP system SQL (blocks A, B, C)
- **CARRYOVER_BEHAVIOR.md** – Carryover flow when sessions close/open
