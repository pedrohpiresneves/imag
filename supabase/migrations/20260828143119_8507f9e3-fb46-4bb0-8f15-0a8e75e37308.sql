CREATE TABLE public.magnet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction_id uuid REFERENCES public.user_plans(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 10,
  reason text NOT NULL DEFAULT 'daily_direction_completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.magnet_transactions TO authenticated;
GRANT ALL ON public.magnet_transactions TO service_role;

ALTER TABLE public.magnet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own magnet transactions"
ON public.magnet_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE UNIQUE INDEX magnet_transactions_unique_reward
  ON public.magnet_transactions (user_id, direction_id, reason)
  WHERE direction_id IS NOT NULL;

CREATE INDEX magnet_transactions_user_idx ON public.magnet_transactions (user_id);

INSERT INTO public.magnet_transactions (user_id, direction_id, amount, reason, created_at)
SELECT DISTINCT ON (p.user_id, p.id)
       p.user_id, p.id, 10, 'daily_direction_completed', COALESCE(p.completed_at, now())
  FROM public.user_plans p
 WHERE p.status = 'completed'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.complete_direction_with_reward(_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.user_plans;
  awarded boolean := false;
  bal integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.user_plans WHERE id = _plan_id AND user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Direction not found' USING ERRCODE = 'P0002';
  END IF;

  IF p.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.user_plans
       SET status = 'completed', completed_at = COALESCE(completed_at, now())
     WHERE id = p.id;
  END IF;

  INSERT INTO public.magnet_transactions (user_id, direction_id, amount, reason)
  VALUES (uid, p.id, 10, 'daily_direction_completed')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS awarded = ROW_COUNT;

  SELECT COALESCE(sum(amount), 0)::int INTO bal
    FROM public.magnet_transactions WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'awarded', awarded, 'amount', CASE WHEN awarded THEN 10 ELSE 0 END, 'balance', bal);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_magnet_balance()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(sum(amount), 0)::int
    FROM public.magnet_transactions
   WHERE user_id = auth.uid();
$$;