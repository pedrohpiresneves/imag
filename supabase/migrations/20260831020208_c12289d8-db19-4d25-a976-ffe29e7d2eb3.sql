ALTER TABLE public.day_events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planned';
ALTER TABLE public.day_events DROP CONSTRAINT IF EXISTS day_events_status_check;
ALTER TABLE public.day_events ADD CONSTRAINT day_events_status_check CHECK (status IN ('planned','done'));