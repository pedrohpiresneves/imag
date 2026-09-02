CREATE OR REPLACE FUNCTION public.set_updated_at_day()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.day_priorities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_date DATE NOT NULL,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS day_priorities_user_date_idx ON public.day_priorities (user_id, day_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_priorities TO authenticated;
GRANT ALL ON public.day_priorities TO service_role;
ALTER TABLE public.day_priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own day priorities" ON public.day_priorities;
CREATE POLICY "own day priorities" ON public.day_priorities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.day_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS day_events_user_date_idx ON public.day_events (user_id, day_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_events TO authenticated;
GRANT ALL ON public.day_events TO service_role;
ALTER TABLE public.day_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own day events" ON public.day_events;
CREATE POLICY "own day events" ON public.day_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.day_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  day_date DATE NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_notes TO authenticated;
GRANT ALL ON public.day_notes TO service_role;
ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own day notes" ON public.day_notes;
CREATE POLICY "own day notes" ON public.day_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS day_priorities_updated ON public.day_priorities;
CREATE TRIGGER day_priorities_updated BEFORE UPDATE ON public.day_priorities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_day();
DROP TRIGGER IF EXISTS day_events_updated ON public.day_events;
CREATE TRIGGER day_events_updated BEFORE UPDATE ON public.day_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_day();
DROP TRIGGER IF EXISTS day_notes_updated ON public.day_notes;
CREATE TRIGGER day_notes_updated BEFORE UPDATE ON public.day_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_day();