CREATE TABLE public.mag_goal_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.user_plans(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('liked','disliked')),
  goal_title text,
  goal_category text,
  goal_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mag_goal_feedback TO authenticated;
GRANT ALL ON public.mag_goal_feedback TO service_role;

ALTER TABLE public.mag_goal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal feedback"
  ON public.mag_goal_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal feedback"
  ON public.mag_goal_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goal feedback"
  ON public.mag_goal_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goal feedback"
  ON public.mag_goal_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_mag_goal_feedback_user ON public.mag_goal_feedback(user_id, created_at DESC);

CREATE TRIGGER mag_goal_feedback_touch_updated_at
  BEFORE UPDATE ON public.mag_goal_feedback
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();