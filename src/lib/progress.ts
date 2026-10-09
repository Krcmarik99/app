/**
 * Pokrok študenta. Ukladá sa len v tomto prehliadači (localStorage):
 * hosť má jeden spoločný záznam, každý prihlásený účet vlastný.
 */

const GUEST_KEY = 'elektrolab:v1';
const userKey = (userId: string) => `${GUEST_KEY}:user:${userId}`;
let key = GUEST_KEY;

export interface TopicStat {
  answered: number;
  correct: number;
}

export interface SessionRecord {
  date: string;
  total: number;
  correct: number;
  topics: string[];
}

export interface Progress {
  lessonsDone: string[];
  lastLesson: string | null;
  stats: Record<string, TopicStat>;
  sessions: SessionRecord[];
  cardsKnown: string[];
  activeDays: string[];
}

function empty(): Progress {
  return { lessonsDone: [], lastLesson: null, stats: {}, sessions: [], cardsKnown: [], activeDays: [] };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Pokrok načítaný zvonka (zo servera) – nesprávne položky sa zahodia. */
export function normalize(raw: unknown): Progress {
  const p = empty();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  p.lessonsDone = strings(r.lessonsDone);
  p.lastLesson = typeof r.lastLesson === 'string' ? r.lastLesson : null;
  p.cardsKnown = strings(r.cardsKnown);
  p.activeDays = strings(r.activeDays);
  if (r.stats && typeof r.stats === 'object') {
    for (const [k, v] of Object.entries(r.stats as Record<string, unknown>)) {
      const st = v as Partial<TopicStat>;
      if (typeof st?.answered === 'number' && typeof st?.correct === 'number') {
        p.stats[k] = { answered: st.answered, correct: st.correct };
      }
    }
  }
  if (Array.isArray(r.sessions)) {
    p.sessions = r.sessions.filter(
      (x): x is SessionRecord => !!x && typeof x.total === 'number' && typeof x.correct === 'number',
    );
  }
  return p;
}

let cache: Progress | null = null;
const listeners = new Set<() => void>();

function load(storageKey: string): Progress {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? normalize(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

export function getProgress(): Progress {
  cache ??= load(key);
  return cache;
}

/** Prepne pokrok na prihláseného používateľa (alebo späť na hosťa pri `null`). */
export function setProgressOwner(userId: string | null): void {
  const next = userId ? userKey(userId) : GUEST_KEY;
  if (next === key) return;
  key = next;
  cache = null;
  listeners.forEach((fn) => fn());
}

function isEmpty(p: Progress): boolean {
  return !p.lessonsDone.length && !p.lastLesson && !Object.keys(p.stats).length && !p.sessions.length && !p.cardsKnown.length;
}

/** Má hosť v tomto prehliadači nejaký pokrok, ktorý sa dá preniesť do nového účtu? */
export function hasGuestProgress(): boolean {
  return !isEmpty(load(GUEST_KEY));
}

/** Presunie pokrok hosťa do účtu (pri registrácii), aby sa nestratil. */
export function adoptGuestProgress(userId: string): void {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return;
    localStorage.setItem(userKey(userId), raw);
    localStorage.removeItem(GUEST_KEY);
  } catch {
    return;
  }
  if (key === GUEST_KEY || key === userKey(userId)) cache = null;
}

/** Pokrok konkrétneho účtu (aj keď práve nie je prihlásený). */
export function progressOf(userId: string): Progress {
  return key === userKey(userId) ? getProgress() : load(userKey(userId));
}

/** Nahradí pokrok účtu, napríklad po zlúčení s pokrokom zo servera. */
export function replaceProgressOf(userId: string, p: Progress): void {
  try {
    localStorage.setItem(userKey(userId), JSON.stringify(p));
  } catch {
    // Bez úložiska ostane pokrok len v pamäti.
  }
  if (key === userKey(userId)) cache = p;
}

/** Presunie pokrok z jedného účtu na druhý (pri prenose účtu na server). */
export function moveProgress(fromId: string, toId: string): void {
  replaceProgressOf(toId, mergeProgress(progressOf(toId), progressOf(fromId)));
  deleteProgressOf(fromId);
}

/**
 * Zlúči pokrok z dvoch zariadení: zjednotí preštudované lekcie, kartičky a dni učenia,
 * pri úspešnosti v téme ponechá záznam s viac odpoveďami a spojí históriu cvičení.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const union = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  const stats: Record<string, TopicStat> = { ...b.stats };
  for (const [k, st] of Object.entries(a.stats)) {
    if (!stats[k] || st.answered >= stats[k].answered) stats[k] = st;
  }
  const seen = new Set<string>();
  const sessions = [...b.sessions, ...a.sessions]
    .filter((s) => {
      const id = JSON.stringify(s);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((x, y) => String(x.date ?? '').localeCompare(String(y.date ?? '')))
    .slice(-50);
  return {
    lessonsDone: union(a.lessonsDone, b.lessonsDone),
    lastLesson: a.lastLesson ?? b.lastLesson,
    stats,
    sessions,
    cardsKnown: union(a.cardsKnown, b.cardsKnown),
    activeDays: union(a.activeDays, b.activeDays).sort().slice(-120),
  };
}

export function deleteProgressOf(userId: string): void {
  try {
    localStorage.removeItem(userKey(userId));
  } catch {
    // Úložisko nie je dostupné – nie je čo mazať.
  }
  if (key === userKey(userId)) cache = null;
}

function save(): void {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Úložisko nemusí byť dostupné (súkromné okno) – aplikácia funguje ďalej bez neho.
  }
  listeners.forEach((fn) => fn());
}

export function onProgressChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function dayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function touchDay(p: Progress): void {
  const d = dayKey();
  if (!p.activeDays.includes(d)) {
    p.activeDays.push(d);
    p.activeDays = p.activeDays.slice(-120);
  }
}

export function setLessonDone(id: string, done: boolean): void {
  const p = getProgress();
  p.lessonsDone = p.lessonsDone.filter((x) => x !== id);
  if (done) p.lessonsDone.push(id);
  touchDay(p);
  save();
}

export function setLastLesson(id: string): void {
  const p = getProgress();
  if (p.lastLesson === id) return;
  p.lastLesson = id;
  save();
}

export function recordAnswer(lessonId: string, correct: boolean): void {
  const p = getProgress();
  const st = p.stats[lessonId] ?? { answered: 0, correct: 0 };
  st.answered += 1;
  if (correct) st.correct += 1;
  p.stats[lessonId] = st;
  touchDay(p);
  save();
}

export function recordSession(rec: Omit<SessionRecord, 'date'>): void {
  const p = getProgress();
  p.sessions.push({ ...rec, date: dayKey() });
  p.sessions = p.sessions.slice(-50);
  save();
}

export function setCardKnown(id: string, known: boolean): void {
  const p = getProgress();
  p.cardsKnown = p.cardsKnown.filter((x) => x !== id);
  if (known) p.cardsKnown.push(id);
  touchDay(p);
  save();
}

export function resetProgress(): void {
  cache = empty();
  save();
}

/** Počet dní po sebe, keď sa študent učil (končiac dnes alebo včera). */
export function streak(days: readonly string[], today = new Date()): number {
  const set = new Set(days);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (set.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function totals(p: Progress): TopicStat {
  return Object.values(p.stats).reduce(
    (acc, s) => ({ answered: acc.answered + s.answered, correct: acc.correct + s.correct }),
    { answered: 0, correct: 0 },
  );
}
