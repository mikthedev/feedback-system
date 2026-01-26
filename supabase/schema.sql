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
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Core tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twitch_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
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

-- -----------------------------------------------------------------------------
-- RLS disabled (auth via Twitch OAuth + API; service role used server-side)
-- -----------------------------------------------------------------------------

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE submission_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;

-- Optional: remove legacy settings table if you previously used key-value config
DROP TABLE IF EXISTS settings;
