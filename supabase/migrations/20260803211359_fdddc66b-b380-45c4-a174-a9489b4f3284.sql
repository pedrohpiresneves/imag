CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'infinitepay',
  plan text NOT NULL CHECK (plan IN ('monthly','annual')),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','canceled','expired','refunded')),
  external_order_id text NOT NULL,
  external_transaction_id text,
  checkout_url text,
  raw_provider_status jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE UNIQUE INDEX payment_transactions_external_order_id_key
  ON public.payment_transactions (external_order_id);
CREATE UNIQUE INDEX payment_transactions_external_transaction_id_key
  ON public.payment_transactions (external_transaction_id)
  WHERE external_transaction_id IS NOT NULL;
CREATE INDEX payment_transactions_user_idx
  ON public.payment_transactions (user_id, created_at DESC);

GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment attempts"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_payment_transactions_touch
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();