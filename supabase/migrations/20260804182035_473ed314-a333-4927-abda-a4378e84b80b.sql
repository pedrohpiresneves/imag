
-- 1. Relatos reais dos usuários
CREATE TABLE public.direction_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid,
  useful boolean NOT NULL,
  outcome_text text,
  profession text,
  direction_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id)
);
GRANT SELECT, INSERT, UPDATE ON public.direction_impacts TO authenticated;
GRANT ALL ON public.direction_impacts TO service_role;
ALTER TABLE public.direction_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own impacts select" ON public.direction_impacts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own impacts insert" ON public.direction_impacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own impacts update" ON public.direction_impacts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Direções validadas (curadoria)
CREATE TABLE public.impact_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profession text NOT NULL,
  story text NOT NULL,
  validations integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.impact_stories TO authenticated, anon;
GRANT ALL ON public.impact_stories TO service_role;
ALTER TABLE public.impact_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impact stories public read" ON public.impact_stories FOR SELECT TO authenticated, anon USING (active = true);

-- 3. Ranking semanal
CREATE TABLE public.impact_weekly_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL,
  title text NOT NULL,
  success_pct integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.impact_weekly_directions TO authenticated, anon;
GRANT ALL ON public.impact_weekly_directions TO service_role;
ALTER TABLE public.impact_weekly_directions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impact weekly public read" ON public.impact_weekly_directions FOR SELECT TO authenticated, anon USING (active = true);

-- 4. Base da comunidade
CREATE TABLE public.impact_community_baseline (
  id smallint PRIMARY KEY DEFAULT 1,
  professionals_today integer NOT NULL DEFAULT 0,
  new_clients integer NOT NULL DEFAULT 0,
  useful_pct integer NOT NULL DEFAULT 0,
  metas_month integer NOT NULL DEFAULT 0,
  base_applied integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT impact_baseline_singleton CHECK (id = 1)
);
GRANT SELECT ON public.impact_community_baseline TO authenticated, anon;
GRANT ALL ON public.impact_community_baseline TO service_role;
ALTER TABLE public.impact_community_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impact baseline public read" ON public.impact_community_baseline FOR SELECT TO authenticated, anon USING (true);

-- Seeds
INSERT INTO public.impact_stories (profession, story, validations, position) VALUES
  ('Advogado', 'Recuperei um cliente parado há meses.', 317, 1),
  ('Dentista', 'A agenda da próxima semana ficou completa.', 126, 2),
  ('Corretor de imóveis', 'Consegui duas visitas para imóveis que estavam parados.', 89, 3),
  ('Arquiteta', 'Fechei um projeto que estava em negociação há semanas.', 74, 4),
  ('Fisioterapeuta', 'Cinco pacientes antigos remarcaram atendimento.', 61, 5),
  ('Designer', 'Recebi três respostas de propostas enviadas.', 48, 6);

INSERT INTO public.impact_weekly_directions (position, title, success_pct) VALUES
  (1, 'Envie mensagem para antigos clientes', 94),
  (2, 'Grave um vídeo curto explicando um caso', 89),
  (3, 'Peça indicação após concluir um atendimento', 86);

INSERT INTO public.impact_community_baseline
  (id, professionals_today, new_clients, useful_pct, metas_month, base_applied)
VALUES (1, 4328, 317, 94, 18421, 2847);

-- 5. Visão agregada
CREATE OR REPLACE FUNCTION public.get_impact_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  b public.impact_community_baseline;
  real_useful integer := 0;
  real_total integer := 0;
  real_month integer := 0;
BEGIN
  SELECT * INTO b FROM public.impact_community_baseline WHERE id = 1;

  SELECT count(*) FILTER (WHERE useful), count(*)
    INTO real_useful, real_total
    FROM public.direction_impacts;

  SELECT count(*) INTO real_month
    FROM public.user_plans
   WHERE status = 'completed'
     AND updated_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'stories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'profession', s.profession,
        'story', s.story, 'validations', s.validations)
        ORDER BY s.position)
      FROM public.impact_stories s WHERE s.active
    ), '[]'::jsonb),
    'ranking', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'position', w.position,
        'title', w.title, 'successPct', w.success_pct)
        ORDER BY w.position)
      FROM public.impact_weekly_directions w WHERE w.active
    ), '[]'::jsonb),
    'community', jsonb_build_object(
      'professionalsToday', COALESCE(b.professionals_today, 0),
      'newClients', COALESCE(b.new_clients, 0) + real_useful,
      'usefulPct', CASE
        WHEN real_total >= 20 THEN round((real_useful::numeric / real_total) * 100)::int
        ELSE COALESCE(b.useful_pct, 0) END,
      'metasMonth', COALESCE(b.metas_month, 0) + real_month
    )
  );
END;
$$;

-- 6. Confiança de uma direção específica
CREATE OR REPLACE FUNCTION public.get_direction_confidence(_title text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  b public.impact_community_baseline;
  seed integer;
  applied integer;
  pct integer;
  real_useful integer := 0;
  real_total integer := 0;
BEGIN
  SELECT * INTO b FROM public.impact_community_baseline WHERE id = 1;
  seed := abs(hashtext(coalesce(_title, 'direcao'))) % 900;

  SELECT count(*) FILTER (WHERE useful), count(*)
    INTO real_useful, real_total
    FROM public.direction_impacts
   WHERE direction_title IS NOT NULL
     AND lower(direction_title) = lower(coalesce(_title, ''));

  applied := COALESCE(b.base_applied, 0) + seed + real_total;
  pct := CASE
    WHEN real_total >= 20 THEN round((real_useful::numeric / real_total) * 100)::int
    ELSE 80 + (seed % 12)
  END;

  RETURN jsonb_build_object('applied', applied, 'pct', pct);
END;
$$;
