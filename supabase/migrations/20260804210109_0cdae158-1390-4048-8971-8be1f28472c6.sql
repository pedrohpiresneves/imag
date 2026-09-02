ALTER TABLE public.impact_stories
  ADD COLUMN IF NOT EXISTS direction_text text,
  ADD COLUMN IF NOT EXISTS how_applied text,
  ADD COLUMN IF NOT EXISTS full_result text,
  ADD COLUMN IF NOT EXISTS hours_ago integer NOT NULL DEFAULT 1;

UPDATE public.impact_stories SET
  direction_text = 'Voltei a falar com clientes antigos com uma nova abordagem.',
  how_applied = 'Separei os contatos parados há mais de 90 dias e enviei uma mensagem curta e pessoal, sem oferta direta.',
  full_result = 'Três respostas no mesmo dia e um cliente retomou o processo que estava parado.',
  hours_ago = 2
WHERE profession = 'Advogado';

UPDATE public.impact_stories SET
  direction_text = 'Enviei uma mensagem para pacientes inativos.',
  how_applied = 'Listei os pacientes sem retorno há mais de 6 meses e mandei um lembrete de avaliação.',
  full_result = 'A agenda da semana seguinte fechou completa de avaliações.',
  hours_ago = 1
WHERE profession = 'Dentista';

UPDATE public.impact_stories SET
  direction_text = 'Retomei contato com leads antigos com uma nova abordagem.',
  how_applied = 'Escolhi cinco leads antigos e enviei uma atualização real do imóvel em vez de uma cobrança.',
  full_result = 'Duas visitas marcadas para imóveis que estavam parados há meses.',
  hours_ago = 3
WHERE profession = 'Corretor de imóveis';

UPDATE public.impact_stories SET
  direction_text = 'Fiz um acompanhamento estratégico propondo os próximos passos.',
  how_applied = 'Enviei um resumo do projeto com prazos e o próximo passo já definido.',
  full_result = 'Proposta aprovada depois de semanas parada em negociação.',
  hours_ago = 5
WHERE profession = 'Arquiteta';

UPDATE public.impact_stories SET
  direction_text = 'Criei uma oferta simples para reativar pacientes.',
  how_applied = 'Divulguei nos stories e mandei individualmente para quem já tinha feito tratamento.',
  full_result = 'Cinco pacientes antigos remarcaram atendimento na mesma semana.',
  hours_ago = 6
WHERE profession = 'Fisioterapeuta';

UPDATE public.impact_stories SET
  direction_text = 'Fiz um follow-up curto nas propostas enviadas.',
  how_applied = 'Retomei cada proposta com uma pergunta objetiva sobre a decisão.',
  full_result = 'Três respostas em 48 horas e um projeto fechado.',
  hours_ago = 8
WHERE profession = 'Designer';

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
        'story', s.story, 'validations', s.validations,
        'direction', s.direction_text, 'howApplied', s.how_applied,
        'fullResult', s.full_result, 'hoursAgo', s.hours_ago)
        ORDER BY s.hours_ago)
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