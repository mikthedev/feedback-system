# Supabase Migration Guide: Session Tracking Feature

This guide will walk you through applying the database migration to add session tracking functionality to your feedback system.

## Overview

This migration adds:
- **Session tracking**: Tracks when submission sessions start and end
- **Session numbers**: Each submission is tagged with a session number
- **Session-based duplicate prevention**: Users can only submit the same track once per session
- **First session special rules**: 1-hour cooldown for resubmissions in the first session

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

### Step 3: Verify the Migration

After running the migration, verify that everything was created correctly:

#### Check Tables

Run this query to verify the new table exists:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'submission_sessions';
```

You should see `submission_sessions` in the results.

#### Check Columns

Run this query to verify the `session_number` column was added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'session_number';
```

You should see `session_number` with type `integer`.

#### Check Functions

Run this query to verify the functions were created:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_or_create_current_session', 'close_current_session');
```

You should see both function names in the results.

#### Check Indexes

Run this query to verify indexes were created:

```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'submissions' 
AND indexname LIKE '%session%';
```

You should see indexes related to sessions.

### Step 4: Initialize First Session (Optional)

If you want to create the first session immediately, you can run:

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

## What the Migration Does

### 1. Creates `submission_sessions` Table

This table tracks:
- `session_number`: Unique sequential number for each session
- `started_at`: When the session started
- `ended_at`: When the session ended (NULL if still open)

### 2. Adds `session_number` to Submissions

Each submission now has a `session_number` field that links it to the session it was submitted in.

### 3. Creates Helper Functions

- **`get_or_create_current_session()`**: Returns the current open session number, or creates a new one if none exists
- **`close_current_session()`**: Closes the current open session

### 4. Creates Indexes

Indexes are created for performance:
- `idx_submissions_session_number`: Fast lookups by session
- `idx_submissions_user_session_url`: Fast duplicate checks within a session

## How Sessions Work

1. **When submissions are opened**: A new session is automatically created (or the existing open session is used)
2. **When submissions are closed**: The current session is marked as ended
3. **Session numbers**: Increment sequentially (1, 2, 3, ...)
4. **Automatic assignment**: New submissions automatically get the current session number

## Troubleshooting

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

-- Drop table
DROP TABLE IF EXISTS submission_sessions;
```

**Warning**: This will remove all session tracking data. Only do this if you're sure you want to revert.

## Testing the Migration

After migration, test the following:

1. **Open submissions** (via curator panel) - should create/use a session
2. **Submit a track** - should get assigned to current session
3. **Try submitting same track again** - should be blocked (same session)
4. **Close submissions** - should close current session
5. **Open submissions again** - should create new session
6. **Submit previously submitted track** - should show warning but allow submission

## Support

If you encounter any issues during migration:

1. Check the Supabase SQL Editor for error messages
2. Verify all prerequisites are met
3. Check that your Supabase project has the necessary permissions
4. Review the migration script for any syntax errors

## Next Steps

After completing the migration:

1. Restart your Next.js application (if running)
2. Test the submission flow
3. Verify session numbers appear in dashboards
4. Test the curator panel to open/close submissions

The application code has already been updated to work with these database changes, so once the migration is complete, everything should work automatically.
