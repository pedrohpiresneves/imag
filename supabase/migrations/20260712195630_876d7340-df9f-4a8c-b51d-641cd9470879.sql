INSERT INTO public.entitlements (user_id, product_id, source, source_ref, status)
VALUES
  ('2a2bdd77-260e-4ff9-83dc-ee774b7c366f', 'agenda_magnetica', 'manual', 'owner_grant_gmail', 'active'),
  ('52832037-d62d-4933-a5e0-7ff84b5affc8', 'agenda_magnetica', 'manual', 'owner_grant_outlook', 'active')
ON CONFLICT (user_id, product_id, source_ref) DO NOTHING;