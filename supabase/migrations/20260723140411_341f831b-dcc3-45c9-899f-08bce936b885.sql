
CREATE TABLE public.user_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  priority_title TEXT NOT NULL,
  priority_reason TEXT,
  first_action TEXT,
  next_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_summary TEXT,
  source TEXT NOT NULL DEFAULT 'mag',
  is_active BOOLEAN NOT NULL DEFAULT true,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_plans_user_active ON public.user_plans(user_id, is_active, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plans TO authenticated;
GRANT ALL ON public.user_plans TO service_role;

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plans" ON public.user_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON public.user_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plans" ON public.user_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON public.user_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER touch_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
