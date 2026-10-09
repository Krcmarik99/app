/**
 * Účty študentov. Hlavne online (Supabase) – prihlásiš sa na každom zariadení a pokrok sa
 * synchronizuje. Keď server nie je dostupný, účet sa vytvorí v tomto prehliadači (localStorage);
 * heslo sa tu neukladá – len jeho odtlačok PBKDF2-SHA-256 s náhodnou soľou. Takýto účet sa
 * pri najbližšom prihlásení s dostupným serverom prenesie na server.
 */
import {
  CloudError, cloudEnabled, cloudSignIn, cloudSignOut, cloudSignUp, deleteCloudAccount,
  loadCloudSession, storeCloudSession, type CloudSession,
} from './cloud';
import { adoptGuestProgress, deleteProgressOf, moveProgress, setProgressOwner } from './progress';

const ACCOUNTS_KEY = 'elektrolab:accounts';
const SESSION_KEY = 'elektrolab:session';
const ITERATIONS = 120_000;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 6;
export const NAME_MAX = 40;

export interface Account {
  id: string;
  username: string;
  name: string;
  created: string;
  /** Účet je na serveri – prihlási sa ním na každom zariadení. */
  cloud: boolean;
}

interface StoredAccount extends Omit<Account, 'cloud'> {
  salt: string;
  hash: string;
  iterations: number;
}

export type AuthField = 'name' | 'username' | 'password' | 'password2';
export type AuthResult = { ok: true; account: Account } | { ok: false; error: string; field?: AuthField };

export interface RegisterInput {
  name: string;
  username: string;
  password: string;
  password2: string;
  /** Presunúť doterajší pokrok hosťa do nového účtu. */
  keepProgress: boolean;
  /** Zostať prihlásený aj po zatvorení prehliadača. */
  remember: boolean;
}

const listeners = new Set<() => void>();

export function onAuthChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const notify = () => listeners.forEach((fn) => fn());

type CloudHook = (s: CloudSession) => Promise<void>;
let afterCloudLogin: CloudHook | null = null;
let beforeCloudLogout: CloudHook | null = null;

/** Synchronizácia sa sem pripojí: po prihlásení stiahne údaje, pred odhlásením odošle neuložené. */
export function setCloudHooks(hooks: { afterLogin: CloudHook; beforeLogout: CloudHook } | null): void {
  afterCloudLogin = hooks?.afterLogin ?? null;
  beforeCloudLogout = hooks?.beforeLogout ?? null;
}

/** Uložené zapojenie z laboratória patrí k účtu – pri prenose či zmazaní účtu ide s ním. */
const labKey = (id: string) => `elektrolab:lab:${id}`;

function moveLab(fromId: string, toId: string): void {
  try {
    const raw = localStorage.getItem(labKey(fromId));
    if (raw && !localStorage.getItem(labKey(toId))) localStorage.setItem(labKey(toId), raw);
    localStorage.removeItem(labKey(fromId));
  } catch {
    // Bez úložiska nie je čo presúvať.
  }
}

function isStored(x: unknown): x is StoredAccount {
  const a = x as Partial<StoredAccount> | null;
  return !!a && typeof a.id === 'string' && typeof a.username === 'string' && typeof a.name === 'string'
    && typeof a.salt === 'string' && typeof a.hash === 'string' && typeof a.iterations === 'number';
}

function readAccounts(): StoredAccount[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(data) ? data.filter(isStored) : [];
  } catch {
    return [];
  }
}

function writeAccounts(list: StoredAccount[]): boolean {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function publicAccount(a: StoredAccount): Account {
  return { id: a.id, username: a.username, name: a.name, created: a.created, cloud: false };
}

function cloudAccount(s: CloudSession): Account {
  return { id: s.user.id, username: s.user.username, name: s.user.name, created: s.user.created, cloud: true };
}

const sameUsername = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function sessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function clearLocalSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Úložisko nie je dostupné.
  }
}

function setSession(id: string | null, remember = true): void {
  clearLocalSession();
  storeCloudSession(null);
  try {
    if (id) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
  } catch {
    // Bez úložiska prihlásenie vydrží len do obnovenia stránky.
  }
  setProgressOwner(id);
  notify();
}

/** Prihlásenie online účtom: uloží token, stiahne pokrok zo servera a až potom ohlási zmenu. */
async function startCloudSession(s: CloudSession): Promise<Account> {
  clearLocalSession();
  storeCloudSession(s);
  setProgressOwner(s.user.id);
  try {
    await afterCloudLogin?.(s);
  } catch {
    // Synchronizácia sa zopakuje neskôr – prihlásenie platí aj bez nej.
  }
  notify();
  return cloudAccount(s);
}

/** Chyba servera ako výsledok formulára (pri políčku, ktorého sa týka). */
function cloudFailure(e: CloudError): AuthResult {
  if (e.kind === 'exists') return { ok: false, error: e.message, field: 'username' };
  if (e.kind === 'weak' || e.kind === 'credentials') return { ok: false, error: e.message, field: 'password' };
  return { ok: false, error: e.message };
}

export function currentAccount(): Account | null {
  const cloud = loadCloudSession();
  if (cloud) return cloudAccount(cloud);
  const id = sessionId();
  const found = id ? readAccounts().find((a) => a.id === id) : undefined;
  return found ? publicAccount(found) : null;
}

/** Pri štarte aplikácie nastaví pokrok podľa prihláseného účtu. */
export function initAuth(): void {
  setProgressOwner(currentAccount()?.id ?? null);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array((hex.match(/../g) ?? []).map((b) => parseInt(b, 16)));
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

const cryptoReady = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';
const NO_CRYPTO = 'Prihlásenie v tomto prostredí nefunguje – prehliadač nepodporuje bezpečné šifrovanie hesiel.';
const NO_STORAGE = 'Prehliadač nedovolil uložiť účet (napríklad v súkromnom okne). Skús bežné okno.';

export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Používateľské meno musí mať ${USERNAME_MIN} až ${USERNAME_MAX} znakov.`;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    return 'Používateľské meno môže obsahovať len písmená bez diakritiky, číslice, bodku, pomlčku a podčiarkovník.';
  }
  return null;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const username = input.username.trim();
  if (!name) return { ok: false, error: 'Napíš svoje meno.', field: 'name' };
  if (name.length > NAME_MAX) return { ok: false, error: `Meno môže mať najviac ${NAME_MAX} znakov.`, field: 'name' };
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, error: usernameError, field: 'username' };
  if (input.password.length < PASSWORD_MIN) {
    return { ok: false, error: `Heslo musí mať aspoň ${PASSWORD_MIN} znakov.`, field: 'password' };
  }
  if (input.password !== input.password2) return { ok: false, error: 'Heslá sa nezhodujú.', field: 'password2' };

  if (cloudEnabled()) {
    try {
      const s = await cloudSignUp(username, input.password, name, input.remember);
      if (input.keepProgress) adoptGuestProgress(s.user.id);
      return { ok: true, account: await startCloudSession(s) };
    } catch (e) {
      if (!(e instanceof CloudError)) throw e;
      if (e.kind !== 'network') return cloudFailure(e);
      // Server nie je dostupný – účet vytvoríme aspoň v tomto prehliadači.
    }
  }

  if (!cryptoReady()) return { ok: false, error: NO_CRYPTO };
  const accounts = readAccounts();
  if (accounts.some((a) => sameUsername(a.username, username))) {
    return { ok: false, error: 'Toto používateľské meno už niekto používa. Vyber si iné.', field: 'username' };
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const id = toHex(crypto.getRandomValues(new Uint8Array(12)));
  const stored: StoredAccount = {
    id, username, name, created: new Date().toISOString(),
    salt: toHex(salt), hash: await derive(input.password, salt, ITERATIONS), iterations: ITERATIONS,
  };
  // Medzitým (počas výpočtu odtlačku) mohol vzniknúť rovnaký účet v inej karte.
  const fresh = readAccounts();
  if (fresh.some((a) => sameUsername(a.username, username))) {
    return { ok: false, error: 'Toto používateľské meno už niekto používa. Vyber si iné.', field: 'username' };
  }
  if (!writeAccounts([...fresh, stored])) return { ok: false, error: NO_STORAGE };
  if (input.keepProgress) adoptGuestProgress(id);
  setSession(id, input.remember);
  return { ok: true, account: publicAccount(stored) };
}

async function verify(account: StoredAccount, password: string): Promise<boolean> {
  return (await derive(password, fromHex(account.salt), account.iterations)) === account.hash;
}

/**
 * Účet z prehliadača, ktorý na serveri ešte nie je: po overení hesla ho vytvorí na serveri
 * s rovnakým menom a heslom a prenesie doň pokrok aj uložené zapojenie.
 */
async function migrateLocal(username: string, password: string, remember: boolean): Promise<AuthResult | null> {
  const local = readAccounts().find((a) => sameUsername(a.username, username.trim()));
  if (!local || !cryptoReady() || !(await verify(local, password))) return null;
  let s: CloudSession;
  try {
    s = await cloudSignUp(local.username, password, local.name, remember);
  } catch (e) {
    if (e instanceof CloudError && e.kind === 'exists') {
      return { ok: false, error: 'Toto meno už v online účtoch používa niekto iný. Prihlás sa jeho heslom alebo si vytvor nový účet.', field: 'username' };
    }
    if (e instanceof CloudError && e.kind === 'network') return null;
    throw e;
  }
  moveProgress(local.id, s.user.id);
  moveLab(local.id, s.user.id);
  writeAccounts(readAccounts().filter((a) => a.id !== local.id));
  return { ok: true, account: await startCloudSession(s) };
}

export async function login(username: string, password: string, remember = true): Promise<AuthResult> {
  if (!username.trim() || !password) return { ok: false, error: 'Vyplň používateľské meno aj heslo.' };
  if (cloudEnabled()) {
    try {
      const s = await cloudSignIn(username, password, remember);
      return { ok: true, account: await startCloudSession(s) };
    } catch (e) {
      if (!(e instanceof CloudError)) throw e;
      if (e.kind === 'credentials') {
        const migrated = await migrateLocal(username, password, remember);
        return migrated ?? { ok: false, error: e.message, field: 'password' };
      }
      if (e.kind !== 'network') return cloudFailure(e);
      // Server nie je dostupný – skúsime účet uložený v tomto prehliadači.
    }
  }
  if (!cryptoReady()) return { ok: false, error: NO_CRYPTO };
  const account = readAccounts().find((a) => sameUsername(a.username, username.trim()));
  // Rovnaká správa pre neznáme meno aj zlé heslo – neprezradí, či účet existuje.
  if (!account || !(await verify(account, password))) {
    return { ok: false, error: 'Nesprávne používateľské meno alebo heslo.', field: 'password' };
  }
  setSession(account.id, remember);
  return { ok: true, account: publicAccount(account) };
}

export function logout(): void {
  const cloud = loadCloudSession();
  setSession(null);
  if (cloud) {
    void (async () => {
      try {
        await beforeCloudLogout?.(cloud);
      } finally {
        await cloudSignOut(cloud);
      }
    })();
  }
}

/** Zmaže prihlásený účet aj s jeho pokrokom. Na potvrdenie treba zadať heslo. */
export async function deleteAccount(password: string): Promise<AuthResult> {
  const cloud = loadCloudSession();
  if (cloud) {
    try {
      // Heslo overí nové prihlásenie; jeho token zároveň oprávňuje zmazanie.
      const fresh = await cloudSignIn(cloud.user.username, password, cloud.remember);
      await deleteCloudAccount(fresh.access);
    } catch (e) {
      if (!(e instanceof CloudError)) throw e;
      if (e.kind === 'credentials') return { ok: false, error: 'Nesprávne heslo.', field: 'password' };
      return { ok: false, error: e.kind === 'network' ? 'Server účtov nie je dostupný – účet sa teraz nedá zmazať.' : e.message };
    }
    deleteProgressOf(cloud.user.id);
    try {
      localStorage.removeItem(labKey(cloud.user.id));
    } catch {
      // Úložisko nie je dostupné.
    }
    setSession(null);
    return { ok: true, account: cloudAccount(cloud) };
  }
  const id = sessionId();
  const accounts = readAccounts();
  const account = accounts.find((a) => a.id === id);
  if (!account) return { ok: false, error: 'Nie si prihlásený.' };
  if (!cryptoReady()) return { ok: false, error: NO_CRYPTO };
  if (!(await verify(account, password))) return { ok: false, error: 'Nesprávne heslo.', field: 'password' };
  if (!writeAccounts(accounts.filter((a) => a.id !== account.id))) return { ok: false, error: NO_STORAGE };
  deleteProgressOf(account.id);
  setSession(null);
  return { ok: true, account: publicAccount(account) };
}
