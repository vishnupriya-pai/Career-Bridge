create table private.ai_chat_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

revoke all on private.ai_chat_rate_limits from public, anon, authenticated;
alter table private.ai_chat_rate_limits enable row level security;

create or replace function public.consume_ai_chat_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  insert into private.ai_chat_rate_limits as rate_limit (user_id, window_started_at, request_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case
      when rate_limit.window_started_at <= now() - interval '1 minute' then now()
      else rate_limit.window_started_at
    end,
    request_count = case
      when rate_limit.window_started_at <= now() - interval '1 minute' then 1
      else rate_limit.request_count + 1
    end
  returning window_started_at, request_count into v_window_started_at, v_request_count;

  return v_request_count <= 12;
end;
$$;

revoke all on function public.consume_ai_chat_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_chat_quota(uuid) to service_role;
