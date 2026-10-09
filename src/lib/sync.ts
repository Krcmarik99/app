/**
 * Synchronizácia online účtu: po prihlásení (aj po otvorení stránky) stiahne pokrok
 * a uložené zapojenie zo servera, zlúči ich s tým, čo je v prehliadači, a každú ďalšiu
 * zmenu po chvíľke odošle späť. Bez pripojenia sa zmeny držia a odošlú pri ďalšej zmene.
 */
import { currentAccount, setCloudHooks } from './auth';
import { CloudError, fetchProfile, loadCloudSession, saveProfile, type CloudSession } from './cloud';
import { mergeProgress, normalize, onProgressChange, progressOf, replaceProgressOf } from './progress';

export type SyncState = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

let state: SyncState = 'local';
let message = '';
const listeners = new Set<() => void>();
const pulledListeners = new Set<() => void>();

/** Stav synchronizácie pre zobrazenie na stránke účtu. */
export function syncStatus(): { state: SyncState; message: string } {
  return { state, message };
}

export function onSyncChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Zavolá sa, keď sa po otvorení stránky stiahne pokrok zo servera (stránku treba prekresliť). */
export function onPulled(fn: () => void): () => void {
  pulledListeners.add(fn);
  return () => pulledListeners.delete(fn);
}

function setState(next: SyncState, msg = ''): void {
  state = next;
  message = msg;
  listeners.forEach((fn) => fn());
}

const labKey = (id: string) => `elektrolab:lab:${id}`;

function readJson(storageKey: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

let syncedFor: string | null = null;
let pending: { progress?: true; circuit?: unknown } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function failed(e: unknown): void {
  if (e instanceof CloudError && e.kind === 'network') setState('offline', 'Server účtov nie je dostupný – zmeny sa odošlú neskôr.');
  else setState('error', e instanceof Error ? e.message : 'Synchronizácia zlyhala.');
}

/** Stiahne profil zo servera a zlúči ho s miestnymi údajmi; čo na serveri chýba, odošle. */
export async function pull(s: CloudSession): Promise<void> {
  const id = s.user.id;
  setState('syncing');
  try {
    const remote = await fetchProfile(s);
    const remoteProgress = normalize(remote?.progress);
    const merged = mergeProgress(progressOf(id), remoteProgress);
    replaceProgressOf(id, merged);
    let circuit: unknown;
    if (remote?.circuit) {
      try {
        localStorage.setItem(labKey(id), JSON.stringify(remote.circuit));
      } catch {
        // Bez úložiska ostane zapojenie len na serveri.
      }
    } else {
      circuit = readJson(labKey(id));
    }
    if (!remote || JSON.stringify(merged) !== JSON.stringify(remoteProgress) || circuit !== undefined) {
      await saveProfile({ progress: merged, ...(circuit !== undefined ? { circuit } : {}) }, { session: s });
    }
    syncedFor = id;
    setState('synced');
  } catch (e) {
    syncedFor = null;
    failed(e);
  }
}

function schedule(change: { progress?: true; circuit?: unknown }): void {
  const account = currentAccount();
  if (!account?.cloud || account.id !== syncedFor) return;
  pending = { ...pending, ...change };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 1500);
}

/** Odošle čakajúce zmeny hneď (pri odhlásení, zatvorení stránky). */
export async function flush(keepalive = false, session?: CloudSession): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const id = session?.user.id ?? syncedFor;
  if (!pending || !id || id !== syncedFor) return;
  const job = pending;
  pending = null;
  const fields: { progress?: unknown; circuit?: unknown } = {};
  if (job.progress) fields.progress = progressOf(id);
  if ('circuit' in job) fields.circuit = job.circuit;
  try {
    setState('syncing');
    await saveProfile(fields, { keepalive, session });
    setState('synced');
  } catch (e) {
    // Zmeny, ktoré prišli počas odosielania, majú prednosť pred tými, čo sa neodoslali.
    pending = Object.assign({}, job, pending as typeof job | null);
    failed(e);
  }
}

/** Laboratórium ohlási zmenu zapojenia – pri online účte sa odošle na server. */
export function pushCircuit(circuit: unknown): void {
  schedule({ circuit });
}

let started = false;

/** Spustí synchronizáciu pri štarte aplikácie. */
export function initSync(): void {
  if (started) return;
  started = true;
  setCloudHooks({
    afterLogin: pull,
    beforeLogout: async (s) => {
      await flush(false, s);
      // Medzitým sa mohol prihlásiť niekto iný – jeho synchronizáciu nerušíme.
      if (syncedFor === s.user.id) {
        syncedFor = null;
        setState('local');
      }
    },
  });
  onProgressChange(() => schedule({ progress: true }));
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => void flush(true));
  const s = loadCloudSession();
  if (s) {
    void pull(s).then(() => {
      if (syncedFor === s.user.id) pulledListeners.forEach((fn) => fn());
    });
  }
}
