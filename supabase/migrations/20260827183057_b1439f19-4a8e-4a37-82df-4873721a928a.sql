-- 1) Guard: permitir gravação vinda de rotinas internas de confiança
CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_role_name TEXT := current_setting('role', true);
  trusted TEXT := current_setting('imag.trusted_write', true);
BEGIN
  IF current_role_name IN ('service_role','postgres','supabase_admin','supabase_auth_admin') THEN
    RETURN NEW;
  END IF;
  IF trusted = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.has_access := OLD.has_access;
  NEW.access_type := OLD.access_type;
  NEW.access_granted_at := OLD.access_granted_at;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.trial_used := OLD.trial_used;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_started_at := OLD.subscription_started_at;
  NEW.subscription_renews_at := OLD.subscription_renews_at;
  RETURN NEW;
END;
$function$;

-- 2) ensure_trial_subscription marca a escrita como confiável
CREATE OR REPLACE FUNCTION public.ensure_trial_subscription(_user_id uuid)
 RETURNS subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.subscriptions;
  ever_had boolean;
BEGIN
  PERFORM set_config('imag.trusted_write', 'on', true);

  IF public.is_ambassador(_user_id) THEN
    SELECT * INTO s FROM public.subscriptions
     WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;
    RETURN s;
  END IF;

  SELECT * INTO s
    FROM public.subscriptions
   WHERE user_id = _user_id
     AND status IN ('trialing','active','past_due')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    UPDATE public.profiles
       SET trial_started_at = COALESCE(trial_started_at, s.trial_started_at),
           trial_ends_at = COALESCE(trial_ends_at, s.trial_ends_at),
           trial_used = CASE WHEN s.plan = 'trial' THEN true ELSE trial_used END,
           subscription_status = CASE
             WHEN subscription_status = 'active' THEN subscription_status
             ELSE s.status END,
           access_type = COALESCE(access_type, CASE WHEN s.plan = 'trial' THEN 'trial' ELSE access_type END),
           access_granted_at = COALESCE(access_granted_at, s.created_at)
     WHERE id = _user_id;
    RETURN s;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
     WHERE user_id = _user_id AND plan = 'trial'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _user_id AND trial_used = true
  ) INTO ever_had;

  IF ever_had THEN
    SELECT * INTO s FROM public.subscriptions
     WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;
    RETURN s;
  END IF;

  INSERT INTO public.subscriptions
    (user_id, plan, status, provider, trial_started_at, trial_ends_at,
     current_period_start, current_period_end)
  VALUES
    (_user_id, 'trial', 'trialing', 'none', now(), now() + interval '10 days',
     now(), now() + interval '10 days')
  RETURNING * INTO s;

  UPDATE public.profiles
     SET trial_started_at = COALESCE(trial_started_at, s.trial_started_at),
         trial_ends_at = COALESCE(trial_ends_at, s.trial_ends_at),
         trial_used = true,
         subscription_status = CASE
           WHEN subscription_status = 'active' THEN subscription_status
           ELSE 'trialing' END,
         access_type = COALESCE(access_type, 'trial'),
         access_granted_at = COALESCE(access_granted_at, now()),
         referral_status = CASE
           WHEN referrer_user_id IS NOT NULL THEN 'em_periodo_gratuito'
           ELSE referral_status END
   WHERE id = _user_id;

  RETURN s;
END;
$function$;

-- 3) activate_trial_for_current_user também marca escrita confiável
CREATE OR REPLACE FUNCTION public.activate_trial_for_current_user()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  p public.profiles;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM set_config('imag.trusted_write', 'on', true);

  IF public.is_ambassador(uid) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'ambassador');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
  END IF;

  IF p.has_access = true AND p.access_type = 'lifetime' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'lifetime');
  END IF;
  IF p.subscription_status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'active');
  END IF;

  IF p.trial_used = true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'trial_already_used',
      'trial_ends_at', p.trial_ends_at, 'subscription_status', p.subscription_status);
  END IF;

  UPDATE public.profiles
     SET trial_started_at = now(),
         trial_ends_at = now() + interval '10 days',
         trial_used = true,
         subscription_status = 'trialing',
         access_type = 'trial',
         access_granted_at = now(),
         referral_status = CASE
           WHEN referrer_user_id IS NOT NULL THEN 'em_periodo_gratuito'
           ELSE referral_status
         END
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'status', 'trialing',
    'trial_ends_at', (now() + interval '10 days'));
END;
$function$;

-- 4) Bootstrap idempotente da conta (perfil + trial + sincronização)
CREATE OR REPLACE FUNCTION public.ensure_user_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  em text;
  created_profile boolean := false;
  s public.subscriptions;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM set_config('imag.trusted_write', 'on', true);

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    SELECT u.email INTO em FROM auth.users u WHERE u.id = uid;
    INSERT INTO public.profiles (id, email, full_name, has_access, access_type, access_granted_at)
    VALUES (uid, em, '',
            public.is_ambassador_email(em),
            CASE WHEN public.is_ambassador_email(em) THEN 'ambassador' ELSE NULL END,
            CASE WHEN public.is_ambassador_email(em) THEN now() ELSE NULL END)
    ON CONFLICT (id) DO NOTHING;
    created_profile := true;
  END IF;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT public.is_ambassador(uid) THEN
    s := public.ensure_trial_subscription(uid);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'created_profile', created_profile,
    'hasAccess', public.has_active_access(uid)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_user_bootstrap() TO authenticated;

-- 5) Backfill: perfis sem estado de trial voltam a refletir a assinatura real
UPDATE public.profiles p
   SET trial_started_at = COALESCE(p.trial_started_at, s.trial_started_at),
       trial_ends_at = COALESCE(p.trial_ends_at, s.trial_ends_at),
       trial_used = CASE WHEN s.plan = 'trial' THEN true ELSE p.trial_used END,
       subscription_status = CASE
         WHEN p.subscription_status = 'active' THEN p.subscription_status
         ELSE s.status END,
       access_type = COALESCE(p.access_type, CASE WHEN s.plan = 'trial' THEN 'trial' ELSE NULL END),
       access_granted_at = COALESCE(p.access_granted_at, s.created_at)
  FROM (
    SELECT DISTINCT ON (user_id) user_id, plan, status, trial_started_at, trial_ends_at, created_at
      FROM public.subscriptions
     ORDER BY user_id, created_at DESC
  ) s
 WHERE s.user_id = p.id
   AND (p.trial_ends_at IS NULL OR p.subscription_status IS NULL OR p.subscription_status = 'none');