
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS meta_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill meta_date for existing rows using São Paulo local date of generated_at
UPDATE public.user_plans
   SET meta_date = (generated_at AT TIME ZONE 'America/Sao_Paulo')::date
 WHERE meta_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_plans_user_meta_date_unique
  ON public.user_plans (user_id, meta_date)
  WHERE meta_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_plans_user_meta_date_idx
  ON public.user_plans (user_id, meta_date DESC);
