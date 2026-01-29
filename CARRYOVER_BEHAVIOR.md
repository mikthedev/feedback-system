# Carryover Behavior Documentation

## Overview

Carryover is a temporary holding state for submissions that were not fully processed (not rated/reviewed) when submissions are closed. These submissions are hidden from active views and automatically return when submissions are opened again.

## Behavior Flow

### When Submissions are OPEN
- Users submit tracks → appear as **active submissions**
- Active submissions appear in:
  - **Queue**: All pending submissions in the current open session
  - **Your Submissions**: User's own submissions (reviewed + pending from current session)

### When Curator CLOSES Submissions
1. Current session is marked as closed (`ended_at` is set)
2. All pending submissions from that session become **carryover**
3. Carryover submissions are:
   - ✅ Visible in **Carryover** field (all pending from closed sessions)
   - ❌ Removed from **Queue** (Queue only shows current session)
   - ❌ Removed from **Your Submissions** (only shows active: reviewed + current session pending)

### When Submissions are OPENED Again
1. A new session is created
2. All carryover submissions (pending from closed sessions) are automatically moved to the new session
3. They become active again and appear in:
   - **Queue**: As pending submissions in the new session
   - **Your Submissions**: As active pending submissions

## Database Schema

No schema changes are required. The system uses existing fields:

- `submissions.session_number`: Links submissions to a session
- `submission_sessions.ended_at`: NULL = open session, NOT NULL = closed session
- `submissions.status`: 'pending' or 'reviewed'

**Carryover = pending submissions where `session_number` is in a closed session (`ended_at IS NOT NULL`)**

## API Endpoints

### GET `/api/submissions` (Your Submissions)
- Returns: Reviewed submissions (any session) + Pending from current open session only
- Excludes: Pending from closed sessions (carryover)

### GET `/api/submissions/queue`
- Returns: All pending submissions in current open session only
- Returns empty array if no open session

### GET `/api/submissions/carryover`
- Returns: All pending submissions from closed sessions (global, not per-user)

## Migration Notes

**No database migration required** - the current schema supports this behavior.

If you need to verify the schema has the required tables:

```sql
-- Verify submission_sessions table exists
SELECT * FROM submission_sessions LIMIT 1;

-- Verify submissions table has session_number
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions' AND column_name = 'session_number';

-- Verify get_or_create_current_session function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'get_or_create_current_session';

-- Verify close_current_session function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'close_current_session';
```

## Testing the Flow

1. **Open submissions** → Submit a track → See it in Queue and Your Submissions
2. **Close submissions** → Track disappears from Queue and Your Submissions, appears in Carryover
3. **Open submissions again** → Track moves from Carryover back to Queue and Your Submissions

## Implementation Details

### Closing Submissions
- Called via `POST /api/settings/submissions` with `submissions_open: false`
- Executes `close_current_session()` RPC which sets `ended_at` on current session
- No data migration needed - carryover is determined by query logic

### Opening Submissions
- Called via `POST /api/settings/submissions` with `submissions_open: true`
- Creates new session via `get_or_create_current_session()`
- Moves carryover: Updates `session_number` of pending submissions from closed sessions to new session
- Handles duplicates: Only moves one submission per `(user_id, soundcloud_url)` pair (keeps oldest)
