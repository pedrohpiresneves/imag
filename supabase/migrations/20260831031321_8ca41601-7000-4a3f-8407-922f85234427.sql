ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS weekly_focus_text text,
  ADD COLUMN IF NOT EXISTS context_version text;