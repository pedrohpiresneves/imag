ALTER TABLE public.money_records
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS due_day smallint,
  ADD COLUMN IF NOT EXISTS recurrence_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS recurrence_parent uuid REFERENCES public.money_records(id) ON DELETE SET NULL;

ALTER TABLE public.money_records
  DROP CONSTRAINT IF EXISTS money_records_recurrence_status_check;
ALTER TABLE public.money_records
  ADD CONSTRAINT money_records_recurrence_status_check
  CHECK (recurrence_status IN ('active', 'paused', 'cancelled'));

ALTER TABLE public.money_records
  DROP CONSTRAINT IF EXISTS money_records_due_day_check;
ALTER TABLE public.money_records
  ADD CONSTRAINT money_records_due_day_check
  CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

CREATE UNIQUE INDEX IF NOT EXISTS money_records_recurrence_month_unique
  ON public.money_records (recurrence_parent, date_trunc('month', entry_date::timestamp))
  WHERE recurrence_parent IS NOT NULL;