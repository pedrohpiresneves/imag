-- ============ TABELAS ============
CREATE TABLE public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  challenge_kind text NOT NULL DEFAULT 'daily',
  challenge_text text NOT NULL,
  target_count integer,
  duration_days integer NOT NULL DEFAULT 30,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, user_id)
);

CREATE TABLE public.circle_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (circle_id, invited_user_id)
);

CREATE INDEX circle_members_user_idx ON public.circle_members(user_id);
CREATE INDEX circle_invites_user_idx ON public.circle_invites(invited_user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.circles TO authenticated;
GRANT ALL ON public.circles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_members TO authenticated;
GRANT ALL ON public.circle_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.circle_invites TO authenticated;
GRANT ALL ON public.circle_invites TO service_role;

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_circle_member(_circle_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members m
    WHERE m.circle_id = _circle_id AND m.user_id = _user_id
  );
$$;

CREATE POLICY "circles_select_members" ON public.circles FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_circle_member(id, auth.uid()));
CREATE POLICY "circles_insert_own" ON public.circles FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "circles_update_owner" ON public.circles FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "circles_delete_owner" ON public.circles FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "circle_members_select" ON public.circle_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_circle_member(circle_id, auth.uid()));
CREATE POLICY "circle_members_insert_self" ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "circle_members_delete" ON public.circle_members FOR DELETE TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.circles c WHERE c.id = circle_id AND c.owner_id = auth.uid()));

CREATE POLICY "circle_invites_select" ON public.circle_invites FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid()
    OR public.is_circle_member(circle_id, auth.uid()));
CREATE POLICY "circle_invites_insert" ON public.circle_invites FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid() AND public.is_circle_member(circle_id, auth.uid()));
CREATE POLICY "circle_invites_update" ON public.circle_invites FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid()) WITH CHECK (invited_user_id = auth.uid());

CREATE TRIGGER circles_touch BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS circle_notifications boolean NOT NULL DEFAULT true;

-- ============ ESTATÍSTICAS ============
CREATE OR REPLACE FUNCTION public.circle_member_stats(_uid uuid, _start timestamptz, _end timestamptz)
RETURNS TABLE(steps integer, active_days integer, streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH done AS (
    SELECT p.completed_at
      FROM public.user_plans p
     WHERE p.user_id = _uid AND p.status = 'completed'
       AND p.completed_at IS NOT NULL
       AND p.completed_at >= _start AND p.completed_at < _end
  ),
  d AS (
    SELECT DISTINCT ((completed_at AT TIME ZONE 'America/Sao_Paulo')::date) AS day FROM done
  ),
  g AS (
    SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp FROM d
  ),
  runs AS (
    SELECT grp, count(*)::int AS cnt, max(day) AS last_day FROM g GROUP BY grp
  )
  SELECT (SELECT count(*) FROM done)::int,
         (SELECT count(*) FROM d)::int,
         COALESCE((SELECT cnt FROM runs
                    WHERE last_day >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 1)
                    ORDER BY last_day DESC LIMIT 1), 0)::int;
$$;

CREATE OR REPLACE FUNCTION public.circle_goal_per_member(_c public.circles)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT GREATEST(1, CASE
    WHEN _c.challenge_kind = 'count' THEN COALESCE(_c.target_count, 10)
    WHEN _c.challenge_kind = 'streak' THEN _c.duration_days
    ELSE _c.duration_days * GREATEST(COALESCE(_c.target_count, 1), 1)
  END);
$$;

-- ============ AÇÕES ============
CREATE OR REPLACE FUNCTION public.create_circle(
  _name text, _challenge_kind text, _challenge_text text,
  _target_count integer, _duration_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  code text;
  c public.circles;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF btrim(coalesce(_name,'')) = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name'); END IF;
  IF (SELECT count(*) FROM public.circles WHERE owner_id = uid AND status = 'active') >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
  END IF;

  LOOP
    code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.circles WHERE invite_code = code);
  END LOOP;

  INSERT INTO public.circles (owner_id, name, challenge_kind, challenge_text,
                              target_count, duration_days, ends_at, invite_code)
  VALUES (uid, left(btrim(_name), 60),
          COALESCE(NULLIF(_challenge_kind,''), 'daily'),
          left(btrim(coalesce(_challenge_text, 'Concluir 1 direção por dia.')), 200),
          _target_count,
          GREATEST(1, LEAST(COALESCE(_duration_days, 30), 365)),
          now() + (GREATEST(1, LEAST(COALESCE(_duration_days, 30), 365)) || ' days')::interval,
          code)
  RETURNING * INTO c;

  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (c.id, uid, 'admin');

  RETURN jsonb_build_object('ok', true, 'id', c.id, 'invite_code', c.invite_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_circle_by_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.circles;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO c FROM public.circles WHERE invite_code = lower(btrim(coalesce(_code,'')));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF c.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'closed'); END IF;
  IF (SELECT count(*) FROM public.circle_members WHERE circle_id = c.id) >= 25 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'full');
  END IF;

  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (c.id, uid, 'member')
  ON CONFLICT (circle_id, user_id) DO NOTHING;

  UPDATE public.circle_invites SET status = 'accepted', responded_at = now()
   WHERE circle_id = c.id AND invited_user_id = uid AND status = 'pending';

  RETURN jsonb_build_object('ok', true, 'id', c.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_to_circle(_circle_id uuid, _user_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  target uuid;
  sent int := 0;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  IF NOT public.is_circle_member(_circle_id, uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  FOREACH target IN ARRAY COALESCE(_user_ids, ARRAY[]::uuid[]) LOOP
    CONTINUE WHEN target = uid OR public.is_circle_member(_circle_id, target);
    INSERT INTO public.circle_invites (circle_id, invited_user_id, invited_by)
    VALUES (_circle_id, target, uid)
    ON CONFLICT (circle_id, invited_user_id) DO NOTHING;
    IF FOUND THEN
      sent := sent + 1;
      PERFORM public.push_notification(
        target, 'circle_invite', 'Você foi convidado para um círculo',
        (SELECT name FROM public.circles WHERE id = _circle_id),
        '/circulos', NULL);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'sent', sent);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_circle_invite(_invite_id uuid, _accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.circle_invites;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  SELECT * INTO inv FROM public.circle_invites WHERE id = _invite_id AND invited_user_id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

  UPDATE public.circle_invites
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,
         responded_at = now()
   WHERE id = inv.id;

  IF _accept THEN
    INSERT INTO public.circle_members (circle_id, user_id, role)
    VALUES (inv.circle_id, uid, 'member')
    ON CONFLICT (circle_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'circle_id', inv.circle_id, 'accepted', _accept);
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_circle(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  DELETE FROM public.circle_members WHERE circle_id = _circle_id AND user_id = uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.end_circle(_circle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  UPDATE public.circles SET status = 'finished', ends_at = LEAST(ends_at, now())
   WHERE id = _circle_id AND owner_id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_circle_challenge(
  _circle_id uuid, _challenge_kind text, _challenge_text text, _target_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
  UPDATE public.circles
     SET challenge_kind = COALESCE(NULLIF(_challenge_kind, ''), challenge_kind),
         challenge_text = left(btrim(COALESCE(NULLIF(_challenge_text, ''), challenge_text)), 200),
         target_count = _target_count
   WHERE id = _circle_id AND owner_id = uid;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'forbidden'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============ LEITURAS ============
CREATE OR REPLACE FUNCTION public.get_my_circles()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
        'members', (SELECT count(*) FROM public.circle_members m2 WHERE m2.circle_id = c.id),
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

  RETURN jsonb_build_object(
    'ok', true,
    'circle', jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'challengeKind', c.challenge_kind,
      'challengeText', c.challenge_text,
      'targetCount', c.target_count,
      'durationDays', c.duration_days,
      'startsAt', c.starts_at,
      'endsAt', c.ends_at,
      'status', CASE WHEN c.status = 'active' AND c.ends_at > now() THEN 'active' ELSE 'finished' END,
      'daysLeft', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.ends_at - now())) / 86400)::int),
      'inviteCode', c.invite_code,
      'isAdmin', (c.owner_id = uid)
    ),
    'me', COALESCE(my, jsonb_build_object('steps', 0, 'streak', 0, 'activeDays', 0)),
    'goalPerMember', goal,
    'ranking', COALESCE(members, '[]'::jsonb),
    'group', jsonb_build_object(
      'members', member_count,
      'steps', total_steps,
      'pct', LEAST(100, CASE WHEN member_count = 0 THEN 0
              ELSE round((total_steps::numeric / (member_count * goal)) * 100)::int END)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_circle_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.circles;
  my_steps int := 0;
  pos int := 1;
BEGIN
  IF uid IS NULL THEN RETURN 'null'::jsonb; END IF;

  SELECT c2.* INTO c FROM public.circles c2
    JOIN public.circle_members m ON m.circle_id = c2.id AND m.user_id = uid
   WHERE c2.status = 'active' AND c2.ends_at > now()
   ORDER BY c2.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;

  WITH m AS (
    SELECT mm.user_id, s.steps
      FROM public.circle_members mm
      CROSS JOIN LATERAL public.circle_member_stats(mm.user_id, c.starts_at, LEAST(c.ends_at, now())) s
     WHERE mm.circle_id = c.id
  )
  SELECT (SELECT steps FROM m WHERE user_id = uid),
         (SELECT count(*) + 1 FROM m WHERE steps > COALESCE((SELECT steps FROM m WHERE user_id = uid), 0))
    INTO my_steps, pos;

  RETURN jsonb_build_object(
    'id', c.id, 'name', c.name,
    'position', pos,
    'steps', COALESCE(my_steps, 0),
    'daysLeft', GREATEST(0, CEIL(EXTRACT(EPOCH FROM (c.ends_at - now())) / 86400)::int)
  );
END;
$$;