import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/content/lessons';
import { QUESTIONS } from '../src/content/questions';
import { streak } from '../src/lib/progress';
import { createRng } from '../src/lib/random';
import { fmt } from '../src/lib/units';
import { GENERATORS } from '../src/practice/generators';
import { buildQuiz, checkNumeric, fromStatic } from '../src/practice/session';

describe('generátory príkladov', () => {
  it('každá lekcia má generátory aj otázky s výberom', () => {
    for (const l of LESSONS) {
      expect(GENERATORS[l.id]?.length, l.id).toBeGreaterThan(0);
      expect(QUESTIONS.filter((q) => q.lessonId === l.id).length, l.id).toBeGreaterThanOrEqual(4);
    }
  });

  it('vytvárajú zmysluplné príklady pri rôznych semienkach', () => {
    for (const [lessonId, gens] of Object.entries(GENERATORS)) {
      gens.forEach((gen, gi) => {
        for (let seed = 1; seed <= 60; seed++) {
          const q = gen(createRng(seed * 7919 + gi));
          const where = `${lessonId}#${gi} seed ${seed}`;
          expect(q.lessonId, where).toBe(lessonId);
          expect(q.prompt.length, where).toBeGreaterThan(10);
          expect(q.prompt.split('`').length % 2, `${where}: nepárne backticky`).toBe(1);
          if (q.kind === 'numeric') {
            expect(Number.isFinite(q.answer), where).toBe(true);
            expect(q.answer, where).toBeGreaterThan(0);
            expect(q.solution.length, where).toBeGreaterThan(0);
            for (const step of q.solution) expect(step.split('`').length % 2, `${where}: ${step}`).toBe(1);
            // Výsledok zaokrúhlený na 3 platné číslice musí byť uznaný.
            expect(checkNumeric(q, fmt(q.answer, 3)), where).toBe('correct');
            expect(checkNumeric(q, fmt(q.answer * 1.2, 3)), where).toBe('wrong');
            // Odpoveď nesmie byť v absurdných číslach – predpona má udržať rozsah.
            const fixedUnit = ['€', '%', 'kWh', 'rad/s', 'm', 'Ω', 'N', ''].includes(q.unit) || q.prompt.startsWith('Preveď');
            if (!fixedUnit) {
              expect(q.answer, `${where}: ${q.answer} ${q.unit}`).toBeGreaterThanOrEqual(0.999);
              expect(q.answer, `${where}: ${q.answer} ${q.unit}`).toBeLessThan(1000);
            }
          } else {
            expect(q.options).toHaveLength(4);
            expect(new Set(q.options).size, where).toBe(4);
            expect(q.correct).toBeGreaterThanOrEqual(0);
            expect(q.correct).toBeLessThan(4);
          }
        }
      });
    }
  });
});

describe('kontrola odpovede', () => {
  const q = { kind: 'numeric' as const, lessonId: 'x', prompt: '', unit: 'mA', answer: 25.53, tolerance: 0.02, solution: [] };
  it('toleruje zaokrúhlenie, nie chybu', () => {
    expect(checkNumeric(q, '25,5')).toBe('correct');
    expect(checkNumeric(q, '25.53')).toBe('correct');
    expect(checkNumeric(q, '26')).toBe('correct');
    expect(checkNumeric(q, '27')).toBe('wrong');
    expect(checkNumeric(q, '0,0255')).toBe('wrong');
    expect(checkNumeric(q, 'dvadsať')).toBe('invalid');
  });
});

describe('zostavenie kvízu', () => {
  it('vráti požadovaný počet otázok z vybraných tém', () => {
    const quiz = buildQuiz(['ohmov-zakon', 'kondenzator'], 20, createRng(42));
    expect(quiz).toHaveLength(20);
    expect(new Set(quiz.map((q) => q.lessonId))).toEqual(new Set(['ohmov-zakon', 'kondenzator']));
  });

  it('pri jednej téme strieda typy otázok', () => {
    const quiz = buildQuiz(['zaklady'], 10, createRng(3));
    expect(quiz.some((q) => q.kind === 'numeric')).toBe(true);
    expect(quiz.some((q) => q.kind === 'choice')).toBe(true);
  });

  it('neznáme témy ignoruje', () => {
    expect(buildQuiz(['neexistuje'], 5, createRng(1))).toEqual([]);
  });

  it('zamieša možnosti a zachová správnu odpoveď', () => {
    const sq = QUESTIONS[0];
    for (let seed = 0; seed < 20; seed++) {
      const q = fromStatic(sq, createRng(seed));
      expect(q.options[q.correct]).toBe(sq.options[0]);
    }
  });
});

describe('séria dní', () => {
  it('počíta dni po sebe končiac dnes alebo včera', () => {
    const today = new Date(2026, 9, 9);
    expect(streak(['2026-10-07', '2026-10-08', '2026-10-09'], today)).toBe(3);
    expect(streak(['2026-10-07', '2026-10-08'], today)).toBe(2);
    expect(streak(['2026-10-05', '2026-10-09'], today)).toBe(1);
    expect(streak(['2026-10-01'], today)).toBe(0);
    expect(streak(['2026-09-30', '2026-10-01'], new Date(2026, 9, 1))).toBe(2);
  });
});
