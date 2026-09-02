
-- Explicit deny policies for tables that must be server-only (service_role bypasses RLS anyway)
CREATE POLICY "no client read" ON public.referral_attributions FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no client write" ON public.referral_attributions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "no client read" ON public.referral_clicks FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no client write" ON public.referral_clicks FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY "no client read" ON public.fraud_flags FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "no client write" ON public.fraud_flags FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
