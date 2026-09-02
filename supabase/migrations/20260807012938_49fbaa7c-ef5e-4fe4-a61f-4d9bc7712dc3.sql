CREATE TABLE public.saved_directions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text,
  direction_text text NOT NULL,
  why_text text,
  strategy_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX saved_directions_user_source_uidx ON public.saved_directions (user_id, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX saved_directions_user_created_idx ON public.saved_directions (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_directions TO authenticated;
GRANT ALL ON public.saved_directions TO service_role;
ALTER TABLE public.saved_directions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved directions" ON public.saved_directions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);