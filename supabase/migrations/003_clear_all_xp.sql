-- =============================================================================
-- RPC: clear_all_user_xp — sets users.xp = 0 for all users. Called from API (curator-only).
-- =============================================================================

CREATE OR REPLACE FUNCTION clear_all_user_xp()
RETURNS void AS $$
  UPDATE users SET xp = 0;
$$ LANGUAGE sql SECURITY DEFINER;
