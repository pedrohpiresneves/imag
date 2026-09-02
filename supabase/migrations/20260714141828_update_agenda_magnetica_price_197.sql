-- Restaura o preço oficial do produto Agenda Magnética para R$ 197,00.
UPDATE public.prices
   SET amount_cents = 19700
 WHERE id = 'agenda_magnetica_lifetime';

ALTER TABLE public.purchases ALTER COLUMN amount_cents SET DEFAULT 19700;
