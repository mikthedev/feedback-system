-- =============================================================================
-- Demo Feedback System – Single canonical schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- See supabase/APPLY_TO_SUPABASE.md for step-by-step instructions.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper: update updated_at (must exist before any triggers use it)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twitch_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  profile_image_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'curator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  soundcloud_url TEXT NOT NULL,
  description TEXT,
  artist_name TEXT,
  song_title TEXT,
  genre TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed')),
  session_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  curator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sound_score DECIMAL(3,1) NOT NULL CHECK (sound_score >= 0 AND sound_score <= 10),
  structure_score DECIMAL(3,1) NOT NULL CHECK (structure_score >= 0 AND structure_score <= 10),
  mix_score DECIMAL(3,1) NOT NULL CHECK (mix_score >= 0 AND mix_score <= 10),
  vibe_score DECIMAL(3,1) NOT NULL CHECK (vibe_score >= 0 AND vibe_score <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(submission_id, curator_id)
);

-- Session tracking (when submissions are open/closed)
CREATE TABLE IF NOT EXISTS submission_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_number INTEGER NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App config: single row, plain boolean for submissions open/closed (no JSONB)
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  submissions_open BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure app_config has exactly one row
INSERT INTO app_config (id, submissions_open)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Triggers (function must exist first)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_submission_sessions_updated_at ON submission_sessions;
CREATE TRIGGER update_submission_sessions_updated_at
  BEFORE UPDATE ON submission_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_session_number ON submissions(session_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_user_session_url
  ON submissions(user_id, session_number, soundcloud_url)
  WHERE session_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_submission_id ON reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_users_twitch_id ON users(twitch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Chat !rate (1–10), first-in-queue submission only; one row per Twitch user per submission
CREATE TABLE IF NOT EXISTS audience_chat_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  twitch_user_id TEXT NOT NULL,
  twitch_login TEXT,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (submission_id, twitch_user_id)
);

CREATE INDEX IF NOT EXISTS idx_audience_chat_ratings_submission_id
  ON audience_chat_ratings(submission_id);

DROP TRIGGER IF EXISTS update_audience_chat_ratings_updated_at ON audience_chat_ratings;
CREATE TRIGGER update_audience_chat_ratings_updated_at
  BEFORE UPDATE ON audience_chat_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Session RPCs (open/close submissions)
-- -----------------------------------------------------------------------------

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
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

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
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- RLS: lock PostgREST (anon / authenticated); service role bypasses RLS.
-- Migrations 011–012 apply the same pattern to every public table.
-- -----------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_chat_ratings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS block_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS block_authenticated ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- Optional: remove legacy settings table if you previously used key-value config
DROP TABLE IF EXISTS settings;

-- -----------------------------------------------------------------------------
-- Top of the Month (TOTM) — see migrations/014_totm.sql
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS totm_months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'active', 'finalized')),
  review_count INTEGER NOT NULL DEFAULT 0,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (year, month)
);

CREATE TABLE IF NOT EXISTS totm_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  totm_month_id UUID NOT NULL REFERENCES totm_months(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twitch_user_id TEXT NOT NULL,
  artist_name TEXT,
  song_title TEXT,
  genre TEXT,
  soundcloud_url TEXT NOT NULL,
  audience_score DECIMAL(3,1),
  curator_score DECIMAL(3,1) NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 10),
  review_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submission_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  removed_from_active BOOLEAN NOT NULL DEFAULT false,
  removed_from_active_at TIMESTAMP WITH TIME ZONE,
  soundcloud_unavailable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (totm_month_id, submission_id),
  UNIQUE (totm_month_id, twitch_user_id),
  UNIQUE (totm_month_id, rank)
);

CREATE TABLE IF NOT EXISTS totm_featured_artists (
  twitch_user_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_totm_month_id UUID REFERENCES totm_months(id) ON DELETE SET NULL,
  first_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  featured_email_sent_at TIMESTAMP WITH TIME ZONE,
  twitch_vip_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_totm_featured_artists_user_id
  ON totm_featured_artists(user_id);

CREATE TABLE IF NOT EXISTS totm_queue_skips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  twitch_user_id TEXT NOT NULL,
  totm_month_id UUID NOT NULL REFERENCES totm_months(id) ON DELETE CASCADE,
  earned_year INTEGER NOT NULL,
  earned_month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'activated', 'consumed')),
  activated_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  activated_at TIMESTAMP WITH TIME ZONE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  reward_email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (totm_month_id, twitch_user_id)
);

CREATE INDEX IF NOT EXISTS idx_totm_queue_skips_user_status
  ON totm_queue_skips(user_id, status);

CREATE TABLE IF NOT EXISTS totm_finalization_log (
  totm_month_id UUID PRIMARY KEY REFERENCES totm_months(id) ON DELETE CASCADE,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  skips_granted INTEGER NOT NULL DEFAULT 0,
  featured_preserved INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS totm_skip_id UUID REFERENCES totm_queue_skips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_totm_skip_id
  ON submissions(totm_skip_id)
  WHERE totm_skip_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_totm_months_year_month ON totm_months(year, month);
CREATE INDEX IF NOT EXISTS idx_totm_entries_month_rank ON totm_entries(totm_month_id, rank);
CREATE INDEX IF NOT EXISTS idx_totm_entries_month_active
  ON totm_entries(totm_month_id)
  WHERE removed_from_active = false;

DROP TRIGGER IF EXISTS update_totm_months_updated_at ON totm_months;
CREATE TRIGGER update_totm_months_updated_at
  BEFORE UPDATE ON totm_months
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_entries_updated_at ON totm_entries;
CREATE TRIGGER update_totm_entries_updated_at
  BEFORE UPDATE ON totm_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_featured_artists_updated_at ON totm_featured_artists;
CREATE TRIGGER update_totm_featured_artists_updated_at
  BEFORE UPDATE ON totm_featured_artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_totm_queue_skips_updated_at ON totm_queue_skips;
CREATE TRIGGER update_totm_queue_skips_updated_at
  BEFORE UPDATE ON totm_queue_skips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE totm_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_featured_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_queue_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE totm_finalization_log ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'totm_months',
    'totm_entries',
    'totm_featured_artists',
    'totm_queue_skips',
    'totm_finalization_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS block_anon ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_anon ON public.%I FOR ALL TO anon USING (false) WITH CHECK (false)',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS block_authenticated ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY block_authenticated ON public.%I FOR ALL TO authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;
