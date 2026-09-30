-- AI usage logging + admin-only reporting (Supabase local).
-- NOTE: PostgreSQL does not support RLS policies on plain VIEWs.
-- We use SECURITY DEFINER RPC for admin reporting instead.

create extension if not exists pgcrypto;

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  user_id uuid null,
  role text null,
  feature text not null,
  mapel_id uuid null,

  model text null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cost_idr_est numeric(12,2) null,

  status_code integer not null default 200,
  error_code text null,
  latency_ms integer null,
  request_id text null,

  metadata jsonb null
);

create index if not exists ai_usage_logs_created_at_idx on public.ai_usage_logs (created_at desc);
create index if not exists ai_usage_logs_feature_idx on public.ai_usage_logs (feature);
create index if not exists ai_usage_logs_user_id_idx on public.ai_usage_logs (user_id);

alter table public.ai_usage_logs enable row level security;

-- Only admins can read logs from client (admin UI).
create policy "Admins can read ai usage logs"
on public.ai_usage_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- --- RPC: Admin usage dashboard (daily totals for last N days) ---
create or replace function public.ai_admin_usage_daily(days_back integer default 14)
returns table(
  day date,
  total_tokens bigint,
  requests bigint,
  ok_requests bigint,
  err_requests bigint,
  avg_latency_ms double precision
)
language sql
security definer
set search_path = public
as $$
  select
    (created_at at time zone 'utc')::date as day,
    sum(total_tokens)::bigint as total_tokens,
    count(*)::bigint as requests,
    sum(case when status_code between 200 and 299 then 1 else 0 end)::bigint as ok_requests,
    sum(case when status_code between 200 and 299 then 0 else 1 end)::bigint as err_requests,
    avg(latency_ms)::double precision as avg_latency_ms
  from public.ai_usage_logs
  where
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and created_at >= (now() at time zone 'utc') - make_interval(days => greatest(1, days_back))
  group by 1
  order by 1;
$$;

revoke all on function public.ai_admin_usage_daily(integer) from public;
grant execute on function public.ai_admin_usage_daily(integer) to authenticated;

-- --- RPC: Admin monthly totals (last N months) ---
create or replace function public.ai_admin_usage_monthly(months_back integer default 6)
returns table(
  month_start date,
  total_tokens bigint,
  requests bigint,
  ok_requests bigint,
  err_requests bigint
)
language sql
security definer
set search_path = public
as $$
  select
    date_trunc('month', created_at at time zone 'utc')::date as month_start,
    sum(total_tokens)::bigint as total_tokens,
    count(*)::bigint as requests,
    sum(case when status_code between 200 and 299 then 1 else 0 end)::bigint as ok_requests,
    sum(case when status_code between 200 and 299 then 0 else 1 end)::bigint as err_requests
  from public.ai_usage_logs
  where
    public.has_role(auth.uid(), 'admin'::public.app_role)
    and created_at >= date_trunc('month', (now() at time zone 'utc') - make_interval(months => greatest(1, months_back)))
  group by 1
  order by 1 desc;
$$;

revoke all on function public.ai_admin_usage_monthly(integer) from public;
grant execute on function public.ai_admin_usage_monthly(integer) to authenticated;

-- --- RPC: Admin recent logs ---
create or replace function public.ai_admin_recent_logs(limit_rows integer default 80)
returns table(
  created_at timestamptz,
  feature text,
  role text,
  user_id uuid,
  model text,
  total_tokens integer,
  status_code integer,
  error_code text,
  latency_ms integer
)
language sql
security definer
set search_path = public
as $$
  select
    l.created_at,
    l.feature,
    coalesce(l.role, '')::text as role,
    l.user_id,
    l.model,
    l.total_tokens,
    l.status_code,
    l.error_code,
    l.latency_ms
  from public.ai_usage_logs l
  where public.has_role(auth.uid(), 'admin'::public.app_role)
  order by l.created_at desc
  limit greatest(1, least(limit_rows, 200));
$$;

revoke all on function public.ai_admin_recent_logs(integer) from public;
grant execute on function public.ai_admin_recent_logs(integer) to authenticated;

-- --- RPC: Month total tokens (used by edge functions for budget enforcement) ---
-- SECURITY DEFINER so edge functions can call with service role; admin check is not required.
create or replace function public.ai_month_total_tokens(month_start timestamptz)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(total_tokens), 0)::bigint
  from public.ai_usage_logs
  where created_at >= month_start
    and created_at < (month_start + interval '1 month');
$$;

revoke all on function public.ai_month_total_tokens(timestamptz) from public;
grant execute on function public.ai_month_total_tokens(timestamptz) to authenticated;

