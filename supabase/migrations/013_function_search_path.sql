-- =============================================================================
-- Fix "Function Search Path Mutable" (Supabase Security Advisor)
-- =============================================================================
-- Pin search_path so callers cannot shadow objects via malicious schemas.
-- =============================================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_or_create_current_session() SET search_path = public, pg_temp;
ALTER FUNCTION public.close_current_session() SET search_path = public, pg_temp;
ALTER FUNCTION public.clear_all_user_xp() SET search_path = public, pg_temp;
