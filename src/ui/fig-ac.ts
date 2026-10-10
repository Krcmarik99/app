/**
 * Schémy a grafy pre striedavé obvody: fázorové diagramy, kompenzácia účinníka,
 * rezonančné obvody, filtre RC a zapojenie záťaže do hviezdy a do trojuholníka.
 */
import { s } from '../lib/dom';
import { lineChart, sample, type Axis } from './chart';
import { logLabel, logTicks } from './explorer';
import { arrowHead, comp, currentArrow, dot, qty, schematic, terminal, voltageArrow, wire } from './schematic';

export interface Phasor {
  /** Koncový bod v jednotkách diagramu (y smeruje hore). */
  x: number;
  y: number;
  label: string;
  /** Začiatok šípky (inak počiatok). */
  from?: [number, number];
  cls?: 'ink' | 'trace' | 'copper' | 'good';
  dashed?: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Fázorový diagram: šípky z počiatku (alebo nadväzujúce), mierka sa zvolí automaticky. */
export function phasorDiagram(vectors: Phasor[], title: string, opts: { width?: number; height?: number } = {}): SVGSVGElement {
  const W = opts.width ?? 330;
  const H = opts.height ?? 240;
  const pts = vectors.flatMap((v) => [[v.x, v.y], v.from ?? [0, 0]]);
  const xs = [0, ...pts.map((p) => p[0])];
  const ys = [0, ...pts.map((p) => p[1])];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 46;
  const k = Math.min((W - 2 * pad) / Math.max(1e-9, x1 - x0), (H - 2 * pad) / Math.max(1e-9, y1 - y0));
  const ox = pad + (W - 2 * pad - (x1 - x0) * k) / 2 - x0 * k;
  const oy = H - pad - (H - 2 * pad - (y1 - y0) * k) / 2 + y0 * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  const parts: SVGElement[] = [
    s('line', { x1: 8, y1: r1(oy), x2: W - 8, y2: r1(oy), class: 'w dash thin' }),
    s('circle', { cx: r1(ox), cy: r1(oy), r: 2.6, class: 'dot' }),
  ];
  for (const v of vectors) {
    const [ax, ay] = P(...(v.from ?? [0, 0]));
    const [bx, by] = P(v.x, v.y);
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) continue;
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const cls = `phasor phasor-${v.cls ?? 'ink'}${v.dashed ? ' is-dashed' : ''}`;
    parts.push(
      s('line', { x1: r1(ax), y1: r1(ay), x2: r1(bx - ux * 7), y2: r1(by - uy * 7), class: cls }),
      arrowHead(bx, by, ang, 5, `${cls} phasor-head`),
    );
    // Popis kúsok za hrot, kolmo odsunutý od šípky.
    const lx = bx + ux * 10 - uy * 8;
    const ly = by + uy * 10 + ux * 8 + 4;
    parts.push(qty(lx, ly, v.label, Math.abs(ux) < 0.3 ? 'middle' : ux > 0 ? 'start' : 'end', `phasor-label phasor-${v.cls ?? 'ink'}`));
  }
  return schematic(W, H, title, ...parts);
}

/** Induktívna záťaž (R a L) s kompenzačným kondenzátorom C pripojeným paralelne. */
export function compensationFigure(): SVGSVGElement {
  const top = 40;
  const bottom = 196;
  const xz = 200;
  const xc = 300;
  return schematic(380, 220, 'Kompenzácia účinníka: kondenzátor paralelne k induktívnej záťaži',
    comp('acsource', [56, top], [56, bottom], { label: 'U', side: 'left' }),
    wire([56, top], [xc, top]),
    wire([56, bottom], [xc, bottom]),
    currentArrow([118, top], 'r', 'I'),
    comp('resistor', [xz, top], [xz, 118], { label: 'R', side: 'left' }),
    comp('inductor', [xz, 118], [xz, bottom], { label: 'L', side: 'left' }),
    currentArrow([xz, top + 18], 'd', 'I_Z', 'right'),
    comp('capacitor', [xc, top], [xc, bottom], { label: 'C', side: 'right' }),
    currentArrow([xc, top + 22], 'd', 'I_C', 'left'),
    dot([xz, top]),
    dot([xz, bottom]),
    s('rect', { x: xz - 42, y: top + 34, width: 64, height: bottom - top - 44, rx: 6, class: 'box' }),
    s('text', { x: xz - 48, y: 124, 'text-anchor': 'end', class: 'val' }, 'motor'),
  );
}

/** Paralelný rezonančný obvod: reálna cievka (L s odporom R) a kondenzátor C. */
export function parallelLcFigure(): SVGSVGElement {
  const top = 40;
  const bottom = 200;
  const xl = 196;
  const xc = 296;
  return schematic(370, 224, 'Paralelný rezonančný obvod: cievka s odporom vinutia R paralelne s kondenzátorom C',
    comp('acsource', [56, top], [56, bottom], { label: 'U', side: 'left' }),
    wire([56, top], [xc, top]),
    wire([56, bottom], [xc, bottom]),
    currentArrow([116, top], 'r', 'I'),
    comp('inductor', [xl, top], [xl, 124], { label: 'L', side: 'left' }),
    comp('resistor', [xl, 124], [xl, bottom], { label: 'R', side: 'left' }),
    currentArrow([xl, top + 16], 'd', 'I_L', 'right'),
    comp('capacitor', [xc, top], [xc, bottom], { label: 'C', side: 'right' }),
    currentArrow([xc, top + 22], 'd', 'I_C', 'left'),
    dot([xl, top]),
    dot([xl, bottom]),
  );
}

/** Pasívny filter: pozdĺžny prvok a priečny prvok, vstup U1 vľavo, výstup U2 vpravo. */
export function filterFigure(kind: 'lp' | 'hp', type: 'rc' | 'rl' = 'rc'): SVGSVGElement {
  const top = 40;
  const bottom = 160;
  const xa = 40;
  const xs = 210;
  const xb = 300;
  // RC: dolná priepusť = R pozdĺžne, C priečne; RL: dolná priepusť = L pozdĺžne, R priečne.
  const series = type === 'rc' ? (kind === 'lp' ? 'resistor' : 'capacitor') : kind === 'lp' ? 'inductor' : 'resistor';
  const shunt = type === 'rc' ? (kind === 'lp' ? 'capacitor' : 'resistor') : kind === 'lp' ? 'resistor' : 'inductor';
  const lab = (k: string) => (k === 'resistor' ? 'R' : k === 'capacitor' ? 'C' : 'L');
  const title = `${kind === 'lp' ? 'Dolná' : 'Horná'} priepusť ${type.toUpperCase()}`;
  return schematic(340, 184, title,
    terminal([xa, top]), terminal([xa, bottom]),
    wire([xa + 3, top], [86, top]),
    comp(series as 'resistor', [86, top], [170, top], { label: lab(series) }),
    wire([170, top], [xb - 3, top]),
    comp(shunt as 'resistor', [xs, top], [xs, bottom], { label: lab(shunt), side: 'right' }),
    wire([xa + 3, bottom], [xb - 3, bottom]),
    dot([xs, top]), dot([xs, bottom]),
    terminal([xb, top]), terminal([xb, bottom]),
    voltageArrow([xa + 12, top + 14], [xa + 12, bottom - 14], 'U_1', 'right'),
    voltageArrow([xb - 12, top + 14], [xb - 12, bottom - 14], 'U_2', 'left'),
  );
}

const PH = [
  { y: 34, name: 'L1' },
  { y: 62, name: 'L2' },
  { y: 90, name: 'L3' },
];

function threePhaseLines(withN: boolean): SVGElement[] {
  const parts: SVGElement[] = [];
  for (const p of PH) {
    parts.push(terminal([40, p.y]), s('text', { x: 30, y: p.y + 5, 'text-anchor': 'end', class: 'note' }, p.name));
  }
  if (withN) parts.push(terminal([40, 118]), s('text', { x: 30, y: 123, 'text-anchor': 'end', class: 'note' }, 'N'));
  return parts;
}

/** Spotrebič zapojený do hviezdy so stredným vodičom. */
export function starLoadFigure(): SVGSVGElement {
  const xs = [150, 210, 270];
  const yStar = 216;
  const parts: SVGElement[] = [...threePhaseLines(true)];
  PH.forEach((p, i) => {
    parts.push(wire([43, p.y], [xs[i], p.y], [xs[i], 128]));
    parts.push(comp('resistor', [xs[i], 128], [xs[i], 196], { label: `Z_${i + 1}`, side: 'right' }));
    parts.push(wire([xs[i], 196], [xs[i], yStar]));
    parts.push(currentArrow([xs[i], 112], 'd', `I_${i + 1}`, 'left'));
  });
  parts.push(wire([150, yStar], [326, yStar]));
  parts.push(wire([43, 118], [110, 118], [110, 238], [326, 238], [326, yStar]));
  parts.push(dot([210, yStar]), dot([270, yStar]));
  parts.push(s('text', { x: 154, y: yStar + 15, class: 'val' }, 'uzol hviezdy'));
  parts.push(voltageArrow([70, 38], [70, 58], 'U', 'right'));
  parts.push(voltageArrow([70, 94], [70, 114], 'U_f', 'right'));
  return schematic(360, 256, 'Spotrebič zapojený do hviezdy (Y) so stredným vodičom N', ...parts);
}

/** Spotrebič zapojený do trojuholníka. */
export function deltaLoadFigure(): SVGSVGElement {
  const A: [number, number] = [262, 34];
  const B: [number, number] = [196, 168];
  const C: [number, number] = [328, 168];
  const parts: SVGElement[] = [...threePhaseLines(false)];
  parts.push(
    wire([43, 34], A),
    wire([43, 62], [176, 62], [176, 168], B),
    wire([43, 90], [150, 90], [150, 206], [348, 206], [348, 168], C),
    comp('resistor', A, B, { label: 'Z_12', side: 'left' }),
    comp('resistor', A, C, { label: 'Z_31', side: 'right' }),
    comp('resistor', B, C, { label: 'Z_23', side: 'below' }),
    dot(A), dot(B), dot(C),
    currentArrow([110, 34], 'r', 'I_1'),
    voltageArrow([70, 38], [70, 58], 'U', 'right'),
  );
  return schematic(380, 226, 'Spotrebič zapojený do trojuholníka (D)', ...parts);
}

/** Tri fázové napätia siete 230/400 V počas jednej periódy. */
export function threePhaseChart(): SVGSVGElement {
  const um = 230 * Math.SQRT2;
  const wave = (shift: number) => sample((t) => um * Math.sin(2 * Math.PI * 50 * (t / 1000) - shift), 0, 20, 160);
  return lineChart({
    ariaLabel: 'Tri fázové napätia L1, L2 a L3 posunuté o 120°',
    x: { min: 0, max: 20, ticks: [0, 5, 10, 15, 20], format: (v) => `${v}`, label: 't [ms]' },
    y: { min: -380, max: 380, ticks: [-325, 0, 325], format: (v) => (v === 0 ? '0' : `${v > 0 ? '' : '−'}325`), label: 'u [V]' },
    series: [
      { points: wave(0), className: 'l1' },
      { points: wave((2 * Math.PI) / 3), className: 'l2' },
      { points: wave((4 * Math.PI) / 3), className: 'l3' },
    ],
    legend: [{ label: 'L1', className: 'l1' }, { label: 'L2', className: 'l2' }, { label: 'L3', className: 'l3' }],
  });
}

/** Pekná os od nuly: horná hranica zaokrúhlená nahor na krok 1, 2, 2,5 alebo 5 · 10ⁿ (4 až 5 dielikov). */
export function niceScale(max: number): { max: number; ticks: number[] } {
  const raw = max / 4;
  const base = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * base).find((st) => st >= raw * 0.999) ?? 10 * base;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let k = 0; k * step <= top * (1 + 1e-9); k++) ticks.push(Number((k * step).toPrecision(12)));
  return { max: top, ticks };
}

/** Logaritmická os: hodnoty sa zadávajú ako log10, popisy sú 100 Hz, 1 kHz… */
export function logAxis(minExp: number, maxExp: number, unit: string, label: string): Axis {
  return { min: minExp, max: maxExp, ticks: logTicks(minExp, maxExp), format: (e) => logLabel(e, unit), label };
}

/**
 * Reaktancie cievky a kondenzátora a impedancia sériového obvodu RLC v závislosti od frekvencie
 * (obe osi logaritmické, v obrázku sú preto XL a XC priamky).
 */
export function reactanceChart(L: number, C: number, R: number, opts: { fMin?: number; fMax?: number } = {}): SVGSVGElement {
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const e0 = Math.log10(opts.fMin ?? f0 / 30);
  const e1 = Math.log10(opts.fMax ?? f0 * 30);
  const xl = (e: number) => Math.log10(2 * Math.PI * 10 ** e * L);
  const xc = (e: number) => Math.log10(1 / (2 * Math.PI * 10 ** e * C));
  const z = (e: number) => Math.log10(Math.hypot(R, 10 ** xl(e) - 10 ** xc(e)));
  const ys = [xl(e0), xl(e1), xc(e0), xc(e1), Math.log10(R)];
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const at0 = Math.log10(f0);
  return lineChart({
    ariaLabel: `Reaktancia cievky, kondenzátora a impedancia sériového obvodu RLC v závislosti od frekvencie; rezonancia pri ${logLabel(at0, 'Hz')}`,
    width: 460,
    height: 260,
    x: { min: e0, max: e1, ticks: logTicks(e0, e1), format: (e) => logLabel(e, 'Hz'), label: 'f (logaritmicky)' },
    y: logAxis(y0, y1, 'Ω', 'X, Z [Ω]'),
    series: [
      { points: sample(xl, e0, e1, 60), className: 'copper' },
      { points: sample(xc, e0, e1, 60), className: 'green' },
      { points: sample(z, e0, e1, 400) },
    ],
    vlines: [{ x: at0, label: 'f₀' }],
    legend: [{ label: 'X_L', className: 'copper' }, { label: 'X_C', className: 'green' }, { label: 'Z', className: '' }],
  });
}
