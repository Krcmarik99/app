-- Databáza pre online účty ElektroLab (Supabase → SQL Editor → Run).
-- Každý používateľ číta a mení len svoj vlastný profil (row level security).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  name text not null,
  progress jsonb not null default '{}'::jsonb,
  circuit jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "citanie vlastnych udajov" on public.profiles
  for select using (auth.uid() = id);
create policy "vytvorenie vlastneho profilu" on public.profiles
  for insert with check (auth.uid() = id);
create policy "uprava vlastnych udajov" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Používateľ môže zmazať vlastný účet (aj s profilom).
create function public.delete_my_account() returns void
  language sql security definer set search_path = ''
  as $$ delete from auth.users where id = auth.uid(); $$;
grant execute on function public.delete_my_account() to authenticated;
