ALTER TABLE public.money_records
  ADD COLUMN IF NOT EXISTS is_pending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.money_records.is_pending IS 'Recebimento fixo ainda não confirmado pelo usuário (previsto). Não soma ao saldo real.';