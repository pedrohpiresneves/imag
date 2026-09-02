-- Base do trial = criação real da conta (auth.users.created_at), horário do servidor.
CREATE OR REPLACE FUNCTION public.ensure_trial_subscription(_user_id uuid)
 RETURNS subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.subscriptions;
  ever_had boolean;
  base timestamptz;
BEGIN
  PERFORM set_config('imag.trusted_write', 'on', true);

  IF public.is_ambassador(_user_id) THEN
    SELECT * INTO s FROM public.subscriptions
     WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;
    RETURN s;
  END IF;

  SELECT COALESCE(u.created_at, now()) INTO base FROM auth.users u WHERE u.id = _user_id;
  base := COALESCE(base, now());

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
     WHERE id = _user_id AND trial_used = true AND trial_ends_at IS NOT NULL
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
    (_user_id, 'trial', 'trialing', 'none', base, base + interval '10 days',
     base, base + interval '10 days')
  RETURNING * INTO s;

  UPDATE public.profiles
     SET trial_started_at = COALESCE(trial_started_at, s.trial_started_at),
         trial_ends_at = COALESCE(trial_ends_at, s.trial_ends_at),
         trial_used = true,
         subscription_status = CASE
           WHEN subscription_status = 'active' THEN subscription_status
           ELSE 'trialing' END,
         access_type = COALESCE(access_type, 'trial'),
         access_granted_at = COALESCE(access_granted_at, s.created_at),
         referral_status = CASE
           WHEN referrer_user_id IS NOT NULL THEN 'em_periodo_gratuito'
           ELSE referral_status END
   WHERE id = _user_id;

  RETURN s;
END;
$function$;

-- Reparo idempotente: contas recentes sem datas de trial corretas.
CREATE OR REPLACE FUNCTION public.repair_trial_window(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base timestamptz;
  p public.profiles;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_user');
  END IF;

  PERFORM set_config('imag.trusted_write', 'on', true);

  SELECT u.created_at INTO base FROM auth.users u WHERE u.id = _user_id;
  IF base IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth_user');
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
  END IF;

  -- Nunca mexe em quem já tem acesso pago/vitalício.
  IF p.access_type IN ('lifetime','admin','test','ambassador')
     OR p.subscription_status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'paid_access');
  END IF;

  -- Só repara contas com menos de 10 dias e sem janela de trial registrada.
  IF base + interval '10 days' <= now() THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'window_elapsed');
  END IF;

  IF p.trial_started_at IS NOT NULL AND p.trial_ends_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_set',
      'trial_ends_at', p.trial_ends_at);
  END IF;

  UPDATE public.profiles
     SET trial_started_at = COALESCE(trial_started_at, base),
         trial_ends_at = COALESCE(trial_ends_at, base + interval '10 days'),
         trial_used = true,
         subscription_status = 'trialing',
         access_type = COALESCE(access_type, 'trial'),
         access_granted_at = COALESCE(access_granted_at, base)
   WHERE id = _user_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = _user_id
  ) THEN
    INSERT INTO public.subscriptions
      (user_id, plan, status, provider, trial_started_at, trial_ends_at,
       current_period_start, current_period_end)
    VALUES
      (_user_id, 'trial', 'trialing', 'none', base, base + interval '10 days',
       base, base + interval '10 days');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'repaired',
    'trial_ends_at', base + interval '10 days');
END;
$function$;

-- Bootstrap passa a reparar a janela do trial também.
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
    PERFORM public.repair_trial_window(uid);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'created_profile', created_profile,
    'hasAccess', public.has_active_access(uid)
  );
END;
$function$;

-- handle_new_user: garante trial e registra falhas em vez de silenciá-las por completo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_amb boolean := public.is_ambassador_email(NEW.email);
BEGIN
  INSERT INTO public.profiles (id, full_name, email, has_access, access_type, access_granted_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    is_amb,
    CASE WHEN is_amb THEN 'ambassador' ELSE NULL END,
    CASE WHEN is_amb THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT is_amb THEN
    BEGIN
      PERFORM public.ensure_trial_subscription(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[handle_new_user] trial nao criado para %: %', NEW.id, SQLERRM;
      BEGIN
        PERFORM set_config('imag.trusted_write', 'on', true);
        UPDATE public.profiles
           SET trial_started_at = COALESCE(trial_started_at, NEW.created_at, now()),
               trial_ends_at = COALESCE(trial_ends_at, COALESCE(NEW.created_at, now()) + interval '10 days'),
               trial_used = true,
               subscription_status = 'trialing',
               access_type = COALESCE(access_type, 'trial'),
               access_granted_at = COALESCE(access_granted_at, now())
         WHERE id = NEW.id;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- Garante que o gatilho está ativo em auth.users.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.repair_trial_window(uuid) TO authenticated, service_role;