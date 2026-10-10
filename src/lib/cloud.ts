/**
 * Klient servera účtov (Supabase) cez jeho REST rozhranie – bez ďalších knižníc.
 * Prihlásenie (GoTrue) vracia prístupový token, ktorým sa potom číta a zapisuje vlastný
 * riadok v tabuľke `profiles` (pokrok a uložené zapojenie). Token sa pred vypršaním obnoví.
 */
import { CLOUD_EMAIL_DOMAIN, CLOUD_KEY, CLOUD_URL } from './config';

export interface CloudUser {
  id: string;
  username: string;
  name: string;
  created: string;
}

export interface CloudSession {
  access: string;
  refresh: string;
  /** Kedy prístupový token vyprší (ms od 1970). */
  expiresAt: number;
  remember: boolean;
  user: CloudUser;
}

export interface CloudProfile {
  username: string;
  name: string;
  progress: unknown;
  circuit: unknown;
  updated_at?: string;
}

export type CloudErrorKind = 'network' | 'credentials' | 'exists' | 'confirm' | 'weak' | 'expired' | 'server';

export class CloudError extends Error {
  constructor(readonly kind: CloudErrorKind, message: string, readonly status = 0) {
    super(message);
  }
}

interface Config {
  url: string;
  key: string;
  fetch: typeof fetch;
}

let config: Config | null = typeof fetch === 'function'
  ? { url: CLOUD_URL, key: CLOUD_KEY, fetch: (...args) => fetch(...args) }
  : null;

/** Posledná kontrola servera (pozri `checkCloud`). */
let health: { at: number; value: Promise<CloudHealth> } | null = null;

/** Nastaví server (v testoch náhradný), alebo ho vypne (`null`) – vtedy sa používajú len účty v prehliadači. */
export function configureCloud(next: { url: string; key: string; fetch?: typeof fetch } | null): void {
  config = next ? { url: next.url, key: next.key, fetch: next.fetch ?? ((...args) => fetch(...args)) } : null;
  health = null;
}

export const cloudEnabled = (): boolean => !!config;

export const emailOf = (username: string) => `${username.trim().toLowerCase()}@${CLOUD_EMAIL_DOMAIN}`;

function errorFrom(status: number, body: Record<string, unknown> | null): CloudError {
  const code = String(body?.error_code ?? body?.code ?? body?.error ?? '');
  const msg = String(body?.msg ?? body?.message ?? body?.error_description ?? '');
  if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/i.test(msg)) {
    return new CloudError('credentials', 'Nesprávne používateľské meno alebo heslo.');
  }
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || /refresh token/i.test(msg)) {
    return new CloudError('credentials', 'Prihlásenie vypršalo. Prihlás sa znova.');
  }
  if (code === 'user_already_exists' || code === 'email_exists' || code === '23505' || /already (registered|exists)/i.test(msg)) {
    return new CloudError('exists', 'Toto používateľské meno už niekto používa. Vyber si iné.');
  }
  if (code === 'email_not_confirmed') {
    return new CloudError('confirm', 'Účet čaká na potvrdenie e-mailom. V nastaveniach Supabase treba vypnúť „Confirm email“.');
  }
  if (code === 'weak_password') return new CloudError('weak', 'Heslo je príliš slabé. Použi dlhšie heslo.');
  if (status === 401 || code === 'PGRST301' || code === 'bad_jwt') return new CloudError('expired', 'Prihlásenie vypršalo.');
  if (status === 429 || /rate limit/i.test(msg)) return new CloudError('server', 'Priveľa pokusov za krátky čas. Skús to o chvíľu.');
  return new CloudError('server', `Server účtov odpovedal chybou${msg ? `: ${msg}` : ` (${status})`}.`);
}

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<unknown> {
  if (!config) throw new CloudError('network', 'Server účtov nie je nastavený.');
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await config.fetch(config.url + path, {
      ...rest,
      headers: {
        apikey: config.key,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new CloudError('network', 'Server účtov nie je dostupný.');
  }
  const text = await res.text().catch(() => '');
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const e = errorFrom(res.status, body as Record<string, unknown> | null);
    throw new CloudError(e.kind, e.message, res.status);
  }
  return body;
}

interface AuthBody {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> };
}

function sessionFrom(raw: unknown, remember: boolean, previous?: CloudUser): CloudSession {
  const body = raw as AuthBody | null;
  if (!body?.access_token || !body.refresh_token || !body.user) {
    throw new CloudError('confirm', 'Registrácia čaká na potvrdenie e-mailom. V nastaveniach Supabase treba vypnúť „Confirm email“.');
  }
  const meta = body.user.user_metadata ?? {};
  const username = typeof meta.username === 'string' ? meta.username : previous?.username ?? (body.user.email ?? '').split('@')[0];
  return {
    access: body.access_token,
    refresh: body.refresh_token,
    expiresAt: body.expires_at ? body.expires_at * 1000 : Date.now() + (body.expires_in ?? 3600) * 1000,
    remember,
    user: {
      id: body.user.id,
      username,
      name: typeof meta.name === 'string' && meta.name ? meta.name : previous?.name ?? username,
      created: body.user.created_at ?? previous?.created ?? new Date().toISOString(),
    },
  };
}

export async function cloudSignUp(username: string, password: string, name: string, remember: boolean): Promise<CloudSession> {
  const body = await call('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email: emailOf(username), password, data: { username, name } }),
  });
  return sessionFrom(body, remember);
}

export async function cloudSignIn(username: string, password: string, remember: boolean): Promise<CloudSession> {
  const body = await call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: emailOf(username), password }),
  });
  return sessionFrom(body, remember);
}

async function cloudRefresh(s: CloudSession): Promise<CloudSession> {
  const body = await call('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: s.refresh }),
  });
  return sessionFrom(body, s.remember, s.user);
}

/**
 * Obnovovací token sa dá použiť len raz. Keď ho naraz potrebuje viac požiadaviek (napr. odoslanie
 * pokroku a záznam aktivity), obnoví sa len raz a všetky dostanú ten istý nový token.
 */
const refreshes = new Map<string, Promise<CloudSession>>();

function refreshOnce(s: CloudSession): Promise<CloudSession> {
  let pending = refreshes.get(s.refresh);
  if (!pending) {
    pending = cloudRefresh(s);
    refreshes.set(s.refresh, pending);
    pending.catch(() => refreshes.delete(s.refresh));
    if (refreshes.size > 20) refreshes.delete(refreshes.keys().next().value!);
  }
  return pending;
}

export async function cloudSignOut(s: CloudSession): Promise<void> {
  try {
    await call('/auth/v1/logout', { method: 'POST', token: s.access });
  } catch {
    // Odhlásenie na serveri je len upratovanie – v prehliadači je používateľ odhlásený tak či tak.
  }
}

// ------------------------------------------------------------------ uloženie prihlásenia

const SESSION_KEY = 'elektrolab:cloud-session';

function isSession(x: unknown): x is CloudSession {
  const s = x as Partial<CloudSession> | null;
  return !!s && typeof s.access === 'string' && typeof s.refresh === 'string' && typeof s.expiresAt === 'number'
    && !!s.user && typeof s.user.id === 'string' && typeof s.user.username === 'string';
}

export function loadCloudSession(): CloudSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    const s: unknown = raw ? JSON.parse(raw) : null;
    return isSession(s) ? s : null;
  } catch {
    return null;
  }
}

export function storeCloudSession(s: CloudSession | null): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (s) (s.remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // Bez úložiska prihlásenie vydrží len do obnovenia stránky.
  }
}

/**
 * Zavolá `fn` s platným prístupovým tokenom; pred vypršaním (alebo po odmietnutí) ho obnoví.
 * Bez `explicit` použije uložené prihlásenie (a obnovený token uloží).
 */
async function withToken<T>(fn: (token: string, user: CloudUser) => Promise<T>, explicit?: CloudSession): Promise<T> {
  let s = explicit ?? loadCloudSession();
  if (!s) throw new CloudError('credentials', 'Nie si prihlásený.');
  const keep = (next: CloudSession) => {
    const stored = loadCloudSession();
    if (stored && stored.user.id === next.user.id) storeCloudSession(next);
    s = next;
  };
  if (s.expiresAt - Date.now() < 60_000) keep(await refreshOnce(s));
  try {
    return await fn(s.access, s.user);
  } catch (e) {
    if (!(e instanceof CloudError) || e.kind !== 'expired') throw e;
    keep(await refreshOnce(s));
    return fn(s.access, s.user);
  }
}

// ------------------------------------------------------------------ profil (pokrok a zapojenie)

export async function fetchProfile(session?: CloudSession): Promise<CloudProfile | null> {
  return withToken(async (token, user) => {
    const rows = await call(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=username,name,progress,circuit,updated_at`, { token });
    return Array.isArray(rows) && rows.length ? (rows[0] as CloudProfile) : null;
  }, session);
}

/** Zapíše (alebo vytvorí) vlastný profil. Zapisujú sa len zadané stĺpce. */
export async function saveProfile(
  fields: { progress?: unknown; circuit?: unknown },
  opts: { keepalive?: boolean; session?: CloudSession } = {},
): Promise<void> {
  const keepalive = opts.keepalive ?? false;
  await withToken(async (token, user) => {
    await call('/rest/v1/profiles', {
      method: 'POST',
      token,
      keepalive,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: user.id, username: user.username, name: user.name, ...fields, updated_at: new Date().toISOString() }),
    });
  }, opts.session);
}

/** Natrvalo zmaže prihlásený účet (funkcia `delete_my_account` v databáze). */
export async function deleteCloudAccount(token: string): Promise<void> {
  await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token, body: '{}' });
}

// ------------------------------------------------------------------ aktivita a správa

/** Udalosti, ktoré vidí správca: registrácia, prihlásenie, otvorenie aplikácie, dokončená lekcia, cvičenie. */
export type ActivityKind = 'register' | 'login' | 'visit' | 'lesson' | 'quiz';

/** Zapíše udalosť pod prihlásený účet (funkcia `log_activity` v databáze). */
export async function cloudLogActivity(
  kind: ActivityKind,
  detail: Record<string, unknown> = {},
  opts: { keepalive?: boolean; session?: CloudSession } = {},
): Promise<void> {
  await withToken(async (token) => {
    await call('/rest/v1/rpc/log_activity', {
      method: 'POST', token, keepalive: opts.keepalive ?? false,
      body: JSON.stringify({ event_kind: kind, event_detail: detail }),
    });
  }, opts.session);
}

/** Je prihlásený účet správca? Pri chybe (aj keď databáza správu ešte nemá) vráti false. */
export async function cloudIsAdmin(session?: CloudSession): Promise<boolean> {
  try {
    const value = await withToken((token) => call('/rest/v1/rpc/is_admin', { method: 'POST', token, body: '{}' }), session);
    return value === true;
  } catch {
    return false;
  }
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
  last_seen: string | null;
  login_count: number;
  progress: unknown;
}

export interface ActivityRow {
  id: number;
  user_id: string;
  at: string;
  kind: ActivityKind;
  detail: Record<string, unknown>;
}

/** Všetky účty s pokrokom – len pre správcu (inak server odmietne). */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const rows = await withToken((token) => call('/rest/v1/rpc/admin_users', { method: 'POST', token, body: '{}' }));
  return Array.isArray(rows) ? (rows as AdminUser[]) : [];
}

/** Posledné udalosti (najnovšie prvé), voliteľne len jedného účtu. Bežnému účtu databáza nevráti nič. */
export async function fetchActivity(opts: { userId?: string; limit?: number } = {}): Promise<ActivityRow[]> {
  const params = new URLSearchParams({ select: 'id,user_id,at,kind,detail', order: 'at.desc', limit: String(opts.limit ?? 200) });
  if (opts.userId) params.set('user_id', `eq.${opts.userId}`);
  const rows = await withToken((token) => call(`/rest/v1/activity?${params}`, { token }));
  return Array.isArray(rows) ? (rows as ActivityRow[]) : [];
}

// ------------------------------------------------------------------ kontrola nastavenia servera

export interface CloudHealth {
  /** Server odpovedá (spojenie nie je zablokované). */
  reachable: boolean;
  /** Registrácia prihlási hneď – v Supabase je vypnuté „Confirm email“. */
  autoconfirm: boolean | null;
  /** V databáze je tabuľka `profiles`. */
  table: boolean | null;
}

/** Overí, či je server účtov dostupný a správne nastavený (výsledok si pamätá minútu). */
export function checkCloud(): Promise<CloudHealth> {
  if (health && Date.now() - health.at < 60_000) return health.value;
  const value = (async (): Promise<CloudHealth> => {
    let settings: Record<string, unknown> | null;
    try {
      settings = (await call('/auth/v1/settings')) as Record<string, unknown> | null;
    } catch (e) {
      const reachable = !(e instanceof CloudError && e.kind === 'network');
      return { reachable, autoconfirm: null, table: null };
    }
    let table: boolean | null = null;
    try {
      await call('/rest/v1/profiles?select=id&limit=1');
      table = true;
    } catch (e) {
      if (e instanceof CloudError && e.status === 404) table = false;
    }
    return { reachable: true, autoconfirm: settings?.mailer_autoconfirm === true, table };
  })();
  health = { at: Date.now(), value };
  return value;
}
