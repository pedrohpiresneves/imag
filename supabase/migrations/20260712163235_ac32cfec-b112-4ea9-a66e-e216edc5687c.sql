
-- weekly_tasks
CREATE TABLE public.weekly_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_tasks TO authenticated;
GRANT ALL ON public.weekly_tasks TO service_role;
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weekly tasks" ON public.weekly_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- mentor_messages
CREATE TABLE public.mentor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mentor messages" ON public.mentor_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX mentor_messages_user_created_idx ON public.mentor_messages (user_id, created_at);

-- checklist_state
CREATE TABLE public.checklist_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_state TO authenticated;
GRANT ALL ON public.checklist_state TO service_role;
ALTER TABLE public.checklist_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist state" ON public.checklist_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notes
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- saved_templates
CREATE TABLE public.saved_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_templates TO authenticated;
GRANT ALL ON public.saved_templates TO service_role;
ALTER TABLE public.saved_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved templates" ON public.saved_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- activity_log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref text,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX activity_log_user_created_idx ON public.activity_log (user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER weekly_tasks_touch BEFORE UPDATE ON public.weekly_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER notes_touch BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER checklist_touch BEFORE UPDATE ON public.checklist_state FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
