ALTER TABLE public.magnet_transactions ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS magnet_transactions_dedupe_uidx
  ON public.magnet_transactions (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.award_magnetos(_user_id uuid, _reason text, _amount integer, _dedupe_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE inserted boolean := false;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN false; END IF;
  INSERT INTO public.magnet_transactions (user_id, amount, reason, dedupe_key)
  VALUES (_user_id, _amount, _reason, _dedupe_key)
  ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_magnet_rewards(_local_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d date := COALESCE(_local_date, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  awards jsonb := '[]'::jsonb;
  total_tasks int := 0;
  done_tasks int := 0;
  finished_at timestamptz;
  last_active date;
  last_comeback timestamptz;
  c record;
  active_members int := 0;
  bonus int := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated', 'awards', awards, 'balance', 0);
  END IF;

  -- 1) Todas as tarefas do dia concluídas: +5 (uma vez por dia)
  SELECT count(*), count(*) FILTER (WHERE done)
    INTO total_tasks, done_tasks
    FROM public.day_priorities
   WHERE user_id = uid AND day_date = d;

  IF total_tasks > 0 AND done_tasks = total_tasks THEN
    IF public.award_magnetos(uid, 'daily_tasks_completed', 5, 'tasks:' || d::text) THEN
      awards := awards || jsonb_build_array(jsonb_build_object('reason', 'daily_tasks_completed', 'amount', 5,
        'label', 'Tarefas do dia concluídas'));
    END IF;
  END IF;

  -- 2) Onboarding finalizado: +5 (apenas uma vez)
  SELECT onboarding_finished_at INTO finished_at
    FROM public.magnetic_profile WHERE user_id = uid;
  IF finished_at IS NOT NULL THEN
    IF public.award_magnetos(uid, 'onboarding_finished', 5, 'onboarding') THEN
      awards := awards || jsonb_build_array(jsonb_build_object('reason', 'onboarding_finished', 'amount', 5,
        'label', 'Onboarding concluído'));
    END IF;
  END IF;

  -- 3) Retomada após 7+ dias de ausência: +10, no máximo a cada 30 dias
  SELECT max((completed_at AT TIME ZONE 'America/Sao_Paulo')::date)
    INTO last_active
    FROM public.user_plans
   WHERE user_id = uid AND status = 'completed' AND completed_at IS NOT NULL
     AND (completed_at AT TIME ZONE 'America/Sao_Paulo')::date < d;

  SELECT max(created_at) INTO last_comeback
    FROM public.magnet_transactions
   WHERE user_id = uid AND reason = 'comeback';

  IF last_active IS NOT NULL AND (d - last_active) >= 7
     AND (last_comeback IS NULL OR last_comeback < now() - interval '30 days') THEN
    IF public.award_magnetos(uid, 'comeback', 10, 'comeback:' || d::text) THEN
      awards := awards || jsonb_build_array(jsonb_build_object('reason', 'comeback', 'amount', 10,
        'label', 'Bem-vinda de volta'));
    END IF;
  END IF;

  -- 4) Círculos encerrados: +20 por círculo concluído com participação real
  FOR c IN
    SELECT cc.id, cc.name, cc.starts_at, cc.ends_at
      FROM public.circles cc
      JOIN public.circle_members mm ON mm.circle_id = cc.id AND mm.user_id = uid
     WHERE cc.status = 'finished' OR cc.ends_at <= now()
  LOOP
    IF (SELECT steps FROM public.circle_member_stats(uid, c.starts_at, c.ends_at)) > 0 THEN
      IF public.award_magnetos(uid, 'circle_completed', 20, 'circle:' || c.id::text) THEN
        awards := awards || jsonb_build_array(jsonb_build_object('reason', 'circle_completed', 'amount', 20,
          'label', 'Círculo concluído'));
      END IF;

      -- Desafio com amigos: +10 por participante ativo, limitado a 5
      SELECT count(*) INTO active_members
        FROM public.circle_members mm2
       WHERE mm2.circle_id = c.id
         AND mm2.user_id <> uid
         AND (SELECT steps FROM public.circle_member_stats(mm2.user_id, c.starts_at, c.ends_at)) > 0;

      bonus := 10 * LEAST(active_members, 5);
      IF bonus > 0 THEN
        IF public.award_magnetos(uid, 'circle_challenge_friends', bonus, 'circle_friends:' || c.id::text) THEN
          awards := awards || jsonb_build_array(jsonb_build_object('reason', 'circle_challenge_friends',
            'amount', bonus, 'label', 'Desafio concluído com amigos'));
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'awards', awards,
    'balance', COALESCE((SELECT sum(amount) FROM public.magnet_transactions WHERE user_id = uid), 0)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_magnetos(uuid, text, integer, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_magnet_rewards(date) TO authenticated;