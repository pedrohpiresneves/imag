create or replace function public.guard_ambassador_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role_name text := current_setting('role', true);
begin
  if current_role_name in ('service_role','postgres','supabase_admin') then
    return new;
  end if;
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.tier := old.tier;
  new.status := old.status;
  new.code := old.code;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists guard_ambassador_fields_trg on public.ambassadors;
create trigger guard_ambassador_fields_trg
before update on public.ambassadors
for each row execute function public.guard_ambassador_fields();