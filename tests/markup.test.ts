// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DECKS } from '../src/content/flashcards';
import { LESSONS } from '../src/content/lessons';
import { QUESTIONS } from '../src/content/questions';
import { rich } from '../src/lib/formula';
import { createRng } from '../src/lib/random';
import { GENERATORS } from '../src/practice/generators';
import { calculatorView, CALCULATORS } from '../src/views/calculators';
import { lessonView } from '../src/views/lessons';

/** Zvyšky zápisu vzorcov, ktoré sa nemajú dostať k študentovi ako surový text. */
const LEAK = /`|@[fso]\{|[_^]\{|\$[\p{L}]|\*\*/u;

function leaks(text: string): string[] {
  return text.split(/\n+/).map((l) => l.trim()).filter((l) => LEAK.test(l));
}

function renderedText(s: string): string {
  const div = document.createElement('div');
  div.append(rich(s));
  return div.textContent ?? '';
}

describe('žiadny nevykreslený zápis vzorca', () => {
  it('v lekciách (aj v schémach a grafoch)', () => {
    for (const l of LESSONS) {
      const el = lessonView(l.id);
      document.body.replaceChildren(el);
      // innerText v jsdom nie je, preto textContent s oddeľovačmi medzi prvkami.
      const parts = [...el.querySelectorAll('*')].flatMap((n) => [...n.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent ?? ''));
      expect(leaks(parts.join('\n')), l.id).toEqual([]);
      const labels = [...el.querySelectorAll('[aria-label]')].map((n) => n.getAttribute('aria-label') ?? '');
      expect(leaks(labels.join('\n')), `${l.id} aria-label`).toEqual([]);
    }
  });

  it('v kalkulačkách', () => {
    for (const c of CALCULATORS) {
      const el = calculatorView(c.id);
      document.body.replaceChildren(el);
      const parts = [...el.querySelectorAll('*')].flatMap((n) => [...n.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent ?? ''));
      expect(leaks(parts.join('\n')), c.id).toEqual([]);
    }
  });

  it('v otázkach, riešeniach a kartičkách', () => {
    const texts: [string, string][] = [];
    for (const q of QUESTIONS) texts.push(...[q.prompt, q.explanation, ...q.options].map((t): [string, string] => [q.lessonId, t]));
    for (const [id, gens] of Object.entries(GENERATORS)) {
      gens.forEach((gen, gi) => {
        for (let seed = 1; seed <= 20; seed++) {
          const q = gen(createRng(seed * 104729 + gi));
          const all = q.kind === 'numeric' ? [q.prompt, ...q.solution] : [q.prompt, q.explanation, ...q.options];
          texts.push(...all.map((t): [string, string] => [`${id}#${gi}`, t]));
        }
      });
    }
    for (const d of DECKS) for (const c of d.cards) texts.push(...[c.front, c.back, c.note ?? ''].map((t): [string, string] => [c.id, t]));
    const bad = texts.filter(([, t]) => leaks(renderedText(t)).length > 0).map(([id, t]) => `${id}: ${t}`);
    expect([...new Set(bad)]).toEqual([]);
  });
});
