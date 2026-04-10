-- =============================================================================
-- Enable RLS on all public tables (Supabase Security Advisor)
-- =============================================================================
-- This app uses Twitch OAuth + server-side API routes with the service role
-- key only. The service role bypasses RLS, so existing behavior is unchanged.
-- PostgREST with the anon key can no longer read/write these tables unless you
-- add explicit policies for anon / authenticated roles.
-- =============================================================================

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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
