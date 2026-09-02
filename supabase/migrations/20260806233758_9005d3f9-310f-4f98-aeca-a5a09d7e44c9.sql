CREATE OR REPLACE FUNCTION public.get_impact_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.impact_community_baseline;
  real_useful integer := 0;
  real_total integer := 0;
  real_month integer := 0;
  real_published integer := 0;
  demo_slots integer := 0;
BEGIN
  SELECT * INTO b FROM public.impact_community_baseline WHERE id = 1;

  SELECT count(*) FILTER (WHERE useful), count(*)
    INTO real_useful, real_total
    FROM public.direction_impacts;

  SELECT count(*) INTO real_month
    FROM public.user_plans
   WHERE status = 'completed'
     AND updated_at >= date_trunc('month', now());

  SELECT count(*) INTO real_published
    FROM public.direction_impacts d
   WHERE d.published AND d.outcome_text IS NOT NULL AND length(btrim(d.outcome_text)) > 0;

  demo_slots := GREATEST(0, 5 - real_published);

  RETURN jsonb_build_object(
    'stories', COALESCE((
      SELECT jsonb_agg(x)
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
          'howApplied', NULL,
          'fullResult', NULL,
          'hoursAgo', GREATEST(0, round(EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0, 2)),
          'authorName', NULLIF(d.author_name, ''),
          'isDemo', false) AS x,
          GREATEST(0, EXTRACT(EPOCH FROM (now() - d.created_at)) / 3600.0) AS ord,
          0 AS grp
        FROM public.direction_impacts d
        WHERE d.published AND d.outcome_text IS NOT NULL AND length(btrim(d.outcome_text)) > 0
        UNION ALL
        SELECT jsonb_build_object(
          'id', s.id,
          'profession', NULL,
          'story', s.story,
          'validations', 0,
          'direction', s.direction_text,
          'howApplied', s.how_applied,
          'fullResult', NULL,
          'hoursAgo', NULL,
          'authorName', NULL,
          'isDemo', true) AS x,
          s.position::numeric AS ord,
          1 AS grp
        FROM public.impact_stories s
        WHERE s.active AND demo_slots > 0
        ORDER BY grp, ord
        LIMIT (real_published + demo_slots)
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