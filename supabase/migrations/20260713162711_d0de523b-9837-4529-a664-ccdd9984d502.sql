-- Trigger functions são executadas pelo próprio Postgres via trigger;
-- ninguém precisa (nem deve) chamar via API. Revoga EXECUTE para
-- silenciar os avisos do linter e endurecer a superfície.
REVOKE EXECUTE ON FUNCTION public.guard_profile_access_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_access_fields() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_profile_access_fields() FROM authenticated;