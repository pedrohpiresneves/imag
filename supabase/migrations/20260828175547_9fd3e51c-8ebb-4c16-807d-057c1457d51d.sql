ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS interaction_type text,
  ADD COLUMN IF NOT EXISTS interaction_config jsonb;