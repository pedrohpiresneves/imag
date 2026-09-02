-- Círculos: evolução coletiva guiada pela MAG
ALTER TABLE public.circles ADD COLUMN IF NOT EXISTS focus_label text;

CREATE TABLE IF NOT EXISTS public.circle_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  text text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, local_date)
);

CREATE TABLE IF NOT EXISTS public.circle_direction_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction_id uuid NOT NULL REFERENCES public.circle_directions(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (direction_id, user_id)
);

CREATE INDEX IF NOT EXISTS circle_directions_circle_idx ON public.circle_directions(circle_id, local_date DESC);
CREATE INDEX IF NOT EXISTS circle_checkins_circle_idx ON public.circle_direction_checkins(circle_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_directions TO authenticated;
GRANT ALL ON public.circle_directions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_direction_checkins TO authenticated;
GRANT ALL ON public.circle_direction_checkins TO service_role;

ALTER TABLE public.circle_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_direction_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "circle_directions_select" ON public.circle_directions;
CREATE POLICY "circle_directions_select" ON public.circle_directions FOR SELECT TO authenticated
  USING (public.is_circle_member(circle_id, auth.uid()));
DROP POLICY IF EXISTS "circle_directions_insert" ON public.circle_directions;
CREATE POLICY "circle_directions_insert" ON public.circle_directions FOR INSERT TO authenticated
  WITH CHECK (public.is_circle_member(circle_id, auth.uid()));

DROP POLICY IF EXISTS "circle_checkins_select" ON public.circle_direction_checkins;
CREATE POLICY "circle_checkins_select" ON public.circle_direction_checkins FOR SELECT TO authenticated
  USING (public.is_circle_member(circle_id, auth.uid()));
DROP POLICY IF EXISTS "circle_checkins_insert" ON public.circle_direction_checkins;
CREATE POLICY "circle_checkins_insert" ON public.circle_direction_checkins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_circle_member(circle_id, auth.uid()));
DROP POLICY IF EXISTS "circle_checkins_delete" ON public.circle_direction_checkins;
CREATE POLICY "circle_checkins_delete" ON public.circle_direction_checkins FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_circle_focus(_circle_id uuid, _focus text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  UPDATE public.circles SET focus_label = NULLIF(btrim(_focus), '')
   WHERE id = _circle_id AND owner_id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_circle_direction(_circle_id uuid, _local_date date, _text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT public.is_circle_member(_circle_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  INSERT INTO public.circle_directions (circle_id, local_date, text, created_by)
  VALUES (_circle_id, _local_date, btrim(_text), uid)
  ON CONFLICT (circle_id, local_date) DO NOTHING
  RETURNING id INTO rid;
  IF rid IS NULL THEN
    SELECT id INTO rid FROM public.circle_directions
     WHERE circle_id = _circle_id AND local_date = _local_date;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', rid);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_circle_direction(_circle_id uuid, _local_date date, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT public.is_circle_member(_circle_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT id INTO rid FROM public.circle_directions
   WHERE circle_id = _circle_id AND local_date = _local_date;
  IF rid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_direction'); END IF;

  INSERT INTO public.circle_direction_checkins (direction_id, circle_id, user_id, note)
  VALUES (rid, _circle_id, uid, NULLIF(btrim(_note), ''))
  ON CONFLICT (direction_id, user_id) DO NOTHING;

  PERFORM public.award_magnetos(uid, 'circle_direction_checkin', 2,
    'circle:' || _circle_id::text || ':' || _local_date::text);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_circle_focus(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_circle_direction(uuid, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.checkin_circle_direction(uuid, date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_circle_focus(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_circle_direction(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_circle_direction(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_circles()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('circles', '[]'::jsonb, 'invites', '[]'::jsonb); END IF;

  RETURN jsonb_build_object(
    'circles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'status', CASE WHEN c.status = 'active' AND c.ends_at > now() THEN 'active' ELSE 'finished' END,
        'challengeText', c.challenge_text,
        'focusLabel', c.focus_label,
        'todayDirection', (SELECT d.text FROM public.circle_directions d
                            WHERE d.circle_id = c.id AND d.local_date = today),
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
$$;

CREATE OR REPLACE FUNCTION public.get_circle_detail(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.circles;
  goal int;
  members jsonb;
  total_steps int := 0;
  member_count int := 0;
  my jsonb;
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  dir record;
  checkins jsonb := '[]'::jsonb;
  done_today int := 0;
  consistency int := 0;
  days_elapsed int := 1;
  total_checkins int := 0;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO c FROM public.circles WHERE id = _circle_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF NOT public.is_circle_member(c.id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  goal := public.circle_goal_per_member(c);

  WITH m AS (
    SELECT mm.user_id, mm.role,
           COALESCE(NULLIF(p.full_name, ''), p.handle, 'Participante') AS name,
           p.avatar_url,
           s.steps, s.active_days, s.streak
      FROM public.circle_members mm
      LEFT JOIN public.profiles p ON p.id = mm.user_id
      CROSS JOIN LATERAL public.circle_member_stats(mm.user_id, c.starts_at, LEAST(c.ends_at, now())) s
     WHERE mm.circle_id = c.id
  )
  SELECT jsonb_agg(jsonb_build_object(
           'userId', m.user_id,
           'name', split_part(m.name, ' ', 1),
           'avatarUrl', m.avatar_url,
           'isAdmin', (m.role = 'admin'),
           'isMe', (m.user_id = uid),
           'steps', m.steps,
           'streak', m.streak,
           'activeDays', m.active_days
         ) ORDER BY m.steps DESC, m.streak DESC, m.name),
         COALESCE(sum(m.steps), 0)::int,
         count(*)::int
    INTO members, total_steps, member_count
    FROM m;

  SELECT x INTO my FROM jsonb_array_elements(COALESCE(members, '[]'::jsonb)) x
   WHERE (x->>'userId')::uuid = uid;

  SELECT d.id AS id, d.text AS text INTO dir
    FROM public.circle_directions d
   WHERE d.circle_id = c.id AND d.local_date = today;

  IF dir.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'userId', ck.user_id,
             'name', split_part(COALESCE(NULLIF(p.full_name, ''), p.handle, 'Participante'), ' ', 1),
             'note', ck.note,
             'isMe', (ck.user_id = uid),
             'at', ck.created_at
           ) ORDER BY ck.created_at), '[]'::jsonb),
           count(*)::int
      INTO checkins, done_today
      FROM public.circle_direction_checkins ck
      LEFT JOIN public.profiles p ON p.id = ck.user_id
     WHERE ck.direction_id = dir.id;
  END IF;

  days_elapsed := GREATEST(1, (today - (c.starts_at AT TIME ZONE 'America/Sao_Paulo')::date) + 1);
  SELECT count(*)::int INTO total_checkins
    FROM public.circle_direction_checkins ck WHERE ck.circle_id = c.id;
  IF member_count > 0 THEN
    consistency := LEAST(100, round((total_checkins::numeric / (member_count * days_elapsed)) * 100)::int);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'circle', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'challengeKind', c.challenge_kind,
      'challengeText', c.challenge_text,
      'focusLabel', c.focus_label,
      'targetCount', c.target_count,
      'durationDays', c.duration_days,
      'startsAt', c.starts_at,
      'endsAt', c.ends_at,
      'status', CASE WHEN c.status = 'active' AND c.ends_at > now() THEN 'active' ELSE 'finished' END,
      'daysLeft', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.ends_at - now())) / 86400)::int),
      'inviteCode', c.invite_code,
      'isAdmin', (c.owner_id = uid)
    ),
    'today', jsonb_build_object(
      'date', today,
      'direction', dir.text,
      'checkins', checkins,
      'doneCount', done_today,
      'iDid', EXISTS (SELECT 1 FROM jsonb_array_elements(checkins) e WHERE (e->>'userId')::uuid = uid)
    ),
    'me', COALESCE(my, jsonb_build_object('steps', 0, 'streak', 0, 'activeDays', 0)),
    'goalPerMember', goal,
    'ranking', COALESCE(members, '[]'::jsonb),
    'group', jsonb_build_object(
      'members', member_count,
      'steps', total_steps,
      'consistency', consistency,
      'daysElapsed', days_elapsed,
      'pct', LEAST(100, CASE WHEN member_count = 0 THEN 0
              ELSE round((total_steps::numeric / (member_count * goal)) * 100)::int END)
    )
  );
END;
$$;