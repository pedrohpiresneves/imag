create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'mag-notification-sweep';

select cron.schedule(
  'mag-notification-sweep',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://project--49306e08-c864-4298-b103-5f3838df5bb6.lovable.app/api/public/cron/mag-notifications',
    headers := '{"Content-Type":"application/json","x-cron-secret":"5c8a1ff2ae5c45d38e1b613f166a29e28b3bead1afe544a39bafaea9b41aa78f"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);