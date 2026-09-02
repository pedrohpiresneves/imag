REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- webhook_events: negar tudo explicitamente para authenticated/anon (só service_role)
DROP POLICY IF EXISTS "webhook_events no client access" ON public.webhook_events;
CREATE POLICY "webhook_events no client access" ON public.webhook_events
  FOR SELECT TO authenticated, anon USING (false);