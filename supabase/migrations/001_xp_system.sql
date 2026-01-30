-- =============================================================================
-- XP system migration (users, user_tokens, user_session_xp, submissions)
-- Run after schema.sql. Safe to run on existing DB (ALTER / CREATE IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users: XP and follow bonus
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS follow_bonus_granted BOOLEAN NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- user_tokens: store Twitch access/refresh tokens for user-scoped API calls
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);

DROP TRIGGER IF EXISTS update_user_tokens_updated_at ON user_tokens;
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_tokens DISABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- user_session_xp: per-user, per-session XP tracking (sub/donation, moves, presence)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_session_xp (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  sub_xp_granted BOOLEAN NOT NULL DEFAULT false,
  donation_xp_granted BOOLEAN NOT NULL DEFAULT false,
  moves_used_this_session INTEGER NOT NULL DEFAULT 0,
  presence_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_user_session_xp_user_session ON user_session_xp(user_id, session_number);

DROP TRIGGER IF EXISTS update_user_session_xp_updated_at ON user_session_xp;
CREATE TRIGGER update_user_session_xp_updated_at
  BEFORE UPDATE ON user_session_xp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_session_xp DISABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- submissions: XP snapshot, carryover, time-based XP, audience rating
-- -----------------------------------------------------------------------------
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_xp_snapshot INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS carryover_bonus_granted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_based_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_time_xp_tick_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_score DECIMAL(3,1) CHECK (audience_score IS NULL OR (audience_score >= 0 AND audience_score <= 10));
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_rating_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS audience_rating_at TIMESTAMP WITH TIME ZONE;
