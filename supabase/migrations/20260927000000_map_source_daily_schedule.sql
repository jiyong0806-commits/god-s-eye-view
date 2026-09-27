create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Provision gev_project_url and gev_publishable_key in Vault before applying.
select cron.schedule(
  'gev-map-source-daily',
  '10 16 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'gev_project_url')
        || '/functions/v1/refresh-map-source',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'gev_publishable_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    );
  $$
);
