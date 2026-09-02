CREATE OR REPLACE FUNCTION public.notify_shared_direction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.push_notification(
    NEW.recipient_id, 'shared_direction',
    'Você recebeu uma nova direção.',
    left(NEW.title, 120),
    '/metas-recebidas', NULL);
  RETURN NEW;
END;
$function$;