import { QUESTIONS, type StaticQuestion } from '../content/questions';
import { pick, shuffle, type Rng } from '../lib/random';
import { parseNumber } from '../lib/units';
import { GENERATORS } from './generators';
import type { ChoiceQuestion, NumericQuestion, Question } from './types';

export function fromStatic(sq: StaticQuestion, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return {
    kind: 'choice',
    lessonId: sq.lessonId,
    prompt: sq.prompt,
    options: order.map((i) => sq.options[i]),
    correct: order.indexOf(0),
    explanation: sq.explanation,
  };
}

/** Podiel číselných príkladov v bežnom cvičení (ak ich téma má). */
const NUMERIC_SHARE = 0.6;

/** Druh cvičenia: výpočty spolu s teóriou, alebo len teoretické otázky bez počítania. */
export type QuizMode = 'mixed' | 'theory';

/** Otázka do testu z teórie – s výberom odpovede a bez výpočtu so zadanými číslami. */
export const isTheory = (sq: StaticQuestion) => !sq.calc;

/** Koľko teoretických otázok majú vybrané témy spolu. */
export function theoryCount(lessonIds: readonly string[]): number {
  const ids = new Set(lessonIds);
  return QUESTIONS.filter((q) => ids.has(q.lessonId) && isTheory(q)).length;
}

/**
 * Zostaví sadu otázok z vybraných tém. Témy sa striedajú dookola,
 * v rámci témy sa náhodne strieda číselný príklad a otázka s výberom.
 * V režime `theory` sú v sade len teoretické otázky, žiadna sa neopakuje
 * a sada môže byť kratšia, ak ich vybrané témy nemajú dosť.
 */
export function buildQuiz(lessonIds: readonly string[], count: number, rng: Rng, mode: QuizMode = 'mixed'): Question[] {
  if (mode === 'theory') return buildTheoryQuiz(lessonIds, count, rng);
  const ids = lessonIds.filter((id) => GENERATORS[id]?.length || QUESTIONS.some((q) => q.lessonId === id));
  if (ids.length === 0) return [];
  const pools = new Map(ids.map((id) => [id, shuffle(rng, QUESTIONS.filter((q) => q.lessonId === id))]));
  const usedGenerators = new Map<string, Set<number>>();
  let order = shuffle(rng, ids);
  const out: Question[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % order.length === 0) order = shuffle(rng, ids);
    const id = order[i % order.length];
    const pool = pools.get(id)!;
    const gens = GENERATORS[id] ?? [];
    const numeric = gens.length > 0 && (pool.length === 0 || rng() < NUMERIC_SHARE);
    if (numeric) {
      const used = usedGenerators.get(id) ?? new Set<number>();
      let candidates = gens.map((_, k) => k).filter((k) => !used.has(k));
      if (candidates.length === 0) {
        used.clear();
        candidates = gens.map((_, k) => k);
      }
      const k = pick(rng, candidates);
      used.add(k);
      usedGenerators.set(id, used);
      out.push(gens[k](rng));
    } else if (pool.length > 0) {
      out.push(fromStatic(pool.pop()!, rng));
    }
  }
  return out;
}

function buildTheoryQuiz(lessonIds: readonly string[], count: number, rng: Rng): Question[] {
  const pools = new Map<string, StaticQuestion[]>();
  for (const id of lessonIds) {
    const pool = QUESTIONS.filter((q) => q.lessonId === id && isTheory(q));
    if (pool.length) pools.set(id, shuffle(rng, pool));
  }
  const out: Question[] = [];
  // Témy sa striedajú dookola, kým je otázok dosť; vyčerpaná téma vypadne.
  while (out.length < count && pools.size > 0) {
    for (const id of shuffle(rng, [...pools.keys()])) {
      if (out.length >= count) break;
      const pool = pools.get(id)!;
      out.push(fromStatic(pool.pop()!, rng));
      if (pool.length === 0) pools.delete(id);
    }
  }
  return out;
}

export type CheckResult = 'correct' | 'wrong' | 'invalid';

export function checkNumeric(q: NumericQuestion, raw: string): CheckResult {
  const x = parseNumber(raw);
  if (Number.isNaN(x)) return 'invalid';
  const allowed = Math.max(Math.abs(q.answer) * q.tolerance, 1e-12);
  return Math.abs(x - q.answer) <= allowed ? 'correct' : 'wrong';
}
