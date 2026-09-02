ALTER TABLE public.shared_directions DROP CONSTRAINT IF EXISTS shared_directions_status_chk;
ALTER TABLE public.shared_directions ADD CONSTRAINT shared_directions_status_chk
  CHECK (status = ANY (ARRAY['pending'::text,'accepted'::text,'declined'::text,'archived'::text,'later'::text]));
ALTER TABLE public.shared_directions ADD COLUMN IF NOT EXISTS added_at timestamptz;

ALTER TABLE public.user_plans ADD COLUMN IF NOT EXISTS origin_kind text NOT NULL DEFAULT 'mag';
ALTER TABLE public.user_plans ADD COLUMN IF NOT EXISTS origin_label text;
ALTER TABLE public.user_plans ADD COLUMN IF NOT EXISTS shared_direction_id uuid REFERENCES public.shared_directions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shared_directions_recipient_created_idx
  ON public.shared_directions (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_plans_user_date_idx
  ON public.user_plans (user_id, meta_date DESC);