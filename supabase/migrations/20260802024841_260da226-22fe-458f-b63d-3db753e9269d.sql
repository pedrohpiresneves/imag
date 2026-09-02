GRANT EXECUTE ON FUNCTION public.check_handle_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_handles(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_handle(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_handle_body(text) TO anon, authenticated;