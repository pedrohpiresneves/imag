-- push_subscriptions: Web Push real (VAPID)
ALTER TABLE public.push_subscriptions
  ALTER COLUMN subscription_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS p256dh text,
  ADD COLUMN IF NOT EXISTS auth text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON public.push_subscriptions (endpoint) WHERE endpoint IS NOT NULL;

-- notification_preferences: novas categorias da MAG
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS direction_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS appointments_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priorities_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkin_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_start smallint NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS quiet_hours_end smallint NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS daily_limit smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS lock_screen_privacy text NOT NULL DEFAULT 'context';

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_lock_screen_privacy_check;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_lock_screen_privacy_check
  CHECK (lock_screen_privacy IN ('context', 'minimal'));

-- desliga o sistema antigo de "novos impactos"
UPDATE public.notification_preferences SET impact_notifications = false WHERE impact_notifications;

-- notification_events: agendamento, envio e abertura
CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_route text NOT NULL,
  entity_id text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  opened_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  deduplication_key text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedupe_key
  ON public.notification_events (user_id, deduplication_key);
CREATE INDEX IF NOT EXISTS notification_events_user_sent_idx
  ON public.notification_events (user_id, sent_at DESC);

GRANT SELECT, UPDATE ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification events" ON public.notification_events;
CREATE POLICY "Users read own notification events"
  ON public.notification_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notification events" ON public.notification_events;
CREATE POLICY "Users update own notification events"
  ON public.notification_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);