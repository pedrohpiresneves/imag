
DROP POLICY IF EXISTS "coupons active read" ON public.coupons;
DROP POLICY IF EXISTS "coupons read" ON public.coupons;
DROP POLICY IF EXISTS "public read active coupons" ON public.coupons;
CREATE POLICY "no client access" ON public.coupons FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "referral_campaigns read" ON public.referral_campaigns;
DROP POLICY IF EXISTS "authenticated read campaigns" ON public.referral_campaigns;
CREATE POLICY "no client access" ON public.referral_campaigns FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "referral_settings read" ON public.referral_settings;
DROP POLICY IF EXISTS "authenticated read settings" ON public.referral_settings;
CREATE POLICY "no client access" ON public.referral_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
