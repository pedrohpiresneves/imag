CREATE OR REPLACE FUNCTION public.toggle_impact_reaction(_impact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  existed boolean;
  total integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.direction_impacts d WHERE d.id = _impact_id AND d.published) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  DELETE FROM public.impact_reactions
   WHERE impact_id = _impact_id AND user_id = uid;
  GET DIAGNOSTICS existed = ROW_COUNT;

  IF NOT existed THEN
    INSERT INTO public.impact_reactions (impact_id, user_id)
    VALUES (_impact_id, uid)
    ON CONFLICT (impact_id, user_id) DO NOTHING;
  END IF;

  SELECT count(*) INTO total FROM public.impact_reactions WHERE impact_id = _impact_id;

  RETURN jsonb_build_object('ok', true, 'reacted', NOT existed, 'count', total);
END;
$function$;

REVOKE ALL ON FUNCTION public.toggle_impact_reaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_impact_reaction(uuid) TO authenticated;