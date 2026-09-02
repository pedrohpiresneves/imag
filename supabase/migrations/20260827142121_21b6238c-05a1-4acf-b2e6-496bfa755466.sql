CREATE TABLE public.user_focus_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  focus_key TEXT NOT NULL,
  focus_label TEXT NOT NULL,
  note TEXT,
  duration TEXT NOT NULL DEFAULT 'next' CHECK (duration IN ('next','until_change')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX user_focus_shifts_one_active ON public.user_focus_shifts (user_id) WHERE status = 'active';
CREATE INDEX user_focus_shifts_user_created ON public.user_focus_shifts (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_focus_shifts TO authenticated;
GRANT ALL ON public.user_focus_shifts TO service_role;
ALTER TABLE public.user_focus_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own focus shifts" ON public.user_focus_shifts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);