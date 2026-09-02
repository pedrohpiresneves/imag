
-- 1) Campos de indicação no profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referrer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_attribution_id uuid,
  ADD COLUMN IF NOT EXISTS referral_attributed_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_status text;

CREATE INDEX IF NOT EXISTS profiles_referrer_user_id_idx
  ON public.profiles(referrer_user_id);

-- 2) Vincular atribuição (a partir de visitor_id em cookie) ao usuário autenticado
CREATE OR REPLACE FUNCTION public.link_referral_from_visitor(_visitor_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  attr record;
  amb_status text;
  existing_ref uuid;
  existing_attributed_at timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _visitor_id IS NULL OR length(_visitor_id) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_visitor');
  END IF;

  SELECT id, code, ambassador_user_id, expires_at, consumed_order_id
    INTO attr
    FROM public.referral_attributions
    WHERE visitor_id = _visitor_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_attribution');
  END IF;
  IF attr.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF attr.ambassador_user_id = uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  SELECT status INTO amb_status
    FROM public.ambassadors
    WHERE user_id = attr.ambassador_user_id;
  IF amb_status IS NULL OR amb_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ambassador_inactive');
  END IF;

  SELECT referrer_user_id, referral_attributed_at
    INTO existing_ref, existing_attributed_at
    FROM public.profiles
    WHERE id = uid;

  -- Preserva indicador original dentro da janela de 30 dias
  IF existing_ref IS NOT NULL THEN
    IF existing_attributed_at IS NULL
       OR existing_attributed_at > now() - interval '30 days' THEN
      RETURN jsonb_build_object('ok', true, 'kept_original', true,
        'code', (SELECT referral_code FROM public.profiles WHERE id = uid));
    END IF;
  END IF;

  UPDATE public.profiles
     SET referrer_user_id = attr.ambassador_user_id,
         referral_code = attr.code,
         referral_attribution_id = attr.id,
         referral_attributed_at = now(),
         referral_status = CASE
           WHEN subscription_status = 'trialing' THEN 'em_periodo_gratuito'
           WHEN has_access = true OR subscription_status = 'active' THEN 'venda_confirmada'
           ELSE 'cadastro_realizado'
         END
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'code', attr.code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_referral_from_visitor(text) TO authenticated;

-- 3) Atualiza ativação de trial para marcar status quando houver indicador
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

-- 4) Cron: marcar indicações que não converteram após o fim do trial
CREATE OR REPLACE FUNCTION public.mark_unconverted_referrals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.profiles
     SET referral_status = 'nao_converteu'
   WHERE referrer_user_id IS NOT NULL
     AND referral_status = 'em_periodo_gratuito'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now()
     AND (subscription_status IS NULL
          OR subscription_status IN ('trialing', 'expired', 'canceled', 'none'))
     AND (has_access = false OR has_access IS NULL OR access_type = 'trial');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_unconverted_referrals() FROM public, anon, authenticated;

-- 5) Política adicional: garantir que o próprio usuário leia seus campos (as políticas existentes de profiles já cobrem, mas confirmamos GRANT)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
