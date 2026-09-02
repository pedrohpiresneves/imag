-- 1) Memória profissional viva
CREATE TABLE public.professional_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  narrative text,
  execution_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_built_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_context TO authenticated;
GRANT ALL ON public.professional_context TO service_role;
ALTER TABLE public.professional_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own professional context" ON public.professional_context
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER professional_context_touch BEFORE UPDATE ON public.professional_context
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Arcos de direção
CREATE TABLE public.direction_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  objective text,
  bottleneck text,
  status text NOT NULL DEFAULT 'active',
  progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direction_arcs_user_status_idx ON public.direction_arcs (user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_arcs TO authenticated;
GRANT ALL ON public.direction_arcs TO service_role;
ALTER TABLE public.direction_arcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own direction arcs" ON public.direction_arcs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER direction_arcs_touch BEFORE UPDATE ON public.direction_arcs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Sinais anônimos de eficácia
CREATE TABLE public.direction_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_key text NOT NULL,
  profession text,
  objective text,
  executed boolean NOT NULL DEFAULT false,
  positive boolean,
  time_bucket text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direction_signals_key_idx ON public.direction_signals (strategy_key, profession);
GRANT SELECT, INSERT ON public.direction_signals TO authenticated;
GRANT ALL ON public.direction_signals TO service_role;
ALTER TABLE public.direction_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals readable" ON public.direction_signals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "signals insertable" ON public.direction_signals
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4) Continuidade nas metas
ALTER TABLE public.user_plans
  ADD COLUMN arc_id uuid REFERENCES public.direction_arcs(id) ON DELETE SET NULL,
  ADD COLUMN parent_plan_id uuid REFERENCES public.user_plans(id) ON DELETE SET NULL,
  ADD COLUMN strategy_key text,
  ADD COLUMN decision jsonb,
  ADD COLUMN expected_signal text,
  ADD COLUMN difficulty smallint;
CREATE INDEX user_plans_arc_idx ON public.user_plans (arc_id);