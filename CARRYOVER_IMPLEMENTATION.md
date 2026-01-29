# Carryover Implementation Summary

## Changes Made

### 1. Updated "Your Submissions" API (`GET /api/submissions`)
**File:** `app/api/submissions/route.ts`

**Before:** Returned ALL user submissions (reviewed + pending from any session)

**After:** Returns only ACTIVE submissions:
- ✅ Reviewed submissions (from any session - these are "done")
- ✅ Pending submissions from CURRENT open session only
- ❌ Excludes pending from closed sessions (carryover)

**Implementation:**
- Fetches reviewed submissions separately
- Fetches pending from current open session separately
- Combines and deduplicates results
- Sorted by `created_at` descending

### 2. Queue API (Already Correct)
**File:** `app/api/submissions/queue/route.ts`

- Already only shows pending from current open session
- Returns empty array when no open session exists
- ✅ No changes needed

### 3. Carryover API (Already Correct)
**File:** `app/api/submissions/carryover/route.ts`

- Already shows all pending from closed sessions (global view)
- ✅ No changes needed

### 4. Opening Submissions Logic (Already Correct)
**File:** `app/api/settings/submissions/route.ts`

- When opening submissions, automatically moves carryover back to new session
- Updates `session_number` of pending submissions from closed sessions to new session
- Handles duplicates (one per user+URL)
- ✅ No changes needed

### 5. Closing Submissions Logic (Already Correct)
**File:** `app/api/settings/submissions/route.ts`

- When closing, sets `ended_at` on current session
- Submissions in that session automatically become carryover (via query logic)
- ✅ No changes needed

## Database Schema

**No migration required** - existing schema supports this behavior:

- `submissions.session_number` - Links to session
- `submission_sessions.ended_at` - NULL = open, NOT NULL = closed
- `submissions.status` - 'pending' or 'reviewed'

Carryover is determined by query logic, not a separate status field.

## Testing Checklist

1. ✅ **Open submissions** → Submit track → See in Queue and Your Submissions
2. ✅ **Close submissions** → Track disappears from Queue and Your Submissions → Appears in Carryover
3. ✅ **Open submissions again** → Track moves from Carryover → Back to Queue and Your Submissions

## Files Modified

1. `app/api/submissions/route.ts` - Updated GET endpoint to exclude carryover
2. `CARRYOVER_BEHAVIOR.md` - Documentation of behavior
3. `CARRYOVER_IMPLEMENTATION.md` - This file

## Files Unchanged (Already Correct)

- `app/api/submissions/queue/route.ts` - Queue logic
- `app/api/submissions/carryover/route.ts` - Carryover logic  
- `app/api/settings/submissions/route.ts` - Open/close logic
- `app/components/Queue.tsx` - Queue UI
- `app/components/Carryover.tsx` - Carryover UI
- `supabase/schema.sql` - Database schema
