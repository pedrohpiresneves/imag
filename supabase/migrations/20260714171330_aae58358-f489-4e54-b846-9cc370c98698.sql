ALTER TABLE public.module_audio
  ADD COLUMN IF NOT EXISTS text_hash text,
  ADD COLUMN IF NOT EXISTS voice_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS progress smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_generated_at timestamptz;

ALTER TABLE public.module_audio ALTER COLUMN storage_path DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.podcast_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_voice text NOT NULL DEFAULT 'nova',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.podcast_settings TO authenticated;
GRANT ALL ON public.podcast_settings TO service_role;

ALTER TABLE public.podcast_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read podcast_settings"
  ON public.podcast_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admins manage podcast_settings"
  ON public.podcast_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_podcast_settings_touch
  BEFORE UPDATE ON public.podcast_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.podcast_settings (id, default_voice)
VALUES (1, 'nova')
ON CONFLICT (id) DO NOTHING;