-- 1) Ciclo de vida da Direção do Dia
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS adapted_at timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_focus_id uuid;

-- 2) Foco da semana
CREATE TABLE IF NOT EXISTS public.weekly_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  interpreted text NOT NULL,
  main_goal text,
  focus_kind text NOT NULL DEFAULT 'general',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metric_label text,
  metric_target integer,
  metric_progress integer NOT NULL DEFAULT 0,
  advances integer NOT NULL DEFAULT 0,
  review_summary text,
  end_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_focus TO authenticated;
GRANT ALL ON public.weekly_focus TO service_role;
ALTER TABLE public.weekly_focus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_focus_own" ON public.weekly_focus;
CREATE POLICY "weekly_focus_own" ON public.weekly_focus
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- apenas um foco ativo por usuário
CREATE UNIQUE INDEX IF NOT EXISTS weekly_focus_one_active
  ON public.weekly_focus (user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS weekly_focus_user_created
  ON public.weekly_focus (user_id, created_at DESC);

DROP TRIGGER IF EXISTS weekly_focus_touch ON public.weekly_focus;
CREATE TRIGGER weekly_focus_touch BEFORE UPDATE ON public.weekly_focus
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Recompensa proporcional para direção feita em parte (idempotente)
CREATE OR REPLACE FUNCTION public.partial_direction_with_reward(_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _awarded boolean := false;
  _balance integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.user_plans
     SET outcome = 'partial',
         outcome_at = COALESCE(outcome_at, now()),
         started_at = COALESCE(started_at, now())
   WHERE id = _plan_id AND user_id = _uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'direction not found';
  END IF;

  BEGIN
    INSERT INTO public.magnet_transactions (user_id, direction_id, reason, amount)
    VALUES (_uid, _plan_id, 'direction_partial', 5);
    _awarded := true;
  EXCEPTION WHEN unique_violation THEN
    _awarded := false;
  END;

  SELECT COALESCE(SUM(amount), 0) INTO _balance
    FROM public.magnet_transactions WHERE user_id = _uid;

  RETURN jsonb_build_object('awarded', _awarded, 'amount', CASE WHEN _awarded THEN 5 ELSE 0 END, 'balance', _balance);
END;
$$;

REVOKE ALL ON FUNCTION public.partial_direction_with_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partial_direction_with_reward(uuid) TO authenticated;