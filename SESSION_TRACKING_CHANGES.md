# Session Tracking Feature - Summary of Changes

This document summarizes all the changes made to implement session-based submission tracking.

## Overview

The system now tracks submission sessions, allowing users to submit multiple tracks per session while preventing duplicate submissions within the same session. Special rules apply to the first session.

## Key Features

1. **Session-based submissions**: Each submission is tagged with a session number
2. **Duplicate prevention**: Users cannot submit the same track twice in the same session
3. **First session rules**: 1-hour cooldown for resubmissions in the first session
4. **Cross-session warnings**: Users are warned (but allowed) when resubmitting a track from a previous session
5. **Session display**: Session numbers are shown in both user and curator dashboards
6. **Submission status**: Both dashboards show whether submissions are open or closed

## Database Changes

### New Table: `submission_sessions`
- Tracks when sessions start and end
- Sequential session numbers (1, 2, 3, ...)
- Automatically managed when submissions are opened/closed

### Modified Table: `submissions`
- Added `session_number` column (INTEGER)
- Links each submission to its session

### New Functions
- `get_or_create_current_session()`: Returns current open session or creates new one
- `close_current_session()`: Closes the current open session

### New Indexes
- `idx_submissions_session_number`: Fast session lookups
- `idx_submissions_user_session_url`: Fast duplicate checks within sessions

## API Changes

### `/api/submissions` (POST)
**New Logic:**
- Gets or creates current session number
- Prevents duplicate submissions within the same session
- Enforces 1-hour cooldown for first session resubmissions
- Returns warning if track was submitted in a previous session (but allows submission)

**Removed:**
- Global duplicate check (one submission per user ever)

### `/api/settings/submissions` (POST)
**New Logic:**
- When opening submissions: Creates new session (or uses existing open session)
- When closing submissions: Closes current session
- Automatically manages session lifecycle

## UI Changes

### User Dashboard (`/dashboard`)
- **Added**: Submission open/closed status badge
- **Added**: Session number display for each submission
- Shows green badge when submissions are open, red when closed

### Curator Panel (`/curator`)
- **Added**: Session number display in submission list
- **Added**: Session number display in review panel
- Submission status toggle already existed (now manages sessions)

### Submit Page (`/submit`)
- **Updated**: Error handling for session-based warnings
- **Updated**: Warning display for previously submitted tracks
- Shows yellow warning when track was submitted in previous session

## Migration Required

**Important**: You must run the database migration before deploying these changes.

See `SUPABASE_MIGRATION_GUIDE.md` for detailed migration instructions.

## Behavior Changes

### Before
- Users could only submit each track once (ever)
- No session tracking
- No distinction between submission periods

### After
- Users can submit the same track in different sessions
- Each session tracks its own submissions
- First session has special 1-hour cooldown rule
- Warnings shown for cross-session resubmissions

## Testing Checklist

After migration, test:

- [ ] Opening submissions creates a new session
- [ ] Submitting a track assigns it to current session
- [ ] Submitting same track again in same session is blocked
- [ ] Closing submissions closes the current session
- [ ] Opening submissions again creates a new session
- [ ] Submitting a track from previous session shows warning but allows submission
- [ ] First session resubmission blocked for 1 hour
- [ ] Session numbers display in user dashboard
- [ ] Session numbers display in curator panel
- [ ] Submission status displays in both dashboards

## Files Modified

### Database
- `supabase/migration_add_session_tracking.sql` (new)
- `SUPABASE_MIGRATION_GUIDE.md` (new)

### API Routes
- `app/api/submissions/route.ts` (updated)
- `app/api/settings/submissions/route.ts` (created/updated)

### UI Components
- `app/dashboard/page.tsx` (updated)
- `app/curator/page.tsx` (updated)
- `app/submit/page.tsx` (updated)

## Notes

- Existing submissions (created before migration) will have `NULL` session_number
- You can optionally backfill existing submissions to session #1 (see migration guide)
- Sessions are automatically managed - no manual intervention needed
- The first session (session #1) has special rules that don't apply to later sessions
