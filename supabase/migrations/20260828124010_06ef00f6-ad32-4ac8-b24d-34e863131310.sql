GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_responses TO authenticated;
GRANT ALL ON public.direction_responses TO service_role;

DROP INDEX IF EXISTS public.direction_responses_user_plan_key;
CREATE UNIQUE INDEX direction_responses_user_plan_key
  ON public.direction_responses (user_id, plan_id);