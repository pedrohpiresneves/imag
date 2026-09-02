ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_nsu text;

UPDATE public.orders
SET order_nsu = 'ord_' || replace(id::text, '-', '')
WHERE order_nsu IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN order_nsu SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_nsu_key ON public.orders (order_nsu);
CREATE INDEX IF NOT EXISTS orders_order_nsu_status_idx ON public.orders (order_nsu, status);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_type text,
  ADD COLUMN IF NOT EXISTS access_granted_at timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_access_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_access_type_check
      CHECK (access_type IS NULL OR access_type IN ('lifetime', 'subscription', 'manual'));
  END IF;
END $$;

UPDATE public.profiles p
SET
  has_access = true,
  access_type = 'lifetime',
  access_granted_at = COALESCE(p.access_granted_at, e.granted_at)
FROM public.entitlements e
WHERE e.user_id = p.id
  AND e.product_id = 'agenda_magnetica'
  AND e.status = 'active'
  AND (e.expires_at IS NULL OR e.expires_at > now())
  AND p.has_access IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS profiles_has_access_idx ON public.profiles (id, has_access);