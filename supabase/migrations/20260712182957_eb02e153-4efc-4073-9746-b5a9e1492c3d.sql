-- ============================================================
-- Payment Provider Layer: catálogo, pedidos, pagamentos, direitos
-- ============================================================

-- Roles (padrão seguro)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products public read" ON public.products;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (active = true);

-- Preços
CREATE TABLE IF NOT EXISTS public.prices (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  interval text, -- null=one_time, 'month','year'
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prices TO anon, authenticated;
GRANT ALL ON public.prices TO service_role;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prices public read" ON public.prices;
CREATE POLICY "prices public read" ON public.prices FOR SELECT TO anon, authenticated USING (active = true);

-- Cupons
CREATE TABLE IF NOT EXISTS public.coupons (
  code text PRIMARY KEY,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coupons public read active" ON public.coupons;
CREATE POLICY "coupons public read active" ON public.coupons FOR SELECT TO anon, authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  product_id text NOT NULL REFERENCES public.products(id),
  price_id text NOT NULL REFERENCES public.prices(id),
  coupon_code text REFERENCES public.coupons(code),
  subtotal_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_email_idx ON public.orders(email);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own orders read" ON public.orders;
CREATE POLICY "own orders read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Pagamentos (tentativas)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'infinitepay','stripe','mercadopago','manual'
  provider_intent_id text,
  method text NOT NULL CHECK (method IN ('pix','card','boleto','manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled','refunded')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  pix_qr_code text,
  pix_copy_paste text,
  raw_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_intent_id)
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments(order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own payments read" ON public.payments;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

-- Entitlements (o que o usuário tem acesso)
CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id),
  source text NOT NULL CHECK (source IN ('payment','subscription','manual','grant')),
  source_ref text, -- payment.id, subscription.id...
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (user_id, product_id, source_ref)
);
CREATE INDEX IF NOT EXISTS entitlements_user_idx ON public.entitlements(user_id);
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own entitlements read" ON public.entitlements;
CREATE POLICY "own entitlements read" ON public.entitlements FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Subscriptions (pronto para futuro)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id),
  price_id text NOT NULL REFERENCES public.prices(id),
  provider text NOT NULL,
  provider_subscription_id text,
  status text NOT NULL,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subs read" ON public.subscriptions;
CREATE POLICY "own subs read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Webhook events (idempotência)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- sem policies: só service_role

-- Affiliates (estrutura pronta, inativa)
CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  commission_percent integer NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own affiliate read" ON public.affiliates;
CREATE POLICY "own affiliate read" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own commissions read" ON public.affiliate_commissions;
CREATE POLICY "own commissions read" ON public.affiliate_commissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

-- Triggers de updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_products_touch ON public.products;
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_orders_touch ON public.orders;
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_payments_touch ON public.payments;
CREATE TRIGGER trg_payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_subs_touch ON public.subscriptions;
CREATE TRIGGER trg_subs_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed do produto Agenda Magnética
INSERT INTO public.products (id, name, description)
VALUES ('agenda_magnetica', 'Agenda Magnética', 'Acesso vitalício ao manual completo (9 capítulos + PDF)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.prices (id, product_id, amount_cents, currency, interval)
VALUES ('agenda_magnetica_lifetime', 'agenda_magnetica', 9700, 'BRL', NULL)
ON CONFLICT (id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;

-- Backfill: purchases legadas -> entitlements
INSERT INTO public.entitlements (user_id, product_id, source, source_ref, status, granted_at)
SELECT p.user_id, 'agenda_magnetica', 'payment', COALESCE(p.stripe_session_id, p.user_id::text), 'active', COALESCE(p.paid_at, p.created_at)
FROM public.purchases p
WHERE p.status = 'paid'
ON CONFLICT (user_id, product_id, source_ref) DO NOTHING;
