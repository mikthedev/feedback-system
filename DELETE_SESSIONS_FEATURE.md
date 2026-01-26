# Delete Sessions Feature - Summary

## Overview

Added a new feature that allows curators to delete submission sessions and all associated data. This feature is available in the Curator Panel.

## Features

1. **List All Sessions**: View all sessions with submission counts
2. **Delete Single Session**: Delete a specific session and its submissions
3. **Delete All Sessions**: Delete all sessions and submissions at once
4. **Confirmation Dialog**: Safety confirmation before deletion
5. **Automatic Cleanup**: Reviews are automatically deleted (CASCADE)

## API Endpoints

### GET `/api/sessions`
- **Access**: Curator only
- **Returns**: List of all sessions with submission counts
- **Response**:
  ```json
  {
    "sessions": [
      {
        "id": "uuid",
        "session_number": 1,
        "started_at": "2026-01-25T...",
        "ended_at": null,
        "submission_count": 5
      }
    ]
  }
  ```

### DELETE `/api/sessions/delete`
- **Access**: Curator only
- **Body Options**:
  - Delete specific sessions: `{ "session_numbers": [1, 2, 3] }`
  - Delete all: `{ "delete_all": true }`
- **Response**:
  ```json
  {
    "success": true,
    "message": "Successfully deleted 2 session(s) and 10 submission(s)",
    "deleted_sessions": [1, 2],
    "deleted_submissions_count": 10
  }
  ```

## UI Features

### Curator Panel - Session Management Section

Located in the Curator Panel, below the Submission Status toggle:

1. **Session List**: Shows all sessions with:
   - Session number
   - Submission count
   - Status (Open/Closed)
   - Start/End dates

2. **Delete Buttons**:
   - Individual "Delete" button for each session
   - "Delete All Sessions" button at the top

3. **Confirmation Modal**:
   - Appears before deletion
   - Shows what will be deleted
   - Requires explicit confirmation

## What Gets Deleted

When a session is deleted:

1. ✅ **Submissions**: All submissions in that session are deleted
2. ✅ **Reviews**: All reviews for those submissions are automatically deleted (CASCADE)
3. ✅ **Session Record**: The session record itself is removed

## Safety Features

- **Confirmation Required**: Cannot delete without confirmation
- **Curator Only**: Only users with curator role can delete
- **Clear Feedback**: Success/error messages shown after operations
- **Auto Refresh**: Sessions and submissions list refresh after deletion

## Database Behavior

- Uses CASCADE delete for reviews (automatic)
- Manual deletion of submissions and sessions
- No orphaned records left behind

## Usage

1. Go to Curator Panel
2. Scroll to "Session Management" section
3. View all sessions
4. Click "Delete" on a specific session, or
5. Click "Delete All Sessions" to remove everything
6. Confirm the deletion in the modal
7. Sessions and submissions are removed from both frontend and database

## Notes

- Deletion is permanent and cannot be undone
- Always use with caution
- Consider backing up data before bulk deletions
- The feature respects user permissions (curator only)
