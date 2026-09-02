ALTER TABLE public.plan_reflections
  ADD COLUMN IF NOT EXISTS signal_key text,
  ADD COLUMN IF NOT EXISTS signal_answer text;

ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS continuity_mode text;