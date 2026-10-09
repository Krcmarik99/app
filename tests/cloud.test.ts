// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { currentAccount, deleteAccount, login, logout, register, type RegisterInput } from '../src/lib/auth';
import { configureCloud } from '../src/lib/cloud';
import { getProgress, progressOf, setCardKnown, setLessonDone } from '../src/lib/progress';
import { flush, initSync, pushCircuit, syncStatus } from '../src/lib/sync';

const URL_ = 'https://test.supabase.co';
const KEY = 'sb_publishable_test';

interface FakeUser { id: string; email: string; password: string; meta: Record<string, unknown>; created_at: string }

/** Náhradný server s rovnakým REST rozhraním ako Supabase (Auth + PostgREST s pravidlami prístupu). */
function fakeSupabase() {
  const users = new Map<string, FakeUser>();
  const access = new Map<string, string>();
  const refresh = new Map<string, string>();
  const profiles = new Map<string, Record<string, unknown>>();
  let online = true;
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
    return json(404, { message: 'not found' });
  };
  return {
    fetch: fetchImpl as typeof fetch,
    users, profiles,
    setOnline: (v: boolean) => { online = v; },
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

beforeAll(() => initSync());

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
});
