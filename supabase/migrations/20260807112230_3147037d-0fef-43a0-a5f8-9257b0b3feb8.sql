
CREATE OR REPLACE FUNCTION public.get_direction_confidence(_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  real_useful integer := 0;
  real_total integer := 0;
BEGIN
  SELECT count(*) FILTER (WHERE useful), count(*)
    INTO real_useful, real_total
    FROM public.direction_impacts
   WHERE direction_title IS NOT NULL
     AND lower(btrim(direction_title)) = lower(btrim(coalesce(_title, '')));

  -- Sem amostra real suficiente: não devolve número algum.
  IF real_total < 5 THEN
    RETURN jsonb_build_object('applied', 0, 'pct', 0);
  END IF;

  RETURN jsonb_build_object(
    'applied', real_total,
    'pct', round((real_useful::numeric / real_total) * 100)::int
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_impact_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  real_useful integer := 0;
  real_total integer := 0;
  real_month integer := 0;
  followed_today integer := 0;
  me uuid := auth.uid();
BEGIN
  SELECT count(*) FILTER (WHERE useful), count(*)
    INTO real_useful, real_total
    FROM public.direction_impacts;

  SELECT count(*) INTO real_month
    FROM public.user_plans
   WHERE status = 'completed'
     AND updated_at >= date_trunc('month', now());

  SELECT count(DISTINCT user_id) INTO followed_today
    FROM public.user_plans
   WHERE status = 'completed'
     AND updated_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'stories', COALESCE((
      SELECT jsonb_agg(x ORDER BY ord)
      FROM (
        SELECT jsonb_build_object(
          'id', d.id,
          'profession', COALESCE(NULLIF(d.profession, ''), 'Profissional iMAG'),
          'story', d.outcome_text,
          'validations', COALESCE((
            SELECT count(*) FROM public.direction_impacts di
             WHERE di.useful
               AND di.direction_title IS NOT NULL
               AND d.direction_title IS NOT NULL
               AND lower(btrim(di.direction_title)) = lower(btrim(d.direction_title))
          ), 0),
          'direction', d.direction_title,
          'howApplied', (
            SELECT NULLIF(btrim(p.priority_reason), '')
              FROM public.user_plans p
             WHERE p.id = d.goal_id
          ),
          'fullResult', NULL,
          'hoursAgo', GREATEST(0, round(EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0, 2)),
          'authorName', CASE WHEN me IS NOT NULL AND d.user_id = me THEN NULLIF(d.author_name, '') ELSE NULL END,
          'isMine', (me IS NOT NULL AND d.user_id = me),
          'isDemo', false) AS x,
          GREATEST(0, EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0) AS ord
        FROM public.direction_impacts d
        WHERE d.published AND d.outcome_text IS NOT NULL AND length(btrim(d.outcome_text)) > 0
      ) q
    ), '[]'::jsonb),
    'ranking', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id, 'position', w.position,
        'title', w.title, 'successPct', w.success_pct)
        ORDER BY w.position)
      FROM public.impact_weekly_directions w WHERE w.active
    ), '[]'::jsonb),
    'community', jsonb_build_object(
      'professionalsToday', followed_today,
      'newClients', real_useful,
      'usefulPct', CASE WHEN real_total >= 20
        THEN round((real_useful::numeric / real_total) * 100)::int ELSE 0 END,
      'metasMonth', real_month
    )
  );
END;
$function$;
