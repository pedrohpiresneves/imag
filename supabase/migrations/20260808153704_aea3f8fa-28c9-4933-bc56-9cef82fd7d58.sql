GRANT SELECT, INSERT, DELETE ON public.impact_reactions TO authenticated;
GRANT ALL ON public.impact_reactions TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS impact_reactions_impact_user_uidx
  ON public.impact_reactions (impact_id, user_id);