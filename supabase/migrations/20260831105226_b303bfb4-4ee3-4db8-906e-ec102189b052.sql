CREATE OR REPLACE FUNCTION public.get_my_circles()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('circles', '[]'::jsonb, 'invites', '[]'::jsonb); END IF;

  RETURN jsonb_build_object(
    'circles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'status', CASE WHEN c.status = 'active' AND c.ends_at > now() THEN 'active' ELSE 'finished' END,
        'challengeText', c.challenge_text,
        'daysLeft', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.ends_at - now())) / 86400)::int),
        'totalDays', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (c.ends_at - c.created_at)) / 86400)::int),
        'members', (SELECT count(*) FROM public.circle_members m2 WHERE m2.circle_id = c.id),
        'initials', COALESCE((
          SELECT jsonb_agg(upper(left(COALESCE(NULLIF(p2.full_name, ''), p2.handle, 'M'), 1)))
          FROM public.circle_members m3
          LEFT JOIN public.profiles p2 ON p2.id = m3.user_id
          WHERE m3.circle_id = c.id
        ), '[]'::jsonb),
        'isAdmin', (c.owner_id = uid),
        'inviteCode', c.invite_code
      ) ORDER BY (c.status = 'active' AND c.ends_at > now()) DESC, c.created_at DESC)
      FROM public.circles c
      JOIN public.circle_members m ON m.circle_id = c.id AND m.user_id = uid
    ), '[]'::jsonb),
    'invites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'circleId', c.id,
        'circleName', c.name,
        'challengeText', c.challenge_text,
        'from', COALESCE(NULLIF(p.full_name, ''), p.handle, 'Alguém da iMAG')
      ) ORDER BY i.created_at DESC)
      FROM public.circle_invites i
      JOIN public.circles c ON c.id = i.circle_id
      LEFT JOIN public.profiles p ON p.id = i.invited_by
      WHERE i.invited_user_id = uid AND i.status = 'pending' AND c.status = 'active'
    ), '[]'::jsonb)
  );
END;
$function$;