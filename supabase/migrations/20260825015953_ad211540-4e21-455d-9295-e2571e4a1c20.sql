CREATE OR REPLACE FUNCTION public.get_active_circle_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.circles;
  members jsonb;
  member_count int := 0;
  done_today int := 0;
  week_done int := 0;
  week_days int := 7;
BEGIN
  IF uid IS NULL THEN RETURN 'null'::jsonb; END IF;

  SELECT c2.* INTO c FROM public.circles c2
    JOIN public.circle_members m ON m.circle_id = c2.id AND m.user_id = uid
   WHERE c2.status = 'active' AND c2.ends_at > now()
   ORDER BY c2.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;

  WITH mm AS (
    SELECT m.user_id, p.full_name, p.avatar_url,
           s.streak,
           EXISTS (
             SELECT 1 FROM public.user_plans up
              WHERE up.user_id = m.user_id AND up.status = 'completed'
                AND up.completed_at IS NOT NULL
                AND ((up.completed_at AT TIME ZONE 'America/Sao_Paulo')::date)
                    = ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
           ) AS done_today,
           (
             SELECT count(DISTINCT ((up.completed_at AT TIME ZONE 'America/Sao_Paulo')::date))
               FROM public.user_plans up
              WHERE up.user_id = m.user_id AND up.status = 'completed'
                AND up.completed_at IS NOT NULL
                AND ((up.completed_at AT TIME ZONE 'America/Sao_Paulo')::date)
                    > ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 7)
           )::int AS week_days_done
      FROM public.circle_members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
      CROSS JOIN LATERAL public.circle_member_stats(m.user_id, c.starts_at, LEAST(c.ends_at, now())) s
     WHERE m.circle_id = c.id
  )
  SELECT jsonb_agg(jsonb_build_object(
           'userId', mm.user_id,
           'name', COALESCE(NULLIF(split_part(mm.full_name, ' ', 1), ''), 'Membro'),
           'avatarUrl', mm.avatar_url,
           'isMe', (mm.user_id = uid),
           'streak', mm.streak,
           'doneToday', mm.done_today
         ) ORDER BY (mm.user_id = uid) DESC, mm.full_name),
         count(*)::int,
         count(*) FILTER (WHERE mm.done_today)::int,
         COALESCE(sum(mm.week_days_done), 0)::int
    INTO members, member_count, done_today, week_done
    FROM mm;

  RETURN jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'members', COALESCE(members, '[]'::jsonb),
    'memberCount', member_count,
    'doneToday', done_today,
    'weekProgress', CASE WHEN member_count = 0 THEN 0
      ELSE LEAST(100, ROUND(week_done::numeric * 100 / (member_count * week_days)))::int END,
    'daysLeft', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.ends_at - now())) / 86400)::int)
  );
END;
$$;