REVOKE EXECUTE ON FUNCTION public.repair_trial_window(uuid) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_trial_window(uuid) TO service_role;