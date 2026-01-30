-- Track external XP (donation, sub) per session for "Unused external" display in footer.
ALTER TABLE user_session_xp ADD COLUMN IF NOT EXISTS external_xp_this_session INTEGER NOT NULL DEFAULT 0;
