# XP System – Supabase SQL Editor Guide

This guide explains **what to run in the Supabase SQL Editor** so that:

- **Each user’s XP is stored individually** in `users.xp` (one row per user, one XP value per row).
- The **Clear all XP** button (curator) works.
- All XP features (time-based, carryover, follow, sub, donation, curator ratings) work.

---

## 1. Prerequisites

You must have run the **base schema** first:

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Open `supabase/schema.sql` in this repo.
3. Copy the **entire file** and paste it into a new query.
4. Click **Run**.  
   This creates `users`, `submissions`, `app_config`, session RPCs, etc.  
   Ensure `update_updated_at_column()` exists (it’s defined in `schema.sql`).

---

## 2. XP schema (per-user XP)

Run **Block A** (Section 5) **once**.  
**XP is stored per user** in `users.xp`; each user row has its own `xp` value.

Block A adds `users.xp`, `users.follow_bonus_granted`, `user_tokens`, `user_session_xp`, and XP-related columns on `submissions`.

**Verify per-user XP:** run `SELECT id, display_name, xp FROM users;` — you should see one row per user, each with its own `xp`.

---

## 3. Tester role

Run **Block B** (Section 5) **once**. Allows the `tester` role and keeps the role constraint consistent.

**Optional – set a user as curator** (required for the **Clear all XP** button):

```sql
UPDATE users SET role = 'curator' WHERE twitch_id = 'YOUR_TWITCH_ID';
```

---

## 4. Clear all XP

The **Clear all XP** button (curator panel) uses the API only: it fetches all user IDs and runs `UPDATE users SET xp = 0` in batches. **No extra SQL is required** for the button to work.

To **clear all XP manually** from the SQL Editor, run **Block C** (Section 5), then:

```sql
SELECT clear_all_user_xp();
```

---

## 5. Copy-paste SQL (run in Supabase SQL Editor, in order)

**Prerequisite:** `schema.sql` has been run (base tables, `update_updated_at_column`).

---

### Block A – XP schema (per-user XP)

Run this **first**. Adds `users.xp` (each user’s XP stored individually) and related tables.

```sql
-- Block A: XP system (users.xp per user, user_tokens, user_session_xp, submissions columns)
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follow_bonus_granted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
DROP TRIGGER IF EXISTS update_user_tokens_updated_at ON user_tokens;
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_tokens DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS user_session_xp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  sub_xp_granted BOOLEAN NOT NULL DEFAULT false,
  donation_xp_granted BOOLEAN NOT NULL DEFAULT false,
  moves_used_this_session INTEGER NOT NULL DEFAULT 0,
  presence_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_number)
);
CREATE INDEX IF NOT EXISTS idx_user_session_xp_user_session ON user_session_xp(user_id, session_number);
DROP TRIGGER IF EXISTS update_user_session_xp_updated_at ON user_session_xp;
CREATE TRIGGER update_user_session_xp_updated_at
  BEFORE UPDATE ON user_session_xp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE user_session_xp DISABLE ROW LEVEL SECURITY;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_xp_snapshot INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS carryover_bonus_granted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_based_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_time_xp_tick_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_score DECIMAL(3,1) CHECK (audience_score IS NULL OR (audience_score >= 0 AND audience_score <= 10));
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_rating_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_rating_at TIMESTAMP WITH TIME ZONE;
```

---

### Block B – Tester role

Run this **second**. Allows `tester` role (and keeps role constraint consistent).

```sql
-- Block B: Tester role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'curator', 'tester'));
```

**Optional – set a user as curator (required for Clear all XP button):**

```sql
UPDATE users SET role = 'curator' WHERE twitch_id = 'YOUR_TWITCH_ID';
```

---

### Block D – External XP (for “Unused external” in dashboard footer)

Run this if you use donation/sub XP and want “Unused external” shown in the XP footer.

```sql
-- Block D: external XP per session (donation, sub)
ALTER TABLE user_session_xp ADD COLUMN IF NOT EXISTS external_xp_this_session INTEGER NOT NULL DEFAULT 0;
```

---

### Block E – Queue position (manual “Use my XP” only)

Required so the queue order reflects only **user-initiated** “Use my XP” actions, not automatic XP-based reordering.

```sql
-- Block E: queue order stored only when user clicks "Use my XP"
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS queue_position INTEGER;
```

---

### Block C – Optional: manual “clear all XP” from SQL

Run this **only if** you want to clear all XP from the SQL Editor with `SELECT clear_all_user_xp();`.  
The **Clear all XP** button in the app does **not** require this block.

```sql
-- Block C (optional): function for manual clear-all-XP in SQL
CREATE OR REPLACE FUNCTION clear_all_user_xp()
RETURNS void AS $$
  UPDATE users SET xp = 0;
$$ LANGUAGE sql SECURITY DEFINER;
```

Then, to reset all users’ XP:

```sql
SELECT clear_all_user_xp();
```

---

## 6. Summary – what to run and in what order

| Step | Block | When |
|------|-------|------|
| Base | `schema.sql` | Once (if not already done) |
| 1 | **Block A** | Once (XP schema, per-user `users.xp`) |
| 2 | **Block B** | Once (tester role) |
| 3 | **Block C** | Optional; only for `SELECT clear_all_user_xp();` |

**After Block A and Block B:**

- Each user’s XP is stored in `users.xp` (one value per user).
- The **Clear all XP** button works (curator only; no Block C needed).
- Time-based, carryover, follow, sub, donation, and curator XP all use this same per-user storage.

---

## 7. Quick checks

- **See per-user XP:**
  ```sql
  SELECT id, display_name, xp, follow_bonus_granted FROM users;
  ```
- **Reset one user’s XP (example):**
  ```sql
  UPDATE users SET xp = 0 WHERE twitch_id = 'SOME_TWITCH_ID';
  ```
- **Reset all XP (if you ran 003):**
  ```sql
  SELECT clear_all_user_xp();
  ```

---

## 8. If something breaks

- **“column xp does not exist”**  
  Run **Block A** (Section 5).

- **“Clear all XP” button does nothing or errors**  
  Ensure you’re logged in as a **curator**. Check the browser Network tab for `POST /api/xp/clear-all`.  
  The app uses batch updates (no RPC). Verify `users.xp` exists: `SELECT id, display_name, xp FROM users;`.

- **“role check” or “tester” errors**  
  Run **Block B** (Section 5).
