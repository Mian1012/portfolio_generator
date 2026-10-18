-- PortfoGen database schema for Supabase
-- NOTE: This starter policy allows anonymous visitors to read, create, update,
-- and delete ALL portfolios. It is suitable only for a classroom demo with
-- non-sensitive sample data. Add Supabase Auth and owner_id-based RLS before
-- using this for real personal information.

create extension if not exists pgcrypto;

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  profile_picture text,
  email text,
  contact_number text,
  address text,
  about_me text,
  education text,
  skills text,
  projects text,
  work_experience text,
  social_links text,
  template text not null default 'simple'
    check (template in ('simple', 'modern', 'creative')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

drop policy if exists "Public demo can read portfolios" on public.portfolios;
drop policy if exists "Public demo can create portfolios" on public.portfolios;
drop policy if exists "Public demo can update portfolios" on public.portfolios;
drop policy if exists "Public demo can delete portfolios" on public.portfolios;

create policy "Public demo can read portfolios"
on public.portfolios for select to anon, authenticated using (true);

create policy "Public demo can create portfolios"
on public.portfolios for insert to anon, authenticated with check (true);

create policy "Public demo can update portfolios"
on public.portfolios for update to anon, authenticated using (true) with check (true);

create policy "Public demo can delete portfolios"
on public.portfolios for delete to anon, authenticated using (true);

create index if not exists portfolios_created_at_idx
on public.portfolios (created_at desc);
