/**
 * Schémy a grafy pre kapitolu Elektronika: usmerňovače a filtrácia, stabilizátory,
 * bipolárny tranzistor, operačný zosilňovač, oscilátory a časovač 555.
 */
import './fig-electronics.css';
import { s } from '../lib/dom';
import { fmt, scaleExp, siParts } from '../lib/units';
import { lineChart, sample, type ChartOptions } from './chart';
import { arrowHead, comp, currentArrow, dot, qty, schematic, terminal, valueText, voltageArrow, wire, type Pt } from './schematic';

const r1 = (v: number) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ pomôcky pre grafy

/** Prevod hodnôt grafu na súradnice SVG – rovnaké okraje ako v lineChart. */
export function chartScale(o: ChartOptions): { x: (v: number) => number; y: (v: number) => number } {
  const W = o.width ?? 420;
  const H = o.height ?? 230;
  const m = { l: 50, r: 18, t: o.legend?.length ? 30 : 16, b: 44 };
  return {
    x: (v) => m.l + ((v - o.x.min) / (o.x.max - o.x.min)) * (W - m.l - m.r),
    y: (v) => H - m.b - ((v - o.y.min) / (o.y.max - o.y.min)) * (H - m.t - m.b),
  };
}

export interface ChartNote {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
  /** Doplnková trieda: 'el-trace', 'el-copper', 'el-muted'. */
  cls?: string;
}

/** Čiarový graf s popismi priamo v ploche grafu; voliteľne zvýrazní zvislú os pri x = 0. */
export function annotatedChart(o: ChartOptions, notes: ChartNote[], opts: { zeroX?: boolean } = {}): SVGSVGElement {
  const svg = lineChart(o);
  const sc = chartScale(o);
  if (opts.zeroX) {
    const x0 = String(r1(sc.x(0)));
    svg.querySelectorAll('line.grid').forEach((l) => {
      if (l.getAttribute('x1') === x0 && l.getAttribute('x2') === x0) l.setAttribute('class', 'axis');
    });
  }
  for (const nt of notes) {
    svg.append(s('text', { x: r1(sc.x(nt.x)), y: r1(sc.y(nt.y)), 'text-anchor': nt.anchor ?? 'start', class: `el-note ${nt.cls ?? ''}`.trim() }, nt.text));
  }
  return svg;
}

/** Pekné hodnoty osi od 0 po max (približne 4 až 6 dielikov). */
export function niceTicks(max: number, count = 5): number[] {
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((st) => st >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 1e-9; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}

// ------------------------------------------------------------------ pomôcky pre schémy

/** Súčiastka vlastného tvaru medzi bodmi a, b; telo je kreslené pozdĺž osi x okolo počiatku. */
function part(a: Pt, b: Pt, half: number, body: SVGElement[]): SVGGElement {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  const ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  return s('g', { class: 'comp' },
    s('line', { x1: a[0], y1: a[1], x2: r1(cx - ux * half), y2: r1(cy - uy * half), class: 'w' }),
    s('line', { x1: r1(cx + ux * half), y1: r1(cy + uy * half), x2: b[0], y2: b[1], class: 'w' }),
    s('g', { transform: `translate(${r1(cx)} ${r1(cy)}) rotate(${r1(ang)})` }, ...body),
  );
}

/** Zenerova dióda: anóda v bode a, katóda (lomená čiara) v bode b. */
export function zenerDiode(a: Pt, b: Pt): SVGGElement {
  return part(a, b, 8, [
    s('polygon', { points: '-8,-9 -8,9 8,0', class: 'b' }),
    s('path', { d: 'M3 -9H8V9H13', class: 'w' }),
  ]);
}

/** Uzemnenie (spoločný vodič) pod bodom x, y. */
function ground(x: number, y: number): SVGGElement {
  return s('g', null,
    s('line', { x1: x, y1: y, x2: x, y2: y + 8, class: 'w' }),
    s('line', { x1: x - 11, y1: y + 8, x2: x + 11, y2: y + 8, class: 'w' }),
    s('line', { x1: x - 7, y1: y + 13, x2: x + 7, y2: y + 13, class: 'w' }),
    s('line', { x1: x - 3, y1: y + 18, x2: x + 3, y2: y + 18, class: 'w' }),
  );
}

/** Transformátor: primárne vinutie na x1, sekundárne na x2, jadro medzi nimi; vinutia od y0 po y1 (násobok 40). */
function transformer(x1: number, x2: number, y0: number, y1: number): SVGElement[] {
  const out: SVGElement[] = [];
  for (let y = y0; y < y1; y += 40) {
    out.push(comp('inductor', [x1, y], [x1, y + 40]), comp('inductor', [x2, y + 40], [x2, y]));
  }
  const xm = (x1 + x2) / 2;
  out.push(
    s('line', { x1: xm - 3, y1: y0, x2: xm - 3, y2: y1, class: 'w' }),
    s('line', { x1: xm + 3, y1: y0, x2: xm + 3, y2: y1, class: 'w' }),
  );
  return out;
}

/** Text malým písmom (bez kurzívy). */
function small(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = 'small'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls }, text);
}

/** Svorka napájania s popisom, napr. +U_CC. */
function supplyLabel(x: number, y: number, sign: string, src: string, anchor: 'start' | 'middle' | 'end' = 'start'): SVGTextElement {
  const t = qty(x, y, src, anchor);
  t.prepend(s('tspan', null, sign));
  return t;
}

interface Bjt { g: SVGGElement; b: Pt; c: Pt; e: Pt }

/** Bipolárny tranzistor s bázou vľavo. NPN má kolektor hore, PNP emitor hore (kladnejšia elektróda je hore). */
export function bjt(x: number, y: number, type: 'npn' | 'pnp'): Bjt {
  const top: Pt = [x + 10, y - 28];
  const bottom: Pt = [x + 10, y + 28];
  const g = s('g', { class: 'comp' },
    s('circle', { cx: x + 2, cy: y, r: 19, class: 'b' }),
    s('line', { x1: x - 26, y1: y, x2: x - 6, y2: y, class: 'w' }),
    s('line', { x1: x - 6, y1: y - 12, x2: x - 6, y2: y + 12, class: 'p' }),
    s('polyline', { points: `${x - 6},${y - 5} ${x + 10},${y - 14} ${top[0]},${top[1]}`, class: 'w' }),
    s('polyline', { points: `${x - 6},${y + 5} ${x + 10},${y + 14} ${bottom[0]},${bottom[1]}`, class: 'w' }),
    type === 'npn'
      ? arrowHead(x + 8.4, y + 13.1, 29.4, 4.2)
      : arrowHead(x - 1.6, y - 7.4, 150.6, 4.2),
  );
  return type === 'npn'
    ? { g, b: [x - 26, y], c: top, e: bottom }
    : { g, b: [x - 26, y], c: bottom, e: top };
}

interface OpAmp { g: SVGGElement; inv: Pt; non: Pt; out: Pt }

/** Operačný zosilňovač (trojuholník) s ľavou stranou na x, stredom na y. */
export function opamp(x: number, y: number, plusTop = false): OpAmp {
  const g = s('g', { class: 'comp' },
    s('polygon', { points: `${x},${y - 34} ${x},${y + 34} ${x + 62},${y}`, class: 'b' }),
    s('text', { x: x + 5, y: y - 11, class: 'note' }, plusTop ? '+' : '−'),
    s('text', { x: x + 5, y: y + 21, class: 'note' }, plusTop ? '−' : '+'),
  );
  return { g, inv: [x, plusTop ? y + 16 : y - 16], non: [x, plusTop ? y - 16 : y + 16], out: [x + 62, y] };
}

// ------------------------------------------------------------------ usmerňovače

/** Jednocestný usmerňovač s transformátorom a záťažou. */
export function halfWaveFigure(): SVGSVGElement {
  const top = 60;
  const bot = 140;
  return schematic(380, 190, 'Jednocestný usmerňovač: transformátor, dióda D a záťaž R_z',
    terminal([26, top]), terminal([26, bot]),
    wire([29, top], [66, top]), wire([29, bot], [66, bot]),
    ...transformer(66, 106, top, bot),
    small(86, 172, 'sieť 230 V'),
    wire([106, top], [160, top]),
    comp('diode', [160, top], [210, top], { label: 'D' }),
    wire([210, top], [300, top]),
    currentArrow([258, top], 'r', 'i_d'),
    comp('resistor', [300, top], [300, bot], { label: 'R_z', side: 'right' }),
    wire([300, bot], [106, bot]),
    voltageArrow([132, top + 14], [132, bot - 14], 'u', 'right'),
    voltageArrow([276, top + 16], [276, bot - 16], 'u_d', 'left'),
  );
}

/** Dvojcestný usmerňovač s transformátorom so stredným vývodom. */
export function centerTapFigure(): SVGSVGElement {
  const yt = 46;
  const yb = 214;
  const ym = 130;
  return schematic(380, 236, 'Dvojcestný usmerňovač s transformátorom so stredným vývodom',
    terminal([26, 90]), terminal([26, 170]),
    wire([29, 90], [66, 90]), wire([29, 170], [66, 170]),
    ...transformer(66, 106, 90, 170),
    small(86, 232, 'sieť 230 V'),
    wire([106, 90], [106, yt], [150, yt]),
    comp('diode', [150, yt], [206, yt], { label: 'D_1' }),
    wire([206, yt], [300, yt], [300, yb], [206, yb]),
    comp('diode', [150, yb], [206, yb], { label: 'D_2' }),
    wire([106, 170], [106, yb], [150, yb]),
    wire([106, ym], [170, ym]),
    comp('resistor', [170, ym], [244, ym], { label: 'R_z' }),
    wire([244, ym], [300, ym]),
    dot([106, ym]), dot([300, ym]),
    voltageArrow([242, ym + 20], [172, ym + 20], 'u_d', 'below'),
    voltageArrow([128, 94], [128, 126], 'u', 'right'),
    voltageArrow([128, 134], [128, 166], 'u', 'right'),
  );
}

/** Mostíkový (Graetzov) usmerňovač, voliteľne s filtračným kondenzátorom. */
export function bridgeFigure(o: { filter?: boolean } = {}): SVGSVGElement {
  const c: Pt = [222, 115];
  const d = 56;
  const T: Pt = [c[0], c[1] - d];
  const B: Pt = [c[0], c[1] + d];
  const L: Pt = [c[0] - d, c[1]];
  const R: Pt = [c[0] + d, c[1]];
  const xl = 384;
  const yb = 215;
  const parts: SVGElement[] = [
    terminal([26, 75]), terminal([26, 155]),
    wire([29, 75], [66, 75]), wire([29, 155], [66, 155]),
    ...transformer(66, 106, 75, 155),
    small(86, 192, 'sieť 230 V'),
    wire([106, 75], [106, T[1]], T),
    wire([106, 155], [106, B[1]], B),
    comp('diode', L, T), comp('diode', T, R), comp('diode', L, B), comp('diode', B, R),
    qty(L[0] + 14, T[1] + 18, 'D_1', 'end'),
    qty(R[0] - 14, T[1] + 18, 'D_2', 'start'),
    qty(L[0] + 14, B[1] - 6, 'D_3', 'end'),
    qty(R[0] - 14, B[1] - 6, 'D_4', 'start'),
    dot(T), dot(B), dot(L), dot(R),
    s('text', { x: R[0] + 8, y: R[1] - 8, class: 'note' }, '+'),
    s('text', { x: L[0] - 6, y: L[1] - 8, 'text-anchor': 'end', class: 'note' }, '−'),
    wire(R, [xl, R[1]]),
    comp('resistor', [xl, R[1]], [xl, yb], { label: 'R_z', side: 'right' }),
    wire([xl, yb], [142, yb], [142, L[1]], L),
  ];
  if (o.filter) {
    parts.push(
      comp('ecap', [318, R[1]], [318, yb], { label: 'C', side: 'left' }),
      dot([318, R[1]]), dot([318, yb]),
      voltageArrow([344, R[1] + 14], [344, yb - 14], 'u_d', 'right'),
    );
  } else {
    parts.push(voltageArrow([360, R[1] + 14], [360, yb - 14], 'u_d', 'left'));
  }
  return schematic(430, 236, o.filter ? 'Mostíkový usmerňovač s filtračným kondenzátorom C' : 'Mostíkový (Graetzov) usmerňovač so štyrmi diódami', ...parts);
}

/** Priebehy napätia na vstupe a výstupe usmerňovača bez filtra (U = 12 V, ideálne diódy). */
export function rectifierChart(kind: 'half' | 'full'): SVGSVGElement {
  const U = 12;
  const um = U * Math.SQRT2;
  const w = 2 * Math.PI * 50;
  const u = (ms: number) => um * Math.sin((w * ms) / 1000);
  const ud = (ms: number) => (kind === 'half' ? Math.max(0, u(ms)) : Math.abs(u(ms)));
  const Ud = (kind === 'half' ? 0.45 : 0.9) * U;
  return lineChart({
    ariaLabel: kind === 'half'
      ? 'Jednocestný usmerňovač: z každej periódy prejde len kladná polvlna'
      : 'Dvojcestný usmerňovač: záporné polvlny sa preklopia na kladné',
    width: 440,
    height: 230,
    x: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40], format: (v) => `${v}`, label: 't [ms]' },
    y: { min: -20, max: 22, ticks: [-17, 0, 17], format: (v) => (v === 0 ? '0' : v > 0 ? '17' : '−17'), label: 'u [V]' },
    series: [
      { points: sample(u, 0, 40, 240), className: 'dashed' },
      { points: sample(ud, 0, 40, 480), className: 'copper' },
    ],
    hlines: [{ y: Ud, label: `Ud = ${fmt(Ud, 3)} V` }],
    legend: [{ label: 'u – vstup', className: 'dashed' }, { label: 'ud – výstup', className: 'copper' }],
  });
}

// ------------------------------------------------------------------ stabilizátory

/** VA charakteristika Zenerovej diódy s Uz = 5,6 V. */
export function zenerChart(): SVGSVGElement {
  const Uz = 5.6;
  const I = (u: number) => {
    if (u >= 0) return 1e-6 * Math.expm1(u / 0.04);
    return -0.5 * Math.exp((-u - Uz) / 0.09) + 1e-4 * u;
  };
  const pts: [number, number][] = [];
  for (let k = 0; k <= 1000; k++) {
    const u = -8 + (10 * k) / 1000;
    pts.push([u, I(u)]);
  }
  const o: ChartOptions = {
    ariaLabel: 'VA charakteristika Zenerovej diódy: v priamom smere vedie od 0,7 V, v závernom smere pri napätí Uz = 5,6 V nastane prieraz',
    width: 440,
    height: 260,
    x: { min: -8, max: 2, ticks: [-8, -6, -4, -2, 0, 2], format: (v) => (v < 0 ? `−${-v}` : `${v}`), label: 'U [V]' },
    y: { min: -40, max: 30, ticks: [-40, -30, -20, -10, 0, 10, 20, 30], format: (v) => (v < 0 ? `−${-v}` : `${v}`), label: 'I [mA]' },
    series: [{ points: pts, className: 'copper' }],
  };
  return annotatedChart(o, [
    { x: 0.4, y: 22, text: 'priamy smer', anchor: 'end' },
    { x: 0.4, y: 15, text: 'od ≈ 0,7 V', anchor: 'end', cls: 'el-muted' },
    { x: -1.2, y: -12, text: 'záverný smer', anchor: 'end' },
    { x: -1.2, y: -19, text: 'nevedie', anchor: 'end', cls: 'el-muted' },
    { x: -5.4, y: -27, text: 'prieraz pri Uz', anchor: 'start', cls: 'el-copper' },
    { x: -5.4, y: -34, text: 'stabilizácia', anchor: 'start', cls: 'el-muted' },
    { x: -5.6, y: 3, text: '−Uz = −5,6 V', anchor: 'middle', cls: 'el-trace' },
  ], { zeroX: true });
}

/** Parametrický stabilizátor so Zenerovou diódou. */
export function zenerStabFigure(v: { r?: string; uz?: string; u1?: string; rl?: string } = {}): SVGSVGElement {
  const top = 50;
  const bot = 176;
  const xz = 206;
  const xl = 290;
  return schematic(400, 200, 'Parametrický stabilizátor: predradný rezistor R, Zenerova dióda D_Z a záťaž R_L',
    terminal([30, top]), terminal([30, bot]),
    wire([33, top], [84, top]),
    comp('resistor', [84, top], [158, top], { label: 'R', value: v.r }),
    wire([158, top], [357, top]),
    currentArrow([180, top], 'r', 'I'),
    zenerDiode([xz, bot], [xz, top]),
    qty(xz + 18, 116, 'D_Z', 'start'),
    ...(v.uz ? [valueText(xz + 18, 131, v.uz, 'start')] : []),
    currentArrow([xz, 74], 'd', 'I_Z', 'right'),
    comp('resistor', [xl, top], [xl, bot], { label: 'R_L', value: v.rl, side: 'right' }),
    currentArrow([xl, 74], 'd', 'I_L', 'left'),
    wire([33, bot], [357, bot]),
    dot([xz, top]), dot([xz, bot]), dot([xl, top]), dot([xl, bot]),
    terminal([360, top]), terminal([360, bot]),
    voltageArrow([50, top + 16], [50, bot - 16], 'U_1', 'right'),
    ...(v.u1 ? [valueText(59, 132, v.u1, 'start')] : []),
    voltageArrow([372, top + 16], [372, bot - 16], 'U_2', 'left'),
  );
}

/** Integrovaný stabilizátor 7805 alebo nastaviteľný LM317 s kondenzátormi. */
export function regulatorFigure(kind: '7805' | 'lm317', v: { r1?: string; r2?: string } = {}): SVGSVGElement {
  const y = 70;
  const yb = kind === 'lm317' ? 214 : 170;
  const bx0 = 170;
  const bx1 = 250;
  const xo = 290;
  const xc2 = kind === 'lm317' ? 344 : 310;
  const xt = kind === 'lm317' ? 410 : 380;
  const parts: SVGElement[] = [
    terminal([34, y]), terminal([34, yb]),
    wire([37, y], [bx0, y]),
    comp('capacitor', [116, y], [116, yb], { label: 'C_1', value: kind === '7805' ? '330 nF' : '100 nF', side: 'right' }),
    dot([116, y]), dot([116, yb]),
    s('rect', { x: bx0, y: 46, width: bx1 - bx0, height: 52, rx: 3, class: 'b' }),
    s('text', { x: (bx0 + bx1) / 2, y: 77, 'text-anchor': 'middle', class: 'label' }, kind === '7805' ? '7805' : 'LM317'),
    small(bx0 + 4, y - 8, 'IN', 'start', 'small el-muted'),
    small(bx1 - 4, y - 8, 'OUT', 'end', 'small el-muted'),
    wire([bx1, y], [xt - 3, y]),
    comp('capacitor', [xc2, y], [xc2, yb], { label: 'C_2', value: kind === '7805' ? '100 nF' : undefined, side: 'left' }),
    dot([xc2, y]), dot([xc2, yb]),
    wire([37, yb], [xt - 3, yb]),
    terminal([xt, y]), terminal([xt, yb]),
    voltageArrow([52, y + 16], [52, yb - 16], 'U_1', 'right'),
    voltageArrow([xt - 14, y + 16], [xt - 14, yb - 16], 'U_2', 'left'),
  ];
  if (kind === '7805') {
    parts.push(
      small((bx0 + bx1) / 2, 93, 'GND', 'middle', 'small el-muted'),
      wire([(bx0 + bx1) / 2, 98], [(bx0 + bx1) / 2, yb]),
      dot([(bx0 + bx1) / 2, yb]),
      small(bx0 - 6, y - 6, '1', 'end'), small(bx1 + 6, y - 6, '3', 'start'), small((bx0 + bx1) / 2 + 6, 112, '2', 'start'),
    );
  } else {
    const ya = 132;
    parts.push(
      small((bx0 + bx1) / 2, 93, 'ADJ', 'middle', 'small el-muted'),
      wire([(bx0 + bx1) / 2, 98], [(bx0 + bx1) / 2, ya], [xo, ya]),
      comp('resistor', [xo, y], [xo, ya], { label: 'R_1', value: v.r1, side: 'right' }),
      comp('resistor', [xo, ya], [xo, yb], { label: 'R_2', value: v.r2, side: 'right' }),
      dot([xo, y]), dot([xo, ya]), dot([xo, yb]),
      small(bx0 - 6, y - 6, '3', 'end'), small(bx1 + 6, y - 6, '2', 'start'), small((bx0 + bx1) / 2 + 6, 112, '1', 'start'),
    );
  }
  return schematic(xt + 30, yb + 22, kind === '7805'
    ? 'Integrovaný stabilizátor 7805 s kondenzátormi na vstupe a výstupe'
    : 'Nastaviteľný stabilizátor LM317: výstupné napätie určuje delič R1 a R2', ...parts);
}

// ------------------------------------------------------------------ tranzistor

/** Schematické značky tranzistorov NPN a PNP s označením elektród. */
export function transistorSymbols(): SVGSVGElement {
  const n = bjt(92, 80, 'npn');
  const p = bjt(252, 80, 'pnp');
  return schematic(370, 170, 'Schematické značky bipolárnych tranzistorov NPN a PNP',
    n.g, p.g,
    wire(n.c, [n.c[0], 40]), wire(n.e, [n.e[0], 120]),
    wire(p.e, [p.e[0], 40]), wire(p.c, [p.c[0], 120]),
    small(n.b[0] - 6, n.b[1] + 5, 'B', 'end', 'label'),
    small(n.c[0] + 8, 46, 'C', 'start', 'label'),
    small(n.e[0] + 8, 122, 'E', 'start', 'label'),
    small(p.b[0] - 6, p.b[1] + 5, 'B', 'end', 'label'),
    small(p.e[0] + 8, 46, 'E', 'start', 'label'),
    small(p.c[0] + 8, 122, 'C', 'start', 'label'),
    small(96, 156, 'NPN', 'middle', 'note'),
    small(256, 156, 'PNP', 'middle', 'note'),
    small(n.e[0] + 22, 104, 'šípka von', 'start', 'small el-muted'),
    small(p.e[0] + 22, 64, 'šípka dnu', 'start', 'small el-muted'),
  );
}

/** Tranzistor NPN ako spínač relé s nulovou diódou. */
export function relaySwitchFigure(): SVGSVGElement {
  const t = bjt(250, 184, 'npn');
  const xc = t.c[0];
  const rail = 30;
  const gnd = 236;
  return schematic(380, 270, 'Tranzistor NPN spína cievku relé; nulová dióda chráni tranzistor pri vypnutí',
    wire([xc, rail], [xc, 52]),
    s('rect', { x: xc - 9, y: 68, width: 18, height: 40, class: 'b' }),
    wire([xc, 52], [xc, 68]), wire([xc, 108], [xc, 126]),
    small(xc - 16, 93, 'K', 'end', 'note'),
    small(xc - 16, 108, 'relé', 'end', 'small el-muted'),
    wire([xc, 52], [318, 52]), wire([xc, 126], [318, 126]),
    comp('diode', [318, 126], [318, 52], { label: 'D', side: 'right' }),
    dot([xc, 52]), dot([xc, 126]),
    wire([xc, 126], t.c),
    currentArrow([xc, 140], 'd', 'I_C', 'left'),
    t.g,
    wire(t.e, [xc, gnd]),
    wire([200, rail], [xc, rail]),
    terminal([200, rail]),
    supplyLabel(192, rail + 5, '+', 'U_CC', 'end'),
    terminal([40, 184]),
    wire([43, 184], [108, 184]),
    comp('resistor', [108, 184], [176, 184], { label: 'R_B' }),
    wire([176, 184], t.b),
    currentArrow([202, 184], 'r', 'I_B'),
    terminal([40, gnd]),
    wire([43, gnd], [xc, gnd]),
    ground(150, gnd),
    voltageArrow([40, 197], [40, gnd - 12], 'U_1', 'right'),
    small(24, 166, 'z mikrokontroléra', 'start', 'small el-muted'),
  );
}

/** Zosilňovač so spoločným emitorom: delič v báze, RC, RE s kondenzátorom CE, väzobné kondenzátory. */
export function ceAmplifierFigure(): SVGSVGElement {
  const t = bjt(226, 146, 'npn');
  const rail = 30;
  const gnd = 262;
  const xb = 150;
  const xc = t.c[0];
  const yc = 100;
  const ye = 196;
  return schematic(420, 290, 'Zosilňovač so spoločným emitorom s deličom v báze',
    wire([xb, rail], [366, rail]),
    terminal([369, rail]),
    supplyLabel(360, rail - 10, '+', 'U_CC', 'end'),
    comp('resistor', [xb, rail], [xb, t.b[1]], { label: 'R_1', side: 'left' }),
    comp('resistor', [xb, t.b[1]], [xb, gnd], { label: 'R_2', side: 'left' }),
    dot([xb, t.b[1]]),
    wire([xb, t.b[1]], t.b),
    comp('resistor', [xc, rail], [xc, yc], { label: 'R_C', side: 'right' }),
    dot([xc, rail]),
    wire([xc, yc], t.c),
    dot([xc, yc]),
    wire([xc, yc], [276, yc]),
    comp('capacitor', [276, yc], [316, yc], { label: 'C_2' }),
    wire([316, yc], [366, yc]),
    terminal([369, yc]),
    t.g,
    wire(t.e, [xc, ye]),
    comp('resistor', [xc, ye], [xc, gnd], { label: 'R_E', side: 'left' }),
    dot([xc, ye]),
    wire([xc, ye], [292, ye]),
    comp('ecap', [292, ye], [292, gnd], { label: 'C_E', side: 'right' }),
    dot([292, gnd]), dot([xc, gnd]), dot([xb, gnd]),
    terminal([34, t.b[1]]),
    wire([37, t.b[1]], [70, t.b[1]]),
    comp('capacitor', [70, t.b[1]], [110, t.b[1]], { label: 'C_1' }),
    wire([110, t.b[1]], [xb, t.b[1]]),
    terminal([34, gnd]),
    wire([37, gnd], [366, gnd]),
    terminal([369, gnd]),
    voltageArrow([34, t.b[1] + 14], [34, gnd - 12], 'u_1', 'right'),
    voltageArrow([369, yc + 14], [369, gnd - 12], 'u_2', 'left'),
  );
}

// ------------------------------------------------------------------ operačný zosilňovač

/** Značka operačného zosilňovača s napájaním a rozdielovým napätím. */
export function opampSymbolFigure(): SVGSVGElement {
  const a = opamp(200, 100);
  return schematic(390, 200, 'Operačný zosilňovač: invertujúci vstup −, neinvertujúci vstup +, výstup a napájanie ±U_CC',
    a.g,
    wire([120, a.inv[1]], a.inv), wire([120, a.non[1]], a.non),
    terminal([117, a.inv[1]]), terminal([117, a.non[1]]),
    small(110, a.inv[1] + 4, 'invertujúci', 'end', 'small'),
    small(110, a.non[1] + 4, 'neinvertujúci', 'end', 'small'),
    wire(a.out, [322, a.out[1]]),
    terminal([325, a.out[1]]),
    small(332, a.out[1] + 4, 'výstup', 'start', 'small'),
    wire([231, 84], [231, 40]), wire([231, 116], [231, 160]),
    supplyLabel(240, 44, '+', 'U_CC'),
    supplyLabel(240, 166, '−', 'U_CC'),
    voltageArrow([152, a.non[1] - 4], [152, a.inv[1] + 4], 'U_d', 'left'),
  );
}

/** Invertujúci zosilňovač. */
export function invertingFigure(): SVGSVGElement {
  const a = opamp(170, 100);
  const nx = 146;
  const fb = 40;
  const gnd = 174;
  return schematic(370, 200, 'Invertujúci zosilňovač: vstup cez R1 na invertujúci vstup, spätná väzba R2',
    a.g,
    terminal([30, a.inv[1]]),
    wire([33, a.inv[1]], [56, a.inv[1]]),
    comp('resistor', [56, a.inv[1]], [124, a.inv[1]], { label: 'R_1' }),
    wire([124, a.inv[1]], a.inv),
    dot([nx, a.inv[1]]),
    wire([nx, a.inv[1]], [nx, fb], [176, fb]),
    comp('resistor', [176, fb], [246, fb], { label: 'R_2' }),
    wire([246, fb], [262, fb], [262, a.out[1]]),
    wire(a.out, [327, a.out[1]]),
    dot([262, a.out[1]]),
    terminal([330, a.out[1]]),
    wire(a.non, [152, a.non[1]], [152, gnd]),
    dot([152, gnd]),
    terminal([30, gnd]), terminal([330, gnd]),
    wire([33, gnd], [327, gnd]),
    voltageArrow([30, a.inv[1] + 14], [30, gnd - 12], 'U_1', 'right'),
    voltageArrow([330, a.out[1] + 14], [330, gnd - 12], 'U_2', 'left'),
  );
}

/** Neinvertujúci zosilňovač (+ vstup hore). */
export function nonInvertingFigure(): SVGSVGElement {
  const a = opamp(170, 92, true);
  const nx = 146;
  const fb = 150;
  const gnd = 206;
  return schematic(370, 230, 'Neinvertujúci zosilňovač: signál na neinvertujúci vstup, delič R1 a R2 v spätnej väzbe',
    a.g,
    terminal([30, a.non[1]]),
    wire([33, a.non[1]], a.non),
    wire(a.inv, [nx, a.inv[1]], [nx, fb]),
    dot([nx, fb]),
    wire([nx, fb], [176, fb]),
    comp('resistor', [176, fb], [246, fb], { label: 'R_2', side: 'below' }),
    wire([246, fb], [262, fb], [262, a.out[1]]),
    dot([262, a.out[1]]),
    wire(a.out, [327, a.out[1]]),
    terminal([330, a.out[1]]),
    comp('resistor', [nx, fb], [nx, gnd], { label: 'R_1', side: 'left' }),
    dot([nx, gnd]),
    terminal([30, gnd]), terminal([330, gnd]),
    wire([33, gnd], [327, gnd]),
    voltageArrow([30, a.non[1] + 14], [30, gnd - 12], 'U_1', 'right'),
    voltageArrow([330, a.out[1] + 14], [330, gnd - 12], 'U_2', 'left'),
  );
}

/** Napäťový sledovač. */
export function followerFigure(): SVGSVGElement {
  const a = opamp(150, 82, true);
  const gnd = 170;
  return schematic(330, 190, 'Napäťový sledovač: výstup priamo spojený s invertujúcim vstupom',
    a.g,
    terminal([30, a.non[1]]),
    wire([33, a.non[1]], a.non),
    wire(a.inv, [130, a.inv[1]], [130, 136], [242, 136], [242, a.out[1]]),
    dot([242, a.out[1]]),
    wire(a.out, [287, a.out[1]]),
    terminal([290, a.out[1]]),
    terminal([30, gnd]), terminal([290, gnd]),
    wire([33, gnd], [287, gnd]),
    voltageArrow([30, a.non[1] + 14], [30, gnd - 12], 'U_1', 'right'),
    voltageArrow([290, a.out[1] + 14], [290, gnd - 12], 'U_2', 'left'),
  );
}

/** Sčítací (sumačný) zosilňovač s dvoma vstupmi. */
export function summingFigure(): SVGSVGElement {
  const a = opamp(180, 104);
  const ya = 66;
  const yb = 142;
  const bus = 146;
  const fb = 30;
  const gnd = 196;
  return schematic(380, 222, 'Sčítací zosilňovač: vstupy cez Ra a Rb do spoločného uzla na invertujúcom vstupe',
    a.g,
    terminal([44, ya]), terminal([44, yb]),
    qty(34, ya + 5, 'U_a', 'end'), qty(34, yb + 5, 'U_b', 'end'),
    wire([47, ya], [64, ya]), wire([47, yb], [64, yb]),
    comp('resistor', [64, ya], [124, ya], { label: 'R_a' }),
    comp('resistor', [64, yb], [124, yb], { label: 'R_b', side: 'below' }),
    wire([124, ya], [bus, ya]), wire([124, yb], [bus, yb]),
    wire([bus, fb], [bus, yb]),
    dot([bus, ya]), dot([bus, a.inv[1]]),
    wire([bus, a.inv[1]], a.inv),
    wire([bus, fb], [186, fb]),
    comp('resistor', [186, fb], [256, fb], { label: 'R_2' }),
    wire([256, fb], [272, fb], [272, a.out[1]]),
    dot([272, a.out[1]]),
    wire(a.out, [337, a.out[1]]),
    terminal([340, a.out[1]]),
    wire(a.non, [164, a.non[1]], [164, gnd]),
    dot([164, gnd]),
    wire([44, gnd], [337, gnd]),
    terminal([340, gnd]),
    ground(44, gnd),
    voltageArrow([340, a.out[1] + 14], [340, gnd - 12], 'U_2', 'left'),
  );
}

/** Komparátor: bez spätnej väzby porovnáva vstupné napätie s referenčným. */
export function comparatorFigure(): SVGSVGElement {
  const a = opamp(170, 92, true);
  const gnd = 186;
  return schematic(360, 210, 'Komparátor: operačný zosilňovač bez spätnej väzby porovnáva U1 s referenčným napätím',
    a.g,
    terminal([30, a.non[1]]),
    wire([33, a.non[1]], a.non),
    wire(a.inv, [130, a.inv[1]], [130, 130]),
    comp('battery', [130, 130], [130, gnd], { label: 'U_ref', side: 'left' }),
    dot([130, gnd]),
    wire(a.out, [317, a.out[1]]),
    terminal([320, a.out[1]]),
    terminal([30, gnd]), terminal([320, gnd]),
    wire([33, gnd], [317, gnd]),
    voltageArrow([30, a.non[1] + 14], [30, gnd - 12], 'U_1', 'right'),
    voltageArrow([320, a.out[1] + 14], [320, gnd - 12], 'U_2', 'left'),
    small(250, 70, 'bez spätnej väzby', 'start', 'small el-muted'),
  );
}

// ------------------------------------------------------------------ oscilátory a 555

/** Bloková schéma oscilátora: zosilňovač A a člen kladnej spätnej väzby β. */
export function oscillatorBlockFigure(): SVGSVGElement {
  return schematic(360, 180, 'Oscilátor: zosilňovač A a člen spätnej väzby β tvoria uzavretú slučku',
    s('polygon', { points: '140,36 140,104 204,70', class: 'b' }),
    qty(160, 76, 'A', 'middle'),
    s('rect', { x: 150, y: 120, width: 60, height: 34, rx: 3, class: 'b' }),
    qty(180, 143, 'β', 'middle'),
    wire([204, 70], [310, 70]),
    terminal([313, 70]),
    qty(320, 75, 'u_2', 'start'),
    wire([268, 70], [268, 137], [210, 137]),
    arrowHead(212, 137, 180, 5, 'arr'),
    dot([268, 70]),
    wire([150, 137], [96, 137], [96, 70], [140, 70]),
    arrowHead(138, 70, 0, 5, 'arr'),
    qty(118, 62, 'u_1', 'middle'),
    small(180, 172, 'kladná spätná väzba', 'middle', 'small el-muted'),
  );
}

/** RC oscilátor s Wienovým mostíkom. */
export function wienFigure(): SVGSVGElement {
  const a = opamp(214, 106, true);
  const P: Pt = [134, a.non[1]];
  const top = 34;
  const gnd = 226;
  const xo = 300;
  const nx = 194;
  const fb = 160;
  return schematic(400, 250, 'RC oscilátor s Wienovým mostíkom: sériový a paralelný člen RC v kladnej spätnej väzbe',
    a.g,
    wire(P, a.non),
    dot(P),
    wire(a.out, [362, a.out[1]]),
    terminal([365, a.out[1]]),
    dot([xo, a.out[1]]),
    wire([xo, a.out[1]], [xo, top], [282, top]),
    comp('resistor', [282, top], [222, top], { label: 'R' }),
    wire([222, top], [196, top]),
    comp('capacitor', [196, top], [164, top], { label: 'C' }),
    wire([164, top], [P[0], top], P),
    wire(P, [84, P[1]]),
    comp('resistor', [84, P[1]], [84, gnd], { label: 'R', side: 'left' }),
    comp('capacitor', [P[0], P[1]], [P[0], gnd], { label: 'C', side: 'right' }),
    wire(a.inv, [nx, a.inv[1]], [nx, fb]),
    dot([nx, fb]),
    wire([nx, fb], [222, fb]),
    comp('resistor', [222, fb], [282, fb], { label: 'R_2', side: 'below' }),
    wire([282, fb], [xo, fb], [xo, a.out[1]]),
    comp('resistor', [nx, fb], [nx, gnd], { label: 'R_1', side: 'left' }),
    wire([84, gnd], [362, gnd]),
    terminal([365, gnd]),
    dot([P[0], gnd]), dot([nx, gnd]),
    voltageArrow([365, a.out[1] + 14], [365, gnd - 12], 'u_2', 'left'),
  );
}

/** Časovač 555 v zapojení astabilného klopného obvodu (puzdro s vývodmi 1 až 8). */
export function ne555Figure(v: { r1?: string; r2?: string; c?: string } = {}): SVGSVGElement {
  const bx0 = 196;
  const bx1 = 296;
  const by0 = 70;
  const by1 = 222;
  const rail = 30;
  const gnd = 262;
  const xr = 130;
  const y7 = 96;
  const y6 = 146;
  const y2 = 196;
  const ymid = 171;
  const bus = 168;
  const x8 = 222;
  const x4 = 270;
  const y3 = 118;
  const y5 = 184;
  const x1 = 246;
  const pin = (x: number, y: number, t: string, anchor: 'start' | 'end' | 'middle') => small(x, y, t, anchor, 'small el-muted');
  return schematic(430, 290, 'Časovač 555 ako astabilný klopný obvod s rezistormi R1, R2 a kondenzátorom C',
    s('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, rx: 4, class: 'b' }),
    s('text', { x: (bx0 + bx1) / 2, y: 158, 'text-anchor': 'middle', class: 'note' }, '555'),
    // napájanie
    wire([xr, rail], [370, rail]),
    terminal([373, rail]),
    supplyLabel(366, rail - 10, '+', 'U_CC', 'end'),
    wire([x8, rail], [x8, by0]), wire([x4, rail], [x4, by0]),
    dot([x8, rail]), dot([x4, rail]), dot([xr, rail]),
    small(x8, by0 + 15, 'VCC', 'middle', 'small'), small(x4, by0 + 15, 'RESET', 'middle', 'small'),
    pin(x8 - 5, by0 - 6, '8', 'end'), pin(x4 - 5, by0 - 6, '4', 'end'),
    // R1, R2, C
    comp('resistor', [xr, rail], [xr, y7], { label: 'R_1', value: v.r1, side: 'left' }),
    dot([xr, y7]),
    wire([xr, y7], [bx0, y7]),
    comp('resistor', [xr, y7], [xr, ymid], { label: 'R_2', value: v.r2, side: 'left' }),
    dot([xr, ymid]),
    wire([xr, ymid], [bus, ymid]),
    wire([bus, y6], [bus, y2]),
    dot([bus, ymid]),
    wire([bus, y6], [bx0, y6]), wire([bus, y2], [bx0, y2]),
    comp('ecap', [xr, ymid], [xr, gnd], { label: 'C', value: v.c, side: 'right' }),
    small(bx0 + 5, y7 + 4, 'DIS', 'start'), small(bx0 + 5, y6 + 4, 'THR', 'start'), small(bx0 + 5, y2 + 4, 'TRIG', 'start'),
    pin(bx0 - 5, y7 - 5, '7', 'end'), pin(bx0 - 5, y6 - 5, '6', 'end'), pin(bx0 - 5, y2 - 5, '2', 'end'),
    // výstup a riadiace napätie
    wire([bx1, y3], [370, y3]),
    terminal([373, y3]),
    small(bx1 - 5, y3 + 4, 'OUT', 'end'), pin(bx1 + 5, y3 - 5, '3', 'start'),
    small(380, y3 + 4, 'výstup', 'start', 'small el-muted'),
    wire([bx1, y5], [330, y5]),
    comp('capacitor', [330, y5], [330, gnd], { value: '10 nF', side: 'right' }),
    small(bx1 - 5, y5 + 4, 'CV', 'end'), pin(bx1 + 5, y5 - 5, '5', 'start'),
    // zem
    wire([x1, by1], [x1, gnd]),
    small(x1, by1 - 8, 'GND', 'middle'), pin(x1 + 5, by1 + 14, '1', 'start'),
    wire([xr, gnd], [330, gnd]),
    dot([x1, gnd]), dot([xr, gnd]),
    ground(x1, gnd),
    voltageArrow([92, ymid + 16], [92, gnd - 14], 'u_C', 'left'),
  );
}

/** Časový priebeh astabilného 555: napätie na kondenzátore a výstup (časy v sekundách). */
export function timer555Chart(R1: number, R2: number, C: number, opts: { ucc?: number; width?: number } = {}): SVGSVGElement {
  const ucc = opts.ucc ?? 9;
  const tau1 = (R1 + R2) * C;
  const tau2 = R2 * C;
  const t1 = Math.LN2 * tau1;
  const t2 = Math.LN2 * tau2;
  const T = t1 + t2;
  const t0 = Math.log(3) * tau1;
  const end = t0 + 2.6 * T;
  const { exp, prefix } = siParts(end, 3);
  const k = (sec: number) => scaleExp(sec, exp);
  const uc = (sec: number) => {
    if (sec < t0) return ucc * (1 - Math.exp(-sec / tau1));
    const ph = (sec - t0) % T;
    return ph < t2 ? (2 / 3) * ucc * Math.exp(-ph / tau2) : ucc - (2 / 3) * ucc * Math.exp(-(ph - t2) / tau1);
  };
  // Výstup: H počas nabíjania, L počas vybíjania – presné hrany.
  const out: [number, number][] = [[0, ucc], [k(t0), ucc], [k(t0), 0]];
  for (let t = t0; t < end; t += T) {
    const a = Math.min(end, t + t2);
    const b = Math.min(end, t + T);
    out.push([k(a), 0]);
    if (a < end) out.push([k(a), ucc], [k(b), ucc]);
    if (b < end) out.push([k(b), 0]);
  }
  const ticks = niceTicks(k(end), 5);
  const o: ChartOptions = {
    ariaLabel: 'Astabilný klopný obvod 555: kondenzátor sa nabíja a vybíja medzi tretinou a dvoma tretinami napájacieho napätia, výstup sa preklápa',
    width: opts.width ?? 460,
    height: 250,
    x: { min: 0, max: k(end), ticks, format: (val) => fmt(val, 3), label: `t [${prefix}s]` },
    y: { min: 0, max: ucc * 1.18, ticks: [0, ucc / 3, (2 * ucc) / 3, ucc], format: (val) => fmt(val, 3), label: 'u [V]' },
    series: [
      { points: out, className: 'green thin' },
      { points: sample(uc, 0, end, 700).map(([x, y]) => [k(x), y]), className: 'copper' },
    ],
    hlines: [{ y: (2 * ucc) / 3, label: '' }, { y: ucc / 3, label: '' }],
    legend: [{ label: 'uC – kondenzátor', className: 'copper' }, { label: 'výstup (vývod 3)', className: 'green' }],
  };
  const xl = k(end) * 0.995;
  return annotatedChart(o, [
    { x: xl, y: (2 * ucc) / 3 + ucc * 0.04, text: '⅔ Ucc', anchor: 'end', cls: 'el-copper' },
    { x: xl, y: ucc / 3 + ucc * 0.04, text: '⅓ Ucc', anchor: 'end', cls: 'el-copper' },
  ]);
}

/** Časový diagram monostabilného 555: spúšťací impulz, napätie na C a výstupný impulz. */
export function monostableFigure(): SVGSVGElement {
  const x0 = 96;
  const xs = 140;
  const xe = 330;
  const x1 = 400;
  const lane = (y: number) => s('line', { x1: x0, y1: y, x2: x1, y2: y, class: 'el-lane' });
  // Napätie na C: exponenciála od 0 po 2/3 Ucc za čas 1,1 RC.
  const yc0 = 178;
  const ych = 46;
  const tauPx = (xe - xs) / Math.log(3);
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = xs + ((xe - xs) * i) / 40;
    const u = 1 - Math.exp(-(x - xs) / tauPx);
    pts.push(`${r1(x)},${r1(yc0 - (u / (2 / 3)) * ych)}`);
  }
  return schematic(420, 290, 'Monostabilný klopný obvod 555: krátky impulz na vstupe 2 spustí výstupný impulz s dĺžkou 1,1 R C',
    lane(80), lane(yc0), lane(256),
    small(x0 - 8, 68, 'vstup 2', 'end', 'small'),
    small(x0 - 8, 82, '(TRIG)', 'end', 'small el-muted'),
    qty(x0 - 8, 160, 'u_C', 'end'),
    small(x0 - 8, 238, 'výstup 3', 'end', 'small'),
    // spúšťací impulz: normálne H, krátko L
    s('polyline', { points: `${x0},50 ${xs},50 ${xs},80 ${xs + 14},80 ${xs + 14},50 ${x1},50`, class: 'el-sig' }),
    // napätie na kondenzátore
    s('line', { x1: x0, y1: yc0 - ych, x2: x1, y2: yc0 - ych, class: 'el-level' }),
    small(x1, yc0 - ych - 6, '⅔ Ucc', 'end', 'small el-muted'),
    s('polyline', { points: `${x0},${yc0} ${pts.join(' ')} ${xe},${yc0} ${x1},${yc0}`, class: 'el-sig el-copper' }),
    // výstup
    s('polyline', { points: `${x0},256 ${xs},256 ${xs},220 ${xe},220 ${xe},256 ${x1},256`, class: 'el-sig el-good' }),
    // pomocné zvislé čiary a dĺžka impulzu
    s('line', { x1: xs, y1: 40, x2: xs, y2: 268, class: 'el-level' }),
    s('line', { x1: xe, y1: 120, x2: xe, y2: 268, class: 'el-level' }),
    s('line', { x1: xs + 6, y1: 206, x2: xe - 6, y2: 206, class: 'varr' }),
    arrowHead(xs + 1, 206, 180, 4, 'arr'),
    arrowHead(xe - 1, 206, 0, 4, 'arr'),
    s('text', { x: (xs + xe) / 2, y: 200, 'text-anchor': 'middle', class: 'el-note el-trace' }, 't = 1,1 · R · C'),
    small(xs + 20, 64, 'spustenie', 'start', 'small el-muted'),
  );
}
