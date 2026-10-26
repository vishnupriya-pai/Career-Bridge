-- Provider-confirmed test payments wait for an administrator before the
-- customer is marked paid and receives the confirmation email.
alter table public.payment_orders
  add column if not exists admin_confirmed_at timestamptz,
  add column if not exists admin_confirmed_by uuid references auth.users(id) on delete set null;

alter table public.payment_orders drop constraint if exists payment_orders_status_check;
alter table public.payment_orders add constraint payment_orders_status_check
  check (status in ('created','pending','authorized','awaiting_admin','paid','failed','partially_refunded','refunded'));

create index if not exists payment_orders_status_created_idx
  on public.payment_orders(status, created_at desc);
