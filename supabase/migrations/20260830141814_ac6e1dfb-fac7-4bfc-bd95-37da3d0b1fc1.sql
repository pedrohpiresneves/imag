alter table public.weekly_focus
  add column if not exists clarify_question text,
  add column if not exists clarify_options jsonb not null default '[]'::jsonb,
  add column if not exists clarify_answer text,
  add column if not exists clarified_at timestamptz;

update public.user_plans p
set is_active = false,
    status = 'invalid'
where p.status <> 'completed'
  and p.completed_at is null
  and coalesce(p.outcome, '') = ''
  and (
    p.priority_title ~* '(bibiemic|undefined|null|\[object Object\])'
    or p.priority_title ~* 'defina um mini ?objetivo'
    or coalesce(p.first_action, '') ~* 'defina um mini ?objetivo'
    or p.priority_title ~ '[bcdfghjklmnpqrstvwxyz]{5,}'
  )
  and not exists (
    select 1 from public.magnet_transactions t where t.direction_id = p.id
  );