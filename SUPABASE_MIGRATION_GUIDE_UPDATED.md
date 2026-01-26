# Supabase Migration Guide: Session Tracking Feature (Updated)

This is an updated guide that includes fixes for the close session functionality and additional features.

## Overview

This migration adds:
- **Session tracking**: Tracks when submission sessions start and end
- **Session numbers**: Each submission is tagged with a session number
- **Session-based duplicate prevention**: Users can only submit the same track once per session
- **First session special rules**: 1-hour cooldown for resubmissions in the first session
- **Fixed close session function**: Now properly returns a value instead of VOID

## Prerequisites

1. Access to your Supabase project dashboard
2. SQL Editor access in Supabase
3. Backup your database (recommended before any migration)

## Step-by-Step Migration Instructions

### Step 1: Access Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com) and log in
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration Script

1. Open the file `supabase/migration_add_session_tracking.sql` in your project
2. Copy the entire contents of the file
3. Paste it into the SQL Editor in Supabase
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**Important**: This migration includes a fix for the `close_current_session()` function that returns an INTEGER instead of VOID, which fixes the "Internal server error" when closing sessions.

### Step 3: Verify the Migration

After running the migration, verify that everything was created correctly:

#### Check Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'submission_sessions';
```

#### Check Columns

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'session_number';
```

#### Check Functions

```sql
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_or_create_current_session', 'close_current_session');
```

You should see both functions with type `FUNCTION`.

#### Test the Close Session Function

Test that the close session function works:

```sql
-- First, ensure there's an open session
SELECT get_or_create_current_session();

-- Test closing it (should return the session number)
SELECT close_current_session();
```

If this returns a session number (or NULL if no session was open), the function is working correctly.

### Step 4: Initialize First Session (Optional)

If you want to create the first session immediately:

```sql
SELECT get_or_create_current_session();
```

This will create session #1 if it doesn't exist.

### Step 5: Update Existing Submissions (Optional)

If you have existing submissions in your database, you may want to assign them to session #1:

```sql
-- First, ensure session #1 exists
SELECT get_or_create_current_session();

-- Update all existing submissions to session #1
UPDATE submissions 
SET session_number = 1 
WHERE session_number IS NULL;
```

**Note**: Only run this if you want to backfill existing submissions. New submissions will automatically get the correct session number.

## What Changed in This Update

### Fixed `close_current_session()` Function

**Before (causing errors):**
```sql
CREATE OR REPLACE FUNCTION close_current_session()
RETURNS VOID AS $$
```

**After (fixed):**
```sql
CREATE OR REPLACE FUNCTION close_current_session()
RETURNS INTEGER AS $$
```

The function now:
- Returns the session number that was closed (INTEGER)
- Returns NULL if no session was open
- Properly handles the return value in API calls

This fixes the "Internal server error" that occurred when closing submission sessions.

## New Features Added

### Delete Sessions Feature

The migration supports a new feature that allows curators to delete sessions and their associated submissions:

- **API Endpoint**: `DELETE /api/sessions/delete`
- **List Sessions**: `GET /api/sessions`
- **UI**: Available in the Curator Panel

When sessions are deleted:
- All submissions in those sessions are deleted
- All reviews for those submissions are automatically deleted (CASCADE)
- The session records are removed from the database

## Troubleshooting

### Error: "function close_current_session() does not exist"

**Solution**: Make sure you ran the entire updated migration script. The function should be created/updated by the migration.

### Error: "Internal server error" when closing sessions

**Solution**: This was fixed in the updated migration. Make sure you've run the latest version of `migration_add_session_tracking.sql` which includes the fixed `close_current_session()` function.

### Error: "function get_or_create_current_session() does not exist"

**Solution**: Make sure you ran the entire migration script. The function should be created by the migration.

### Error: "column session_number does not exist"

**Solution**: Make sure the `ALTER TABLE` statement in the migration ran successfully. Check the SQL Editor for any errors.

### Existing submissions have NULL session_number

**Solution**: This is expected for submissions created before the migration. You can either:
- Leave them as NULL (they won't affect new functionality)
- Run the backfill query in Step 5 to assign them to session #1

### Sessions not being created automatically

**Solution**: Make sure the `get_or_create_current_session()` function exists and is callable. Test it with:
```sql
SELECT get_or_create_current_session();
```

### Close session still showing error

**Solution**: 
1. Verify you've run the updated migration
2. Check that `close_current_session()` returns INTEGER (not VOID)
3. Test the function directly in SQL Editor:
   ```sql
   SELECT close_current_session();
   ```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove session_number column
ALTER TABLE submissions DROP COLUMN IF EXISTS session_number;

-- Drop indexes
DROP INDEX IF EXISTS idx_submissions_session_number;
DROP INDEX IF EXISTS idx_submissions_user_session_url;

-- Drop functions
DROP FUNCTION IF EXISTS get_or_create_current_session();
DROP FUNCTION IF EXISTS close_current_session();

-- Drop table (this will fail if there are foreign key references)
-- You may need to delete submissions first
DROP TABLE IF EXISTS submission_sessions;
```

**Warning**: This will remove all session tracking data. Only do this if you're sure you want to revert.

## Testing the Migration

After migration, test the following:

1. **Open submissions** (via curator panel) - should create/use a session
2. **Submit a track** - should get assigned to current session
3. **Try submitting same track again** - should be blocked (same session)
4. **Close submissions** - should close current session without error ✅
5. **Open submissions again** - should create new session
6. **Submit previously submitted track** - should show warning but allow submission
7. **Delete sessions** (via curator panel) - should delete sessions and submissions ✅

## New Features Testing

### Test Delete Sessions Feature

1. **List Sessions**: Go to Curator Panel → Session Management section
2. **Delete Single Session**: Click "Delete" on a specific session
3. **Delete All Sessions**: Click "Delete All Sessions" button
4. **Verify Deletion**: Check that:
   - Sessions are removed from the list
   - Submissions for those sessions are deleted
   - Reviews for those submissions are deleted (CASCADE)

## Support

If you encounter any issues during migration:

1. Check the Supabase SQL Editor for error messages
2. Verify all prerequisites are met
3. Check that your Supabase project has the necessary permissions
4. Review the migration script for any syntax errors
5. Test the functions directly in SQL Editor before using them in the app

## Next Steps

After completing the migration:

1. Restart your Next.js application (if running)
2. Test the submission flow
3. Test closing submissions (should work without errors now)
4. Verify session numbers appear in dashboards
5. Test the delete sessions feature in the curator panel
6. Verify that deleted sessions and submissions are removed from both frontend and database

The application code has already been updated to work with these database changes, so once the migration is complete, everything should work automatically.
