/**
 * Server účtov (Supabase). Adresa a „publishable“ kľúč sú určené na zverejnenie v aplikácii –
 * prístup k údajom chránia pravidlá v databáze (každý vidí len svoj profil).
 * Tajný kľúč (secret / service_role) sem nikdy nepatrí.
 */
export const CLOUD_URL = 'https://veyiobgcuxdyrgyxukfx.supabase.co';
export const CLOUD_KEY = 'sb_publishable_6gQJlilWpyqthtbjTyCdVg_-k4HpGls';

/**
 * Prihlasuje sa používateľským menom; Supabase však potrebuje e-mail, preto sa z mena zloží
 * adresa v tejto doméne. Žiadne e-maily sa neposielajú (v Supabase je vypnuté „Confirm email“).
 */
export const CLOUD_EMAIL_DOMAIN = 'ucty.elektrolab.sk';

/** Verejná adresa aplikácie (GitHub Pages) – tam spojenie so serverom účtov funguje. */
export const PUBLIC_URL = 'https://krcmarik99.github.io/app/';
