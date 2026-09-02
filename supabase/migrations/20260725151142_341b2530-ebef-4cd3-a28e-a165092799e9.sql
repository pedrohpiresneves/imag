
-- ==== SEGURANÇA (findings do scanner) ====

-- 1) module_audio: SELECT só para usuários com acesso ativo (paywall real)
DROP POLICY IF EXISTS "authenticated can read module_audio" ON public.module_audio;
CREATE POLICY "paid users can read module_audio"
  ON public.module_audio FOR SELECT
  TO authenticated
  USING (public.has_active_access(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) orders: bloqueio explícito de writes por clientes; service_role mantém acesso via GRANT
CREATE POLICY "no client writes on orders"
  ON public.orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "no client updates on orders"
  ON public.orders FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "no client deletes on orders"
  ON public.orders FOR DELETE
  TO anon, authenticated
  USING (false);

-- 3) referral_campaigns: só admin lê detalhes internos
DROP POLICY IF EXISTS "campaigns readable" ON public.referral_campaigns;
CREATE POLICY "admins read campaigns"
  ON public.referral_campaigns FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) referral_settings: só admin lê
DROP POLICY IF EXISTS "settings readable" ON public.referral_settings;
CREATE POLICY "admins read referral_settings"
  ON public.referral_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) SECURITY DEFINER: revogar EXECUTE de anon/public onde não precisa ser público
REVOKE EXECUTE ON FUNCTION public.activate_trial_for_current_user()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_access(uuid)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_my_handle(text)                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_handle_available(text)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suggest_handles(text)                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_referral_from_visitor(text)        FROM PUBLIC, anon;

-- Garante acesso autenticado
GRANT EXECUTE ON FUNCTION public.activate_trial_for_current_user()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_access(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_handle(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_handle_available(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_handles(text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_referral_from_visitor(text)    TO authenticated;

-- ==== REGRA DE NEGÓCIO: 7 dias de tolerância no past_due ====
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          (p.subscription_status = 'active'
            AND (p.subscription_renews_at IS NULL OR p.subscription_renews_at > now()))
          OR (p.subscription_status = 'trialing'
            AND p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now())
          OR (p.has_access = true AND p.access_type = 'lifetime')
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.stripe_subscriptions s
      WHERE s.user_id = _user_id
        AND (
          (s.status = 'trialing' AND s.trial_end IS NOT NULL AND s.trial_end > now())
          OR (s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled'
              AND s.current_period_end IS NOT NULL
              AND s.current_period_end > now())
          -- Janela de recuperação de 7 dias em past_due
          OR (s.status = 'past_due'
              AND s.past_due_since IS NOT NULL
              AND s.past_due_since > now() - interval '7 days')
        )
    );
$function$;

GRANT EXECUTE ON FUNCTION public.has_active_access(uuid) TO authenticated;
