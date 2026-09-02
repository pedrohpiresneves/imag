
-- =========================================================================
-- CÍRCULO MAGNÉTICO — Sistema de indicação
-- =========================================================================

-- Enums ----------------------------------------------------------------------
CREATE TYPE public.ambassador_tier AS ENUM ('ambassador', 'pro', 'partner');
CREATE TYPE public.ambassador_status AS ENUM ('active', 'blocked', 'pending_review');
CREATE TYPE public.commission_status AS ENUM ('pending', 'available', 'paid', 'reversed', 'cancelled');
CREATE TYPE public.payout_status AS ENUM ('requested', 'processing', 'paid', 'failed');
CREATE TYPE public.payout_method AS ENUM ('pix', 'manual');
CREATE TYPE public.fraud_reason AS ENUM ('self_referral', 'duplicate_account', 'suspicious_ip', 'velocity', 'manual');

-- ambassadors ----------------------------------------------------------------
CREATE TABLE public.ambassadors (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  tier public.ambassador_tier NOT NULL DEFAULT 'ambassador',
  status public.ambassador_status NOT NULL DEFAULT 'active',
  pix_key TEXT,
  pix_key_type TEXT,
  terms_accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ambassadors_code_idx ON public.ambassadors (lower(code));
GRANT SELECT, UPDATE ON public.ambassadors TO authenticated;
GRANT ALL ON public.ambassadors TO service_role;
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ambassador row" ON public.ambassadors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ambassador update" ON public.ambassadors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ambassadors_updated BEFORE UPDATE ON public.ambassadors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- referral_clicks ------------------------------------------------------------
CREATE TABLE public.referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referer TEXT,
  landing_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX referral_clicks_code_idx ON public.referral_clicks (code, created_at DESC);
CREATE INDEX referral_clicks_iphash_idx ON public.referral_clicks (ip_hash, created_at DESC);
GRANT ALL ON public.referral_clicks TO service_role;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
-- sem policies pra authenticated: apenas server-side

-- referral_attributions ------------------------------------------------------
CREATE TABLE public.referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL,
  ambassador_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX referral_attributions_ambassador_idx ON public.referral_attributions (ambassador_user_id);
GRANT ALL ON public.referral_attributions TO service_role;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

-- referral_commissions -------------------------------------------------------
CREATE TABLE public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ambassador_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_user_id UUID,
  gross_amount_cents INTEGER NOT NULL,
  eligible_amount_cents INTEGER NOT NULL,
  rate_bps INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  release_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  payout_id UUID,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX referral_commissions_ambassador_idx ON public.referral_commissions (ambassador_user_id, status);
CREATE INDEX referral_commissions_release_idx ON public.referral_commissions (status, release_at);
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own commissions" ON public.referral_commissions FOR SELECT TO authenticated USING (auth.uid() = ambassador_user_id);
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.referral_commissions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- payouts --------------------------------------------------------------------
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  method public.payout_method NOT NULL DEFAULT 'pix',
  status public.payout_status NOT NULL DEFAULT 'requested',
  pix_key_snapshot TEXT,
  provider_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payouts_ambassador_idx ON public.payouts (ambassador_user_id, created_at DESC);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payouts" ON public.payouts FOR SELECT TO authenticated USING (auth.uid() = ambassador_user_id);
CREATE TRIGGER trg_payouts_updated BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.referral_commissions
  ADD CONSTRAINT referral_commissions_payout_fk FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;

-- referral_settings (singleton) ----------------------------------------------
CREATE TABLE public.referral_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_rate_bps INTEGER NOT NULL DEFAULT 2000,
  guarantee_days INTEGER NOT NULL DEFAULT 7,
  cookie_days INTEGER NOT NULL DEFAULT 30,
  min_payout_cents INTEGER NOT NULL DEFAULT 5000,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_settings TO authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.referral_settings FOR SELECT TO authenticated USING (true);
INSERT INTO public.referral_settings (id) VALUES (1);

-- referral_campaigns ---------------------------------------------------------
CREATE TABLE public.referral_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate_bps INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  code TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX referral_campaigns_active_idx ON public.referral_campaigns (active, starts_at, ends_at);
GRANT SELECT ON public.referral_campaigns TO authenticated;
GRANT ALL ON public.referral_campaigns TO service_role;
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns readable" ON public.referral_campaigns FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.referral_campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- fraud_flags ----------------------------------------------------------------
CREATE TABLE public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  commission_id UUID REFERENCES public.referral_commissions(id) ON DELETE CASCADE,
  reason public.fraud_reason NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fraud_flags_open_idx ON public.fraud_flags (resolved_at) WHERE resolved_at IS NULL;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- orders extensions ----------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_attribution_id UUID REFERENCES public.referral_attributions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_referrer_idx ON public.orders (referrer_user_id);

-- Backfill: cria embaixadores para todos com entitlement ativo ---------------
INSERT INTO public.ambassadors (user_id, code)
SELECT DISTINCT e.user_id,
  lower(
    regexp_replace(
      coalesce(split_part(u.email, '@', 1), 'amig'),
      '[^a-z0-9]', '', 'gi'
    )
  ) || substr(md5(e.user_id::text || random()::text), 1, 5)
FROM public.entitlements e
JOIN auth.users u ON u.id = e.user_id
WHERE e.status = 'active'
ON CONFLICT (user_id) DO NOTHING;
