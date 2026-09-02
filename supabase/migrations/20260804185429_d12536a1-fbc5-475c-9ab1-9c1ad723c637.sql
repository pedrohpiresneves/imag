CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Acesso vitalício / administrativo / de teste
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          p.access_type IN ('lifetime','admin','test')
          OR (p.subscription_status = 'active'
              AND (p.subscription_renews_at IS NULL OR p.subscription_renews_at > now()))
          OR (p.subscription_status = 'trialing'
              AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
        )
    )
    -- Papel de administrador
    OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _user_id AND r.role = 'admin'
    )
    -- Assinatura/teste na tabela central de assinaturas
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
    -- Stripe (modelo legado)
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
$function$;

-- get_access_state passa a reconhecer vitalício/admin/test também
CREATE OR REPLACE FUNCTION public.get_access_state(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Backfill: espelha no perfil o período gratuito/assinatura já existente
UPDATE public.profiles p
   SET trial_started_at = COALESCE(p.trial_started_at, s.trial_started_at),
       trial_ends_at = COALESCE(p.trial_ends_at, s.trial_ends_at),
       trial_used = true,
       subscription_status = CASE
         WHEN p.subscription_status IN ('active') THEN p.subscription_status
         ELSE s.status END,
       access_type = COALESCE(p.access_type, s.plan)
  FROM public.subscriptions s
 WHERE s.user_id = p.id
   AND s.status IN ('trialing','active')
   AND (p.subscription_status IS NULL OR p.subscription_status = 'none');

-- Backfill: usuários antigos sem nenhuma assinatura ganham o período gratuito
INSERT INTO public.subscriptions
  (user_id, plan, status, provider, trial_started_at, trial_ends_at,
   current_period_start, current_period_end)
SELECT p.id, 'trial', 'trialing', 'none', now(), now() + interval '10 days',
       now(), now() + interval '10 days'
  FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id)
   AND COALESCE(p.access_type, '') NOT IN ('lifetime','admin','test');

UPDATE public.profiles p
   SET trial_started_at = COALESCE(p.trial_started_at, s.trial_started_at),
       trial_ends_at = COALESCE(p.trial_ends_at, s.trial_ends_at),
       trial_used = true,
       subscription_status = 'trialing',
       access_type = COALESCE(p.access_type, 'trial')
  FROM public.subscriptions s
 WHERE s.user_id = p.id
   AND s.status = 'trialing'
   AND (p.subscription_status IS NULL OR p.subscription_status = 'none');