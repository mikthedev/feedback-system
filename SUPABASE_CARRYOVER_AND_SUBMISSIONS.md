# Supabase: Carryover & Your Submissions

This guide covers what Supabase needs for **Your Submissions** (including new submissions showing) and **Carryover** (pending from closed sessions). **No new schema changes are required** if you already ran `supabase/schema.sql`. Use this to verify and, if needed, fix your project.

---

## 1. What the app expects

- **`submission_sessions`** – one row per “session” (open/close cycle), with `ended_at`:
  - `ended_at IS NULL` → current **open** session  
  - `ended_at IS NOT NULL` → **closed** session  
- **`submissions.session_number`** – links each submission to a session.
- **`get_or_create_current_session()`** – returns current open session number, or creates a new session when the last one is closed (or there are no sessions).
- **`close_current_session()`** – sets `ended_at = NOW()` on the current open session.

Carryover = pending submissions in **closed** sessions.  
“Your Submissions” = reviewed (any session) + pending only in the **current open** session.

---

## 2. Verify in Supabase

Run these in the **SQL Editor** (Supabase Dashboard → SQL Editor → New query).

### 2.1 Tables

```sql
-- submission_sessions must exist
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'submission_sessions'
);
-- Expect: true

-- submissions must have session_number
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'session_number';
-- Expect: one row, type integer, is_nullable YES
```

### 2.2 RPCs

```sql
-- Both must exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_or_create_current_session', 'close_current_session');
-- Expect: 2 rows
```

### 2.3 Quick behavior check

```sql
-- Create/open session
SELECT get_or_create_current_session();
-- Expect: single integer (e.g. 1)

-- Check open session
SELECT session_number, ended_at FROM submission_sessions ORDER BY session_number DESC LIMIT 1;
-- Expect: ended_at IS NULL for current session

-- Close it
SELECT close_current_session();
-- Expect: same integer as above

-- Check closed
SELECT session_number, ended_at FROM submission_sessions ORDER BY session_number DESC LIMIT 1;
-- Expect: ended_at IS NOT NULL
```

---

## 3. If something is missing

### 3.1 Tables or `session_number` missing

Apply the full schema:

1. Open `supabase/schema.sql` in this repo.
2. Copy the entire file.
3. Supabase Dashboard → SQL Editor → New query → paste → Run.

See `supabase/APPLY_TO_SUPABASE.md` for more detail.

### 3.2 RPCs missing

Run the RPC definitions from `schema.sql` (around “Session RPCs”):

```sql
-- From schema.sql: get_or_create_current_session + close_current_session
CREATE OR REPLACE FUNCTION get_or_create_current_session()
RETURNS INTEGER AS $$
DECLARE
  current_session_number INTEGER;
  last_session submission_sessions%ROWTYPE;
BEGIN
  SELECT * INTO last_session
  FROM submission_sessions
  ORDER BY session_number DESC
  LIMIT 1;

  IF last_session IS NULL OR last_session.ended_at IS NOT NULL THEN
    IF last_session IS NULL THEN
      current_session_number := 1;
    ELSE
      current_session_number := last_session.session_number + 1;
    END IF;

    INSERT INTO submission_sessions (session_number, started_at)
    VALUES (current_session_number, NOW())
    RETURNING session_number INTO current_session_number;
  ELSE
    current_session_number := last_session.session_number;
  END IF;

  RETURN current_session_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION close_current_session()
RETURNS INTEGER AS $$
DECLARE
  current_session submission_sessions%ROWTYPE;
  closed_session_number INTEGER;
BEGIN
  SELECT * INTO current_session
  FROM submission_sessions
  WHERE ended_at IS NULL
  ORDER BY session_number DESC
  LIMIT 1;

  IF current_session IS NOT NULL THEN
    UPDATE submission_sessions
    SET ended_at = NOW()
    WHERE id = current_session.id
    RETURNING session_number INTO closed_session_number;
    RETURN closed_session_number;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

### 3.3 Existing submissions with `session_number` NULL

Legacy rows without `session_number` are not shown as “active” in Your Submissions (they’re treated as outside the current session). To assign them to session `1`:

```sql
-- Optional: backfill missing session_number
UPDATE submissions
SET session_number = 1
WHERE session_number IS NULL;

-- Ensure session 1 exists
INSERT INTO submission_sessions (session_number, started_at)
VALUES (1, NOW())
ON CONFLICT (session_number) DO NOTHING;
```

Only run this if you understand the impact (e.g. all those submissions will be treated as session 1).

---

## 4. Manual fix: "Session won't close" / submissions not moving to Carryover

If the curator closes submissions but pending items stay in Queue / Your Submissions and never show in Carryover, the current session may not be closed (`ended_at` still NULL).

Run this in the SQL Editor to close the current open session:

```sql
UPDATE submission_sessions
SET ended_at = NOW()
WHERE id = (
  SELECT id FROM submission_sessions
  WHERE ended_at IS NULL
  ORDER BY session_number DESC
  LIMIT 1
);
```

Then refresh the dashboard. Pending submissions from that session should move to Carryover and disappear from Queue and Your Submissions.

---

## 5. Summary

- **No new columns or tables** are needed for carryover or “Your Submissions.”
- Ensure `submission_sessions`, `submissions.session_number`, and the two RPCs exist and behave as in §2 and §3.
- Use `supabase/schema.sql` (or the snippets above) to fix any missing pieces.
- If closing via the app doesn't work, use the manual `UPDATE` in §4 to close the current session.

After that, the app can correctly show new submissions in Your Submissions and use Carryover as intended.
