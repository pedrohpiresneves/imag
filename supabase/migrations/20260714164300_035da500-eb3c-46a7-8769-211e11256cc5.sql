
-- Security-definer role check (idempotent)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Table
CREATE TABLE public.module_audio (
  module_slug TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  duration_seconds INTEGER,
  size_bytes BIGINT,
  content_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.module_audio TO authenticated;
GRANT ALL ON public.module_audio TO service_role;

ALTER TABLE public.module_audio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read module_audio"
  ON public.module_audio FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins can insert module_audio"
  ON public.module_audio FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins can update module_audio"
  ON public.module_audio FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins can delete module_audio"
  ON public.module_audio FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_module_audio_touch
  BEFORE UPDATE ON public.module_audio
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage RLS on bucket "podcasts"
CREATE POLICY "admins can upload to podcasts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'podcasts' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins can update podcasts objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'podcasts' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'podcasts' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins can delete podcasts objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'podcasts' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins can read podcasts objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'podcasts' AND public.has_role(auth.uid(), 'admin'::public.app_role));
