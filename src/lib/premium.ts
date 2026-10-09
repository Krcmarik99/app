/**
 * Predplatné ElektroLab Premium: cena, zľavové kódy a ktoré kapitoly sú len pre predplatiteľov.
 * Kódy sú uložené len ako odtlačok SHA-256, aby sa nedali prečítať zo zdrojového kódu.
 */
import { lessonById, type ChapterId } from '../content/lessons';
import { currentAccount, setSubscription, type Account } from './auth';

/** Mesačná cena predplatného v eurách. */
export const MONTHLY_PRICE = 2;

/** Kapitoly, ktoré sú dostupné len s predplatným. */
export const PREMIUM_CHAPTERS: ReadonlySet<ChapterId> = new Set<ChapterId>(['ac', 'meas']);

export interface PromoCode {
  /** SHA-256 kódu po úprave cez `normalizeCode` (hex). */
  hash: string;
  /** Zľava v percentách. */
  discount: number;
}

export const PROMO_CODES: readonly PromoCode[] = [
  { hash: '0da31bde272a4013ad638385248d3857d10101f54a71ccc3492f19e486fce112', discount: 100 },
];

/** Kód bez medzier a veľkými písmenami – na veľkosti písmen pri zadávaní nezáleží. */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Zľava v percentách, ktorú kód dáva, alebo `null`, ak kód neplatí. */
export async function promoDiscount(code: string, codes: readonly PromoCode[] = PROMO_CODES): Promise<number | null> {
  const normalized = normalizeCode(code);
  if (!normalized || typeof crypto === 'undefined' || !crypto.subtle) return null;
  const hash = await sha256(normalized);
  return codes.find((c) => c.hash === hash)?.discount ?? null;
}

/** Mesačná suma po zľave, zaokrúhlená na centy. */
export function monthlyTotal(discount: number): number {
  return Math.round(MONTHLY_PRICE * (100 - discount)) / 100;
}

export function hasPremium(account: Account | null = currentAccount()): boolean {
  return !!account?.subscription;
}

export function isChapterLocked(chapter: ChapterId | undefined, premium = hasPremium()): boolean {
  return !!chapter && PREMIUM_CHAPTERS.has(chapter) && !premium;
}

export function isLessonLocked(id: string, premium = hasPremium()): boolean {
  return isChapterLocked(lessonById(id)?.chapter, premium);
}

export type PremiumResult = { ok: true } | { ok: false; error: string };

/**
 * Aktivuje predplatné so zľavovým kódom. Platba kartou zatiaľ nie je zapojená,
 * preto sa bez platby dá aktivovať len kód so 100 % zľavou.
 */
export async function activatePremium(code: string, codes: readonly PromoCode[] = PROMO_CODES): Promise<PremiumResult> {
  const account = currentAccount();
  if (!account) return { ok: false, error: 'Na aktiváciu predplatného sa najprv prihlás.' };
  if (account.subscription) return { ok: true };
  const discount = await promoDiscount(code, codes);
  if (discount === null) return { ok: false, error: 'Tento zľavový kód neplatí.' };
  if (monthlyTotal(discount) > 0) {
    return { ok: false, error: 'Zvyšnú sumu by bolo treba zaplatiť kartou, platba kartou však zatiaľ nie je dostupná.' };
  }
  const saved = setSubscription({ plan: 'premium', since: new Date().toISOString(), price: MONTHLY_PRICE, discount });
  return saved ? { ok: true } : { ok: false, error: 'Predplatné sa nepodarilo uložiť. Skús to znova.' };
}

export function cancelPremium(): boolean {
  return setSubscription(null);
}
