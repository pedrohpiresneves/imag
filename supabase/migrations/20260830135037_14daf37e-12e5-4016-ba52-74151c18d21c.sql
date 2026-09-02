ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS orchestration jsonb,
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS needs_professional boolean NOT NULL DEFAULT false;