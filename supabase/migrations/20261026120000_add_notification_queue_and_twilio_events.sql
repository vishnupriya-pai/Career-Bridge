-- Add the minimal persistence required by notify and the Twilio status webhook.
-- This is intentionally separate from the broader communications/payments
-- migration so applying the WhatsApp fix does not add unrelated tables.
alter table public.notification_log
  add column if not exists event_key text,
  add column if not exists provider text,
  add column if not exists provider_message_id text,
  add column if not exists status text not null default 'sent',
  add column if not exists error_code text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.notification_log drop constraint if exists notification_log_status_check;
alter table public.notification_log add constraint notification_log_status_check
  check (status in ('queued','sent','delivered','failed','undelivered'));

create unique index if not exists notification_log_event_channel_unique
  on public.notification_log(user_id, channel, event_key);
create unique index if not exists notification_log_provider_message_unique
  on public.notification_log(provider, provider_message_id)
  where provider is not null and provider_message_id is not null;

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('twilio','razorpay')),
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.provider_webhook_events enable row level security;
revoke all on public.provider_webhook_events from public, anon, authenticated;
grant all on public.provider_webhook_events to service_role;
