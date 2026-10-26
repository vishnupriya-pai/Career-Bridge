-- Admin-managed recurring CareerBridge plan catalog and customer subscriptions.
create table if not exists public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  amount_paise integer not null default 0 check (amount_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  billing_period text not null default 'monthly' check (billing_period in ('monthly','yearly')),
  billing_interval integer not null default 1 check (billing_interval between 1 and 12),
  total_cycles integer not null default 120 check (total_cycles between 1 and 120),
  provider_plan_id text,
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (id,name,description,amount_paise,currency,billing_period,billing_interval,total_cycles,features,active,sort_order)
values
  ('free','Free','A solid start for your job search.',0,'INR','monthly',1,1,array['Browse active job opportunities','Save jobs and manage your profile','Apply to roles with your resume'],true,0),
  ('careerbridge-plus','CareerBridge Plus','More support for your next career move.',49900,'INR','monthly',1,120,array['Everything in Free','Monthly recurring billing','Payment confirmation after admin review'],true,1),
  ('careerbridge-pro','CareerBridge Pro','More time and support to find the right opportunity.',99900,'INR','yearly',1,10,array['Everything in Plus','Yearly recurring billing','Priority support from the CareerBridge team'],true,2)
on conflict (id) do nothing;

alter table public.payment_orders
  add column if not exists plan_id text references public.subscription_plans(id) on delete set null,
  add column if not exists plan_name text,
  add column if not exists plan_duration_days integer not null default 30,
  add column if not exists provider_subscription_id text;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text references public.subscription_plans(id) on delete set null,
  plan_name text not null,
  provider_subscription_id text unique,
  payment_order_id uuid unique references public.payment_orders(id) on delete restrict,
  status text not null default 'created' check (status in ('created','authenticated','active','pending','paused','halted','cancelled','completed','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_subscriptions_user_status_idx on public.user_subscriptions(user_id,status,current_period_end desc);
create index if not exists payment_orders_subscription_idx on public.payment_orders(provider_subscription_id,created_at desc);

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;
drop policy if exists "users read active plans and admins read all plans" on public.subscription_plans;
create policy "users read active plans and admins read all plans" on public.subscription_plans
  for select to anon, authenticated using (active or (select private.is_admin()));
drop policy if exists "users and admins read subscription status" on public.user_subscriptions;
create policy "users and admins read subscription status" on public.user_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id or (select private.is_admin()));
grant select on public.subscription_plans to anon, authenticated;
grant select on public.user_subscriptions to authenticated;
grant all on public.subscription_plans, public.user_subscriptions, public.payment_orders to service_role;
