# Supabase Connection Fix Guide

## Problem
The app wasn't connecting to Supabase because Row Level Security (RLS) policies were enabled and configured for Supabase Auth, but this app uses Twitch OAuth instead.

## Solution Applied

1. **Updated `supabase/schema.sql`** - Disabled RLS on all tables since we use the admin client with service role key
2. **Improved error handling** - Added better error messages in the admin client
3. **Created test endpoint** - Added `/api/test-db` to verify the connection

## Steps to Fix

### 1. Update Supabase Database Schema

You need to run the updated schema in your Supabase project:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the following SQL (or the entire updated `supabase/schema.sql` file):

```sql
-- Disable RLS on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
```

5. Click **Run** to execute the SQL

**OR** run the entire updated `supabase/schema.sql` file if you haven't set up the tables yet.

### 2. Test the Connection

After updating the schema, test the connection:

1. Make sure your dev server is running: `npm run dev`
2. Open your browser and go to: `http://localhost:3000/api/test-db`
3. You should see a JSON response like:
   ```json
   {
     "success": true,
     "message": "Supabase connection is working!",
     "stats": {
       "users": 0,
       "submissions": 0,
       "reviews": 0
     }
   }
   ```

If you see an error, check:
- Environment variables in `.env.local` are correct
- The schema was applied in Supabase
- Your Supabase project is active

### 3. Verify Environment Variables

Make sure your `.env.local` file has:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (not the anon key!)

You can find these in Supabase Dashboard > Settings > API

## Why This Fix Works

- **RLS was blocking queries**: The original RLS policies checked for Supabase Auth tokens (`auth.uid()`, `auth.jwt()`), but this app uses Twitch OAuth
- **Admin client bypasses RLS**: The service role key should bypass RLS, but disabling it ensures no conflicts
- **Access control is server-side**: All authentication and authorization is handled in the API routes, so RLS isn't needed

## Where to View Users and Submissions in Supabase

**Important:** This app uses **Twitch OAuth**, not Supabase Auth. User and submission data live in your **custom tables**, not in Supabase’s built‑in Auth.

| Where to look | What you’ll see |
|---------------|------------------|
| **Table Editor → `users`** | Twitch users (login, display name, role). **This is where your users are.** |
| **Table Editor → `submissions`** | Demo submissions (SoundCloud URLs, status). **This is where “interactions” / submissions live.** |
| **Table Editor → `reviews`** | Curator reviews (scores). |
| **Authentication → Users** | Supabase Auth (GoTrue) users. **Always empty for this app** — we don’t use it. |

If you only check **Authentication → Users**, you’ll see no one. Always use **Table Editor** and open the `users` and `submissions` tables to verify sign‑ups and new submissions.

### Same project for app and dashboard

The app uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`. Ensure that:

- Your Supabase Dashboard is open for **the same project** as in `.env.local`.
- You’ve run `supabase/schema.sql` in that project’s SQL Editor.

### Quick check

1. Run `npm run dev` and open `http://localhost:3000/api/test-db`.
2. The response includes `stats.users`, `stats.submissions`, `stats.reviews`.
3. If those counts match what you see in Table Editor, the app and dashboard are using the same database.

## How to Change User Roles in Supabase

To change a user's role from `user` to `curator` (or vice versa):

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Table Editor** (not Authentication → Users)
4. Open the `users` table
5. Find the user you want to modify by:
   - Searching by `display_name` (their Twitch display name)
   - Searching by `twitch_id` (their Twitch user ID)
6. Click on the row to edit it
7. Find the `role` field and change it:
   - `user` → regular user (can submit demos)
   - `curator` → curator (can review submissions and manage submission periods)
8. Click **Save** or press Enter

**Important Notes:**
- Users must log out and log back in for role changes to take effect (the app caches the user role in the session)
- Only users with `curator` role can access the curator panel at `/curator`
- Curators can toggle submissions open/closed using the button in the curator panel
- The role field only accepts `user` or `curator` values (enforced by database constraint)

### Alternative: Using SQL Editor

You can also change roles using SQL:

```sql
-- Change a user to curator by display name
UPDATE users 
SET role = 'curator' 
WHERE display_name = 'YourTwitchUsername';

-- Change a user to curator by twitch_id
UPDATE users 
SET role = 'curator' 
WHERE twitch_id = '12345678';

-- Change back to regular user
UPDATE users 
SET role = 'user' 
WHERE display_name = 'YourTwitchUsername';
```

## Next Steps

After fixing the connection:
1. Test user registration via Twitch OAuth
2. Test submitting a demo
3. Test the curator panel
4. Check that data appears in **Supabase Dashboard → Table Editor** (`users`, `submissions`, `reviews`), not in Authentication → Users
5. Assign curator role to a user (see above)
6. Test the submission open/close toggle in the curator panel