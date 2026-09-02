CREATE OR REPLACE FUNCTION public.get_access_decision(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles;
  has_subscription boolean := false;
  has_trial boolean := false;
  reason text := 'expired';
  days_left integer := 0;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;

  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.stripe_subscriptions s
      WHERE s.user_id = _user_id
        AND s.status = 'active'
        AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR public.is_ambassador(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _user_id AND r.role = 'admin'
    )
    OR (p.id IS NOT NULL AND p.access_type IN ('lifetime','admin','test','ambassador'))
  INTO has_subscription;

  has_trial := p.id IS NOT NULL
    AND p.trial_ends_at IS NOT NULL
    AND now() < p.trial_ends_at;

  IF has_subscription THEN
    reason := 'subscription';
  ELSIF has_trial THEN
    reason := 'trial';
  END IF;

  IF has_trial THEN
    days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (p.trial_ends_at - now())) / 86400)::int);
  END IF;

  RETURN jsonb_build_object(
    'has_access', has_subscription OR has_trial,
    'access_reason', reason,
    'trial_started_at', p.trial_started_at,
    'trial_ends_at', p.trial_ends_at,
    'days_remaining', days_left
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_access_decision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_access_decision(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((public.get_access_decision(_user_id)->>'has_access')::boolean, false)
$function$;

REVOKE ALL ON FUNCTION public.has_active_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated, service_role;

UPDATE public.profiles p
SET trial_started_at = u.created_at,
    trial_ends_at = u.created_at + interval '10 days',
    trial_used = true,
    subscription_status = 'trialing',
    access_type = COALESCE(p.access_type, 'trial'),
    access_granted_at = COALESCE(p.access_granted_at, u.created_at)
FROM auth.users u
WHERE p.id = u.id
  AND u.created_at > now() - interval '10 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = u.id AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.stripe_subscriptions s
    WHERE s.user_id = u.id AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  )
  AND (
    p.trial_started_at IS NULL
    OR p.trial_ends_at IS NULL
    OR abs(extract(epoch FROM (p.trial_started_at - u.created_at))) > 5
    OR abs(extract(epoch FROM (p.trial_ends_at - (u.created_at + interval '10 days')))) > 5
  );