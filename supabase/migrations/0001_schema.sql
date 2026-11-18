-- AHA Leadership Insight - schema, constraints, and RLS
-- Run this file first in the Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('admin')),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.dimensions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  description text not null default '',
  weight numeric not null default 0 check (weight >= 0),
  strength_guidance text not null default '',
  development_guidance text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  dimension_id uuid not null references public.dimensions (id),
  question_text text not null check (char_length(btrim(question_text)) > 0),
  weight numeric not null default 1 check (weight > 0),
  reverse_scoring boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_versions (
  id uuid primary key default gen_random_uuid(),
  version_number integer not null unique,
  configuration_snapshot jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id),
  assessment_version_id uuid not null references public.assessment_versions (id),
  access_token uuid not null default gen_random_uuid(),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references public.assessment_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  question_snapshot jsonb not null,
  answer integer not null check (answer between 1 and 5),
  corrected_answer integer not null check (corrected_answer between 1 and 5),
  created_at timestamptz not null default now(),
  unique (assessment_session_id, question_id)
);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null unique references public.assessment_sessions (id) on delete cascade,
  overall_score numeric not null,
  category text not null,
  dimension_scores jsonb not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create unique index if not exists participants_email_unique
  on public.participants (lower(email))
  where email is not null;
create index if not exists questions_dimension_idx on public.questions (dimension_id);
create index if not exists questions_active_order_idx on public.questions (is_active, sort_order);
create index if not exists sessions_participant_idx on public.assessment_sessions (participant_id);
create index if not exists sessions_version_idx on public.assessment_sessions (assessment_version_id);
create index if not exists results_created_idx on public.assessment_results (created_at desc);
create index if not exists results_category_idx on public.assessment_results (category);
create index if not exists responses_session_idx on public.responses (assessment_session_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists dimensions_set_updated_at on public.dimensions;
create trigger dimensions_set_updated_at
  before update on public.dimensions
  for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin helper
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.participants enable row level security;
alter table public.dimensions enable row level security;
alter table public.questions enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.assessment_sessions enable row level security;
alter table public.responses enable row level security;
alter table public.assessment_results enable row level security;

-- Profiles: a user may read their own profile; active admins may read all.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Configuration tables: only active admins. Writes are used for the working draft.
-- No DELETE policy is defined: questions/dimensions are retired with is_active so
-- historical results keep referencing their original records.
drop policy if exists dimensions_admin_all on public.dimensions;
drop policy if exists questions_admin_all on public.questions;
drop policy if exists dimensions_admin_select on public.dimensions;
create policy dimensions_admin_select on public.dimensions
  for select to authenticated
  using (public.is_admin());

drop policy if exists dimensions_admin_insert on public.dimensions;
create policy dimensions_admin_insert on public.dimensions
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists dimensions_admin_update on public.dimensions;
create policy dimensions_admin_update on public.dimensions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists questions_admin_select on public.questions;
create policy questions_admin_select on public.questions
  for select to authenticated
  using (public.is_admin());

drop policy if exists questions_admin_insert on public.questions;
create policy questions_admin_insert on public.questions
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists questions_admin_update on public.questions;
create policy questions_admin_update on public.questions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Versions are read-only for admins. Creation/publishing happens through
-- SECURITY DEFINER functions so published snapshots cannot be edited directly.
drop policy if exists versions_admin_select on public.assessment_versions;
create policy versions_admin_select on public.assessment_versions
  for select to authenticated
  using (public.is_admin());

-- Assessment data is readable by active admins only.
drop policy if exists participants_admin_select on public.participants;
create policy participants_admin_select on public.participants
  for select to authenticated
  using (public.is_admin());

drop policy if exists sessions_admin_select on public.assessment_sessions;
create policy sessions_admin_select on public.assessment_sessions
  for select to authenticated
  using (public.is_admin());

drop policy if exists responses_admin_select on public.responses;
create policy responses_admin_select on public.responses
  for select to authenticated
  using (public.is_admin());

drop policy if exists results_admin_select on public.assessment_results;
create policy results_admin_select on public.assessment_results
  for select to authenticated
  using (public.is_admin());

-- No policies are defined for the anon role: participants interact only through
-- the public SECURITY DEFINER RPCs in 0002_functions.sql.

-- ---------------------------------------------------------------------------
-- New auth users get an inactive admin profile. Activate explicitly in SQL:
--   update public.profiles set is_active = true where email = 'admin@example.com';
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, is_active)
  values (new.id, coalesce(new.email, ''), 'admin', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
