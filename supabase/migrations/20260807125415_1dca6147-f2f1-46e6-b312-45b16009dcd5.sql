CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  group_key text,
  count integer NOT NULL DEFAULT 1,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX notifications_group_uniq
  ON public.notifications (user_id, group_key) WHERE group_key IS NOT NULL;
CREATE INDEX notifications_user_created ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.push_notification(
  _user_id uuid, _kind text, _title text, _body text, _link text, _group_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF _group_key IS NULL THEN
    INSERT INTO public.notifications (user_id, kind, title, body, link)
    VALUES (_user_id, _kind, _title, _body, _link);
  ELSE
    INSERT INTO public.notifications (user_id, kind, title, body, link, group_key)
    VALUES (_user_id, _kind, _title, _body, _link, _group_key)
    ON CONFLICT (user_id, group_key) DO UPDATE
      SET count = public.notifications.count + 1,
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          link = EXCLUDED.link,
          read_at = NULL,
          updated_at = now(),
          created_at = now();
  END IF;
END;
$$;

-- 1) MAG Meta recebida de outro usuário
CREATE OR REPLACE FUNCTION public.notify_shared_direction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_notification(
    NEW.recipient_id, 'shared_direction',
    'Você recebeu uma direção',
    left(NEW.title, 120),
    '/metas-recebidas', NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_shared_direction_trg
AFTER INSERT ON public.shared_directions
FOR EACH ROW EXECUTE FUNCTION public.notify_shared_direction();

-- 2) e 3) impacto: direção útil + direção compartilhada gerou impacto
CREATE OR REPLACE FUNCTION public.notify_direction_impact() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id uuid;
  sender uuid;
  prof text;
  day text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  -- quem publicou a mesma direção recebe aviso de utilidade
  IF NEW.useful AND NEW.direction_title IS NOT NULL THEN
    FOR owner_id IN
      SELECT DISTINCT d.user_id FROM public.direction_impacts d
       WHERE d.published
         AND d.user_id <> NEW.user_id
         AND d.direction_title IS NOT NULL
         AND lower(btrim(d.direction_title)) = lower(btrim(NEW.direction_title))
    LOOP
      PERFORM public.push_notification(
        owner_id, 'impact_useful',
        'Sua direção funcionou para outro profissional',
        left(coalesce(NEW.direction_title, ''), 120),
        '/impacto',
        'useful:' || lower(btrim(NEW.direction_title)) || ':' || day);
    END LOOP;
  END IF;

  -- quem compartilhou a direção que virou impacto
  IF NEW.goal_id IS NOT NULL THEN
    SELECT s.sender_id INTO sender
      FROM public.user_plans p
      JOIN public.shared_directions s ON s.id = p.shared_direction_id
     WHERE p.id = NEW.goal_id;
    IF sender IS NOT NULL AND sender <> NEW.user_id THEN
      PERFORM public.push_notification(
        sender, 'shared_impact',
        'Uma direção que você compartilhou gerou impacto',
        left(coalesce(NEW.direction_title, ''), 120),
        '/impacto', NULL);
    END IF;
  END IF;

  -- resumo diário de novos impactos da mesma profissão
  IF NEW.published AND NEW.profession IS NOT NULL AND btrim(NEW.profession) <> '' THEN
    prof := lower(btrim(NEW.profession));
    FOR owner_id IN
      SELECT p.id FROM public.profiles p
       WHERE p.id <> NEW.user_id
         AND p.profession IS NOT NULL
         AND lower(btrim(p.profession)) = prof
    LOOP
      PERFORM public.push_notification(
        owner_id, 'impact_digest',
        'Novos impactos na sua área',
        'Profissionais como você registraram resultados hoje.',
        '/impacto',
        'prof:' || prof || ':' || day);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_direction_impact_trg
AFTER INSERT ON public.direction_impacts
FOR EACH ROW EXECUTE FUNCTION public.notify_direction_impact();

CREATE TRIGGER notifications_touch
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();