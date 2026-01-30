# Demo Feedback System

A minimal MVP for a demo submission and feedback system that can be embedded into a Framer website via iframe. Users log in with Twitch, submit SoundCloud demos, and earn XP for participation; curators review submissions and manage sessions (open/close). Queue position can be improved by spending XP.

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
- Iframe-embeddable for Framer
- Submissions open/closed controlled via `app_config` (curator toggles in app)

## Prerequisites

1. **Node.js 18+** installed
2. **Supabase account** (free tier)
3. **Twitch Developer account** with OAuth app
4. **Resend account** (free tier)
5. **Vercel account** (for deployment)

## Setup Instructions

### 1. Clone and Install

```bash
cd demo-feedback-system
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. **Base schema**: In **SQL Editor**, run the entire contents of `supabase/schema.sql`. See `supabase/APPLY_TO_SUPABASE.md` for step-by-step instructions.
3. **XP system**: Run the SQL blocks from `supabase/XP_SQL_GUIDE.md` in order (Block A: XP columns/tables, Block B: tester role). Block C is optional (manual clear-all).
4. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Twitch OAuth Setup

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Create a new application
3. Set OAuth Redirect URLs:
   - `http://localhost:3000/api/auth/twitch/callback` (for local)
   - `https://yourdomain.vercel.app/api/auth/twitch/callback` (for production)
4. Copy Client ID and Client Secret

### 4. Resend Setup

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your domain (or use their test domain for development)
3. Copy your API key
4. Note your "from" email address

### 5. Environment Variables

Create a `.env.local` file in the root (see `.env.local.example`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Twitch OAuth
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
NEXT_PUBLIC_TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/twitch/callback

# Resend
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

**Base schema** (`supabase/schema.sql`):

- **users** – Twitch OAuth user data, `role` (user/curator/tester). After XP setup: `xp`, `follow_bonus_granted`
- **submissions** – Demo submissions (SoundCloud URL, description, artist_name, song_title), `status` (pending/reviewed), `session_number`
- **reviews** – Curator ratings per submission (sound, structure, mix, vibe)
- **submission_sessions** – Session tracking (`session_number`, `started_at`, `ended_at`); RPCs `get_or_create_current_session()`, `close_current_session()`
- **app_config** – Single row: `submissions_open` (boolean)

**XP additions** (from `supabase/XP_SQL_GUIDE.md`):

- **users**: `xp`, `follow_bonus_granted`
- **user_tokens**, **user_session_xp**, **xp_log** (and related columns on submissions)

RLS is disabled; auth is Twitch OAuth + API with service role server-side.

## Making a User a Curator or Tester

1. Go to **Supabase Dashboard → Table Editor → users**
2. Find the user by `twitch_id` or `display_name`
3. Set **role** to `curator` or `tester`
4. Save

Curators can close/open submissions, review, clear all XP, adjust XP, grant donation XP. Testers can adjust XP for testing.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **New Project** and import your GitHub repository
3. Add all environment variables from `.env.local`
4. Set:
   - `NEXT_PUBLIC_TWITCH_REDIRECT_URI` = `https://yourproject.vercel.app/api/auth/twitch/callback`
   - `NEXT_PUBLIC_APP_URL` = `https://yourproject.vercel.app`
5. Deploy

### 3. Twitch OAuth

Add your production callback URL to the Twitch app’s OAuth Redirect URLs.

## Embedding in Framer

1. In Framer, add an **Embed** component
2. Set the URL to your deployed app: `https://yourproject.vercel.app`
3. The app will work in the iframe

## Security Features

- Server-side SoundCloud URL validation (no frontend bypass)
- Duplicate submission prevention (per user/session/URL)
- Role-based access control (user / curator / tester)
- Cookie-based session management
- Enter key prevention on submission form where appropriate

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
| `/api/submissions` | GET, POST | User’s submissions, create submission |
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
| `/api/xp/clear-all` | POST | Clear all users’ XP (curator) |
| `/api/xp/grant-donation` | POST | Grant donation XP (curator) |
| `/api/xp/log` | GET | Current user XP log |
| `/api/test-db` | GET | Test DB connection |

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

## Troubleshooting

**Twitch OAuth not working**
- Redirect URI must match exactly in the Twitch console
- Check all Twitch env vars in Vercel/local

**Email not sending**
- Check Resend API key and domain verification
- Ensure `RESEND_FROM_EMAIL` is verified

**Database / “can’t see users or submissions”**
- Run `supabase/schema.sql` first, then XP blocks from `XP_SQL_GUIDE.md`
- Users and submissions are in **Table Editor** → `users`, `submissions` (not Supabase Auth)
- Confirm `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` match the project
- Use `/api/test-db` to verify the app can read from the DB

## License

MIT
