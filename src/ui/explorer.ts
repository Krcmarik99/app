/**
 * Interaktívny graf do lekcie: posuvníky pre parametre (lineárne alebo logaritmicky),
 * prípadne prepínač, a graf s vypočítanými hodnotami, ktorý sa prekreslí pri každej zmene.
 */
import { h } from '../lib/dom';
import { rich } from '../lib/formula';
import { formatSI } from '../lib/units';

export interface ExplorerParam {
  key: string;
  /** Popis (môže obsahovať vzorec v `…`). */
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  /** Logaritmická stupnica (napr. frekvencia, kapacita). */
  log?: boolean;
  /** Vlastné zobrazenie hodnoty. */
  format?: (v: number) => string;
}

export interface ExplorerChoice {
  key: string;
  label: string;
  options: [string, string][];
  value: string;
}

export interface ExplorerView {
  chart: SVGSVGElement;
  readouts: [string, string][];
  note?: string;
}

export interface ExplorerOptions {
  title: string;
  params: ExplorerParam[];
  choices?: ExplorerChoice[];
  draw: (v: Record<string, number>, c: Record<string, string>) => ExplorerView;
}

const STEPS = 1000;

function toValue(p: ExplorerParam, pos: number): number {
  const t = pos / STEPS;
  const v = p.log ? p.min * (p.max / p.min) ** t : p.min + (p.max - p.min) * t;
  return Number(v.toPrecision(3));
}

function toPos(p: ExplorerParam, v: number): number {
  const t = p.log ? Math.log(v / p.min) / Math.log(p.max / p.min) : (v - p.min) / (p.max - p.min);
  return Math.round(Math.max(0, Math.min(1, t)) * STEPS);
}

let counter = 0;

export function explorer(o: ExplorerOptions): HTMLElement {
  const values: Record<string, number> = Object.fromEntries(o.params.map((p) => [p.key, p.value]));
  const choices: Record<string, string> = Object.fromEntries((o.choices ?? []).map((c) => [c.key, c.value]));
  const chartBox = h('div', { class: 'chart-panel' });
  const readouts = h('dl', { class: 'explorer-readouts', 'aria-live': 'polite' });
  const note = h('p', { class: 'explorer-note' });
  const uid = `ex${(counter += 1)}`;

  const redraw = () => {
    const view = o.draw(values, choices);
    chartBox.replaceChildren(view.chart);
    readouts.replaceChildren(...view.readouts.map(([k, v]) => h('div', null, h('dt', null, rich(k)), h('dd', null, v))));
    note.replaceChildren(...(view.note ? [rich(view.note)] : []));
    note.hidden = !view.note;
  };

  const controls = o.params.map((p) => {
    const id = `${uid}-${p.key}`;
    const out = h('output', { for: id });
    const show = () => {
      out.textContent = p.format ? p.format(values[p.key]) : formatSI(values[p.key], p.unit, 3);
    };
    const input = h('input', { id, type: 'range', min: 0, max: STEPS, step: 1, value: toPos(p, p.value) });
    input.addEventListener('input', () => {
      values[p.key] = toValue(p, Number(input.value));
      show();
      redraw();
    });
    show();
    return h('div', { class: 'explorer-param' },
      h('div', { class: 'explorer-param-head' }, h('label', { for: id }, rich(p.label)), out),
      input);
  });

  const selects = (o.choices ?? []).map((c) => {
    const id = `${uid}-${c.key}`;
    const sel = h('select', { id, class: 'field-input' }, c.options.map(([v, t]) => h('option', { value: v, selected: v === c.value }, t)));
    sel.addEventListener('change', () => {
      choices[c.key] = sel.value;
      redraw();
    });
    return h('div', { class: 'explorer-param' },
      h('div', { class: 'explorer-param-head' }, h('label', { for: id }, c.label)),
      h('div', { class: 'field-box' }, sel));
  });

  redraw();
  return h('div', { class: 'explorer' },
    h('div', { class: 'explorer-head' }, h('p', { class: 'eyebrow' }, 'Interaktívny graf'), h('h3', null, o.title)),
    h('div', { class: 'explorer-controls' }, selects, controls),
    chartBox,
    readouts,
    note,
  );
}

/** Popisy osí pre logaritmickú stupnicu: 10, 100, 1 k… (x je log10 hodnoty). */
export function logTicks(minExp: number, maxExp: number): number[] {
  const out: number[] = [];
  for (let e = Math.ceil(minExp); e <= Math.floor(maxExp); e++) out.push(e);
  return out;
}

export function logLabel(exp: number, unit = ''): string {
  return formatSI(10 ** exp, unit, 2).replace(/\s/g, ' ');
}
