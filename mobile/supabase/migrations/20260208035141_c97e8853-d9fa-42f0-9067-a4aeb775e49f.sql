-- Enable pg_net extension for HTTP calls from cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule due date reminders at 10:00 AM Nepal Time (04:15 UTC)
SELECT cron.schedule(
  'due-date-reminder-10am',
  '15 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/send-due-date-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YmtxYnZteXJmZ2drb3lidWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDQ1ODQsImV4cCI6MjA4NTkyMDU4NH0.aWEsnWOnddpDGlK1UjpBrscAxj900uUpX3QRyRvaSUs'
    ),
    body := jsonb_build_object('trigger', '10am')
  ) AS request_id;
  $$
);

-- Schedule due date reminders at 2:00 PM Nepal Time (08:15 UTC)
SELECT cron.schedule(
  'due-date-reminder-2pm',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hxbkqbvmyrfggkoybugz.supabase.co/functions/v1/send-due-date-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YmtxYnZteXJmZ2drb3lidWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDQ1ODQsImV4cCI6MjA4NTkyMDU4NH0.aWEsnWOnddpDGlK1UjpBrscAxj900uUpX3QRyRvaSUs'
    ),
    body := jsonb_build_object('trigger', '2pm')
  ) AS request_id;
  $$
);