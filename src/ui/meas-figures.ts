/**
 * Obrázky ku kapitole Elektrotechnické merania: stupnica analógového prístroja,
 * displej číslicového prístroja, zapojenia meracích metód a grafy chýb.
 */
import { s } from '../lib/dom';
import { fmt } from '../lib/units';
import { lineChart, sample } from './chart';
import {
  comp, currentArrow, dashedWire, dot, note, qty, schematic, terminal, valueText, voltageArrow, wire,
} from './schematic';

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- analógová stupnica

export interface ScaleOptions {
  /** Počet dielikov celej stupnice (αmax). */
  divisions: number;
  /** Výchylka ručičky v dielikoch. */
  alpha: number;
  /** Značka prístroja na číselníku, napr. „V“, „mA“. */
  symbol?: string;
  /** Text merací rozsah, napr. „MR = 30 V“. */
  range?: string;
  /** Trieda presnosti vytlačená na číselníku, napr. „1,5“. */
  accuracyClass?: string;
}

/**
 * Číselník analógového meracieho prístroja so stupnicou v dielikoch a ručičkou.
 * Študent z neho odčíta výchylku α a z konštanty K vypočíta nameranú hodnotu.
 */
export function analogScale(o: ScaleOptions): SVGSVGElement {
  const W = 360;
  const H = 214;
  const cx = W / 2;
  const cy = 196;
  const r = 158;
  const sweep = 48;
  const angle = (d: number) => ((-sweep + (2 * sweep * d) / o.divisions) * Math.PI) / 180;
  const pt = (d: number, rad: number): [number, number] => [cx + rad * Math.sin(angle(d)), cy - rad * Math.cos(angle(d))];

  const arcLen = (r * 2 * sweep * Math.PI) / 180;
  const perDiv = arcLen / o.divisions;
  const minor = [1, 2, 5, 10, 20].find((st) => perDiv * st >= 3.4 && o.divisions % st === 0) ?? 1;
  const major = [5, 10, 20, 25, 30, 50, 100].find((st) => st % minor === 0 && o.divisions % st === 0 && o.divisions / st <= 8)
    ?? o.divisions;
  const mid = major % 2 === 0 && (major / 2) % minor === 0 ? major / 2 : 0;

  const face = s('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 12, class: 'dial-face' });
  const parts: SVGElement[] = [face];
  const [ax, ay] = pt(0, r);
  const [bx, by] = pt(o.divisions, r);
  parts.push(s('path', { d: `M${r1(ax)} ${r1(ay)}A${r} ${r} 0 0 1 ${r1(bx)} ${r1(by)}`, class: 'dial-arc' }));
  for (let d = 0; d <= o.divisions; d += minor) {
    const isMajor = d % major === 0;
    const isMid = !isMajor && mid > 0 && d % mid === 0;
    const len = isMajor ? 15 : isMid ? 10 : 6;
    const [x1, y1] = pt(d, r);
    const [x2, y2] = pt(d, r - len);
    parts.push(s('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: isMajor ? 'dial-tick major' : 'dial-tick' }));
    if (isMajor) {
      const [lx, ly] = pt(d, r - 28);
      parts.push(s('text', { x: r1(lx), y: r1(ly + 4), 'text-anchor': 'middle', class: 'dial-num' }, String(d)));
    }
  }
  if (o.symbol) parts.push(s('text', { x: 30, y: H - 40, class: 'dial-sym' }, o.symbol));
  if (o.range) parts.push(s('text', { x: 16, y: H - 14, class: 'dial-small' }, o.range));
  if (o.accuracyClass) parts.push(s('text', { x: W - 16, y: H - 14, 'text-anchor': 'end', class: 'dial-small' }, `trieda ${o.accuracyClass}`));
  const [nx, ny] = pt(Math.max(0, Math.min(o.divisions, o.alpha)), r - 4);
  parts.push(
    s('line', { x1: cx, y1: cy, x2: r1(nx), y2: r1(ny), class: 'dial-needle' }),
    s('circle', { cx, cy, r: 7, class: 'dial-pivot' }),
  );
  return s(
    'svg',
    {
      viewBox: `0 0 ${W} ${H}`, width: W, class: 'dial', role: 'img',
      'aria-label': `Stupnica s ${o.divisions} dielikmi, ručička ukazuje ${fmt(o.alpha)} dielikov`,
    },
    s('title', null, `Stupnica s ${o.divisions} dielikmi`),
    ...parts,
  );
}

// ---------------------------------------------------------------- displej číslicového prístroja

const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc',
  '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', L: 'fed', E: 'afged', r: 'eg', O: 'abcdef', F: 'afge',
};

const SEG_RECT: Record<string, [number, number, number, number]> = {
  a: [6, 0, 18, 5], b: [25, 5, 5, 19], c: [25, 28, 5, 19], d: [6, 47, 18, 5],
  e: [0, 28, 5, 19], f: [0, 5, 5, 19], g: [6, 23.5, 18, 5],
};

/**
 * Sedemsegmentový displej, napr. lcdDisplay('1.999', 'V') pre 3½-miestny displej.
 * Bodka za číslicou rozsvieti desatinnú bodku tejto číslice.
 */
export function lcdDisplay(text: string, unit = ''): SVGSVGElement {
  const chars: { ch: string; dp: boolean }[] = [];
  for (const ch of text) {
    if (ch === '.' || ch === ',') {
      if (chars.length) chars[chars.length - 1].dp = true;
    } else {
      chars.push({ ch, dp: false });
    }
  }
  const cell = 40;
  const padX = 18;
  const unitW = unit ? 22 + unit.length * 15 : 0;
  const W = padX * 2 + chars.length * cell + unitW;
  const H = 92;
  const parts: SVGElement[] = [
    s('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 10, class: 'lcd-frame' }),
    s('rect', { x: 8, y: 8, width: W - 16, height: H - 16, rx: 6, class: 'lcd-glass' }),
  ];
  chars.forEach(({ ch, dp }, i) => {
    const on = SEGMENTS[ch] ?? '';
    const g = s('g', { transform: `translate(${padX + i * cell + 4} 20) skewX(-7)` });
    for (const [seg, [x, y, w, hgt]] of Object.entries(SEG_RECT)) {
      g.append(s('rect', { x, y, width: w, height: hgt, rx: 1.6, class: on.includes(seg) ? 'seg-on' : 'seg-off' }));
    }
    g.append(s('circle', { cx: 34, cy: 49.5, r: 2.8, class: dp ? 'seg-on' : 'seg-off' }));
    parts.push(g);
  });
  if (unit) parts.push(s('text', { x: W - padX - 2, y: 70, 'text-anchor': 'end', class: 'lcd-unit' }, unit));
  return s(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, width: W, class: 'lcd', role: 'img', 'aria-label': `Displej ukazuje ${text} ${unit}`.trim() },
    s('title', null, `Displej: ${text} ${unit}`.trim()),
    ...parts,
  );
}

// ---------------------------------------------------------------- zapojenia

function plusMinus(x: number, top: number, bottom: number): SVGElement[] {
  return [terminal([x, top]), terminal([x, bottom]), note(x - 14, top + 5, '+', 'end'), note(x - 14, bottom + 5, '−', 'end')];
}

/** Obr. 2.3 – vlastná spotreba voltmetra: voltmeter paralelne k meranému odporu. */
export function voltmeterConsumptionFigure(): SVGSVGElement {
  const top = 40;
  const bottom = 172;
  return schematic(
    320, 196, 'Voltmeter s vnútorným odporom RV pripojený paralelne k odporu R',
    ...plusMinus(46, top, bottom),
    wire([50, top], [262, top]),
    wire([50, bottom], [262, bottom]),
    comp('voltmeter', [160, top], [160, bottom], { label: 'R_V', side: 'right' }),
    comp('resistor', [262, top], [262, bottom], { label: 'R', side: 'right' }),
    currentArrow([160, top + 22], 'd', 'I_V', 'left'),
    currentArrow([262, top + 22], 'd', 'I', 'left'),
    dot([160, top]),
    dot([160, bottom]),
  );
}

/** Obr. 2.4 – vlastná spotreba ampérmetra: úbytok napätia ΔUA na ampérmetri. */
export function ammeterConsumptionFigure(): SVGSVGElement {
  const top = 46;
  const bottom = 172;
  return schematic(
    320, 196, 'Ampérmeter s vnútorným odporom RA v sérii s odporom R',
    ...plusMinus(46, top, bottom),
    wire([50, top], [86, top]),
    comp('ammeter', [86, top], [156, top], { label: 'R_A' }),
    wire([156, top], [262, top]),
    currentArrow([212, top], 'r', 'I'),
    voltageArrow([96, top + 26], [146, top + 26], 'ΔU_A', 'below'),
    comp('resistor', [262, top], [262, bottom], { label: 'R', side: 'right' }),
    wire([262, bottom], [50, bottom]),
  );
}

/** Ohmmeter s magnetoelektrickým voltmetrom: zdroj, tlačidlo TL, bočník Rb a predradný Rp. */
export function ohmmeterFigure(): SVGSVGElement {
  const top = 40;
  const bottom = 170;
  const xRx = 60;
  const xTl = 128;
  const xM = 250;
  const xRb = 318;
  return schematic(
    370, 224, 'Ohmmeter: zdroj, meraný odpor Rx, tlačidlo TL, prístroj Ω, bočník Rb a predradný odpor Rp',
    wire([xRx, top], [150, top]),
    comp('battery', [150, top], [196, top]),
    wire([196, top], [xM, top]),
    dashedWire([xM, top], [xRb, top]),
    wire([xRx, top], [xRx, 86]),
    terminal([xRx, 86]),
    terminal([xRx, 124]),
    wire([xRx, 124], [xRx, bottom]),
    qty(xRx - 14, 110, 'R_x', 'end'),
    wire([xTl, top], [xTl, 88]),
    comp('button', [xTl, 88], [xTl, 122]),
    wire([xTl, 122], [xTl, bottom]),
    note(xTl + 22, 110, 'TL', 'start'),
    comp('ohmmeter', [xM, top], [xM, bottom]),
    comp('varres', [xRb, top], [xRb, bottom], { label: 'R_b', side: 'right' }),
    wire([xRx, bottom], [150, bottom]),
    comp('varres', [150, bottom], [214, bottom], { label: 'R_p', side: 'below' }),
    wire([214, bottom], [xM, bottom]),
    dashedWire([xM, bottom], [xRb, bottom]),
    dot([xTl, top]),
    dot([xTl, bottom]),
    dot([xM, top]),
    dot([xM, bottom]),
  );
}

/**
 * Ohmova metóda. „AV“ – ampérmeter pred voltmetrom (voltmeter priamo na Rx, pre malé a stredné odpory),
 * „VA“ – voltmeter pred ampérmetrom (ampérmeter priamo v sérii s Rx, pre veľké odpory).
 */
export function vaMethodFigure(kind: 'AV' | 'VA'): SVGSVGElement {
  const top = 46;
  const bottom = 176;
  const left = 60;
  const xR = 312;
  if (kind === 'AV') {
    return schematic(
      370, 200, 'Zapojenie AV: ampérmeter pred voltmetrom, voltmeter meria priamo napätie na Rx',
      comp('battery', [left, top], [left, bottom], { label: 'U', side: 'left' }),
      wire([left, top], [88, top]),
      comp('ammeter', [88, top], [150, top], { label: 'R_A' }),
      wire([150, top], [xR, top]),
      currentArrow([180, top], 'r', 'I'),
      comp('voltmeter', [214, top], [214, bottom], { label: 'R_V', side: 'right' }),
      comp('resistor', [xR, top], [xR, bottom], { label: 'R_x', side: 'right' }),
      currentArrow([214, top + 24], 'd', 'I_V', 'left'),
      currentArrow([xR, top + 24], 'd', 'I_R', 'left'),
      wire([xR, bottom], [left, bottom]),
      dot([214, top]),
      dot([214, bottom]),
    );
  }
  return schematic(
    370, 200, 'Zapojenie VA: voltmeter pred ampérmetrom, ampérmeter meria priamo prúd cez Rx',
    comp('battery', [left, top], [left, bottom], { label: 'U', side: 'left' }),
    wire([left, top], [190, top]),
    comp('voltmeter', [124, top], [124, bottom], { label: 'R_V', side: 'right' }),
    currentArrow([124, top + 24], 'd', 'I_V', 'left'),
    comp('ammeter', [190, top], [252, top], { label: 'R_A' }),
    wire([252, top], [xR, top]),
    currentArrow([282, top], 'r', 'I'),
    comp('resistor', [xR, top], [xR, bottom], { label: 'R_x', side: 'right' }),
    wire([xR, bottom], [left, bottom]),
    dot([124, top]),
    dot([124, bottom]),
  );
}

// ---------------------------------------------------------------- grafy chýb

/** Obr. 2.1 – absolútna chyba analógového prístroja je v celom rozsahu rovnaká. */
export function absErrorChart(): SVGSVGElement {
  return lineChart({
    ariaLabel: 'Najväčšia absolútna chyba analógového prístroja je konštantná v celom rozsahu stupnice',
    x: { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], format: (v) => `${v}`, label: 'výchylka [dieliky]' },
    y: { min: -1.6, max: 1.6, ticks: [-1, 0, 1], format: (v) => (v > 0 ? '+ΔXₘₐₓ' : v < 0 ? '−ΔXₘₐₓ' : '0'), label: 'absolútna chyba' },
    series: [
      { points: [[0, 1], [100, 1]], className: 'copper' },
      { points: [[0, -1], [100, -1]], className: 'copper' },
    ],
  });
}

/** Obr. 2.2 – relatívna chyba prístroja triedy 1 so stupnicou 100 dielikov. */
export function relErrorChart(): SVGSVGElement {
  const from = 100 / 15;
  return lineChart({
    ariaLabel: 'Relatívna chyba prístroja triedy presnosti 1 klesá s rastúcou výchylkou ručičky',
    x: { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100], format: (v) => `${v}`, label: 'výchylka [dieliky]' },
    y: { min: -16, max: 16, ticks: [-15, -10, -5, 0, 5, 10, 15], format: (v) => `${v} %`, label: 'δ' },
    series: [
      { points: sample((x) => 100 / x, from, 100), className: 'copper' },
      { points: sample((x) => -100 / x, from, 100), className: 'copper' },
    ],
    markers: [
      { x: 20, y: 5, label: '5 % pri 20 dielikoch', above: true },
      { x: 100, y: 1, label: '1 % na konci stupnice', above: true },
    ],
  });
}

/** Obr. 6.4 – absolútna chyba ČMP rastie s nameranou hodnotou (rozsah 200 V, rdg 0,9 %, FS 0,1 %). */
export function cmpAbsErrorChart(): SVGSVGElement {
  const delta = (x: number) => 0.009 * x + 0.2;
  return lineChart({
    ariaLabel: 'Absolútna chyba číslicového prístroja: aditívna zložka je stála, multiplikatívna rastie s nameranou hodnotou',
    x: { min: 0, max: 200, ticks: [0, 50, 100, 150, 200], format: (v) => `${v}`, label: 'Xₘ [V]' },
    y: { min: -2.4, max: 2.4, ticks: [-2, -1, 0, 1, 2], format: (v) => (v > 0 ? `+${fmt(v)}` : fmt(v)), label: 'Δ [V]' },
    series: [
      { points: [[0, delta(0)], [200, delta(200)]], className: 'copper' },
      { points: [[0, -delta(0)], [200, -delta(200)]], className: 'copper' },
      { points: [[0, 0.2], [200, 0.2]], className: 'dashed' },
      { points: [[0, -0.2], [200, -0.2]], className: 'dashed' },
    ],
    markers: [
      { x: 100, y: delta(100), label: '±1,1 V pri 100 V' },
      { x: 200, y: delta(200), label: '±2 V' },
    ],
  });
}

/** Obr. 6.5 – relatívna chyba ČMP klesá ku koncu rozsahu na δm + δa. */
export function cmpRelErrorChart(): SVGSVGElement {
  const delta = (x: number) => 0.9 + (0.1 * 200) / x;
  return lineChart({
    ariaLabel: 'Relatívna chyba číslicového prístroja klesá ku koncu rozsahu na súčet δm a δa',
    x: { min: 0, max: 200, ticks: [0, 50, 100, 150, 200], format: (v) => `${v}`, label: 'Xₘ [V]' },
    y: { min: -3.6, max: 3.6, ticks: [-3, -2, -1, 0, 1, 2, 3], format: (v) => `${fmt(v)} %`, label: 'δ' },
    series: [
      { points: sample(delta, 7, 200), className: 'copper' },
      { points: sample((x) => -delta(x), 7, 200), className: 'copper' },
    ],
    markers: [
      { x: 100, y: delta(100), label: '1,1 % pri 100 V', above: true },
      { x: 200, y: delta(200), label: '1 % na konci rozsahu', above: true },
    ],
  });
}

/** Krátky popis veličiny do vlastných schém (re-export, aby moduly nemuseli siahať do schematic.ts). */
export { qty, valueText };
