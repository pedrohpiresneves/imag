CREATE TABLE public.ambassador_emails (
  email text PRIMARY KEY,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_emails TO authenticated;
GRANT ALL ON public.ambassador_emails TO service_role;

ALTER TABLE public.ambassador_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ambassador emails"
ON public.ambassador_emails FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.normalize_email(_raw text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT lower(btrim(coalesce(_raw, ''))) $$;

CREATE OR REPLACE FUNCTION public.is_ambassador_email(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_emails a
    WHERE a.email = public.normalize_email(_email)
      AND public.normalize_email(_email) <> ''
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ambassador(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.ambassador_emails a
      ON a.email = public.normalize_email(p.email)
    WHERE p.id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.ambassador_emails a
      ON a.email = public.normalize_email(u.email)
    WHERE u.id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_ambassador(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          p.access_type IN ('lifetime','admin','test','ambassador')
          OR (p.subscription_status = 'active'
              AND (p.subscription_renews_at IS NULL OR p.subscription_renews_at > now()))
          OR (p.subscription_status = 'trialing'
              AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _user_id AND r.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND (
          (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now())
          OR (s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL
              AND s.current_period_end > now())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.stripe_subscriptions s
      WHERE s.user_id = _user_id
        AND (
          (s.status = 'trialing' AND s.trial_end IS NOT NULL AND s.trial_end > now())
          OR (s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled'
              AND s.current_period_end IS NOT NULL
              AND s.current_period_end > now())
          OR (s.status = 'past_due'
              AND s.past_due_since IS NOT NULL
              AND s.past_due_since > now() - interval '7 days')
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_trial_subscription(_user_id uuid)
RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.subscriptions;
  ever_had boolean;
BEGIN
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
           WHEN subscription_status IN ('active') THEN subscription_status
           ELSE 'trialing' END,
         access_type = COALESCE(access_type, 'trial'),
         access_granted_at = COALESCE(access_granted_at, now()),
         referral_status = CASE
           WHEN referrer_user_id IS NOT NULL THEN 'em_periodo_gratuito'
           ELSE referral_status END
   WHERE id = _user_id;

  RETURN s;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_trial_for_current_user()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.profiles;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.get_access_state(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s public.subscriptions;
  has_access boolean := false;
  ends_at timestamptz;
  days_left integer;
BEGIN
  IF public.is_ambassador(_user_id) THEN
    RETURN jsonb_build_object(
      'hasAccess', true, 'plan', 'ambassador', 'status', 'active',
      'isTrial', false, 'trialEndsAt', NULL, 'currentPeriodEnd', NULL,
      'canceledAt', NULL, 'paymentProvider', NULL, 'endsAt', NULL,
      'daysRemaining', NULL);
  END IF;

  SELECT * INTO s
    FROM public.subscriptions
   WHERE user_id = _user_id
   ORDER BY (status IN ('trialing','active','past_due')) DESC, created_at DESC
   LIMIT 1;

  IF s.id IS NOT NULL THEN
    IF s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now() THEN
      has_access := true; ends_at := s.trial_ends_at;
    ELSIF s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now()) THEN
      has_access := true; ends_at := s.current_period_end;
    ELSIF s.status = 'canceled' AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now() THEN
      has_access := true; ends_at := s.current_period_end;
    END IF;
  END IF;

  IF NOT has_access THEN
    has_access := public.has_active_access(_user_id);
  END IF;

  IF ends_at IS NOT NULL THEN
    days_left := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ends_at - now())) / 86400)::int);
  END IF;

  RETURN jsonb_build_object(
    'hasAccess', has_access,
    'plan', COALESCE(s.plan, 'none'),
    'status', COALESCE(s.status, 'none'),
    'isTrial', COALESCE(s.status = 'trialing', false),
    'trialEndsAt', s.trial_ends_at,
    'currentPeriodEnd', s.current_period_end,
    'canceledAt', s.canceled_at,
    'paymentProvider', s.payment_provider,
    'endsAt', ends_at,
    'daysRemaining', days_left
  );
END;
$$;