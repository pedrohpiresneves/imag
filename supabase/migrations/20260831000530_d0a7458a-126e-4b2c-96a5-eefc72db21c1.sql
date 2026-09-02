ALTER TABLE public.plan_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';
ALTER TABLE public.day_events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user';