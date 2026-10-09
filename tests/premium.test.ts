// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { currentAccount, deleteAccount, logout, register } from '../src/lib/auth';
import {
  PROMO_CODES, activatePremium, cancelPremium, hasPremium, isLessonLocked, monthlyTotal, normalizeCode, promoDiscount,
  type PromoCode,
} from '../src/lib/premium';

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Testovacie kódy – skutočný kód sa v testoch neobjavuje. */
async function testCodes(): Promise<PromoCode[]> {
  return [
    { hash: await sha256('ZADARMO'), discount: 100 },
    { hash: await sha256('POLOVICA'), discount: 50 },
  ];
}

const signUp = () => register({
  name: 'Eva', username: 'eva', password: 'heslo123', password2: 'heslo123', keepProgress: false, remember: true,
});

beforeEach(() => {
  logout();
  localStorage.clear();
  sessionStorage.clear();
});

describe('predplatné', () => {
  it('skutočný kód je uložený len ako odtlačok so 100 % zľavou', () => {
    expect(PROMO_CODES).toHaveLength(1);
    expect(PROMO_CODES[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(PROMO_CODES[0].discount).toBe(100);
  });

  it('overí kód bez ohľadu na medzery a veľkosť písmen', async () => {
    const codes = await testCodes();
    expect(normalizeCode(' za darmo ')).toBe('ZADARMO');
    expect(await promoDiscount(' zaDarmo ', codes)).toBe(100);
    expect(await promoDiscount('polovica', codes)).toBe(50);
    expect(await promoDiscount('neplatny', codes)).toBeNull();
    expect(await promoDiscount('', codes)).toBeNull();
  });

  it('počíta mesačnú sumu po zľave', () => {
    expect(monthlyTotal(0)).toBe(2);
    expect(monthlyTotal(50)).toBe(1);
    expect(monthlyTotal(100)).toBe(0);
  });

  it('aktivácia vyžaduje prihlásenie a kód so 100 % zľavou', async () => {
    const codes = await testCodes();
    expect(await activatePremium('ZADARMO', codes)).toMatchObject({ ok: false });
    expect(isLessonLocked('obvody-rlc')).toBe(true);

    await signUp();
    expect(await activatePremium('zlý kód', codes)).toEqual({ ok: false, error: 'Tento zľavový kód neplatí.' });
    expect(await activatePremium('POLOVICA', codes)).toMatchObject({ ok: false });
    expect(hasPremium()).toBe(false);

    expect(await activatePremium('zadarmo', codes)).toEqual({ ok: true });
    expect(hasPremium()).toBe(true);
    expect(currentAccount()?.subscription).toMatchObject({ plan: 'premium', price: 2, discount: 100 });
  });

  it('zamyká len kapitoly Premium a predplatné patrí k účtu', async () => {
    const codes = await testCodes();
    expect(isLessonLocked('ohmov-zakon')).toBe(false);
    expect(isLessonLocked('striedavy-prud')).toBe(true);

    await signUp();
    await activatePremium('ZADARMO', codes);
    expect(isLessonLocked('striedavy-prud')).toBe(false);

    logout();
    expect(isLessonLocked('striedavy-prud')).toBe(true);

    await register({ name: 'Jano', username: 'jano', password: 'heslo123', password2: 'heslo123', keepProgress: false, remember: true });
    expect(hasPremium()).toBe(false);

    cancelPremium();
    expect(hasPremium()).toBe(false);
    await activatePremium('ZADARMO', codes);
    expect(cancelPremium()).toBe(true);
    expect(hasPremium()).toBe(false);
    expect((await deleteAccount('heslo123')).ok).toBe(true);
  });
});
