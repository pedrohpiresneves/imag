-- 1) Tabela de assinaturas Stripe (isolada da InfinitePay)
CREATE TABLE public.stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  price_lookup_key text NOT NULL,        -- 'imag_mensal_recorrente' | 'imag_anual_recorrente'
  status text NOT NULL,                   -- trialing/active/past_due/canceled/incomplete/...
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  past_due_since timestamptz,
  first_invoice_paid_at timestamptz,     -- marca liberação de comissão
  raw_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, stripe_subscription_id)
);

CREATE INDEX stripe_subscriptions_user_env_idx
  ON public.stripe_subscriptions(user_id, environment, status);
CREATE INDEX stripe_subscriptions_customer_idx
  ON public.stripe_subscriptions(environment, stripe_customer_id);

GRANT SELECT ON public.stripe_subscriptions TO authenticated;
GRANT ALL ON public.stripe_subscriptions TO service_role;

ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own stripe subs read"
  ON public.stripe_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_stripe_subs_touch
  BEFORE UPDATE ON public.stripe_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Log idempotente de eventos Stripe
CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, stripe_event_id)
);

CREATE INDEX stripe_webhook_events_created_idx
  ON public.stripe_webhook_events(created_at DESC);

GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policy = nenhum usuário lê; apenas service_role.

-- 3) Perfis: customer Stripe reutilizável
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id_sandbox text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id_live text;

-- 4) Comissões do Círculo aceitam ancoragem Stripe (assinatura + fatura)
ALTER TABLE public.referral_commissions
  ALTER COLUMN payment_id DROP NOT NULL,
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'infinitepay'
    CHECK (source IN ('infinitepay','stripe')),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS environment text;

CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_stripe_invoice_key
  ON public.referral_commissions(environment, stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

-- 5) Nova regra de acesso: soma InfinitePay + Stripe
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Caminho 1: perfil (InfinitePay/trial/vitalício) — comportamento anterior
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          (p.subscription_status = 'active'
            AND (p.subscription_renews_at IS NULL OR p.subscription_renews_at > now()))
          OR (p.subscription_status = 'trialing'
            AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
          OR (p.has_access = true AND p.access_type = 'lifetime')
        )
    )
    -- Caminho 2: assinatura Stripe válida (qualquer ambiente durante teste;
    -- filtro por env será adicionado antes de go-live — ver checklist).
    OR EXISTS (
      SELECT 1 FROM public.stripe_subscriptions s
      WHERE s.user_id = _user_id
        AND (
          -- Trial vigente
          (s.status = 'trialing' AND s.trial_end IS NOT NULL AND s.trial_end > now())
          -- Ativa com período vigente (ou sem período informado)
          OR (s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          -- Cancelada mas ainda dentro do período pago
          OR (s.status = 'canceled'
              AND s.current_period_end IS NOT NULL
              AND s.current_period_end > now())
          -- Past due com janela de graça de 3 dias após virada de período
          OR (s.status = 'past_due'
              AND s.past_due_since IS NOT NULL
              AND s.past_due_since > now() - interval '3 days')
        )
    );
$function$;

-- 6) Helper para o painel de embaixadores (opcional): lista assinaturas Stripe do usuário
COMMENT ON TABLE public.stripe_subscriptions IS
  'Assinaturas Stripe (ambos ambientes). Fonte da verdade para acesso via Stripe.';
COMMENT ON TABLE public.stripe_webhook_events IS
  'Log idempotente de eventos Stripe recebidos, por ambiente.';