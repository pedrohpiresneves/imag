CREATE TABLE public.money_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income','expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL,
  description TEXT,
  entry_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX money_records_user_date_idx ON public.money_records (user_id, entry_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.money_records TO authenticated;
GRANT ALL ON public.money_records TO service_role;

ALTER TABLE public.money_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own money records"
ON public.money_records FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER money_records_touch_updated_at
BEFORE UPDATE ON public.money_records
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.money_records;