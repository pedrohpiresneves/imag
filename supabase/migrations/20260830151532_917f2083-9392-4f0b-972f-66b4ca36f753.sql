ALTER TABLE public.weekly_focus
  ADD COLUMN IF NOT EXISTS pending_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommendation text;

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invalidation_reason text,
  ADD COLUMN IF NOT EXISTS alignment_score integer,
  ADD COLUMN IF NOT EXISTS engine_version text,
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE TABLE IF NOT EXISTS public.future_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  text text NOT NULL,
  source_focus_id uuid REFERENCES public.weekly_focus(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'saved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_goals TO authenticated;
GRANT ALL ON public.future_goals TO service_role;

ALTER TABLE public.future_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own future goals"
  ON public.future_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS future_goals_user_idx ON public.future_goals (user_id, status, created_at DESC);

CREATE TRIGGER future_goals_touch_updated_at
  BEFORE UPDATE ON public.future_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Correção dos registros atuais: direções pendentes desligadas do foco ativo
UPDATE public.user_plans p
SET status = 'invalidated_by_focus_change',
    is_active = false,
    invalidated_at = now(),
    invalidation_reason = 'focus_mismatch_cleanup'
WHERE p.completed_at IS NULL
  AND p.outcome IS NULL
  AND p.status NOT IN ('completed', 'invalidated_by_focus_change')
  AND (
    p.weekly_focus_id IS NULL
    OR p.weekly_focus_id NOT IN (
      SELECT f.id FROM public.weekly_focus f
      WHERE f.user_id = p.user_id AND f.status = 'active'
    )
  );