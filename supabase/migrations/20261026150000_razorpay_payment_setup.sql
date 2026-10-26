-- Minimal schema required by the Razorpay test checkout and administrator review flow.
alter table public.payment_orders
  add column if not exists provider_payment_id text,
  add column if not exists checkout_signature_verified boolean not null default false,
  add column if not exists failure_reason text,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_paise bigint not null default 0,
  add column if not exists admin_confirmed_at timestamptz,
  add column if not exists admin_confirmed_by uuid references auth.users(id) on delete set null;

alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check
  check (status in ('created','pending','authorized','awaiting_admin','paid','failed','partially_refunded','refunded'));
alter table public.payment_orders drop constraint if exists payment_orders_refund_amount_paise_check;
alter table public.payment_orders add constraint payment_orders_refund_amount_paise_check check (refund_amount_paise >= 0);
create unique index if not exists payment_orders_payment_id_unique
  on public.payment_orders(provider_payment_id) where provider_payment_id is not null;
create index if not exists payment_orders_user_created_idx on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_created_idx on public.payment_orders(status, created_at desc);

alter table public.notification_log add column if not exists reference_id text;

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

alter table public.payment_events enable row level security;
alter table public.audit_logs enable row level security;
drop policy if exists "admin reads payment events" on public.payment_events;
create policy "admin reads payment events" on public.payment_events for select to authenticated using ((select private.is_admin()));
drop policy if exists "admin reads audit logs" on public.audit_logs;
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using ((select private.is_admin()));
grant select on public.payment_events, public.audit_logs to authenticated;
grant all on public.payment_events, public.audit_logs, public.payment_orders to service_role;
