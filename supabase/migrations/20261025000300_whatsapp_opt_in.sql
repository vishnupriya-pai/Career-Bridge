alter table public.profiles add column if not exists whatsapp_opt_in boolean not null default false;
grant update(whatsapp_opt_in) on public.profiles to authenticated;