CREATE TABLE public.impact_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  impact_id uuid NOT NULL REFERENCES public.direction_impacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (impact_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.impact_reactions TO authenticated;
GRANT ALL ON public.impact_reactions TO service_role;

ALTER TABLE public.impact_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own reactions select" ON public.impact_reactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own reactions insert" ON public.impact_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own reactions delete" ON public.impact_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_impact_reactions_impact ON public.impact_reactions(impact_id);

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
            SELECT count(*) FROM public.impact_reactions r WHERE r.impact_id = d.id
          ), 0),
          'reacted', (me IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.impact_reactions r
             WHERE r.impact_id = d.id AND r.user_id = me
          )),
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