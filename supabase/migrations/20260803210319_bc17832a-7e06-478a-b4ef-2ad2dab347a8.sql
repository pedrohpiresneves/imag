-- 1) Amplia a tabela de assinaturas
ALTER TABLE public.subscriptions
  ALTER COLUMN product_id DROP NOT NULL,
  ALTER COLUMN price_id DROP NOT NULL,
  ALTER COLUMN provider SET DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS external_payment_id text;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('trial','monthly','annual'));

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','past_due','canceled','expired'));

-- Uma única assinatura vigente por usuário
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_user
  ON public.subscriptions (user_id)
  WHERE status IN ('trialing','active','past_due');

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_external_payment_idx
  ON public.subscriptions (payment_provider, external_payment_id)
  WHERE external_payment_id IS NOT NULL;

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- 2) Início automático do teste grátis (uma vez por conta)
CREATE OR REPLACE FUNCTION public.ensure_trial_subscription(_user_id uuid)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.subscriptions;
  ever_had boolean;
BEGIN
  SELECT * INTO s
    FROM public.subscriptions
   WHERE user_id = _user_id
     AND status IN ('trialing','active','past_due')
   ORDER BY created_at DESC
   LIMIT 1;
  IF FOUND THEN
    RETURN s;
  END IF;

  -- Teste só pode existir uma vez por conta
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

REVOKE ALL ON FUNCTION public.ensure_trial_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_trial_subscription(uuid) TO service_role;

-- RPC segura para o próprio usuário
CREATE OR REPLACE FUNCTION public.start_trial_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.subscriptions;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  s := public.ensure_trial_subscription(uid);
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'trial_already_used');
  END IF;
  RETURN jsonb_build_object('ok', true, 'plan', s.plan, 'status', s.status,
                            'trial_ends_at', s.trial_ends_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_trial_for_current_user() TO authenticated;

-- Trigger de cadastro: cria perfil + teste grátis
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    PERFORM public.ensure_trial_subscription(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- nunca bloquear o cadastro
  END;

  RETURN NEW;
END;
$$;

-- 3) Função central de acesso
CREATE OR REPLACE FUNCTION public.get_access_state(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.subscriptions;
  has_access boolean := false;
  ends_at timestamptz;
  days_left integer;
BEGIN
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

  -- Compatibilidade com o modelo legado (Stripe / vitalício)
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

GRANT EXECUTE ON FUNCTION public.get_access_state(uuid) TO authenticated, service_role;

-- Backfill: usuários existentes sem assinatura registrada
INSERT INTO public.subscriptions
  (user_id, plan, status, provider, payment_provider,
   trial_started_at, trial_ends_at, current_period_start, current_period_end)
SELECT p.id,
       CASE WHEN p.access_type = 'lifetime' THEN 'annual' ELSE 'trial' END,
       CASE
         WHEN p.has_access AND p.access_type = 'lifetime' THEN 'active'
         WHEN p.subscription_status = 'active' THEN 'active'
         WHEN p.subscription_status = 'trialing' AND p.trial_ends_at > now() THEN 'trialing'
         WHEN p.trial_used THEN 'expired'
         ELSE 'trialing'
       END,
       'none', NULL,
       COALESCE(p.trial_started_at, p.created_at),
       COALESCE(p.trial_ends_at, p.created_at + interval '10 days'),
       COALESCE(p.subscription_started_at, p.trial_started_at, p.created_at),
       COALESCE(p.subscription_renews_at, p.trial_ends_at, p.created_at + interval '10 days')
  FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id);