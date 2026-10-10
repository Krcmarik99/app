/**
 * Obrázky ku kapitole Elektroenergetika a bezpečnosť a k lekciám merania výkonu, mostíkových
 * metód a osciloskopu: reťazec od elektrárne k odberateľovi, sieťové sústavy, pásma účinkov
 * prúdu na človeka, prúdový chránič, triedy ochrany, slučka poruchy, vypínacie charakteristiky
 * ističov, zapojenie wattmetra, Aronovo zapojenie, Wheatstoneov mostík a obrazovka osciloskopu.
 */
import './fig-power.css';
import { s } from '../lib/dom';
import { fmt, formatSI } from '../lib/units';
import { arrowHead, comp, currentArrow, dot, qty, schematic, voltageArrow, wire, type Pt } from './schematic';

const r1 = (n: number) => Math.round(n * 10) / 10;

type Anchor = 'start' | 'middle' | 'end';

/** Obyčajný (vzpriamený) text v schéme s triedou, napr. „small“, „label“, „val“. */
function txt(x: number, y: number, text: string, cls = 'small', anchor: Anchor = 'middle'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls }, text);
}

/** Značka uzemnenia; (x, y) je bod pripojenia nad značkou. */
function ground(x: number, y: number): SVGGElement {
  return s('g', null,
    s('line', { x1: x, y1: y, x2: x, y2: y + 9, class: 'w' }),
    s('line', { x1: x - 11, y1: y + 9, x2: x + 11, y2: y + 9, class: 'w' }),
    s('line', { x1: x - 7, y1: y + 14, x2: x + 7, y2: y + 14, class: 'w' }),
    s('line', { x1: x - 3, y1: y + 19, x2: x + 3, y2: y + 19, class: 'w' }),
  );
}

/** Svislý vodič s „mostíkom“ cez vodorovný vodič, ktorý len kríži (bez spojenia). */
function hopPath(x: number, y1: number, y2: number, hops: number[], cls = 'w'): SVGPathElement {
  let d = `M${x} ${y1}`;
  for (const y of hops) d += `V${y - 6}A6 6 0 0 1 ${x} ${y + 6}`;
  d += `V${y2}`;
  return s('path', { d, class: cls });
}

// ---------------------------------------------------------------- farebné vodiče

export type Conductor = 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'PEN';

const COND_CLASS: Record<'L1' | 'L2' | 'L3' | 'N', string> = { L1: 'pw-l1', L2: 'pw-l2', L3: 'pw-l3', N: 'pw-n' };

/** Vodič v predpísanej farbe: L1 hnedá, L2 čierna, L3 sivá, N modrá, PE zelenožltá, PEN zelenožltá s modrými koncami. */
function cond(kind: Conductor, ...pts: Pt[]): SVGGElement {
  const points = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const line = (cls: string) => s('polyline', { points, class: `pw-c ${cls}` });
  if (kind !== 'PE' && kind !== 'PEN') return s('g', null, line(COND_CLASS[kind]));
  const g = s('g', null, line('pw-pe'), line('pw-pe-y'));
  if (kind === 'PEN') {
    const mark = (a: Pt, b: Pt) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const k = Math.min(14, len / 2) / len;
      return s('line', { x1: a[0], y1: a[1], x2: r1(a[0] + (b[0] - a[0]) * k), y2: r1(a[1] + (b[1] - a[1]) * k), class: 'pw-c pw-n' });
    };
    const n = pts.length;
    g.append(mark(pts[0], pts[1]), mark(pts[n - 1], pts[n - 2]));
  }
  return g;
}

/** Ukážka farieb vodičov s ich označením. */
export function conductorColorsFigure(): SVGSVGElement {
  const rows: [Conductor, string][] = [
    ['L1', 'fázový vodič L1 – hnedá'],
    ['L2', 'fázový vodič L2 – čierna'],
    ['L3', 'fázový vodič L3 – sivá'],
    ['N', 'stredný vodič N – modrá'],
    ['PE', 'ochranný vodič PE – zelenožltá'],
    ['PEN', 'vodič PEN – zelenožltá, modré konce'],
  ];
  const parts: SVGElement[] = [];
  rows.forEach(([k, label], i) => {
    const y = 26 + i * 30;
    parts.push(cond(k, [18, y], [118, y]), txt(132, y + 5, label, 'small', 'start'));
  });
  return schematic(360, 200, 'Farby vodičov: L1 hnedá, L2 čierna, L3 sivá, N modrá, PE zelenožltá, PEN zelenožltý s modrými koncami', ...parts);
}

// ---------------------------------------------------------------- reťazec výroba – prenos – rozvod

/** Cesta elektrickej energie od elektrárne k odberateľovi (zhora nadol). */
export function powerChainFigure(): SVGSVGElement {
  const x = 78;
  const step = 70;
  const y0 = 36;
  const ys = Array.from({ length: 6 }, (_, i) => y0 + i * step);
  const parts: SVGElement[] = [];
  const segs: { label: string; thick: boolean }[] = [
    { label: '', thick: false },
    { label: 'vedenia 400 kV a 220 kV', thick: true },
    { label: 'vedenia 110 kV', thick: true },
    { label: 'vedenia 22 kV (VN)', thick: false },
    { label: 'sieť NN 400/230 V', thick: false },
  ];
  // Spojovacie vedenia medzi značkami.
  for (let i = 0; i < 5; i++) {
    const a = ys[i] + (i === 0 ? 15 : 18);
    const b = ys[i + 1] - (i === 4 ? 14 : 18);
    parts.push(s('line', { x1: x, y1: a, x2: x, y2: b, class: segs[i].thick ? 'w thick' : 'w' }));
    if (segs[i].label) parts.push(txt(x + 22, (ys[i] + ys[i + 1]) / 2 + 9, segs[i].label, 'small trace', 'start'));
  }
  // Alternátor.
  parts.push(
    s('circle', { cx: x, cy: ys[0], r: 15, class: 'b' }),
    txt(x, ys[0] + 2, 'G', 'label'),
    s('path', { d: `M${x - 7} ${ys[0] + 8}c2.3 -4 4.7 -4 7 0s4.7 4 7 0`, class: 'w thin' }),
  );
  // Transformátory: dve prekrývajúce sa kružnice.
  for (let i = 1; i <= 4; i++) {
    parts.push(
      s('circle', { cx: x, cy: ys[i] - 7, r: 11, class: 'w', fill: 'none' }),
      s('circle', { cx: x, cy: ys[i] + 7, r: 11, class: 'w', fill: 'none' }),
    );
  }
  // Odberateľ – domček.
  const yh = ys[5];
  parts.push(s('path', { d: `M${x - 14} ${yh + 14}V${yh - 2}L${x} ${yh - 14}L${x + 14} ${yh - 2}V${yh + 14}Z`, class: 'b' }));
  const titles: [string, string][] = [
    ['Elektráreň – alternátor', 'napätie 6 až 24 kV, 50 Hz'],
    ['Blokový transformátor', 'zvýši napätie, napr. na 400 kV'],
    ['Rozvodňa 400/110 kV', 'koniec prenosovej sústavy'],
    ['Rozvodňa 110/22 kV', 'distribučná sústava'],
    ['Distribučný transformátor 22/0,4 kV', 'na stĺpe alebo v kioskovej stanici'],
    ['Odberateľ', 'domácnosti, firmy, verejné osvetlenie'],
  ];
  titles.forEach(([t, sub], i) => {
    parts.push(txt(x + 26, ys[i] - 3, t, 'label', 'start'), txt(x + 26, ys[i] + 13, sub, 'val', 'start'));
  });
  // Zátvorky vľavo: výroba, prenos, distribúcia, spotreba.
  const brackets: [number, number, string][] = [
    [ys[0] - 16, ys[1] + 18, 'výroba'],
    [ys[1] + 24, ys[2] + 18, 'prenos'],
    [ys[2] + 24, ys[4] + 18, 'distribúcia'],
    [ys[5] - 16, ys[5] + 16, 'spotreba'],
  ];
  for (const [a, b, label] of brackets) {
    const bx = 30;
    parts.push(
      s('path', { d: `M${bx + 6} ${a}H${bx}V${b}H${bx + 6}`, class: 'w thin ink2' }),
      s('text', { x: bx - 8, y: (a + b) / 2, 'text-anchor': 'middle', class: 'small', transform: `rotate(-90 ${bx - 8} ${(a + b) / 2})` }, label),
    );
  }
  const svg = schematic(390, ys[5] + 32, 'Cesta energie: alternátor, blokový transformátor, prenosová sústava 400 kV, rozvodne 400/110 kV a 110/22 kV, distribučný transformátor 22/0,4 kV a odberateľ', ...parts);
  svg.setAttribute('width', '390');
  return svg;
}

// ---------------------------------------------------------------- sieťové sústavy

export type NetworkKind = 'TN-C' | 'TN-S' | 'TN-C-S' | 'TT' | 'IT';

/**
 * Sieťová sústava NN: zdroj (sekundárne vinutie transformátora do hviezdy), vodiče a spotrebič
 * s kovovým krytom (neživou časťou) pripojeným na PE, PEN alebo na vlastný uzemňovač.
 */
export function networkFigure(kind: NetworkKind): SVGSVGElement {
  const rows = { L1: 46, L2: 70, L3: 94, N: 118, PE: 142 };
  const xs = 44;
  const xEnd = 336;
  const parts: SVGElement[] = [];
  const hasN = kind !== 'IT';
  // Vinutia zdroja (hviezda) a uzol hviezdy.
  for (const k of ['L1', 'L2', 'L3'] as const) {
    parts.push(comp('inductor', [xs, rows[k]], [xs + 40, rows[k]]));
    parts.push(cond(k, [xs + 40, rows[k]], [xEnd, rows[k]]));
    parts.push(txt(xEnd + 8, rows[k] + 5, k, 'label', 'start'));
  }
  parts.push(txt(xs + 20, 26, 'zdroj', 'small'));
  parts.push(wire([xs, rows.L1], [xs, hasN ? rows.N : rows.L3]));
  // Uzemnenie zdroja.
  const yg = 176;
  if (kind === 'IT') {
    parts.push(
      wire([xs, rows.L3], [xs, 118]),
      s('rect', { x: xs - 8, y: 118, width: 16, height: 30, class: 'b' }),
      txt(xs + 14, 138, 'Z', 'label', 'start'),
      s('line', { x1: xs, y1: 148, x2: xs, y2: yg, class: 'w dash' }),
      ground(xs, yg),
      txt(xs + 16, yg + 16, 'izolovaný zdroj alebo', 'small', 'start'),
      txt(xs + 16, yg + 32, 'uzemnený cez impedanciu', 'small', 'start'),
    );
  } else {
    parts.push(wire([xs, rows.N], [xs, yg]), ground(xs, yg), txt(xs + 16, yg + 16, 'uzemnenie zdroja', 'small', 'start'));
  }
  // Stredný, ochranný a PEN vodič.
  if (kind === 'TN-C') {
    parts.push(cond('PEN', [xs, rows.N], [xEnd, rows.N]), txt(xEnd + 8, rows.N + 5, 'PEN', 'label', 'start'));
  } else if (kind === 'TN-S') {
    parts.push(
      cond('N', [xs, rows.N], [xEnd, rows.N]), txt(xEnd + 8, rows.N + 5, 'N', 'label', 'start'),
      cond('PE', [xs, rows.PE], [xEnd, rows.PE]), txt(xEnd + 8, rows.PE + 5, 'PE', 'label', 'start'),
      dot([xs, rows.N]), dot([xs, rows.PE]),
    );
  } else if (kind === 'TN-C-S') {
    const xsplit = 158;
    parts.push(
      cond('PEN', [xs, rows.N], [xsplit, rows.N]),
      cond('N', [xsplit, rows.N], [xEnd, rows.N]), txt(xEnd + 8, rows.N + 5, 'N', 'label', 'start'),
      cond('PE', [xsplit, rows.N], [xsplit, rows.PE], [xEnd, rows.PE]), txt(xEnd + 8, rows.PE + 5, 'PE', 'label', 'start'),
      dot([xsplit, rows.N]),
      txt(105, rows.N - 7, 'PEN', 'label'),
      txt(xsplit, rows.PE + 22, 'rozdelenie PEN', 'small'),
    );
  } else if (kind === 'TT') {
    parts.push(cond('N', [xs, rows.N], [xEnd, rows.N]), txt(xEnd + 8, rows.N + 5, 'N', 'label', 'start'), dot([xs, rows.N]));
  }
  // Spotrebič s kovovým krytom.
  const bx = 212;
  const by = 172;
  const bw = 88;
  const bh = 50;
  const drops = [230, 254, 278];
  (['L1', 'L2', 'L3'] as const).forEach((k, i) => {
    parts.push(cond(k, [drops[i], rows[k]], [drops[i], by]), dot([drops[i], rows[k]]));
  });
  parts.push(
    s('rect', { x: bx, y: by, width: bw, height: bh, rx: 4, class: 'b' }),
    txt(bx + bw / 2, by + 22, 'spotrebič', 'small'),
    txt(bx + bw / 2, by + 38, 'kovový kryt', 'val'),
  );
  const yk = by + 26;
  if (kind === 'TN-C') {
    parts.push(cond('PE', [322, rows.N], [322, yk], [bx + bw, yk]), dot([322, rows.N]));
  } else if (kind === 'TN-S' || kind === 'TN-C-S') {
    parts.push(cond('PE', [322, rows.PE], [322, yk], [bx + bw, yk]), dot([322, rows.PE]));
  } else {
    parts.push(cond('PE', [bx + bw, yk], [322, yk], [322, 214]), ground(322, 214), txt(392, 252, 'uzemnenie neživých častí', 'small', 'end'));
  }
  parts.push(txt(392, 22, kind, 'label', 'end'));
  const desc: Record<NetworkKind, string> = {
    'TN-C': 'Sústava TN-C: uzol zdroja uzemnený, kryt spotrebiča pripojený na spoločný vodič PEN',
    'TN-S': 'Sústava TN-S: uzol zdroja uzemnený, samostatný stredný vodič N a ochranný vodič PE',
    'TN-C-S': 'Sústava TN-C-S: vodič PEN sa v rozvádzači rozdelí na N a PE, kryt spotrebiča je na PE',
    TT: 'Sústava TT: uzol zdroja uzemnený, kryt spotrebiča má vlastný uzemňovač',
    IT: 'Sústava IT: zdroj izolovaný od zeme alebo uzemnený cez impedanciu, kryt spotrebiča uzemnený',
  };
  return schematic(400, kind === 'TT' || kind === 'IT' ? 262 : 234, desc[kind], ...parts);
}

// ---------------------------------------------------------------- grafy s logaritmickými osami

interface PAxis {
  min: number;
  max: number;
  ticks: number[];
  format: (v: number) => string;
  label: string;
  log?: boolean;
}

interface Frame {
  svg: SVGSVGElement;
  sx: (v: number) => number;
  sy: (v: number) => number;
  clip: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

let clipCounter = 0;

/** Rám grafu v štýle lineChart (triedy .chart), osi môžu byť logaritmické. */
function frame(o: { width: number; height: number; ariaLabel: string; x: PAxis; y: PAxis }): Frame {
  const W = o.width;
  const H = o.height;
  const left = 56;
  const right = W - 28;
  const top = 22;
  const bottom = H - 44;
  const tx = (v: number) => (o.x.log ? Math.log10(v) : v);
  const ty = (v: number) => (o.y.log ? Math.log10(v) : v);
  const sx = (v: number) => left + ((tx(v) - tx(o.x.min)) / (tx(o.x.max) - tx(o.x.min))) * (right - left);
  const sy = (v: number) => bottom - ((ty(v) - ty(o.y.min)) / (ty(o.y.max) - ty(o.y.min))) * (bottom - top);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, class: 'chart pw-chart', role: 'img', 'aria-label': o.ariaLabel }, s('title', null, o.ariaLabel));
  const minor = (ax: PAxis) => {
    if (!ax.log) return [];
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(ax.min)); e < Math.ceil(Math.log10(ax.max)); e++) {
      for (let m = 2; m <= 9; m++) {
        const v = m * 10 ** e;
        if (v > ax.min && v < ax.max && !ax.ticks.some((t) => Math.abs(t - v) < v * 1e-9)) out.push(v);
      }
    }
    return out;
  };
  for (const v of minor(o.x)) svg.append(s('line', { x1: r1(sx(v)), x2: r1(sx(v)), y1: top, y2: bottom, class: 'grid pw-minor' }));
  for (const v of minor(o.y)) svg.append(s('line', { x1: left, x2: right, y1: r1(sy(v)), y2: r1(sy(v)), class: 'grid pw-minor' }));
  for (const t of o.y.ticks) {
    svg.append(
      s('line', { x1: left, x2: right, y1: r1(sy(t)), y2: r1(sy(t)), class: t === o.y.min ? 'axis' : 'grid' }),
      s('text', { x: left - 7, y: r1(sy(t) + 4), 'text-anchor': 'end', class: 'tick' }, o.y.format(t)),
    );
  }
  for (const t of o.x.ticks) {
    svg.append(
      s('line', { x1: r1(sx(t)), x2: r1(sx(t)), y1: top, y2: bottom, class: t === o.x.min ? 'axis' : 'grid' }),
      s('text', { x: r1(sx(t)), y: bottom + 17, 'text-anchor': 'middle', class: 'tick' }, o.x.format(t)),
    );
  }
  svg.append(
    s('line', { x1: left, x2: right, y1: bottom, y2: bottom, class: 'axis' }),
    s('line', { x1: left, x2: left, y1: top, y2: bottom, class: 'axis' }),
    s('text', { x: right, y: H - 6, 'text-anchor': 'end', class: 'axis-label' }, o.x.label),
    s('text', { x: 4, y: top - 8, class: 'axis-label' }, o.y.label),
  );
  const clip = `pwclip-${(clipCounter += 1)}`;
  svg.append(s('clipPath', { id: clip }, s('rect', { x: left, y: top, width: right - left, height: bottom - top })));
  return { svg, sx, sy, clip, left, right, top, bottom };
}

const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('');

/** Geometricky rovnomerné body od a po b (pre logaritmickú os). */
function logspace(a: number, b: number, n = 60): number[] {
  return Array.from({ length: n + 1 }, (_, i) => a * (b / a) ** (i / n));
}

// ---------------------------------------------------------------- pásma účinkov prúdu (IEC 60479-1, zjednodušene)

/** Krivka b (hranica AC-2/AC-3) – body [t ms, I mA], zjednodušene. */
const CURVE_B: [number, number][] = [[10, 200], [2000, 10], [10000, 10]];
/** Krivka c1 (začiatok pásma AC-4 – možnosť fibrilácie komôr) – body [t ms, I mA], zjednodušene. */
const CURVE_C1: [number, number][] = [[10, 500], [100, 400], [500, 100], [1000, 50], [3000, 40], [10000, 40]];

/** Prúd na krivke v čase t (interpolácia v logaritmických súradniciach). */
function curveAt(curve: [number, number][], t: number): number {
  if (t <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [t0, i0] = curve[i - 1];
    const [t1, i1] = curve[i];
    if (t <= t1) {
      const f = (Math.log10(t) - Math.log10(t0)) / (Math.log10(t1) - Math.log10(t0));
      return 10 ** (Math.log10(i0) + f * (Math.log10(i1) - Math.log10(i0)));
    }
  }
  return curve[curve.length - 1][1];
}

/** Pásmo účinkov AC-1 až AC-4 pre prúd (mA) a čas pôsobenia (ms). */
export function currentZone(iMa: number, tMs: number): 1 | 2 | 3 | 4 {
  if (iMa < 0.5) return 1;
  if (iMa < curveAt(CURVE_B, tMs)) return 2;
  if (iMa < curveAt(CURVE_C1, tMs)) return 3;
  return 4;
}

/**
 * Zjednodušené pásma účinkov striedavého prúdu 50 Hz na človeka (dráha ľavá ruka – nohy)
 * podľa IEC 60479-1. Voliteľne vyznačí bod (prúd, čas).
 */
export function currentZonesChart(point?: { iMa: number; tMs: number }): SVGSVGElement {
  const f = frame({
    width: 440,
    height: 300,
    ariaLabel: 'Pásma účinkov striedavého prúdu na človeka v závislosti od prúdu a času pôsobenia (zjednodušene podľa IEC 60479-1)',
    x: { min: 0.1, max: 10000, ticks: [0.1, 1, 10, 100, 1000, 10000], format: (v) => fmt(v), label: 'prúd telom I [mA]', log: true },
    y: { min: 10, max: 10000, ticks: [10, 100, 1000, 10000], format: (v) => fmt(v), label: 't [ms]', log: true },
  });
  const ts = logspace(10, 10000, 60);
  const P = (iMa: number, tMs: number): [number, number] => [f.sx(Math.min(10000, Math.max(0.1, iMa))), f.sy(tMs)];
  const bPts = ts.map((t) => P(curveAt(CURVE_B, t), t));
  const cPts = ts.map((t) => P(curveAt(CURVE_C1, t), t));
  const g = s('g', { 'clip-path': `url(#${f.clip})` });
  g.append(
    s('path', { d: `${pathOf([P(0.5, 10), P(0.5, 10000), ...[...bPts].reverse()])}Z`, class: 'pw-zone2' }),
    s('path', { d: `${pathOf([...bPts, ...[...cPts].reverse()])}Z`, class: 'pw-zone3' }),
    s('path', { d: `${pathOf([...cPts, P(10000, 10000), P(10000, 10)])}Z`, class: 'pw-zone4' }),
    s('line', { x1: r1(f.sx(30)), x2: r1(f.sx(30)), y1: f.top, y2: f.bottom, class: 'pw-rcd' }),
    s('line', { x1: r1(f.sx(0.5)), x2: r1(f.sx(0.5)), y1: f.top, y2: f.bottom, class: 'line thin' }),
    s('path', { d: pathOf(bPts), class: 'line thin' }),
    s('path', { d: pathOf(cPts), class: 'line red' }),
  );
  f.svg.append(g);
  const yTop = f.sy(6000);
  f.svg.append(
    s('text', { x: r1(f.sx(0.5) + 5), y: r1(yTop), class: 'pw-curve-label' }, 'a'),
    s('text', { x: r1(f.sx(10) + 5), y: r1(yTop), class: 'pw-curve-label' }, 'b'),
    s('text', { x: r1(f.sx(40) + 5), y: r1(yTop), class: 'pw-curve-label' }, 'c₁'),
    s('text', { x: r1(f.sx(30) - 4), y: r1(f.sy(14)), 'text-anchor': 'end', class: 'pw-rcd-label' }, '30 mA'),
    s('text', { x: r1(f.sx(0.22)), y: r1(f.sy(250)), 'text-anchor': 'middle', class: 'pw-zone-label' }, 'AC-1'),
    s('text', { x: r1(f.sx(3.2)), y: r1(f.sy(250)), 'text-anchor': 'middle', class: 'pw-zone-label' }, 'AC-2'),
    s('text', { x: r1(f.sx(70)), y: r1(f.sy(250)), 'text-anchor': 'middle', class: 'pw-zone-label' }, 'AC-3'),
    s('text', { x: r1(f.sx(1500)), y: r1(f.sy(250)), 'text-anchor': 'middle', class: 'pw-zone-label' }, 'AC-4'),
  );
  if (point) {
    const [px, py] = P(point.iMa, Math.min(10000, Math.max(10, point.tMs)));
    f.svg.append(
      s('line', { x1: r1(px), x2: r1(px), y1: r1(py), y2: f.bottom, class: 'drop' }),
      s('line', { x1: f.left, x2: r1(px), y1: r1(py), y2: r1(py), class: 'drop' }),
      s('circle', { cx: r1(px), cy: r1(py), r: 5, class: 'marker' }),
    );
  }
  return f.svg;
}

// ---------------------------------------------------------------- vypínacie charakteristiky ističov

export type TripChar = 'B' | 'C' | 'D';

/** Pásmo elektromagnetickej spúšte v násobkoch In (STN EN 60898-1). */
export const MAGNETIC: Record<TripChar, [number, number]> = { B: [3, 5], C: [5, 10], D: [10, 20] };

/*
 * Tepelná spúšť – zjednodušené hranice pásma t = C / (k² − a²) v sekundách, zvolené tak, aby
 * platili body normy: pri 1,13 In nevypne do 1 h, pri 1,45 In vypne do 1 h, pri 2,55 In vypne za 1 s až 60 s.
 */
const A2_MAX = (60 * 2.55 ** 2 - 3600 * 1.45 ** 2) / (60 - 3600);
const C_MAX = 60 * (2.55 ** 2 - A2_MAX);
const A2_MIN = (1 * 2.55 ** 2 - 3600 * 1.13 ** 2) / (1 - 3600);
const C_MIN = 1 * (2.55 ** 2 - A2_MIN);

/** Najdlhší čas vypnutia tepelnou spúšťou (s); Infinity, ak istič nemusí vypnúť vôbec. */
export function thermalMax(k: number): number {
  return k * k <= A2_MAX ? Infinity : C_MAX / (k * k - A2_MAX);
}

/** Najkratší čas vypnutia tepelnou spúšťou (s); Infinity pod dohovoreným nevypínacím prúdom. */
export function thermalMin(k: number): number {
  return k * k <= A2_MIN ? Infinity : C_MIN / (k * k - A2_MIN);
}

const T_TOP = 10000;
const T_BOTTOM = 0.01;
const kAt = (c: number, a2: number, t: number) => Math.sqrt(a2 + c / t);

/** Obrys pásma vypínacej charakteristiky (body [k, t]). */
function bandPoints(ch: TripChar): [number, number][] {
  const [m1, m2] = MAGNETIC[ch];
  const kTopMax = kAt(C_MAX, A2_MAX, T_TOP);
  const kTopMin = kAt(C_MIN, A2_MIN, T_TOP);
  const upper = logspace(kTopMax, m2, 50).map((k): [number, number] => [k, thermalMax(k)]);
  const lower = logspace(m1, kTopMin, 50).map((k): [number, number] => [k, thermalMin(k)]);
  return [...upper, [m2, T_BOTTOM], [m1, T_BOTTOM], ...lower];
}

const TRIP_X_TICKS = [1, 2, 3, 5, 10, 20, 50, 100];

function tripFrame(ariaLabel: string): Frame {
  return frame({
    width: 440,
    height: 310,
    ariaLabel,
    x: { min: 1, max: 100, ticks: TRIP_X_TICKS, format: (v) => fmt(v), label: 'násobok menovitého prúdu I / Iₙ', log: true },
    y: { min: T_BOTTOM, max: T_TOP, ticks: [0.01, 0.1, 1, 10, 100, 1000, 10000], format: (v) => fmt(v), label: 't [s]', log: true },
  });
}

/** Vypínacie charakteristiky ističov B, C a D v jednom grafe. */
export function tripCurvesChart(): SVGSVGElement {
  const f = tripFrame('Vypínacie charakteristiky ističov B, C a D: spoločné pásmo tepelnej spúšte a pásma elektromagnetickej spúšte 3–5, 5–10 a 10–20 násobku In');
  const P = ([k, t]: [number, number]): [number, number] => [f.sx(k), f.sy(t)];
  const g = s('g', { 'clip-path': `url(#${f.clip})` });
  const kTopMax = kAt(C_MAX, A2_MAX, T_TOP);
  const kTopMin = kAt(C_MIN, A2_MIN, T_TOP);
  const upper = logspace(kTopMax, 20, 60).map((k): [number, number] => [k, thermalMax(k)]);
  const lower = logspace(kTopMin, 20, 60).map((k): [number, number] => [k, thermalMin(k)]);
  g.append(s('path', { d: `${pathOf([...upper, ...[...lower].reverse()].map(P))}Z`, class: 'pw-thermal' }));
  for (const ch of ['B', 'C', 'D'] as TripChar[]) {
    const [m1, m2] = MAGNETIC[ch];
    const top = logspace(m1, m2, 20).map((k): [number, number] => [k, thermalMax(k)]);
    const cls = ch.toLowerCase();
    g.append(
      s('path', { d: `${pathOf([[m1, T_BOTTOM], ...top, [m2, T_BOTTOM]].map((p) => P(p as [number, number])))}Z`, class: `pw-band pw-band-${cls}`, 'stroke-width': 0 }),
      s('line', { x1: r1(f.sx(m1)), x2: r1(f.sx(m1)), y1: r1(f.sy(thermalMin(m1))), y2: f.bottom, class: `pw-edge-${cls}` }),
      s('line', { x1: r1(f.sx(m2)), x2: r1(f.sx(m2)), y1: r1(f.sy(thermalMax(m2))), y2: f.bottom, class: `pw-edge-${cls}` }),
    );
  }
  g.append(
    s('path', { d: pathOf(upper.map(P)), class: 'line thin' }),
    s('path', { d: pathOf(lower.map(P)), class: 'line thin dashed' }),
  );
  f.svg.append(g);
  for (const ch of ['B', 'C', 'D'] as TripChar[]) {
    const [m1, m2] = MAGNETIC[ch];
    f.svg.append(s('text', { x: r1(f.sx(Math.sqrt(m1 * m2))), y: r1(f.sy(0.025)), 'text-anchor': 'middle', class: `pw-letter-${ch.toLowerCase()}` }, ch));
  }
  f.svg.append(
    s('text', { x: r1(f.sx(2.2)), y: r1(f.sy(400)), 'text-anchor': 'start', class: 'pw-note' }, 'tepelná spúšť (preťaženie)'),
    s('text', { x: r1(f.sx(22)), y: r1(f.sy(0.3)), 'text-anchor': 'start', class: 'pw-note' }, 'elektromagnetická'),
    s('text', { x: r1(f.sx(22)), y: r1(f.sy(0.3)) + 15, 'text-anchor': 'start', class: 'pw-note' }, 'spúšť (skrat)'),
  );
  return f.svg;
}

/** Vypínacia charakteristika jedného ističa; pri zadanom násobku k vyznačí rozsah možných časov vypnutia. */
export function tripChart(ch: TripChar, k?: number, range?: [number, number]): SVGSVGElement {
  const f = tripFrame(`Vypínacia charakteristika ističa ${ch}`);
  const P = ([kk, t]: [number, number]): [number, number] => [f.sx(kk), f.sy(t)];
  const cls = ch.toLowerCase();
  const g = s('g', { 'clip-path': `url(#${f.clip})` });
  g.append(s('path', { d: `${pathOf(bandPoints(ch).map(P))}Z`, class: `pw-band pw-band-${cls}` }));
  f.svg.append(g);
  const m2 = MAGNETIC[ch][1];
  f.svg.append(s('text', { x: r1(f.sx(m2) + 6), y: r1(f.sy(0.02)), 'text-anchor': 'start', class: `pw-letter-${cls}` }, ch));
  if (k !== undefined) {
    const x = r1(f.sx(Math.min(100, Math.max(1, k))));
    f.svg.append(s('line', { x1: x, x2: x, y1: f.top, y2: f.bottom, class: 'drop' }));
    if (range) {
      const [a, b] = range;
      const ya = r1(f.sy(Math.max(T_BOTTOM, Math.min(T_TOP, a))));
      const yb = r1(f.sy(Math.max(T_BOTTOM, Math.min(T_TOP, b))));
      f.svg.append(s('line', { x1: x, x2: x, y1: ya, y2: yb, class: 'pw-range' }));
    }
  }
  return f.svg;
}

// ---------------------------------------------------------------- ochrana pred úrazom

/** Princíp prúdového chrániča: súčtový transformátor prúdu, vinutie, spúšť a kontakty. */
export function rcdFigure(): SVGSVGElement {
  const yL = 56;
  const yN = 100;
  const xt = 180;
  const parts: SVGElement[] = [
    txt(16, yL + 5, 'L', 'label', 'middle'),
    txt(16, yN + 5, 'N', 'label', 'middle'),
    s('ellipse', { cx: xt, cy: (yL + yN) / 2, rx: 13, ry: 42, class: 'core' }),
    wire([26, yL], [96, yL]),
    comp('switch', [96, yL], [126, yL]),
    wire([126, yL], [262, yL]),
    wire([26, yN], [96, yN]),
    comp('switch', [96, yN], [126, yN]),
    wire([126, yN], [262, yN]),
    txt(xt, 22, 'súčtový transformátor', 'small'),
    txt(46, (yL + yN) / 2 + 4, 'kontakty', 'small', 'start'),
    // Snímacie vinutie a spúšť.
    wire([xt, (yL + yN) / 2 + 42], [xt, 150]),
    comp('inductor', [xt, 150], [xt, 190]),
    wire([xt, 190], [xt, 206], [146, 206]),
    s('rect', { x: 74, y: 192, width: 72, height: 28, rx: 3, class: 'b' }),
    txt(110, 211, 'spúšť', 'small'),
    txt(xt + 12, 176, 'vinutie', 'small', 'start'),
    s('line', { x1: 110, y1: 192, x2: 110, y2: 46, class: 'w dash thin ink2' }),
    // Spotrebič s poruchou a ochranný vodič.
    s('rect', { x: 262, y: 34, width: 96, height: 92, rx: 4, class: 'b' }),
    comp('resistor', [290, yL], [290, yN]),
    wire([262, yL], [290, yL]),
    wire([262, yN], [290, yN]),
    wire([290, yL], [320, yL]),
    s('polyline', { points: `320,${yL} 330,${yL + 10} 324,${yL + 14} 336,${yL + 24} 330,${yL + 28} 358,${yL + 34}`, class: 'w bad' }),
    txt(310, 116, 'porucha', 'small bad', 'middle'),
    cond('PE', [340, 126], [340, 168]),
    ground(340, 168),
    txt(352, 152, 'PE', 'label', 'start'),
    currentArrow([226, yL], 'r', 'I_L'),
    currentArrow([226, yN], 'l', 'I_N', 'below'),
    currentArrow([340, 140], 'd', 'I_Δ', 'left'),
  ];
  return schematic(400, 232, 'Prúdový chránič: vodiče L a N prechádzajú súčtovým transformátorom; pri poruche časť prúdu tečie cez PE a spúšť rozopne kontakty', ...parts);
}

/** Značky tried ochrany spotrebičov 0, I, II a III. */
export function protectionClassFigure(): SVGSVGElement {
  const cy = 52;
  const cols = [56, 162, 268, 374];
  const parts: SVGElement[] = [];
  // Trieda 0 – bez značky.
  parts.push(txt(cols[0], cy - 2, 'bez', 'small pw-muted'), txt(cols[0], cy + 14, 'značky', 'small'));
  // Trieda I – ochranné uzemnenie (kružnica so značkou uzemnenia).
  const x1 = cols[1];
  parts.push(
    s('circle', { cx: x1, cy, r: 24, class: 'w', fill: 'none' }),
    s('line', { x1, y1: cy - 15, x2: x1, y2: cy + 2, class: 'w' }),
    s('line', { x1: x1 - 13, y1: cy + 2, x2: x1 + 13, y2: cy + 2, class: 'w' }),
    s('line', { x1: x1 - 8.5, y1: cy + 8, x2: x1 + 8.5, y2: cy + 8, class: 'w' }),
    s('line', { x1: x1 - 4, y1: cy + 14, x2: x1 + 4, y2: cy + 14, class: 'w' }),
  );
  // Trieda II – dva sústredné štvorce.
  const x2 = cols[2];
  parts.push(
    s('rect', { x: x2 - 23, y: cy - 23, width: 46, height: 46, class: 'w', fill: 'none' }),
    s('rect', { x: x2 - 13, y: cy - 13, width: 26, height: 26, class: 'w', fill: 'none' }),
  );
  // Trieda III – kosoštvorec s rímskou trojkou.
  const x3 = cols[3];
  parts.push(
    s('path', { d: `M${x3} ${cy - 28}L${x3 + 28} ${cy}L${x3} ${cy + 28}L${x3 - 28} ${cy}Z`, class: 'w', fill: 'none' }),
    txt(x3, cy + 6, 'III', 'label'),
  );
  ['trieda 0', 'trieda I', 'trieda II', 'trieda III'].forEach((t, i) => parts.push(txt(cols[i], 112, t, 'label')));
  return schematic(430, 126, 'Značky tried ochrany: trieda 0 bez značky, trieda I ochranná svorka, trieda II dvojitý štvorec, trieda III kosoštvorec s III', ...parts);
}

/** Slučka poruchového prúdu v sieti TN-C-S: zdroj, fázový vodič, porucha na kryte, PE a PEN späť k zdroju. */
export function faultLoopFigure(): SVGSVGElement {
  const yL = 50;
  const yR = 192;
  const xs = 50;
  const xsplit = 200;
  const parts: SVGElement[] = [
    txt(xs, 32, 'zdroj', 'small'),
    wire([xs, yL], [xs, 70]),
    comp('inductor', [xs, 70], [xs, 150]),
    wire([xs, 150], [xs, yR]),
    voltageArrow([74, 72], [74, 168], 'U_0', 'right'),
    cond('L1', [xs, yL], [110, yL]),
    s('rect', { x: 110, y: yL - 9, width: 40, height: 18, rx: 2, class: 'b' }),
    s('line', { x1: 110, y1: yL, x2: 150, y2: yL, class: 'w thin' }),
    txt(130, yL - 16, 'istič / poistka', 'small'),
    cond('L1', [150, yL], [330, yL], [330, 98]),
    txt(240, yL - 9, 'L', 'label'),
    currentArrow([196, yL], 'r', 'I_k', 'below'),
    s('rect', { x: 248, y: 78, width: 122, height: 64, rx: 4, class: 'b' }),
    cond('L1', [330, 74], [330, 98]),
    s('polyline', { points: '330,98 342,106 336,111 350,118 344,123 370,130', class: 'w bad' }),
    txt(290, 106, 'kovový kryt', 'small'),
    txt(290, 122, '(trieda I)', 'val'),
    txt(308, 164, 'porucha', 'small bad', 'start'),
    cond('PE', [300, 142], [300, yR], [xsplit, yR]),
    cond('PEN', [xsplit, yR], [xs, yR]),
    dot([xsplit, yR]),
    txt(250, yR - 8, 'PE', 'label'),
    txt(150, yR - 8, 'PEN', 'label'),
    txt(xsplit, yR + 24, 'rozvádzač', 'small'),
    currentArrow([300, 166], 'd'),
    currentArrow([110, yR], 'l'),
    ground(xs, yR),
  ];
  return schematic(400, 232, 'Slučka poruchy v sieti TN-C-S: zdroj, fázový vodič, porucha izolácie na kryte, ochranný vodič PE a PEN späť k uzlu zdroja', ...parts);
}

// ---------------------------------------------------------------- meranie výkonu

/** Wattmeter: kružnica s W, prúdová cievka v sérii, napäťová paralelne; začiatky vinutí označené hviezdičkou. */
function wattmeter(x: number, y: number, label?: string): SVGElement[] {
  const r = 16;
  return [
    s('circle', { cx: x, cy: y, r, class: 'b' }),
    txt(x, y + 5, 'W', 'label'),
    // Napäťová cievka – začiatok (hore) pripojený na stranu zdroja pred prúdovou cievkou.
    wire([x, y - r], [x, y - r - 10], [x - 32, y - r - 10], [x - 32, y]),
    dot([x - 32, y]),
    txt(x - 22, y - 5, '*', 'label'),
    txt(x + 6, y - r - 14, '*', 'label', 'start'),
    ...(label ? [qty(x + r + 6, y - 8, label, 'start')] : []),
  ];
}

/** Zapojenie wattmetra v jednofázovom obvode s kontrolným ampérmetrom a voltmetrom. */
export function wattmeterFigure(): SVGSVGElement {
  const top = 56;
  const bottom = 176;
  const xw = 204;
  return schematic(420, 200, 'Zapojenie wattmetra: prúdová cievka do série so spotrebičom, napäťová cievka paralelne, ampérmeter a voltmeter kontrolujú prúd a napätie',
    comp('acsource', [40, top], [40, bottom], { label: 'U', side: 'left' }),
    wire([40, top], [82, top]),
    comp('ammeter', [82, top], [124, top]),
    wire([124, top], [xw - 16, top]),
    ...wattmeter(xw, top),
    wire([xw + 16, top], [384, top]),
    wire([xw, top + 16], [xw, bottom]),
    txt(xw + 10, 128, 'napäťová cievka', 'small', 'start'),
    txt(xw + 22, top + 22, 'prúdová cievka', 'small', 'start'),
    currentArrow([270, top], 'r', 'I'),
    comp('voltmeter', [334, top], [334, bottom]),
    comp('resistor', [384, top], [384, bottom], { label: 'Z', side: 'left' }),
    wire([40, bottom], [384, bottom]),
    dot([xw, bottom]), dot([334, top]), dot([334, bottom]),
  );
}

/** Aronovo zapojenie dvoch wattmetrov v trojvodičovej sústave. */
export function aronFigure(): SVGSVGElement {
  const y = { L1: 56, L2: 120, L3: 184 };
  const xl = 330;
  return schematic(420, 210, 'Aronovo zapojenie: wattmeter W1 má prúdovú cievku vo vodiči L1 a napäťovú medzi L1 a L3, W2 prúdovú v L2 a napäťovú medzi L2 a L3',
    txt(30, y.L1 + 5, 'L1', 'label', 'end'),
    txt(30, y.L2 + 5, 'L2', 'label', 'end'),
    txt(30, y.L3 + 5, 'L3', 'label', 'end'),
    wire([36, y.L1], [134, y.L1]),
    ...wattmeter(150, y.L1, 'P_1'),
    wire([166, y.L1], [xl, y.L1]),
    wire([36, y.L2], [234, y.L2]),
    ...wattmeter(250, y.L2, 'P_2'),
    wire([266, y.L2], [xl, y.L2]),
    wire([36, y.L3], [xl, y.L3]),
    hopPath(150, y.L1 + 16, y.L3, [y.L2]),
    wire([250, y.L2 + 16], [250, y.L3]),
    dot([150, y.L3]), dot([250, y.L3]),
    currentArrow([308, y.L1], 'r', 'I_1'),
    currentArrow([308, y.L2], 'r', 'I_2'),
    currentArrow([308, y.L3], 'r', 'I_3'),
    s('rect', { x: xl, y: 34, width: 74, height: 172, rx: 4, class: 'b' }),
    txt(xl + 37, 116, 'trojfázový', 'small'),
    txt(xl + 37, 132, 'spotrebič', 'small'),
  );
}

// ---------------------------------------------------------------- mostík

/**
 * Wheatstoneov mostík: R1 (neznámy Rx) hore vľavo, R2 hore vpravo, R3 dole vľavo, R4 dole vpravo,
 * zdroj U0 medzi uzlami A a C, nulový indikátor NI medzi uzlami B a D.
 */
export function bridgeFigure(labels: { r1?: string; r2?: string; r3?: string; r4?: string } = {}): SVGSVGElement {
  const A: Pt = [210, 40];
  const B: Pt = [130, 120];
  const C: Pt = [210, 200];
  const D: Pt = [290, 120];
  const cx = 210;
  return schematic(360, 236, 'Wheatstoneov mostík: R1 a R3 v ľavej vetve, R2 a R4 v pravej vetve, nulový indikátor medzi uzlami B a D, zdroj U0 medzi uzlami A a C',
    comp('resistor', A, B),
    comp('resistor', A, D),
    comp('resistor', B, C),
    comp('resistor', D, C),
    qty(158, 72, 'R_1', 'end'),
    ...(labels.r1 ? [s('text', { x: 136, y: 71, 'text-anchor': 'end', class: 'val' }, labels.r1)] : []),
    qty(262, 72, 'R_2', 'start'),
    ...(labels.r2 ? [s('text', { x: 284, y: 71, 'text-anchor': 'start', class: 'val' }, labels.r2)] : []),
    qty(158, 182, 'R_3', 'end'),
    ...(labels.r3 ? [s('text', { x: 140, y: 196, 'text-anchor': 'end', class: 'val' }, labels.r3)] : []),
    qty(262, 182, 'R_4', 'start'),
    ...(labels.r4 ? [s('text', { x: 280, y: 196, 'text-anchor': 'start', class: 'val' }, labels.r4)] : []),
    wire(B, [cx - 12, 120]),
    wire([cx + 12, 120], D),
    s('circle', { cx, cy: 120, r: 12, class: 'b' }),
    s('line', { x1: cx - 6, y1: 127, x2: cx + 4, y2: 113, class: 'w thin' }),
    arrowHead(cx + 6, 110.5, -54, 3.4),
    txt(cx, 147, 'NI', 'label'),
    txt(B[0] - 8, B[1] + 5, 'B', 'small pw-muted', 'end'),
    txt(D[0] + 8, D[1] + 5, 'D', 'small pw-muted', 'start'),
    txt(A[0] + 9, A[1] - 6, 'A', 'small pw-muted', 'start'),
    txt(C[0] + 9, C[1] + 14, 'C', 'small pw-muted', 'start'),
    wire(A, [210, 20], [50, 20], [50, 92]),
    comp('battery', [50, 92], [50, 148], { label: 'U_0', side: 'left' }),
    wire([50, 148], [50, 220], [210, 220], C),
    dot(A), dot(B), dot(C), dot(D),
  );
}

// ---------------------------------------------------------------- osciloskop

export interface ScopeOptions {
  /** Citlivosť vertikálneho vychyľovania kanála 1 [V/dielik]. */
  voltsPerDiv: number;
  /** Časová základňa [s/dielik]. */
  timePerDiv: number;
  /** Amplitúda kanála 1 v dielikoch (od stredu k vrcholu). */
  amplitudeDiv: number;
  /** Perióda v dielikoch. */
  periodDiv: number;
  /** Posun začiatku kanála 1 v dielikoch (oneskorenie). */
  phaseDiv?: number;
  /** Druhý kanál s rovnakou periódou. */
  second?: { amplitudeDiv: number; voltsPerDiv?: number; phaseDiv?: number };
  /** Delič sondy (1 alebo 10); pri 10 sa na obrazovke vypíše „sonda 10:1“. */
  probe?: number;
}

const DIV = 30;

/** Obrazovka osciloskopu: mriežka 10 × 8 dielikov, sínusový priebeh a nastavenie V/dielik a čas/dielik. */
export function scopeScreen(o: ScopeOptions): SVGSVGElement {
  const X0 = 16;
  const Y0 = 10;
  const W = 10 * DIV;
  const H = 8 * DIV;
  const cy = Y0 + H / 2;
  const parts: SVGElement[] = [s('rect', { x: X0, y: Y0, width: W, height: H, rx: 4, class: 'pw-screen' })];
  for (let i = 1; i < 10; i++) {
    parts.push(s('line', { x1: X0 + i * DIV, x2: X0 + i * DIV, y1: Y0, y2: Y0 + H, class: i === 5 ? 'pw-axis' : 'pw-grid' }));
  }
  for (let j = 1; j < 8; j++) {
    parts.push(s('line', { x1: X0, x2: X0 + W, y1: Y0 + j * DIV, y2: Y0 + j * DIV, class: j === 4 ? 'pw-axis' : 'pw-grid' }));
  }
  // Jemné delenie stredných osí po 0,2 dielika.
  for (let i = 1; i < 50; i++) {
    if (i % 5 === 0) continue;
    const x = X0 + (i * DIV) / 5;
    parts.push(s('line', { x1: x, x2: x, y1: cy - 3, y2: cy + 3, class: 'pw-axis' }));
  }
  for (let j = 1; j < 40; j++) {
    if (j % 5 === 0) continue;
    const y = Y0 + (j * DIV) / 5;
    parts.push(s('line', { x1: X0 + W / 2 - 3, x2: X0 + W / 2 + 3, y1: y, y2: y, class: 'pw-axis' }));
  }
  const clip = `pwscope-${(clipCounter += 1)}`;
  parts.push(s('clipPath', { id: clip }, s('rect', { x: X0, y: Y0, width: W, height: H })));
  const trace = (amp: number, ph: number, cls: string) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const xd = (10 * i) / 400;
      const yd = amp * Math.sin((2 * Math.PI * (xd - ph)) / o.periodDiv);
      pts.push([X0 + xd * DIV, cy - Math.max(-4.3, Math.min(4.3, yd)) * DIV]);
    }
    return s('path', { d: pathOf(pts), class: cls, 'clip-path': `url(#${clip})` });
  };
  if (o.second) parts.push(trace(o.second.amplitudeDiv, o.second.phaseDiv ?? 0, 'pw-ch2'));
  parts.push(trace(o.amplitudeDiv, o.phaseDiv ?? 0, 'pw-ch1'));
  const probe = o.probe && o.probe !== 1 ? `, sonda ${o.probe}:1` : '';
  const ly = Y0 + H + 22;
  parts.push(
    txt(X0, ly, `CH1: ${formatSI(o.voltsPerDiv, 'V', 3)}/dielik${probe}`, 'label copper', 'start'),
    txt(X0 + W, ly, `${formatSI(o.timePerDiv, 's', 3)}/dielik`, 'label', 'end'),
  );
  if (o.second) {
    parts.push(txt(X0, ly + 18, `CH2: ${formatSI(o.second.voltsPerDiv ?? o.voltsPerDiv, 'V', 3)}/dielik${probe}`, 'label trace', 'start'));
  }
  const total = Y0 + H + (o.second ? 50 : 32);
  const desc = `Obrazovka osciloskopu 10 × 8 dielikov: ${formatSI(o.voltsPerDiv, 'V', 3)}/dielik, ${formatSI(o.timePerDiv, 's', 3)}/dielik${o.second ? ', dva kanály' : ''}`;
  return schematic(W + 2 * X0, total, desc, ...parts);
}

/** Lissajousov obrazec v režime XY: x = sin(fx·t), y = sin(fy·t + φ). */
export function lissajousFigure(fx: number, fy: number, phaseDeg: number): SVGSVGElement {
  const X0 = 12;
  const Y0 = 10;
  const S = 8 * 24;
  const c = S / 2;
  const parts: SVGElement[] = [s('rect', { x: X0, y: Y0, width: S, height: S, rx: 4, class: 'pw-screen' })];
  for (let i = 1; i < 8; i++) {
    parts.push(
      s('line', { x1: X0 + i * 24, x2: X0 + i * 24, y1: Y0, y2: Y0 + S, class: i === 4 ? 'pw-axis' : 'pw-grid' }),
      s('line', { x1: X0, x2: X0 + S, y1: Y0 + i * 24, y2: Y0 + i * 24, class: i === 4 ? 'pw-axis' : 'pw-grid' }),
    );
  }
  const ph = (phaseDeg * Math.PI) / 180;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 800; i++) {
    const t = (2 * Math.PI * i) / 800;
    pts.push([X0 + c + 3.4 * 24 * Math.sin(fx * t), Y0 + c - 3.4 * 24 * Math.sin(fy * t + ph)]);
  }
  parts.push(s('path', { d: `${pathOf(pts)}Z`, class: 'pw-ch1' }));
  return schematic(S + 2 * X0, S + 2 * Y0, 'Lissajousov obrazec na obrazovke osciloskopu v režime XY', ...parts);
}

/** Elipsa v režime XY pri rovnakých frekvenciách: vyznačí úseky 2Y0 (priesečníky s osou y) a 2Ym (celková výška). */
export function ellipseFigure(phaseDeg: number): SVGSVGElement {
  const svg = lissajousFigure(1, 1, phaseDeg);
  const X0 = 12;
  const Y0 = 10;
  const S = 192;
  const c = S / 2;
  const a = 3.4 * 24;
  const ph = (phaseDeg * Math.PI) / 180;
  const y0 = a * Math.sin(ph);
  // Najvyšší bod elipsy: sin(t + φ) = 1, t = 90° − φ.
  const xTop = a * Math.cos(ph);
  const W = X0 + S + 96;
  const H = S + 2 * Y0;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(Math.round(W * 1.25)));
  const d1 = X0 + S + 16;
  const d2 = X0 + S + 54;
  const yA = Y0 + c - y0;
  const yB = Y0 + c + y0;
  const yT = Y0 + c - a;
  const yU = Y0 + c + a;
  const tick = (x: number, y: number) => s('line', { x1: x - 5, x2: x + 5, y1: r1(y), y2: r1(y), class: 'pw-dim' });
  svg.append(
    s('circle', { cx: X0 + c, cy: r1(yA), r: 3.2, class: 'pw-dim', fill: 'currentColor' }),
    s('circle', { cx: X0 + c, cy: r1(yB), r: 3.2, class: 'pw-dim', fill: 'currentColor' }),
    s('line', { x1: X0 + c, x2: d1, y1: r1(yA), y2: r1(yA), class: 'pw-dim', 'stroke-dasharray': '3 3' }),
    s('line', { x1: X0 + c, x2: d1, y1: r1(yB), y2: r1(yB), class: 'pw-dim', 'stroke-dasharray': '3 3' }),
    s('line', { x1: d1, x2: d1, y1: r1(yA), y2: r1(yB), class: 'pw-dim' }), tick(d1, yA), tick(d1, yB),
    s('text', { x: d1 + 6, y: r1(Y0 + c + 4), class: 'pw-dim-text' }, '2Y₀'),
    s('line', { x1: r1(X0 + c + xTop), x2: d2, y1: r1(yT), y2: r1(yT), class: 'pw-dim', 'stroke-dasharray': '3 3' }),
    s('line', { x1: r1(X0 + c - xTop), x2: d2, y1: r1(yU), y2: r1(yU), class: 'pw-dim', 'stroke-dasharray': '3 3' }),
    s('line', { x1: d2, x2: d2, y1: r1(yT), y2: r1(yU), class: 'pw-dim' }), tick(d2, yT), tick(d2, yU),
    s('text', { x: d2 + 6, y: r1(Y0 + c + 4), class: 'pw-dim-text' }, '2Yₘ'),
  );
  return svg;
}
