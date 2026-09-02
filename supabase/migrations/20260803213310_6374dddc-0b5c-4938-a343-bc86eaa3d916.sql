ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS invoice_slug text,
  ADD COLUMN IF NOT EXISTS paid_amount integer,
  ADD COLUMN IF NOT EXISTS installments integer,
  ADD COLUMN IF NOT EXISTS capture_method text,
  ADD COLUMN IF NOT EXISTS receipt_url text;