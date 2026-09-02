CREATE TABLE public.direction_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.user_plans(id) ON DELETE CASCADE,
  direction_title text,
  life_area text,
  response_type text NOT NULL DEFAULT 'internal',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  context text,
  influences_future boolean NOT NULL DEFAULT true,
  learning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX direction_responses_user_plan_key
  ON public.direction_responses (user_id, plan_id)
  WHERE plan_id IS NOT NULL;

CREATE INDEX direction_responses_user_created_idx
  ON public.direction_responses (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_responses TO authenticated;
GRANT ALL ON public.direction_responses TO service_role;

ALTER TABLE public.direction_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own direction responses"
  ON public.direction_responses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER direction_responses_touch
  BEFORE UPDATE ON public.direction_responses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();