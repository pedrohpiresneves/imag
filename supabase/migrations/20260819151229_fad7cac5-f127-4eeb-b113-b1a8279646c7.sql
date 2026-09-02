CREATE TABLE public.capture_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('agora','hoje','depois','planos')),
  due_date DATE,
  due_time TIME,
  due_label TEXT,
  source_text TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX capture_items_user_created_idx ON public.capture_items (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capture_items TO authenticated;
GRANT ALL ON public.capture_items TO service_role;
ALTER TABLE public.capture_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own capture items" ON public.capture_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);