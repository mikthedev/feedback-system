# Applying schema to Supabase (supabase.com)

This project uses a **single canonical schema** in `schema.sql`. All tables, functions, triggers, and RPCs live there.

## Quick apply (new or reset)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` in your editor, copy the entire file, and paste into the SQL Editor.
4. Click **Run** (or Cmd/Ctrl+Enter).

Done. The schema is applied.

---

## When you need to change the schema

1. **Edit `supabase/schema.sql`** in this repo (add/change tables, columns, functions, etc.).
2. **Re-apply** using one of the options below.

### Option A: Re-run full schema (recommended for dev / clean slate)

- Use `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, etc. These are already used in `schema.sql`, so you can **run the whole file again** without errors.
- **Caveat:** This does not drop tables or columns. To remove something, you must add explicit `DROP TABLE` / `ALTER TABLE ... DROP COLUMN` in the schema (or run a one-off migration) and then re-run.

### Option B: Run only the new part (migrations)

- Add a new **migration block** at the bottom of `schema.sql`, or create a separate file like `supabase/patches/001_add_foo.sql`.
- Copy only that block into the SQL Editor and run it.
- Keep `schema.sql` updated so it stays the single source of truth (including the new changes). That way, fresh installs only need to run `schema.sql`.

---

## Legacy `settings` table

The schema file ends with `DROP TABLE IF EXISTS settings;`. The app now uses `app_config` (plain `submissions_open` boolean) instead of the old key-value `settings` table. Running `schema.sql` will remove `settings` if it exists. If you need to keep it for another purpose, delete or comment out that line in `schema.sql` before running.

---

## XP system (per-user `users.xp`, Clear all XP)

For **XP storage** (each user’s XP in `users.xp`) and the **Clear all XP** button, run the SQL from **`supabase/XP_SQL_GUIDE.md`** in order:

1. **Block A** – XP columns and tables (`users.xp`, `user_tokens`, `user_session_xp`, etc.).
2. **Block B** – Tester role.
3. **Block C** (optional) – Manual “clear all XP” via `SELECT clear_all_user_xp();`.

The guide includes copy-paste SQL and verification steps. The **Clear all XP** button works after Block A and B (no Block C required).

---

## Verify

- **app_config:** `SELECT * FROM app_config;` → one row, `submissions_open` boolean.
- **Session RPCs:**  
  `SELECT get_or_create_current_session();`  
  `SELECT close_current_session();`
- **Curator flow:** Close submissions in the app → `app_config.submissions_open` should be `false`, and users cannot submit.
