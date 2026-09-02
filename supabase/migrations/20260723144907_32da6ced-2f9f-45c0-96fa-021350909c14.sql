-- ============================================================
-- Fase 3 — Dashboard Inteligente / Memória Adaptativa
-- Registra a reflexão noturna do usuário sobre o plano ativo:
--  "você conseguiu?" -> status + o que aconteceu + o que ficou.
-- Esses registros alimentam o próximo diagnóstico da MAG.
-- ============================================================

CREATE TABLE public.plan_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.user_plans(id) ON DELETE SET NULL,
  -- outcome: como o dia foi em relação à prioridade
  outcome text NOT NULL CHECK (outcome IN ('done', 'partial', 'blocked', 'skipped')),
  -- o que aconteceu de verdade (texto livre, curto)
  note text,
  -- humor/energia percebida (1-5) — opcional
  energy smallint CHECK (energy IS NULL OR (energy >= 1 AND energy <= 5)),
  reflected_for date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Um check-in por plano por dia (o mais recente prevalece via app).
CREATE INDEX plan_reflections_user_date_idx
  ON public.plan_reflections (user_id, reflected_for DESC);
CREATE INDEX plan_reflections_plan_idx
  ON public.plan_reflections (plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_reflections TO authenticated;
GRANT ALL ON public.plan_reflections TO service_role;

ALTER TABLE public.plan_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_plan_reflections_select"
  ON public.plan_reflections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "own_plan_reflections_insert"
  ON public.plan_reflections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_plan_reflections_update"
  ON public.plan_reflections FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_plan_reflections_delete"
  ON public.plan_reflections FOR DELETE TO authenticated
  USING (user_id = auth.uid());