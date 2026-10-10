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

-- ------------------------------------------------------------------ správca a aktivita
-- Správca vidí zoznam účtov, ich pokrok a aktivitu (prihlásenia, dokončené lekcie, cvičenia).
-- Kto je správca, sa nastaví v SQL Editore súborom supabase/spravca.sql – z aplikácie sa to zmeniť nedá.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.admins enable row level security;

-- Každý zistí len to, či je správcom on sám. Zapisovať do tabuľky cez aplikáciu nemôže nikto.
drop policy if exists "citanie vlastneho spravcu" on public.admins;
create policy "citanie vlastneho spravcu" on public.admins
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists login_count integer not null default 0;

-- Správca číta profily všetkých (pokrok); meniť ich nemôže.
drop policy if exists "spravca cita profily" on public.profiles;
create policy "spravca cita profily" on public.profiles
  for select to authenticated using ((select public.is_admin()));

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('register', 'login', 'visit', 'lesson', 'quiz')),
  detail jsonb not null default '{}'::jsonb check (octet_length(detail::text) <= 2000)
);

create index if not exists activity_at on public.activity (at desc);
create index if not exists activity_user_at on public.activity (user_id, at desc);

alter table public.activity enable row level security;

-- Aktivitu číta len správca. Zapisuje sa iba funkciou log_activity (vždy pod vlastným účtom).
drop policy if exists "spravca cita aktivitu" on public.activity;
create policy "spravca cita aktivitu" on public.activity
  for select to authenticated using ((select public.is_admin()));

-- Staršia podoba funkcie s inými názvami parametrov sa najprv odstráni.
drop function if exists public.log_activity(text, jsonb);
create function public.log_activity(event_kind text, event_detail jsonb default '{}'::jsonb) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if auth.uid() is null then
    return;
  end if;
  insert into public.activity (user_id, kind, detail) values (auth.uid(), event_kind, coalesce(event_detail, '{}'::jsonb));
  update public.profiles
    set last_seen = now(),
        login_count = login_count + case when event_kind in ('login', 'register') then 1 else 0 end
    where id = auth.uid();
end;
$$;

revoke execute on function public.log_activity(text, jsonb) from public, anon;
grant execute on function public.log_activity(text, jsonb) to authenticated;

-- Zoznam všetkých účtov pre správcu (aj tých, ktoré ešte nemajú profil).
drop function if exists public.admin_users();
create function public.admin_users()
  returns table (
    id uuid, username text, name text, created_at timestamptz, last_sign_in_at timestamptz,
    last_seen timestamptz, login_count integer, progress jsonb
  )
  language plpgsql stable security definer set search_path = ''
  as $$
begin
  if not public.is_admin() then
    raise exception 'Len pre správcu.' using errcode = '42501';
  end if;
  return query
    select u.id,
           coalesce(p.username, u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
           coalesce(p.name, u.raw_user_meta_data ->> 'name', ''),
           u.created_at, u.last_sign_in_at, p.last_seen, coalesce(p.login_count, 0), p.progress
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by greatest(coalesce(p.last_seen, 'epoch'::timestamptz), coalesce(u.last_sign_in_at, 'epoch'::timestamptz)) desc;
end;
$$;

revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;
