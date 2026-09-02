
-- 1. Novos campos em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_renews_at timestamptz;

-- 2. Ampliar tipos de acesso permitidos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_access_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_access_type_check
  CHECK (access_type IS NULL OR access_type = ANY (ARRAY['lifetime','subscription','manual','trial','annual']));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['none','trialing','active','expired','canceled']));

-- 3. Guard ampliado — proteger novos campos contra alteração pelo cliente
CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_role_name TEXT := current_setting('role', true);
BEGIN
  IF current_role_name IN ('service_role','postgres','supabase_admin') THEN
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
$$;

-- 4. Função central de acesso
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND (
        -- Assinatura anual vigente
        (p.subscription_status = 'active'
          AND (p.subscription_renews_at IS NULL OR p.subscription_renews_at > now()))
        -- Trial vigente
        OR (p.subscription_status = 'trialing'
          AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
        -- Acesso vitalício legado
        OR (p.has_access = true AND p.access_type = 'lifetime')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated, anon, service_role;

-- 5. Ativação idempotente do trial (chamada via server function autenticada)
CREATE OR REPLACE FUNCTION public.activate_trial_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Já tem acesso vitalício ou assinatura ativa: nada a fazer.
  IF p.has_access = true AND p.access_type = 'lifetime' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'lifetime');
  END IF;
  IF p.subscription_status = 'active' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'active');
  END IF;

  -- Já usou o trial antes: não reiniciar.
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
         access_granted_at = now()
   WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'status', 'trialing',
    'trial_ends_at', (now() + interval '10 days'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_trial_for_current_user() TO authenticated;
