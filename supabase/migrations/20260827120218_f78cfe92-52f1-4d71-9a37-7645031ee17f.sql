ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS day_close_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS day_close_hour smallint NOT NULL DEFAULT 20;

CREATE TABLE IF NOT EXISTS public.day_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  rating text NOT NULL CHECK (rating IN ('dificil','regular','bom','otimo')),
  moved_count integer NOT NULL DEFAULT 0,
  removed_count integer NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_closures TO authenticated;
GRANT ALL ON public.day_closures TO service_role;

ALTER TABLE public.day_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own day closures" ON public.day_closures;
CREATE POLICY "Users manage their own day closures"
  ON public.day_closures FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS day_closures_user_date_idx ON public.day_closures (user_id, day_date DESC);