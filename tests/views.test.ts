// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DECKS } from '../src/content/flashcards';
import { LESSONS } from '../src/content/lessons';
import { formula, rich } from '../src/lib/formula';
import { calculatorView, calculatorsView, CALCULATORS } from '../src/views/calculators';
import { flashcardsView } from '../src/views/flashcards';
import { homeView } from '../src/views/home';
import { lessonView, lessonsView } from '../src/views/lessons';
import { practiceView } from '../src/views/practice';

function mount(el: HTMLElement): HTMLElement {
  document.body.replaceChildren(el);
  return el;
}

beforeEach(() => {
  localStorage.clear();
});

describe('vzorce', () => {
  it('vykreslí veličiny kurzívou, indexy a zlomky', () => {
    const div = document.createElement('div');
    div.append(formula('$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}'));
    expect(div.querySelectorAll('i.v')).toHaveLength(5);
    expect(div.querySelectorAll('sub')).toHaveLength(4);
    expect(div.querySelector('.frac .num')?.textContent).toBe('R2');
    expect(div.querySelector('.frac .den')?.textContent).toBe('R1 + R2');
  });

  it('podporuje odmocninu a text s tučným písmom', () => {
    const div = document.createElement('div');
    div.append(rich('Platí `$U = @f{$U_{m}}{@s{2}}` a **pozor** na jednotky.'));
    expect(div.querySelector('.sqrt-rad')?.textContent).toBe('2');
    expect(div.querySelector('strong')?.textContent).toBe('pozor');
    expect(div.textContent).toContain('na jednotky.');
  });
});

describe('stránky sa vykreslia bez chyby', () => {
  it('domov', () => {
    const el = mount(homeView());
    expect(el.querySelector('h1')?.textContent).toContain('Elektrotechnika');
    expect(el.querySelector('#hero-u')).not.toBeNull();
  });

  it('zoznam lekcií a všetky lekcie', () => {
    expect(mount(lessonsView()).querySelectorAll('.lesson-row')).toHaveLength(LESSONS.length);
    for (const l of LESSONS) {
      const el = mount(lessonView(l.id));
      expect(el.querySelector('h1')?.textContent).toBe(l.title);
      expect(el.querySelectorAll('.question').length).toBeGreaterThanOrEqual(2);
    }
    expect(mount(lessonView('neexistuje')).textContent).toContain('nenašla');
  });

  it('cvičenie – nastavenie, odpoveď a výsledok', () => {
    const el = mount(practiceView());
    expect(el.querySelectorAll('.chip-toggle')).toHaveLength(LESSONS.length);
    const run = mount(practiceView('farebny-kod'));
    expect(run.querySelector('.question')).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      const option = run.querySelector<HTMLButtonElement>('.option');
      if (option) option.click();
      else {
        run.querySelector<HTMLButtonElement>('.numeric-form .btn-quiet:not([disabled])')?.click();
      }
      run.querySelector<HTMLButtonElement>('.run-next')?.click();
    }
    expect(run.querySelector('.summary-big')?.textContent).toMatch(/\d+ \/ 5/);
    expect(JSON.parse(localStorage.getItem('elektrolab:v1')!).stats['farebny-kod'].answered).toBe(5);
  });

  it('všetky kalkulačky', () => {
    expect(mount(calculatorsView()).querySelectorAll('.calc-card')).toHaveLength(CALCULATORS.length);
    for (const c of CALCULATORS) {
      const el = mount(calculatorView(c.id));
      expect(el.querySelector('.calc-error'), c.id).toBeNull();
      expect(el.querySelector('.results, .big-value'), c.id).not.toBeNull();
    }
  });

  it('kalkulačka Ohmovho zákona dopočíta prúd a výkon', () => {
    const el = mount(calculatorView('ohm'));
    const I = el.querySelector<HTMLInputElement>('#ohm-I')!;
    const P = el.querySelector<HTMLInputElement>('#ohm-P')!;
    expect(I.value).toBe('25,53m');
    expect(P.value).toBe('306,4m');
    const R = el.querySelector<HTMLInputElement>('#ohm-R')!;
    R.value = '1k';
    R.dispatchEvent(new Event('input'));
    expect(I.value).toBe('12m');
  });

  it('kartičky', () => {
    for (const d of DECKS) {
      const el = mount(flashcardsView(d.id));
      const card = el.querySelector<HTMLButtonElement>('.flip-card')!;
      card.click();
      expect(card.classList.contains('is-flipped')).toBe(true);
      el.querySelector<HTMLButtonElement>('.card-answers .btn-primary')!.click();
    }
    expect(JSON.parse(localStorage.getItem('elektrolab:v1')!).cardsKnown).toHaveLength(DECKS.length);
  });
});
