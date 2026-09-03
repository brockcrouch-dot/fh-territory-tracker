-- One-time correction for the empty FH Territory Tracker database.
-- Safe here because the tables were just created and contain no app data yet.
drop table if exists public.activities cascade;
drop table if exists public.leads cascade;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('Business','Residential')),
  name text not null,
  town text,
  contact text,
  phone text,
  employees text,
  workforce_1099 text,
  status text not null default 'New',
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  kind text not null check (kind in ('Business','Residential')),
  name text not null,
  status text not null,
  notes text,
  happened_at timestamptz not null default now(),
  follow_up_at timestamptz,
  latitude double precision,
  longitude double precision
);

alter table public.leads enable row level security;
alter table public.activities enable row level security;

create policy "Users can view own leads" on public.leads for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own leads" on public.leads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own leads" on public.leads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own leads" on public.leads for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Users can view own activities" on public.activities for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create own activities" on public.activities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own activities" on public.activities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own activities" on public.activities for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.leads, public.activities to authenticated;

create index leads_user_id_idx on public.leads(user_id);
create index leads_status_idx on public.leads(user_id,status);
create index activities_user_id_idx on public.activities(user_id);
create index activities_lead_id_idx on public.activities(lead_id);
create index activities_follow_up_idx on public.activities(user_id,follow_up_at);
