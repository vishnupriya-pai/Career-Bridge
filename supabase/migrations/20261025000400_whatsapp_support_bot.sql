create table if not exists public.whatsapp_bot_contacts (
 phone_e164 text primary key check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 opted_out boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.whatsapp_bot_messages (
 id uuid primary key default gen_random_uuid(),
 message_sid text not null unique,
 phone_e164 text not null references public.whatsapp_bot_contacts(phone_e164) on delete cascade,
 user_message text not null check (char_length(user_message) between 1 and 1200),
 assistant_reply text not null default '' check (char_length(assistant_reply) <= 1200),
 created_at timestamptz not null default now()
);
create index if not exists whatsapp_bot_messages_phone_created_idx on public.whatsapp_bot_messages(phone_e164, created_at desc);
alter table public.whatsapp_bot_contacts enable row level security;
alter table public.whatsapp_bot_messages enable row level security;
revoke all on public.whatsapp_bot_contacts, public.whatsapp_bot_messages from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_bot_contacts, public.whatsapp_bot_messages to service_role;