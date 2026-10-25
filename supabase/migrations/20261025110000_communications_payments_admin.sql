-- Messaging history, admin-controlled campaigns and auditable payment events.
alter table public.notification_log
  add column if not exists event_key text,
  add column if not exists reference_id text,
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
create index if not exists notification_log_user_created_idx
  on public.notification_log(user_id, created_at desc);

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  channel text not null check (channel in ('sms','whatsapp')),
  audience text not null check (audience in ('all','fresher','experienced')),
  message text not null check (char_length(message) between 1 and 1200),
  job_id uuid references public.jobs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sending','completed','partial','failed','cancelled')),
  total_recipients integer not null default 0 check (total_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists notification_campaigns_created_idx on public.notification_campaigns(created_at desc);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('sms','whatsapp')),
  status text not null default 'pending' check (status in ('pending','sent','delivered','failed','undelivered','suppressed')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id, channel)
);
create index if not exists campaign_recipients_pending_idx on public.campaign_recipients(campaign_id, status, created_at);
create index if not exists campaign_recipients_user_idx on public.campaign_recipients(user_id, created_at desc);

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

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  provider_order_id text,
  provider_payment_id text,
  payload_hash text not null,
  processed_at timestamptz,
  received_at timestamptz not null default now()
);
create index if not exists payment_events_order_idx on public.payment_events(provider_order_id, received_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.payment_orders
  add column if not exists provider_payment_id text,
  add column if not exists checkout_signature_verified boolean not null default false,
  add column if not exists failure_reason text,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_paise bigint not null default 0 check (refund_amount_paise >= 0);
alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check
  check (status in ('created','pending','authorized','paid','failed','partially_refunded','refunded'));
create unique index if not exists payment_orders_payment_id_unique
  on public.payment_orders(provider_payment_id) where provider_payment_id is not null;
create index if not exists payment_orders_user_created_idx on public.payment_orders(user_id, created_at desc);

alter table public.notification_log enable row level security;
alter table public.notification_campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.payment_events enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "user reads own notification history" on public.notification_log;
create policy "user reads own notification history" on public.notification_log
  for select to authenticated using ((select auth.uid()) = user_id or (select private.is_admin()));
drop policy if exists "admin reads campaigns" on public.notification_campaigns;
create policy "admin reads campaigns" on public.notification_campaigns for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin reads campaign recipients" on public.campaign_recipients;
create policy "admin reads campaign recipients" on public.campaign_recipients for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin reads provider webhook events" on public.provider_webhook_events;
create policy "admin reads provider webhook events" on public.provider_webhook_events for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin reads payment events" on public.payment_events;
create policy "admin reads payment events" on public.payment_events for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using ((select private.is_admin()));

grant select on public.notification_log, public.notification_campaigns, public.campaign_recipients,
  public.provider_webhook_events, public.payment_events, public.audit_logs to authenticated;
grant all on public.notification_log, public.notification_campaigns, public.campaign_recipients,
  public.provider_webhook_events, public.payment_events, public.audit_logs, public.payment_orders to service_role;


create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('twilio','meta')),
  provider_message_id text not null unique,
  channel text not null check (channel in ('sms','whatsapp')),
  from_e164 text not null check (from_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  profile_id uuid references public.profiles(id) on delete set null,
  message_text text not null default '' check (char_length(message_text) <= 1200),
  received_at timestamptz not null default now()
);
create index if not exists inbound_messages_created_idx on public.inbound_messages(received_at desc);
alter table public.inbound_messages enable row level security;
drop policy if exists "admin reads inbound messages" on public.inbound_messages;
create policy "admin reads inbound messages" on public.inbound_messages for select to authenticated using ((select private.is_admin()));
grant select on public.inbound_messages to authenticated;
grant all on public.inbound_messages to service_role;


create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  provider_refund_id text not null unique,
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  provider_payment_id text not null,
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null check (status in ('pending','processed','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists payment_refunds_order_idx on public.payment_refunds(payment_order_id, created_at desc);
alter table public.payment_refunds enable row level security;
drop policy if exists "admin reads payment refunds" on public.payment_refunds;
create policy "admin reads payment refunds" on public.payment_refunds for select to authenticated using ((select private.is_admin()));
revoke all on public.inbound_messages, public.notification_campaigns, public.campaign_recipients, public.provider_webhook_events, public.payment_events, public.audit_logs, public.payment_refunds from public, anon, authenticated;
grant select on public.payment_refunds to authenticated;
grant all on public.payment_refunds to service_role;
