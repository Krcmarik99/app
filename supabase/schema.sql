-- Databáza pre online účty ElektroLab (Supabase → SQL Editor → Run).
-- Dá sa spustiť aj opakovane. Každý používateľ číta a mení len svoj vlastný profil.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  name text not null,
  progress jsonb not null default '{}'::jsonb,
  circuit jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "citanie vlastnych udajov" on public.profiles;
create policy "citanie vlastnych udajov" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "vytvorenie vlastneho profilu" on public.profiles;
create policy "vytvorenie vlastneho profilu" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "uprava vlastnych udajov" on public.profiles;
create policy "uprava vlastnych udajov" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Používateľ môže zmazať vlastný účet (profil sa zmaže s ním).
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
