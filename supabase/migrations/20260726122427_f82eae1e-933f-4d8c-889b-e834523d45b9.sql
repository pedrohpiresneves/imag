
-- Bulk restore of Data-API grants. Every public table needs explicit grants
-- for `authenticated` and `service_role`, otherwise PostgREST returns
-- "permission denied" even when RLS would allow the row. All 40 tables
-- currently have zero grants for these roles, which is why /app cannot load
-- the MAG Meta.
DO $$
DECLARE
    tbl record;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname = 'public'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
    END LOOP;
END;
$$;

-- Public reads for genuinely public tables (products/prices catalog,
-- referral landing pages, public settings). Everything else stays auth-only.
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.prices TO anon;
GRANT SELECT ON public.referral_campaigns TO anon;
GRANT SELECT ON public.referral_clicks TO anon;
GRANT SELECT ON public.referral_settings TO anon;

-- Grants on sequences owned by public tables, so INSERTs work end to end.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
