-- Security remediation: closes the tables reported as public by Supabase Advisor.
-- Safe to run after earlier schema versions; service_role keeps the API access it needs.
begin;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.analytics enable row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_events enable row level security;
alter table public.error_logs enable row level security;
alter table public.finance_entries enable row level security;

-- These four tables are never read by the browser. Defense in depth: deny the
-- Data API roles even before RLS policy evaluation; the backend service_role
-- continues to access them.
revoke all privileges on table public.usage_counters from anon, authenticated;
revoke all privileges on table public.usage_events from anon, authenticated;
revoke all privileges on table public.error_logs from anon, authenticated;
revoke all privileges on table public.finance_entries from anon, authenticated;

notify pgrst, 'reload schema';

commit;
