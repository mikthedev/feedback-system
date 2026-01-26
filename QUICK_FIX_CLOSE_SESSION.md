# Quick Fix: Close Session Error

If you're getting "Internal server error" when closing submissions, run this SQL fix in Supabase SQL Editor.

## Quick Fix SQL

```sql
-- Fix close_current_session function to return INTEGER instead of VOID
CREATE OR REPLACE FUNCTION close_current_session()
RETURNS INTEGER AS $$
DECLARE
  current_session submission_sessions%ROWTYPE;
  closed_session_number INTEGER;
BEGIN
  -- Get the current open session
  SELECT * INTO current_session
  FROM submission_sessions
  WHERE ended_at IS NULL
  ORDER BY session_number DESC
  LIMIT 1;
  
  -- Close it if it exists
  IF current_session IS NOT NULL THEN
    UPDATE submission_sessions
    SET ended_at = NOW()
    WHERE id = current_session.id
    RETURNING session_number INTO closed_session_number;
    
    RETURN closed_session_number;
  ELSE
    -- No open session to close
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## Steps

1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL above
3. Click **Run**
4. Test closing submissions - should work now!

## Verify It Works

Test the function directly:

```sql
-- This should return a session number (or NULL if no session is open)
SELECT close_current_session();
```

If it returns a number or NULL (not an error), the fix worked!
