-- Chat-based audience ratings (1–10) for the first track in the live queue.
-- One vote per Twitch user per submission (upsert).

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

ALTER TABLE audience_chat_ratings ENABLE ROW LEVEL SECURITY;
