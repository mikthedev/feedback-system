-- =============================================================================
-- RLS policies for Supabase Security Advisor ("RLS enabled, no policy")
-- =============================================================================
-- Explicit policies for anon + authenticated with USING (false): no API access
-- via the anon key. The service role bypasses RLS; server routes are unchanged.
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
