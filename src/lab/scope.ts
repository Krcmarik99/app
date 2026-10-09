/**
 * Obrazovka osciloskopu: 10 × 8 dielikov, dva kanály, spúšťanie nábežnou hranou CH1
 * (periodický priebeh stojí na mieste), pri jednosmerných dejoch sa obraz posúva.
 */
import { h, s } from '../lib/dom';
import { fmt, formatSI } from '../lib/units';
import type { Simulator } from './engine';
import { KINDS, VOLT_DIVS, num, type Part } from './parts';

const SW = 500;
const SH = 400;
const DIV = 50;

export interface ScopePanel {
  el: HTMLElement;
  update(sim: Simulator | null): void;
}

function autoDiv(maxAbs: number): number {
  return VOLT_DIVS.find((d) => maxAbs <= 3.6 * d) ?? VOLT_DIVS[VOLT_DIVS.length - 1];
}

const divText = (v: number, unit: string) => `${formatSI(v, unit, 3)}/d`;

export function scopePanel(part: Part, onProp: (key: string, value: string) => void): ScopePanel {
  const grid: SVGElement[] = [];
  for (let i = 0; i <= 10; i++) grid.push(s('line', { x1: i * DIV, y1: 0, x2: i * DIV, y2: SH, class: i === 5 ? 'scope-axis' : 'scope-grid' }));
  for (let j = 0; j <= 8; j++) grid.push(s('line', { x1: 0, y1: j * DIV, x2: SW, y2: j * DIV, class: j === 4 ? 'scope-axis' : 'scope-grid' }));
  const tr1 = s('polyline', { class: 'scope-ch1', points: '' });
  const tr2 = s('polyline', { class: 'scope-ch2', points: '' });
  const svg = s('svg', { viewBox: `0 0 ${SW} ${SH}`, class: 'scope-screen-svg', role: 'img', 'aria-label': `Obrazovka osciloskopu ${part.name}` },
    s('rect', { x: 0, y: 0, width: SW, height: SH, class: 'scope-bg' }), ...grid, tr2, tr1);

  const info1 = h('span', { class: 'scope-info ch1' });
  const info2 = h('span', { class: 'scope-info ch2' });
  const infoT = h('span', { class: 'scope-info' });

  const select = (key: string, label: string) => {
    const def = KINDS.scope.props.find((p) => p.key === key)!;
    const el = h('select', { class: 'field-input', 'aria-label': label },
      def.options!.map(([v, t]) => h('option', { value: v, selected: String(part.props[key]) === v }, t)));
    el.addEventListener('change', () => onProp(key, el.value));
    return h('label', { class: 'scope-control' }, h('span', null, label), h('div', { class: 'field-box' }, el));
  };

  const el = h('section', { class: 'scope-panel', 'aria-label': `Osciloskop ${part.name}` },
    h('div', { class: 'scope-head' },
      h('h3', null, `Osciloskop ${part.name}`),
      h('div', { class: 'scope-infos' }, info1, info2, infoT),
    ),
    svg,
    h('div', { class: 'scope-controls' },
      select('tdiv', 'Čas/dielik'),
      select('v1', 'CH1 (žltý)'),
      select('v2', 'CH2 (modrý)'),
    ),
  );

  const tdiv = num(part.props.tdiv, 5e-3);
  const window = 10 * tdiv;
  infoT.textContent = `${divText(tdiv, 's')}`;

  const update = (sim: Simulator | null) => {
    const trace = sim?.traces.get(part.id);
    const all = trace ? trace.samples() : [];
    if (!all.length) {
      tr1.setAttribute('points', '');
      tr2.setAttribute('points', '');
      info1.textContent = 'CH1 –';
      info2.textContent = 'CH2 –';
      return;
    }
    const tEnd = all[all.length - 1].t;
    const recent = all.filter((p) => p.t >= tEnd - 2 * window);
    const v1s = recent.map((p) => p.v1);
    const max1 = Math.max(...v1s);
    const min1 = Math.min(...v1s);
    const level = (max1 + min1) / 2;
    let start = tEnd - window;
    let rising: number[] = [];
    if (max1 - min1 > 1e-3 * Math.max(1, Math.abs(max1))) {
      for (let i = 1; i < recent.length; i++) {
        if (recent[i - 1].v1 < level && recent[i].v1 >= level) rising.push(recent[i].t);
      }
      const trig = rising.filter((t) => t <= tEnd - window).pop();
      if (trig !== undefined) start = trig;
    } else {
      rising = [];
    }
    const shown = recent.filter((p) => p.t >= start && p.t <= start + window);
    const maxAbs = (key: 'v1' | 'v2') => Math.max(0, ...shown.map((p) => Math.abs(p[key])));
    const d1 = part.props.v1 === 'auto' ? autoDiv(maxAbs('v1')) : num(part.props.v1, 1);
    const d2 = part.props.v2 === 'auto' ? autoDiv(maxAbs('v2')) : num(part.props.v2, 1);
    const step = Math.max(1, Math.floor(shown.length / 800));
    const pts = (key: 'v1' | 'v2', d: number) => {
      const out: string[] = [];
      for (let i = 0; i < shown.length; i += step) {
        const p = shown[i];
        const x = ((p.t - start) / window) * SW;
        const y = SH / 2 - (p[key] / d) * DIV;
        out.push(`${x.toFixed(1)},${Math.max(-20, Math.min(SH + 20, y)).toFixed(1)}`);
      }
      return out.join(' ');
    };
    tr1.setAttribute('points', pts('v1', d1));
    tr2.setAttribute('points', pts('v2', d2));
    const pp = (key: 'v1' | 'v2') => {
      const vs = shown.map((p) => p[key]);
      return vs.length ? Math.max(...vs) - Math.min(...vs) : 0;
    };
    const freq = rising.length >= 2 ? (rising.length - 1) / (rising[rising.length - 1] - rising[0]) : 0;
    info1.textContent = `CH1 ${divText(d1, 'V')} · Uš-š ${formatSI(pp('v1'), 'V', 3)}${freq ? ` · f ≈ ${fmt(freq, 3)} Hz` : ''}`;
    info2.textContent = `CH2 ${divText(d2, 'V')} · Uš-š ${formatSI(pp('v2'), 'V', 3)}`;
  };

  return { el, update };
}
