-- =============================================================================
-- Add "tester" role. Testers can manually add/remove XP for testing.
-- Run after 001_xp_system.sql. Adjust constraint name if your DB differs.
--
-- To assign tester to a user (e.g. your Twitch account):
--   UPDATE users SET role = 'tester' WHERE twitch_id = 'YOUR_TWITCH_ID';
-- =============================================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'curator', 'tester'));
