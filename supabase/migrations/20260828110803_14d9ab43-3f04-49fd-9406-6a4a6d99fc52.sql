CREATE OR REPLACE FUNCTION public.get_my_access_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  user_created timestamptz;
  profile_trial_started timestamptz;
  profile_trial_end timestamptz;
  effective_trial_end timestamptz;
  profile_subscription_status text;
  profile_access_type text;
  has_subscription boolean := false;
  has_trial boolean := false;
  access_reason text := 'expired';
  days_left integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.created_at
    INTO user_created
    FROM auth.users u
   WHERE u.id = uid;

  IF user_created IS NULL THEN
    RAISE EXCEPTION 'Authenticated user not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.trial_started_at, p.trial_ends_at, p.subscription_status, p.access_type
    INTO profile_trial_started, profile_trial_end, profile_subscription_status, profile_access_type
    FROM public.profiles p
   WHERE p.id = uid;

  effective_trial_end := COALESCE(profile_trial_end, user_created + interval '10 days');

  SELECT
    EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.user_id = uid
         AND s.status = 'active'
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.stripe_subscriptions s
       WHERE s.user_id = uid
         AND s.status = 'active'
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
    )
    OR public.is_ambassador(uid)
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
       WHERE r.user_id = uid AND r.role = 'admin'
    )
    OR profile_access_type IN ('lifetime', 'admin', 'test', 'ambassador')
    INTO has_subscription;

  has_trial := now() < effective_trial_end;

  IF has_subscription THEN
    access_reason := 'subscription';
  ELSIF has_trial THEN
    access_reason := 'trial';
  END IF;

  IF has_trial THEN
    days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (effective_trial_end - now())) / 86400)::integer);
  END IF;

  RETURN jsonb_build_object(
    'has_access', has_subscription OR has_trial,
    'reason', access_reason,
    'user_created_at', user_created,
    'trial_started_at', COALESCE(profile_trial_started, user_created),
    'trial_ends_at', profile_trial_end,
    'effective_trial_end', effective_trial_end,
    'subscription_status', COALESCE(profile_subscription_status, CASE WHEN has_trial THEN 'trialing' ELSE 'none' END),
    'days_remaining', days_left
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_access_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_access_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_access_decision(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.get_my_access_status();
END;
$function$;

REVOKE ALL ON FUNCTION public.get_access_decision(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_access_decision(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((public.get_my_access_status()->>'has_access')::boolean, false);
END;
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
  AND u.created_at >= now() - interval '10 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.user_id = u.id
       AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.stripe_subscriptions s
     WHERE s.user_id = u.id
       AND s.status = 'active'
       AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );

UPDATE public.subscriptions s
SET trial_started_at = u.created_at,
    trial_ends_at = u.created_at + interval '10 days',
    status = 'trialing',
    updated_at = now()
FROM auth.users u
WHERE s.user_id = u.id
  AND s.plan = 'trial'
  AND u.created_at >= now() - interval '10 days'
  AND NOT EXISTS (
    SELECT 1 FROM public.stripe_subscriptions ss
     WHERE ss.user_id = u.id
       AND ss.status = 'active'
       AND (ss.current_period_end IS NULL OR ss.current_period_end > now())
  );