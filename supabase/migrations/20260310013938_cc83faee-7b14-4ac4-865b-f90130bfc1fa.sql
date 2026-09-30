
SELECT cron.schedule(
  'check-tagihan-jatuh-tempo',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'http://127.0.0.1:54321/functions/v1/trigger-push-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"}'::jsonb,
    body := '{"type": "tagihan_reminder_cron"}'::jsonb
  ) AS request_id;
  $$
);
