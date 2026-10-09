/**
 * Kreslenie schém. Značky podľa STN EN 60617 (rezistor ako obdĺžnik, cievka ako oblúčiky).
 * Súčiastka sa kreslí medzi dvoma svorkami a; b, ktoré ležia vodorovne alebo zvisle.
 */
import { s } from '../lib/dom';

export type Pt = [number, number];

export type CompKind =
  | 'resistor' | 'varres' | 'capacitor' | 'ecap' | 'inductor' | 'battery' | 'acsource'
  | 'lamp' | 'ammeter' | 'voltmeter' | 'ohmmeter' | 'diode' | 'led' | 'switch' | 'button' | 'fuse';

/** Polovičná dĺžka tela súčiastky v smere vodiča. */
const HALF: Record<CompKind, number> = {
  resistor: 18, varres: 18, capacitor: 4, ecap: 5, inductor: 20, battery: 4, acsource: 13,
  lamp: 11, ammeter: 11, voltmeter: 11, ohmmeter: 11, diode: 8, led: 8, switch: 13, button: 13, fuse: 15,
};

/** Polovičná šírka tela kolmo na vodič – podľa nej sa odsadí popis. */
const PERP: Record<CompKind, number> = {
  resistor: 7, varres: 12, capacitor: 12, ecap: 12, inductor: 6, battery: 12, acsource: 13,
  lamp: 11, ammeter: 11, voltmeter: 11, ohmmeter: 11, diode: 9, led: 13, switch: 11, button: 16, fuse: 6,
};

const r1 = (n: number) => Math.round(n * 10) / 10;

function arrowHead(x: number, y: number, angleDeg: number, size = 5, cls = 'f'): SVGPolygonElement {
  const a = (angleDeg * Math.PI) / 180;
  const p = (dx: number, dy: number): string => {
    const rx = x + dx * Math.cos(a) - dy * Math.sin(a);
    const ry = y + dx * Math.sin(a) + dy * Math.cos(a);
    return `${r1(rx)},${r1(ry)}`;
  };
  return s('polygon', { points: `${p(0, 0)} ${p(-size * 1.6, -size * 0.75)} ${p(-size * 1.6, size * 0.75)}`, class: cls });
}

function body(kind: CompKind): SVGElement[] {
  switch (kind) {
    case 'resistor':
      return [s('rect', { x: -18, y: -7, width: 36, height: 14, class: 'b' })];
    case 'varres':
      return [
        s('rect', { x: -18, y: -7, width: 36, height: 14, class: 'b' }),
        s('line', { x1: -13, y1: 12, x2: 11, y2: -9, class: 'w' }),
        arrowHead(14, -12, -41, 3.6),
      ];
    case 'capacitor':
      return [
        s('line', { x1: -4, y1: -12, x2: -4, y2: 12, class: 'p' }),
        s('line', { x1: 4, y1: -12, x2: 4, y2: 12, class: 'p' }),
      ];
    case 'ecap':
      return [
        s('rect', { x: -5, y: -12, width: 4, height: 24, class: 'b' }),
        s('line', { x1: 5, y1: -12, x2: 5, y2: 12, class: 'p' }),
        s('path', { d: 'M-14 -12h6M-11 -15v6', class: 'w thin' }),
      ];
    case 'inductor':
      return [s('path', { d: 'M-20 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0', class: 'w' })];
    case 'battery':
      return [
        s('line', { x1: -4, y1: -12, x2: -4, y2: 12, class: 'w' }),
        s('line', { x1: 4, y1: -6, x2: 4, y2: 6, class: 'p thick' }),
      ];
    case 'acsource':
      return [
        s('circle', { cx: 0, cy: 0, r: 13, class: 'b' }),
        s('path', { d: 'M-8 0c2-6 6-6 8 0s6 6 8 0', class: 'w' }),
      ];
    case 'lamp':
      return [
        s('circle', { cx: 0, cy: 0, r: 11, class: 'b' }),
        s('path', { d: 'M-7.8 -7.8L7.8 7.8M-7.8 7.8L7.8 -7.8', class: 'w' }),
      ];
    case 'ammeter':
    case 'voltmeter':
    case 'ohmmeter':
      return [s('circle', { cx: 0, cy: 0, r: 11, class: 'b' })];
    case 'diode':
      return [
        s('polygon', { points: '-8,-9 -8,9 8,0', class: 'b' }),
        s('line', { x1: 8, y1: -9, x2: 8, y2: 9, class: 'w' }),
      ];
    case 'led':
      return [
        s('polygon', { points: '-8,-9 -8,9 8,0', class: 'b' }),
        s('line', { x1: 8, y1: -9, x2: 8, y2: 9, class: 'w' }),
        s('line', { x1: -3, y1: -11, x2: 3, y2: -18, class: 'w thin' }),
        arrowHead(5, -20.5, -50, 3),
        s('line', { x1: 3, y1: -9, x2: 9, y2: -16, class: 'w thin' }),
        arrowHead(11, -18.5, -50, 3),
      ];
    case 'switch':
      return [
        s('circle', { cx: -11, cy: 0, r: 2.2, class: 'b' }),
        s('line', { x1: -9.5, y1: -1.5, x2: 12, y2: -11, class: 'w' }),
        s('circle', { cx: 11, cy: 0, r: 2.2, class: 'b' }),
      ];
    case 'button':
      return [
        s('circle', { cx: -11, cy: 0, r: 2.2, class: 'b' }),
        s('circle', { cx: 11, cy: 0, r: 2.2, class: 'b' }),
        s('line', { x1: -13, y1: -7, x2: 13, y2: -7, class: 'w' }),
        s('line', { x1: 0, y1: -7, x2: 0, y2: -16, class: 'w' }),
        s('line', { x1: -5, y1: -16, x2: 5, y2: -16, class: 'w' }),
      ];
    case 'fuse':
      return [
        s('rect', { x: -15, y: -6, width: 30, height: 12, class: 'b' }),
        s('line', { x1: -15, y1: 0, x2: 15, y2: 0, class: 'w' }),
      ];
  }
}

export type Side = 'above' | 'below' | 'left' | 'right';

/** Popis veličiny: „R_1“ → kurzívou R s dolným indexom 1. */
export function qty(x: number, y: number, src: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = ''): SVGTextElement {
  const [main, sub] = src.split('_');
  const t = s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: `q ${cls}`.trim() });
  t.append(s('tspan', { class: 'it' }, main));
  if (sub) t.append(s('tspan', { class: 'sub', dy: '0.32em' }, sub));
  return t;
}

export function valueText(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: 'val' }, text);
}

export interface CompOptions {
  label?: string;
  value?: string;
  side?: Side;
}

export function comp(kind: CompKind, a: Pt, b: Pt, opts: CompOptions = {}): SVGGElement {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const half = HALF[kind];
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const g = s(
    'g',
    { class: `comp comp-${kind}` },
    s('line', { x1, y1, x2: r1(cx - ux * half), y2: r1(cy - uy * half), class: 'w' }),
    s('line', { x1: r1(cx + ux * half), y1: r1(cy + uy * half), x2, y2, class: 'w' }),
    s('g', { transform: `translate(${r1(cx)} ${r1(cy)}) rotate(${r1(angle)})` }, ...body(kind)),
  );
  const meterText = { ammeter: 'A', voltmeter: 'V', ohmmeter: 'Ω' } as Partial<Record<CompKind, string>>;
  if (meterText[kind]) {
    g.append(s('text', { x: r1(cx), y: r1(cy + 4.5), 'text-anchor': 'middle', class: 'meter' }, meterText[kind]));
  }
  if (opts.label || opts.value) {
    const horizontal = Math.abs(ux) > Math.abs(uy);
    const side = opts.side ?? (horizontal ? 'above' : 'right');
    const off = PERP[kind] + 8;
    const lines: SVGTextElement[] = [];
    if (side === 'above' || side === 'below') {
      const first = side === 'above' ? cy - off - (opts.label && opts.value ? 14 : 0) : cy + off + 11;
      if (opts.label) lines.push(qty(cx, first, opts.label));
      if (opts.value) lines.push(valueText(cx, opts.label ? first + 14 : first, opts.value));
    } else {
      const x = side === 'right' ? cx + off : cx - off;
      const anchor = side === 'right' ? 'start' : 'end';
      if (opts.label) lines.push(qty(x, opts.value ? cy - 2 : cy + 5, opts.label, anchor));
      if (opts.value) lines.push(valueText(x, opts.label ? cy + 13 : cy + 4, opts.value, anchor));
    }
    g.append(...lines);
  }
  return g;
}

export function wire(...points: Pt[]): SVGPolylineElement {
  return s('polyline', { points: points.map(([x, y]) => `${x},${y}`).join(' '), class: 'w' });
}

/** Prerušovaný vodič – voliteľné alebo naznačené spojenie. */
export function dashedWire(...points: Pt[]): SVGPolylineElement {
  return s('polyline', { points: points.map(([x, y]) => `${x},${y}`).join(' '), class: 'w dash' });
}

/** Obyčajný popis v schéme (napr. + a − pri svorkách). */
export function note(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: 'note' }, text);
}

export function dot([x, y]: Pt): SVGCircleElement {
  return s('circle', { cx: x, cy: y, r: 3, class: 'dot' });
}

export function terminal([x, y]: Pt): SVGCircleElement {
  return s('circle', { cx: x, cy: y, r: 3.6, class: 'b' });
}

const DIR_ANGLE = { r: 0, d: 90, l: 180, u: -90 } as const;

/** Šípka prúdu na vodiči, voliteľne s popisom. */
export function currentArrow([x, y]: Pt, dir: keyof typeof DIR_ANGLE, label?: string, labelSide: Side = 'above'): SVGGElement {
  const g = s('g', { class: 'cur' }, arrowHead(x + (dir === 'r' ? 5 : dir === 'l' ? -5 : 0), y + (dir === 'd' ? 5 : dir === 'u' ? -5 : 0), DIR_ANGLE[dir], 4.4, 'arr'));
  if (label) {
    const pos: Record<Side, [number, number, 'start' | 'middle' | 'end']> = {
      above: [x, y - 9, 'middle'],
      below: [x, y + 20, 'middle'],
      left: [x - 10, y + 5, 'end'],
      right: [x + 10, y + 5, 'start'],
    };
    const [lx, ly, anchor] = pos[labelSide];
    g.append(qty(lx, ly, label, anchor, 'trace'));
  }
  return g;
}

/** Šípka napätia medzi dvoma bodmi (smer od + k −). */
export function voltageArrow(a: Pt, b: Pt, label: string, labelSide: Side = 'right'): SVGGElement {
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ex = b[0] - ((b[0] - a[0]) / len) * 1;
  const ey = b[1] - ((b[1] - a[1]) / len) * 1;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const lx = labelSide === 'right' ? mx + 9 : labelSide === 'left' ? mx - 9 : mx;
  const ly = labelSide === 'above' ? my - 9 : labelSide === 'below' ? my + 18 : my + 5;
  const anchor = labelSide === 'right' ? 'start' : labelSide === 'left' ? 'end' : 'middle';
  return s(
    'g',
    { class: 'volt' },
    s('line', { x1: a[0], y1: a[1], x2: r1(ex - ((b[0] - a[0]) / len) * 6), y2: r1(ey - ((b[1] - a[1]) / len) * 6), class: 'varr' }),
    arrowHead(ex, ey, angle, 4, 'arr'),
    qty(lx, ly, label, anchor, 'trace'),
  );
}

export function schematic(width: number, height: number, title: string, ...children: SVGElement[]): SVGSVGElement {
  return s(
    'svg',
    {
      viewBox: `0 0 ${width} ${height}`,
      width: Math.round(width * 1.25),
      class: 'sch',
      role: 'img',
      'aria-label': title,
    },
    s('title', null, title),
    ...children,
  );
}
