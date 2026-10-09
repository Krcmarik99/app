/**
 * Stavebnica kalkulačiek: vstupné políčka s predponami, riadky výsledkov,
 * prepínače a rozloženie. Používajú ju všetky kalkulačky.
 */
import type { ChapterId } from '../content/lessons';
import { h, type Child } from '../lib/dom';
import { formula } from '../lib/formula';
import { fmt, formatSI, parseQuantity, siParts } from '../lib/units';

export interface CalculatorInfo {
  id: string;
  title: string;
  short: string;
  /** Kapitola, ku ktorej kalkulačka patrí – podľa nej sa určí, či je len pre predplatiteľov. */
  chapter: ChapterId;
  render: () => HTMLElement;
}

export interface Field {
  el: HTMLElement;
  input: HTMLInputElement;
  read: () => number;
}

export function field(id: string, label: Child, unit: string, value: string, onInput: () => void, hint?: string): Field {
  const input = h('input', {
    id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value, class: 'field-input',
  });
  const read = () => parseQuantity(input.value, unit);
  input.addEventListener('input', () => {
    const v = read();
    input.classList.toggle('is-invalid', input.value.trim() !== '' && Number.isNaN(v));
    onInput();
  });
  const el = h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('div', { class: 'field-box' }, input, unit ? h('span', { class: 'field-unit' }, unit) : null),
    hint ? h('p', { class: 'field-hint' }, hint) : null,
  );
  return { el, input, read };
}

export function v(sym: string): HTMLElement {
  const span = h('span', { class: 'fx' });
  span.append(formula(sym));
  return span;
}

export function result(label: Child, value: string, emphasis = false): HTMLElement {
  return h('div', { class: `result ${emphasis ? 'result-main' : ''}` },
    h('dt', null, label),
    h('dd', null, value),
  );
}

export function segmented<T extends string>(name: string, label: string, options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label },
    options.map(([val, text]) => h('label', { class: 'seg-item' },
      h('input', { type: 'radio', name, id: `${name}-${val}`, value: val, checked: val === value, onChange: () => onChange(val) }),
      h('span', null, text),
    )),
  );
}

export function calcLayout(inputs: Child, outputs: HTMLElement, figure?: HTMLElement | null): HTMLElement {
  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, inputs),
    h('div', { class: 'calc-outputs' },
      outputs,
      figure ? h('div', { class: 'sch-panel calc-figure' }, figure) : null,
    ),
  );
}

export const ok = (x: number) => Number.isFinite(x) && x > 0;
export const si = (x: number, unit: string, sig = 4) => formatSI(x, unit, sig);
export const errorMsg = (text: string) => h('p', { class: 'calc-error' }, text);

/** Krátky zápis s predponou do políčka: 0,02553 → „25,53m“. */
export function compact(x: number): string {
  const { scaled, prefix } = siParts(x, 4);
  return `${fmt(scaled, 4)}${prefix}`;
}
