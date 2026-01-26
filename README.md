# Demo Feedback System

A minimal MVP for a demo submission and feedback system that can be embedded into a Framer website via iframe.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Supabase** (PostgreSQL + Auth storage)
- **Twitch OAuth** (Authentication)
- **Resend** (Email service)
- **Tailwind CSS** (Styling)
- **Vercel** (Deployment)

## Features

- ✅ Twitch OAuth authentication
- ✅ Demo submission (SoundCloud URLs only)
- ✅ Server-side URL validation (abuse-resistant)
- ✅ Email confirmation via Resend
- ✅ Curator panel for reviewing submissions
- ✅ User dashboard to view submissions and scores
- ✅ Iframe-embeddable for Framer
- ✅ Role-based access control (user/curator)

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

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the **SQL Editor**, run the entire contents of `supabase/schema.sql` (single canonical schema for all tables, functions, and RPCs). See `supabase/APPLY_TO_SUPABASE.md` for step-by-step instructions and how to change or re-apply the schema.
3. Go to Settings > API and copy:
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

Create a `.env.local` file in the root directory:

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

The system uses three main tables:

- **users**: Stores Twitch OAuth user data and roles
- **submissions**: Stores demo submissions with SoundCloud URLs
- **reviews**: Stores curator ratings (sound, structure, mix, vibe)

See `supabase/schema.sql` for the complete schema (indexes, triggers; RLS is disabled).

## Making a User a Curator

To assign curator role to a user:

1. Go to Supabase Dashboard > Table Editor > `users`
2. Find the user by their `twitch_id` or `display_name`
3. Edit the `role` field and change it from `user` to `curator`
4. Save

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
2. Click "New Project"
3. Import your GitHub repository
4. Add all environment variables from `.env.local`
5. Update `NEXT_PUBLIC_TWITCH_REDIRECT_URI` to your Vercel URL:
   ```
   NEXT_PUBLIC_TWITCH_REDIRECT_URI=https://yourproject.vercel.app/api/auth/twitch/callback
   ```
6. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
7. Deploy

### 3. Update Twitch OAuth Redirect URI

After deployment, add your production callback URL to your Twitch app's OAuth Redirect URLs list.

## Embedding in Framer

1. In Framer, add an **Embed** component
2. Set the URL to your deployed Vercel app: `https://yourproject.vercel.app`
3. The app will automatically work in the iframe

## Security Features

- ✅ Server-side SoundCloud URL validation (no frontend bypass)
- ✅ Duplicate submission prevention (1-hour cooldown)
- ✅ Role-based access control
- ✅ Cookie-based session management
- ✅ Enter key prevention on submission form

## API Routes

- `GET /api/auth/twitch` - Initiate Twitch OAuth
- `GET /api/auth/twitch/callback` - Twitch OAuth callback
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/submissions` - Get user's submissions
- `POST /api/submissions` - Create new submission
- `GET /api/submissions/pending` - Get pending submissions (curator only)
- `POST /api/reviews` - Submit review (curator only)

## Project Structure

```
demo-feedback-system/
├── app/
│   ├── api/              # API routes
│   ├── curator/          # Curator panel page
│   ├── dashboard/        # User dashboard
│   ├── submit/           # Submission page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home/login page
│   └── globals.css       # Global styles
├── lib/
│   ├── supabase/         # Supabase clients
│   ├── auth.ts           # Auth helpers
│   ├── validators.ts     # Validation schemas
│   └── resend.ts         # Email service
├── supabase/
│   └── schema.sql        # Database schema
└── README.md
```

## Troubleshooting

### Twitch OAuth not working
- Verify redirect URI matches exactly in Twitch console
- Check environment variables are set correctly
- Ensure callback URL is accessible

### Email not sending
- Verify Resend API key is correct
- Check domain verification in Resend dashboard
- Ensure `RESEND_FROM_EMAIL` is verified

### Database errors / "Supabase can't see users or submissions"
- Run `supabase/schema.sql` in Supabase SQL Editor (creates tables, **RLS is disabled** for this app)
- **Users and submissions** are in **Table Editor** → `users` and `submissions`, **not** in Authentication → Users (we use Twitch OAuth)
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` match the project you're viewing in the dashboard
- Hit `/api/test-db` to confirm the app can read from the same DB

## License

MIT
# feedback-system
