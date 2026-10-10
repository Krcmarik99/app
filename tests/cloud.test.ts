// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { currentAccount, deleteAccount, login, logout, register, type RegisterInput } from '../src/lib/auth';
import { initActivity } from '../src/lib/activity';
import { CloudError, checkCloud, cloudIsAdmin, configureCloud, fetchActivity, fetchAdminUsers } from '../src/lib/cloud';
import { getProgress, progressOf, recordSession, setCardKnown, setLessonDone } from '../src/lib/progress';
import { flush, initSync, pushCircuit, syncStatus } from '../src/lib/sync';
import { adminView, describeActivity, when } from '../src/views/admin';

const URL_ = 'https://test.supabase.co';
const KEY = 'sb_publishable_test';

interface FakeUser { id: string; email: string; password: string; meta: Record<string, unknown>; created_at: string }

/** Náhradný server s rovnakým REST rozhraním ako Supabase (Auth + PostgREST s pravidlami prístupu). */
function fakeSupabase() {
  const users = new Map<string, FakeUser>();
  const access = new Map<string, string>();
  const refresh = new Map<string, string>();
  const profiles = new Map<string, Record<string, unknown>>();
  const admins = new Set<string>();
  const activity: { id: number; user_id: string; at: string; kind: string; detail: unknown }[] = [];
  let online = true;
  let autoconfirm = true;
  let tableExists = true;
  let n = 0;
  const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const sessionOf = (u: FakeUser) => {
    const a = `a${++n}`;
    const r = `r${++n}`;
    access.set(a, u.id);
    refresh.set(r, u.id);
    return {
      access_token: a, refresh_token: r, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: u.id, email: u.email, created_at: u.created_at, user_metadata: u.meta },
    };
  };
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!online) throw new TypeError('Failed to fetch');
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    if (headers.get('apikey') !== KEY) return json(401, { message: 'Invalid API key' });
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const path = url.pathname;
    if (path === '/auth/v1/settings') return json(200, { disable_signup: false, mailer_autoconfirm: autoconfirm, external: { email: true } });
    if (path === '/rest/v1/profiles' && !tableExists) return json(404, { code: 'PGRST205', message: "Could not find the table 'public.profiles'" });
    if (path === '/auth/v1/signup') {
      if ([...users.values()].some((u) => u.email === body.email)) return json(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      if (String(body.password).length < 6) return json(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
      const u: FakeUser = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, email: body.email, password: body.password, meta: body.data ?? {}, created_at: new Date().toISOString() };
      users.set(u.id, u);
      return json(200, sessionOf(u));
    }
    if (path === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = [...users.values()].find((x) => x.email === body.email);
        if (!u || u.password !== body.password) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return json(200, sessionOf(u));
      }
      const id = refresh.get(body.refresh_token);
      if (!id || !users.has(id)) return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      refresh.delete(body.refresh_token);
      return json(200, sessionOf(users.get(id)!));
    }
    const uid = access.get((headers.get('Authorization') ?? '').replace('Bearer ', ''));
    if (path === '/auth/v1/logout') {
      access.delete((headers.get('Authorization') ?? '').replace('Bearer ', ''));
      return json(204);
    }
    // Bez prihlásenia (rola anon) pravidlá nepustia k žiadnemu riadku.
    if (!uid && path === '/rest/v1/profiles' && method === 'GET') return json(200, []);
    if (!uid) return json(401, { code: 'PGRST301', message: 'JWT expired' });
    if (path === '/rest/v1/profiles') {
      if (method === 'GET') {
        const id = (url.searchParams.get('id') ?? '').replace('eq.', '');
        return json(200, id === uid && profiles.has(uid) ? [profiles.get(uid)] : []);
      }
      if (body.id !== uid) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
      if ([...profiles.entries()].some(([id, p]) => id !== uid && p.username === body.username)) return json(409, { code: '23505', message: 'duplicate key' });
      profiles.set(uid, { ...profiles.get(uid), ...body });
      return json(201);
    }
    if (path === '/rest/v1/rpc/delete_my_account') {
      users.delete(uid);
      profiles.delete(uid);
      return json(204);
    }
    // Správa a aktivita – rovnaké pravidlá ako v supabase/schema.sql.
    if (path === '/rest/v1/rpc/log_activity') {
      if (!['register', 'login', 'visit', 'lesson', 'quiz'].includes(body.event_kind)) return json(400, { code: '23514', message: 'violates check constraint' });
      activity.push({ id: activity.length + 1, user_id: uid, at: new Date().toISOString(), kind: body.event_kind, detail: body.event_detail ?? {} });
      const prof = profiles.get(uid);
      if (prof) {
        prof.last_seen = new Date().toISOString();
        if (body.event_kind === 'login' || body.event_kind === 'register') prof.login_count = Number(prof.login_count ?? 0) + 1;
      }
      return json(204);
    }
    if (path === '/rest/v1/rpc/is_admin') return json(200, admins.has(uid));
    if (path === '/rest/v1/rpc/admin_users') {
      if (!admins.has(uid)) return json(403, { code: '42501', message: 'Len pre správcu.' });
      return json(200, [...users.values()].map((u) => ({
        id: u.id, username: profiles.get(u.id)?.username ?? u.meta.username, name: profiles.get(u.id)?.name ?? u.meta.name,
        created_at: u.created_at, last_sign_in_at: new Date().toISOString(), last_seen: profiles.get(u.id)?.last_seen ?? null,
        login_count: profiles.get(u.id)?.login_count ?? 0, progress: profiles.get(u.id)?.progress ?? null,
      })));
    }
    if (path === '/rest/v1/activity' && method === 'GET') {
      if (!admins.has(uid)) return json(200, []);
      const who = (url.searchParams.get('user_id') ?? '').replace('eq.', '');
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      return json(200, activity.filter((a) => !who || a.user_id === who).slice().reverse().slice(0, limit));
    }
    return json(404, { message: 'not found' });
  };
  return {
    fetch: fetchImpl as typeof fetch,
    users, profiles, admins, activity,
    setOnline: (v: boolean) => { online = v; },
    setAutoconfirm: (v: boolean) => { autoconfirm = v; },
    setTable: (v: boolean) => { tableExists = v; },
    expireTokens: () => access.clear(),
  };
}

const input = (over: Partial<RegisterInput> = {}): RegisterInput => ({
  name: 'Eva Malá', username: 'eva', password: 'heslo123', password2: 'heslo123', keepProgress: false, remember: true, ...over,
});

/** „Iné zariadenie“: prázdny prehliadač. */
async function newDevice(): Promise<void> {
  logout();
  await new Promise((r) => setTimeout(r, 0));
  localStorage.clear();
  sessionStorage.clear();
}

let server: ReturnType<typeof fakeSupabase>;

beforeAll(() => {
  initSync();
  initActivity();
});

/** Počká, kým sa odošlú požiadavky spustené na pozadí. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(async () => {
  server = fakeSupabase();
  configureCloud({ url: URL_, key: KEY, fetch: server.fetch });
  await newDevice();
});

describe('online účty', () => {
  it('registrácia vytvorí online účet a profil s pokrokom', async () => {
    setLessonDone('ohmov-zakon', true);
    const r = await register(input({ keepProgress: true }));
    expect(r.ok).toBe(true);
    expect(currentAccount()).toMatchObject({ username: 'eva', name: 'Eva Malá', cloud: true });
    const id = currentAccount()!.id;
    expect(server.profiles.get(id)).toMatchObject({ username: 'eva', name: 'Eva Malá' });
    expect((server.profiles.get(id)!.progress as { lessonsDone: string[] }).lessonsDone).toEqual(['ohmov-zakon']);
    expect(syncStatus().state).toBe('synced');
    expect(JSON.stringify(localStorage)).not.toContain('heslo123');
  });

  it('na inom zariadení sa prihlási a dostane svoj pokrok aj zapojenie', async () => {
    await register(input());
    setLessonDone('vykon-a-praca', true);
    setCardKnown('karta-1', true);
    pushCircuit({ parts: [], wires: [{ id: 'w', a: [0, 0], b: [1, 0] }] });
    await flush();

    await newDevice();
    expect(currentAccount()).toBeNull();
    const r = await login('EVA', 'heslo123');
    expect(r.ok).toBe(true);
    expect(getProgress().lessonsDone).toEqual(['vykon-a-praca']);
    expect(getProgress().cardsKnown).toEqual(['karta-1']);
    const id = currentAccount()!.id;
    expect(JSON.parse(localStorage.getItem(`elektrolab:lab:${id}`)!).wires).toHaveLength(1);
  });

  it('zlúči pokrok z dvoch zariadení', async () => {
    await register(input());
    const id = currentAccount()!.id;
    setLessonDone('a', true);
    await flush();
    // Druhé zariadenie: offline pokrok v prehliadači, potom prihlásenie.
    await newDevice();
    localStorage.setItem(`elektrolab:v1:user:${id}`, JSON.stringify({ lessonsDone: ['b'], stats: {}, sessions: [], cardsKnown: [], activeDays: [] }));
    await login('eva', 'heslo123');
    expect(getProgress().lessonsDone.sort()).toEqual(['a', 'b']);
    expect((server.profiles.get(id)!.progress as { lessonsDone: string[] }).lessonsDone.sort()).toEqual(['a', 'b']);
  });

  it('chyby: obsadené meno, zlé heslo, vypršaný token', async () => {
    await register(input());
    await newDevice();
    expect(await register(input({ name: 'Iná Eva' }))).toMatchObject({ ok: false, field: 'username' });
    expect(await login('eva', 'zle-heslo')).toMatchObject({ ok: false, field: 'password', error: 'Nesprávne používateľské meno alebo heslo.' });
    expect((await login('eva', 'heslo123')).ok).toBe(true);
    server.expireTokens();
    setLessonDone('c', true);
    await flush();
    expect(syncStatus().state).toBe('synced');
    expect((server.profiles.get(currentAccount()!.id)!.progress as { lessonsDone: string[] }).lessonsDone).toEqual(['c']);
  });

  it('bez servera vytvorí účet v prehliadači a pri ďalšom prihlásení ho prenesie na server', async () => {
    server.setOnline(false);
    const r = await register(input({ username: 'jano', name: 'Ján' }));
    expect(r.ok).toBe(true);
    expect(currentAccount()).toMatchObject({ username: 'jano', cloud: false });
    const localId = currentAccount()!.id;
    setLessonDone('d', true);
    logout();

    server.setOnline(true);
    const again = await login('jano', 'heslo123');
    expect(again.ok).toBe(true);
    const acc = currentAccount()!;
    expect(acc.cloud).toBe(true);
    expect(acc.id).not.toBe(localId);
    expect(getProgress().lessonsDone).toEqual(['d']);
    expect(progressOf(localId).lessonsDone).toEqual([]);
    expect([...server.users.values()].map((u) => u.email)).toContain('jano@ucty.elektrolab.sk');
    expect(JSON.parse(localStorage.getItem('elektrolab:accounts') ?? '[]')).toEqual([]);
  });

  it('zmaže online účet po zadaní hesla', async () => {
    await register(input());
    const id = currentAccount()!.id;
    expect(await deleteAccount('zle')).toMatchObject({ ok: false, field: 'password' });
    expect((await deleteAccount('heslo123')).ok).toBe(true);
    expect(currentAccount()).toBeNull();
    expect(server.users.has(id)).toBe(false);
    expect(server.profiles.has(id)).toBe(false);
  });

  it('kontrola servera ukáže dostupnosť, potvrdzovanie e-mailom a tabuľku', async () => {
    expect(await checkCloud()).toEqual({ reachable: true, autoconfirm: true, table: true });
    server.setAutoconfirm(false);
    server.setTable(false);
    configureCloud({ url: URL_, key: KEY, fetch: server.fetch });
    expect(await checkCloud()).toEqual({ reachable: true, autoconfirm: false, table: false });
    server.setOnline(false);
    configureCloud({ url: URL_, key: KEY, fetch: server.fetch });
    expect((await checkCloud()).reachable).toBe(false);
  });
});

describe('správa a aktivita', () => {
  it('zapíše registráciu, prihlásenie, dokončenú lekciu a cvičenie pod vlastný účet', async () => {
    await register(input());
    const id = currentAccount()!.id;
    setLessonDone('ohmov-zakon', true);
    setLessonDone('ohmov-zakon', true);
    recordSession({ total: 10, correct: 7, topics: ['ohmov-zakon', 'zaklady'] });
    await settle();
    await newDevice();
    await login('eva', 'heslo123');
    await settle();
    const mine = server.activity.filter((a) => a.user_id === id);
    expect(mine.map((a) => a.kind)).toEqual(['register', 'lesson', 'quiz', 'login']);
    expect(mine[1].detail).toEqual({ lesson: 'ohmov-zakon' });
    expect(mine[2].detail).toEqual({ total: 10, correct: 7, topics: ['ohmov-zakon', 'zaklady'] });
    expect(server.profiles.get(id)!.login_count).toBe(2);
  });

  it('bežný účet nevidí cudzie údaje, správca vidí všetky účty a aktivitu', async () => {
    await register(input());
    expect(await cloudIsAdmin()).toBe(false);
    expect(await fetchActivity()).toEqual([]);
    await expect(fetchAdminUsers()).rejects.toBeInstanceOf(CloudError);

    await newDevice();
    await register(input({ username: 'spravca', name: 'Správca' }));
    server.admins.add(currentAccount()!.id);
    expect(await cloudIsAdmin()).toBe(true);
    const users = await fetchAdminUsers();
    expect(users.map((u) => u.username).sort()).toEqual(['eva', 'spravca']);
    await settle();
    const events = await fetchActivity();
    expect(events.filter((e) => e.kind === 'register')).toHaveLength(2);
    expect(new Set(events.map((e) => e.user_id)).size).toBe(2);
  });

  it('stránka správy ukáže používateľov, aktivitu a detail; iným účtom ju nezobrazí', async () => {
    await register(input());
    setLessonDone('zaklady', true);
    await flush();
    await newDevice();
    await register(input({ username: 'spravca', name: 'Správca' }));
    await settle();

    let el = adminView();
    document.body.replaceChildren(el);
    await settle();
    expect(el.textContent).toContain('Len pre správcu');
    expect(el.querySelector('.admin-table')).toBeNull();

    server.admins.add(currentAccount()!.id);
    el = adminView();
    document.body.replaceChildren(el);
    await settle();
    const rows = el.querySelectorAll('.admin-table tbody tr');
    expect(rows).toHaveLength(2);
    expect(el.querySelector('.admin-feed')!.textContent).toContain('Dokončená lekcia: Elektrické veličiny a jednotky');
    const search = el.querySelector<HTMLInputElement>('#admin-search')!;
    search.value = 'eva';
    search.dispatchEvent(new Event('input'));
    expect(el.querySelectorAll('.admin-table tbody tr')).toHaveLength(1);
    el.querySelector<HTMLButtonElement>('.admin-table .admin-user-link')!.click();
    const detail = el.querySelector<HTMLElement>('.admin-detail')!;
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain('@eva');
    expect(detail.textContent).toContain('Elektrické veličiny a jednotky');
  });

  it('opis a čas udalosti', () => {
    const now = new Date(2026, 9, 10, 15, 0);
    expect(when(new Date(2026, 9, 10, 9, 5).toISOString(), now)).toBe('dnes 09:05');
    expect(when(new Date(2026, 9, 9, 18, 30).toISOString(), now)).toBe('včera 18:30');
    expect(when(null, now)).toBe('—');
    expect(describeActivity({ kind: 'quiz', detail: { total: 5, correct: 4, topics: ['zaklady'] } })).toBe('Cvičenie: 4 z 5 správne · Elektrické veličiny a jednotky');
    expect(describeActivity({ kind: 'login', detail: {} })).toBe('Prihlásenie');
  });
});
