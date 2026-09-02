ALTER TABLE public.profiles DISABLE TRIGGER guard_profile_access_fields_trg;

UPDATE public.profiles p
   SET trial_started_at = COALESCE(p.trial_started_at, s.trial_started_at),
       trial_ends_at = COALESCE(p.trial_ends_at, s.trial_ends_at),
       trial_used = CASE WHEN s.plan = 'trial' THEN true ELSE p.trial_used END,
       subscription_status = CASE
         WHEN p.subscription_status = 'active' THEN 'active'
         ELSE s.status END,
       access_type = COALESCE(p.access_type, s.plan),
       has_access = true
  FROM public.subscriptions s
 WHERE s.user_id = p.id
   AND s.status IN ('trialing','active')
   AND COALESCE(p.subscription_status,'none') = 'none';

ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_access_fields_trg;