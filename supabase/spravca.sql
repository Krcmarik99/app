-- Nastavenie správcu aplikácie (Supabase → SQL Editor → Run).
-- Najprv spusti supabase/schema.sql. Potom namiesto TVOJE_MENO napíš svoje používateľské meno
-- z aplikácie (malými písmenami) a spusti tento príkaz. Môžeš ho zopakovať pre ďalších správcov.

insert into public.admins (user_id)
select id from auth.users where email = lower('TVOJE_MENO') || '@ucty.elektrolab.sk'
on conflict do nothing;

-- Kontrola – mal by sa vypísať tvoj účet:
select u.email, a.user_id from public.admins a join auth.users u on u.id = a.user_id;

-- Odobratie správcu:
-- delete from public.admins where user_id = (select id from auth.users where email = 'meno@ucty.elektrolab.sk');
