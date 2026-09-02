CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  role_guc TEXT := current_setting('role', true);
  trusted TEXT := current_setting('imag.trusted_write', true);
BEGIN
  IF trusted = 'on' THEN
    RETURN NEW;
  END IF;
  IF role_guc IN ('service_role','postgres','supabase_admin','supabase_auth_admin') THEN
    RETURN NEW;
  END IF;
  IF current_user IN ('postgres','service_role','supabase_admin','supabase_auth_admin') THEN
    RETURN NEW;
  END IF;
  NEW.has_access := OLD.has_access;
  NEW.access_type := OLD.access_type;
  NEW.access_granted_at := OLD.access_granted_at;
  NEW.trial_started_at := OLD.trial_started_at;
  NEW.trial_ends_at := OLD.trial_ends_at;
  NEW.trial_used := OLD.trial_used;
  NEW.subscription_status := OLD.subscription_status;
  NEW.subscription_started_at := OLD.subscription_started_at;
  NEW.subscription_renews_at := OLD.subscription_renews_at;
  RETURN NEW;
END;
$function$;

SELECT set_config('imag.trusted_write', 'on', true);

UPDATE public.profiles p
   SET trial_started_at = COALESCE(p.trial_started_at, s.trial_started_at),
       trial_ends_at = COALESCE(p.trial_ends_at, s.trial_ends_at),
       trial_used = CASE WHEN s.plan = 'trial' THEN true ELSE p.trial_used END,
       subscription_status = CASE
         WHEN p.subscription_status = 'active' THEN p.subscription_status
         ELSE s.status END,
       access_type = COALESCE(p.access_type, CASE WHEN s.plan = 'trial' THEN 'trial' ELSE NULL END),
       access_granted_at = COALESCE(p.access_granted_at, s.created_at)
  FROM (
    SELECT DISTINCT ON (user_id) user_id, plan, status, trial_started_at, trial_ends_at, created_at
      FROM public.subscriptions
     ORDER BY user_id, created_at DESC
  ) s
 WHERE s.user_id = p.id
   AND (p.trial_ends_at IS NULL OR p.subscription_status IS NULL OR p.subscription_status = 'none');