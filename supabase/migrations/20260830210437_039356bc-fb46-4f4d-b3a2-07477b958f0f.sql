CREATE TABLE public.plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  info TEXT,
  due_date DATE,
  due_time TEXT,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX plan_items_user_date_idx ON public.plan_items (user_id, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_items TO authenticated;
GRANT ALL ON public.plan_items TO service_role;

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own plan items" ON public.plan_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER plan_items_touch_updated_at
  BEFORE UPDATE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_plan_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind NOT IN ('task','goal_week','goal_month','goal_year','deadline') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_items_validate
  BEFORE INSERT OR UPDATE ON public.plan_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_item();