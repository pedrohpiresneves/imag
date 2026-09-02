-- Perfil Magnético: dossiê profundo do profissional
CREATE TABLE public.magnetic_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  business JSONB NOT NULL DEFAULT '{}'::jsonb,
  communication JSONB NOT NULL DEFAULT '{}'::jsonb,
  mindset JSONB NOT NULL DEFAULT '{}'::jsonb,
  objectives JSONB NOT NULL DEFAULT '{}'::jsonb,
  instagram JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  completeness SMALLINT NOT NULL DEFAULT 0,
  onboarding_state TEXT NOT NULL DEFAULT 'in_progress',
  onboarding_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magnetic_profile TO authenticated;
GRANT ALL ON public.magnetic_profile TO service_role;

ALTER TABLE public.magnetic_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own magnetic profile"
  ON public.magnetic_profile
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER magnetic_profile_touch
  BEFORE UPDATE ON public.magnetic_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Mensagens da conversa de onboarding
CREATE TABLE public.onboarding_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_messages_user_created_idx
  ON public.onboarding_messages(user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.onboarding_messages TO authenticated;
GRANT ALL ON public.onboarding_messages TO service_role;

ALTER TABLE public.onboarding_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own onboarding messages"
  ON public.onboarding_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);