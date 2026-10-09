// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentAccount, deleteAccount, login, logout, register, validateUsername, type RegisterInput } from '../src/lib/auth';
import { getProgress, hasGuestProgress, setLessonDone } from '../src/lib/progress';

const input = (over: Partial<RegisterInput> = {}): RegisterInput => ({
  name: 'Ján Novák', username: 'jano', password: 'ohm1234', password2: 'ohm1234', keepProgress: false, remember: true, ...over,
});

beforeEach(() => {
  logout();
  localStorage.clear();
  sessionStorage.clear();
});

describe('účty', () => {
  it('kontroluje údaje pri registrácii', async () => {
    expect(await register(input({ name: '  ' }))).toMatchObject({ ok: false, field: 'name' });
    expect(await register(input({ username: 'ja' }))).toMatchObject({ ok: false, field: 'username' });
    expect(await register(input({ username: 'ján' }))).toMatchObject({ ok: false, field: 'username' });
    expect(await register(input({ password: '123', password2: '123' }))).toMatchObject({ ok: false, field: 'password' });
    expect(await register(input({ password2: 'iné heslo' }))).toMatchObject({ ok: false, field: 'password2' });
    expect(validateUsername('jan.novak_2')).toBeNull();
    expect(currentAccount()).toBeNull();
  });

  it('zaregistruje, odhlási a znova prihlási', async () => {
    const r = await register(input());
    expect(r.ok).toBe(true);
    expect(currentAccount()).toMatchObject({ username: 'jano', name: 'Ján Novák' });
    expect(localStorage.getItem('elektrolab:accounts')).not.toContain('ohm1234');

    expect(await register(input({ username: 'JANO' }))).toMatchObject({ ok: false, field: 'username' });

    logout();
    expect(currentAccount()).toBeNull();
    expect(await login('jano', 'zlé heslo')).toMatchObject({ ok: false, error: 'Nesprávne používateľské meno alebo heslo.' });
    expect(await login('nikto', 'ohm1234')).toMatchObject({ ok: false, error: 'Nesprávne používateľské meno alebo heslo.' });
    expect((await login('Jano', 'ohm1234')).ok).toBe(true);
    expect(currentAccount()?.username).toBe('jano');
  });

  it('bez „pamätať si“ drží prihlásenie len v relácii prehliadača', async () => {
    await register(input({ remember: false }));
    expect(sessionStorage.getItem('elektrolab:session')).toBeTruthy();
    expect(localStorage.getItem('elektrolab:session')).toBeNull();
  });

  it('každý účet má vlastný pokrok a pokrok hosťa sa dá preniesť', async () => {
    setLessonDone('ohmov-zakon', true);
    expect(hasGuestProgress()).toBe(true);

    await register(input({ keepProgress: true }));
    expect(getProgress().lessonsDone).toEqual(['ohmov-zakon']);
    expect(hasGuestProgress()).toBe(false);
    setLessonDone('vykon', true);

    logout();
    expect(getProgress().lessonsDone).toEqual([]);

    await register(input({ name: 'Eva', username: 'eva' }));
    expect(getProgress().lessonsDone).toEqual([]);
    setLessonDone('kapacita', true);

    logout();
    await login('jano', 'ohm1234');
    expect(getProgress().lessonsDone).toEqual(['ohmov-zakon', 'vykon']);
  });

  it('zmaže účet aj s pokrokom až po zadaní hesla', async () => {
    await register(input());
    setLessonDone('ohmov-zakon', true);
    expect(await deleteAccount('zlé heslo')).toMatchObject({ ok: false, field: 'password' });
    expect(currentAccount()).not.toBeNull();

    expect((await deleteAccount('ohm1234')).ok).toBe(true);
    expect(currentAccount()).toBeNull();
    expect(await login('jano', 'ohm1234')).toMatchObject({ ok: false });
    expect(Object.keys(localStorage).filter((k) => k.includes(':user:'))).toEqual([]);
  });
});
