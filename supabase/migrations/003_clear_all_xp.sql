-- =============================================================================
-- RPC: clear_all_user_xp — sets users.xp = 0 for all users. Called from API (curator-only).
-- =============================================================================

CREATE OR REPLACE FUNCTION clear_all_user_xp()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE users SET xp = 0;
$$;
