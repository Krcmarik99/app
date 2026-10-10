/**
 * Schémy a grafy pre kapitolu Elektrické stroje: transformátor (konštrukcia, značky, meranie
 * naprázdno a nakrátko, straty), trojfázový, autotransformátor a meracie transformátory,
 * asynchrónny motor (prierez, svorkovnica, momentová charakteristika), jednosmerný motor.
 */
import './fig-machines.css';
import { s } from '../lib/dom';
import { fmt } from '../lib/units';
import { lineChart, sample, type ChartOptions } from './chart';
import { arrowHead, comp, currentArrow, dot, note, qty, schematic, terminal, valueText, voltageArrow, wire, type Pt } from './schematic';

const r1 = (v: number) => Math.round(v * 10) / 10;

// ------------------------------------------------------------------ pomôcky

/**
 * Cievka z polkruhových oblúčikov medzi bodmi a, b. `side` je smer (v súradniciach obrazovky),
 * do ktorého sú oblúčiky vyduté; bez neho sa vydujú doľava od smeru a → b.
 */
export function coil(a: Pt, b: Pt, humps: number, side?: Pt, cls = 'w'): SVGPathElement {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  // Oblúk s príznakom sweep = 1 je vydutý smerom (uy, −ux).
  const sweep = !side || side[0] * uy - side[1] * ux > 0 ? 1 : 0;
  const r = len / (2 * humps);
  let d = `M${r1(x1)} ${r1(y1)}`;
  for (let i = 1; i <= humps; i++) {
    d += `A${r1(r)} ${r1(r)} 0 0 ${sweep} ${r1(x1 + ux * 2 * r * i)} ${r1(y1 + uy * 2 * r * i)}`;
  }
  return s('path', { d, class: cls });
}

/** Popis zložený z veličín s indexmi a znamienok oddelených medzerou, napr. „I_2 − I_1“. */
function fx(x: number, y: number, src: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = ''): SVGTextElement {
  const t = s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: `q ${cls}`.trim() });
  let lowered = false;
  src.split(' ').forEach((tok, i) => {
    const [main, sub] = tok.split('_');
    if (i) t.append(s('tspan', lowered ? { dy: '-0.32em' } : null, '\u00a0'));
    lowered = false;
    t.append(s('tspan', /^[A-Za-zΦφωηβ]$/.test(main) ? { class: 'it' } : null, main));
    if (sub) {
      t.append(s('tspan', { class: 'sub', dy: '0.32em' }, sub));
      lowered = true;
    }
  });
  return t;
}

function small(x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = 'small'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls }, text);
}

/** Wattmeter: krúžok s písmenom W; prúdová cievka leží na vodiči. */
function wattmeter(cx: number, cy: number): SVGElement[] {
  return [
    s('circle', { cx, cy, r: 13, class: 'b' }),
    s('text', { x: cx, y: cy + 4.5, 'text-anchor': 'middle', class: 'meter' }, 'W'),
  ];
}

/** Dve rovnobežné čiary jadra (značka cievok so železným jadrom). */
function coreLines(x1: number, y1: number, x2: number, y2: number, gap = 6): SVGElement[] {
  const vertical = x1 === x2;
  return [
    s('line', { x1, y1, x2, y2, class: 'w' }),
    s('line', { x1: vertical ? x1 + gap : x1, y1: vertical ? y1 : y1 + gap, x2: vertical ? x2 + gap : x2, y2: vertical ? y2 : y2 + gap, class: 'w' }),
  ];
}

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

/** Text v ploche grafu so „svätožiarou“ (čitateľný aj cez čiary mriežky). */
export function chartNote(o: ChartOptions, x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'middle', cls = ''): SVGTextElement {
  const sc = chartScale(o);
  return s('text', { x: r1(sc.x(x)), y: r1(sc.y(y)), 'text-anchor': anchor, class: `mch-note ${cls}`.trim() }, text);
}

/** Pekné zaokrúhlenie rozsahu osi nahor: 1, 2, 2,5, 5 × 10ⁿ. */
export function niceMax(v: number): number {
  const e = 10 ** Math.floor(Math.log10(Math.max(v, 1e-9)));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * e >= v) return k * e;
  return 10 * e;
}

// ------------------------------------------------------------------ transformátor

/** Konštrukcia jednofázového jadrového transformátora: jadro z plechov, dve vinutia, tok Φ, zdroj a záťaž. */
export function transformerConstructionFigure(): SVGSVGElement {
  const core = 'M140 44H320V224H140ZM180 84V184H280V84Z';
  const parts: SVGElement[] = [];
  // Naznačený zväzok plechov – zadné vrstvy posunuté šikmo hore.
  for (const k of [3, 2, 1]) {
    parts.push(s('path', { d: core, class: 'core', 'fill-rule': 'evenodd', transform: `translate(${k * 3} ${-k * 3})`, opacity: 0.55 + 0.1 * (3 - k) }));
  }
  parts.push(s('path', { d: core, class: 'core', 'fill-rule': 'evenodd' }));
  // Magnetický tok v strede jadra.
  parts.push(
    s('path', { d: 'M160 64H300V204H160Z', class: 'mch-flux' }),
    arrowHead(238, 64, 0, 5, 'mch-flux-head'),
    arrowHead(222, 204, 180, 5, 'mch-flux-head'),
    qty(230, 112, 'Φ', 'middle', 'trace'),
  );
  // Primárne vinutie – viac závitov tenšieho drôtu.
  let d1 = '';
  for (let i = 0; i <= 10; i++) d1 += `M132 ${89 + i * 9}L188 ${94 + i * 9}`;
  parts.push(s('rect', { x: 132, y: 85, width: 56, height: 101, rx: 3, class: 'mch-coil' }), s('path', { d: d1, class: 'mch-turn' }));
  // Sekundárne vinutie – menej závitov hrubšieho drôtu.
  let d2 = '';
  for (let i = 0; i <= 5; i++) d2 += `M272 ${93 + i * 18}L328 ${98 + i * 18}`;
  parts.push(s('rect', { x: 272, y: 85, width: 56, height: 101, rx: 3, class: 'mch-coil' }), s('path', { d: d2, class: 'mch-turn mch-thick' }));
  parts.push(
    comp('acsource', [70, 89], [70, 179], { label: 'U_1', side: 'left' }),
    wire([70, 89], [132, 89]),
    wire([70, 179], [132, 179]),
    currentArrow([100, 89], 'r', 'I_1'),
    wire([328, 98], [404, 98]),
    wire([328, 188], [404, 188]),
    comp('resistor', [404, 98], [404, 188], { label: 'Z', side: 'right' }),
    currentArrow([354, 98], 'r', 'I_2'),
    voltageArrow([380, 112], [380, 174], 'U_2', 'left'),
    qty(194, 140, 'N_1', 'start'),
    qty(266, 140, 'N_2', 'end'),
    small(232, 28, 'jadro z izolovaných plechov'),
    small(160, 248, 'primárne vinutie'),
    small(300, 248, 'sekundárne vinutie'),
  );
  return schematic(460, 258, 'Jednofázový transformátor: jadro z plechov, primárne vinutie N1 pripojené na zdroj U1, sekundárne vinutie N2 so záťažou Z, magnetický tok Φ v jadre', ...parts);
}

/** Jadrový a plášťový transformátor v reze: vinutie NN pri jadre, vinutie VN navonok. */
export function coreTypesFigure(): SVGSVGElement {
  const win = (x: number, w: number, cls: 'mch-nn' | 'mch-vn') => s('rect', { x, y: 58, width: w, height: 84, rx: 2, class: cls });
  return schematic(440, 224, 'Jadrový (stĺpový) a plášťový transformátor v reze, vinutie nižšieho napätia je navinuté bližšie pri jadre',
    s('path', { d: 'M40 30H200V170H40ZM64 54V146H176V54Z', class: 'core', 'fill-rule': 'evenodd' }),
    win(66, 8, 'mch-nn'), win(77, 12, 'mch-vn'), win(30, 8, 'mch-nn'), win(15, 12, 'mch-vn'),
    win(166, 8, 'mch-nn'), win(151, 12, 'mch-vn'), win(202, 8, 'mch-nn'), win(213, 12, 'mch-vn'),
    s('path', { d: 'M255 30H425V170H255ZM275 54V146H320V54ZM360 54V146H405V54Z', class: 'core', 'fill-rule': 'evenodd' }),
    win(310, 8, 'mch-nn'), win(295, 12, 'mch-vn'), win(362, 8, 'mch-nn'), win(373, 12, 'mch-vn'),
    small(120, 192, 'jadrový (stĺpový) typ', 'middle', 'label'),
    small(340, 192, 'plášťový typ', 'middle', 'label'),
    s('rect', { x: 112, y: 205, width: 16, height: 10, rx: 2, class: 'mch-vn' }),
    small(134, 214, 'vinutie VN', 'start'),
    s('rect', { x: 248, y: 205, width: 16, height: 10, rx: 2, class: 'mch-nn' }),
    small(270, 214, 'vinutie NN', 'start'),
  );
}

/** Schematické značky transformátora: cievky s jadrom a značka s dvoma kružnicami. */
export function transformerSymbolsFigure(): SVGSVGElement {
  return schematic(420, 176, 'Schematické značky transformátora: dve cievky so železným jadrom a značka s dvoma kružnicami podľa STN EN 60617',
    wire([40, 50], [92, 50]), wire([40, 130], [92, 130]),
    coil([92, 50], [92, 130], 4, [1, 0]),
    ...coreLines(110, 44, 110, 136),
    coil([134, 50], [134, 130], 4, [-1, 0]),
    wire([134, 50], [188, 50]), wire([134, 130], [188, 130]),
    terminal([40, 50]), terminal([40, 130]), terminal([188, 50]), terminal([188, 130]),
    qty(92, 38, 'N_1'), qty(134, 38, 'N_2'),
    voltageArrow([56, 62], [56, 118], 'U_1', 'right'),
    voltageArrow([172, 62], [172, 118], 'U_2', 'left'),
    small(114, 162, 'a) cievky so železným jadrom'),
    wire([236, 90], [265, 90]),
    s('circle', { cx: 290, cy: 90, r: 25, class: 'w' }),
    s('circle', { cx: 326, cy: 90, r: 25, class: 'w' }),
    wire([351, 90], [384, 90]),
    terminal([236, 90]), terminal([384, 90]),
    qty(250, 78, 'U_1'), qty(370, 78, 'U_2'),
    small(310, 162, 'b) značka podľa STN EN 60617'),
  );
}

export interface TransformerValues {
  u1?: string;
  u2?: string;
  i1?: string;
  i2?: string;
  z?: string;
  p?: string;
}

/** Zdroj, transformátor a záťaž – voliteľne s hodnotami (kalkulačka). */
export function transformerCircuitFigure(v: TransformerValues = {}): SVGSVGElement {
  const top = 48;
  const bot = 148;
  const parts: SVGElement[] = [
    comp('acsource', [80, top], [80, bot], { label: 'U_1', value: v.u1, side: 'left' }),
    wire([80, top], [170, top], [170, 58]),
    coil([170, 58], [170, 138], 4, [1, 0]),
    wire([170, 138], [170, bot], [80, bot]),
    ...coreLines(188, 54, 188, 142),
    coil([212, 58], [212, 138], 4, [-1, 0]),
    wire([212, 58], [212, top], [330, top]),
    wire([212, 138], [212, bot], [330, bot]),
    comp('resistor', [330, top], [330, bot], { label: 'Z_2', value: v.z, side: 'right' }),
    currentArrow([120, top], 'r', 'I_1'),
    currentArrow([270, top], 'r', 'I_2'),
    voltageArrow([300, 62], [300, 134], 'U_2', 'left'),
    qty(156, 103, 'N_1', 'end'),
    qty(226, 103, 'N_2', 'start'),
  ];
  if (v.i1) parts.push(valueText(120, 64, v.i1));
  if (v.i2) parts.push(valueText(270, 64, v.i2));
  if (v.u2) parts.push(valueText(291, 118, v.u2, 'end'));
  if (v.p) parts.push(valueText(191, 170, `p = ${v.p}`));
  return schematic(400, v.p ? 182 : 166, 'Transformátor napájaný napätím U1 so záťažou Z2 na sekundárnej strane', ...parts);
}

/** Meranie transformátora naprázdno (open) alebo nakrátko (short): ampérmeter, wattmeter a voltmeter na primári. */
export function transformerTestFigure(kind: 'open' | 'short'): SVGSVGElement {
  const top = 44;
  const bot = 176;
  const open = kind === 'open';
  const parts: SVGElement[] = [
    comp('acsource', [60, top], [60, bot], { label: open ? 'U_1n' : 'U_k', side: 'left' }),
    wire([60, top], [86, top]),
    comp('ammeter', [86, top], [134, top], { label: open ? 'I_0' : 'I_1n' }),
    wire([134, top], [155, top]),
    ...wattmeter(168, top),
    qty(168, top - 19, open ? 'P_0' : 'P_k'),
    wire([181, top], [276, top], [276, 70]),
    wire([168, top + 13], [168, bot]),
    comp('voltmeter', [214, top], [214, bot], { label: open ? 'U_1n' : 'U_k', side: 'right' }),
    coil([276, 70], [276, 150], 4, [1, 0]),
    wire([276, 150], [276, bot], [60, bot]),
    ...coreLines(294, 66, 294, 154),
    coil([318, 70], [318, 150], 4, [-1, 0]),
    wire([318, 70], [318, top], [390, top]),
    wire([318, 150], [318, bot], [390, bot]),
    open
      ? comp('voltmeter', [390, top], [390, bot], { label: 'U_20', side: 'right' })
      : comp('ammeter', [390, top], [390, bot], { label: 'I_2n', side: 'right' }),
    dot([168, bot]), dot([214, top]), dot([214, bot]),
    small(354, 202, open ? 'sekundár naprázdno' : 'sekundár nakrátko'),
  ];
  if (!open) {
    parts.push(
      s('line', { x1: 42, y1: 130, x2: 74, y2: 94, class: 'w thin' }),
      arrowHead(77, 90.5, -48, 3.6),
      small(60, 202, 'regulovateľný zdroj'),
    );
  }
  return schematic(460, 212, open
    ? 'Meranie naprázdno: na primár je pripojené menovité napätie, ampérmeter meria prúd naprázdno I0, wattmeter straty naprázdno P0, voltmetre napätia U1n a U20'
    : 'Meranie nakrátko: sekundár je skratovaný ampérmetrom, napätie zdroja sa zvyšuje, kým netečie menovitý prúd; wattmeter meria straty nakrátko Pk', ...parts);
}

/** Straty transformátora v závislosti od činiteľa zaťaženia β. */
export function lossesChart(): SVGSVGElement {
  const P0 = 0.25;
  const Pk = 1.75;
  const bOpt = Math.sqrt(P0 / Pk);
  const o: ChartOptions = {
    ariaLabel: 'Straty v železe sú stále, straty vo vinutí rastú s druhou mocninou zaťaženia; pri βopt sa rovnajú',
    width: 440,
    x: { min: 0, max: 1.4, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4], format: (v) => fmt(v), label: 'β [–]' },
    y: { min: 0, max: 4, ticks: [0, 1, 2, 3, 4], format: (v) => fmt(v), label: 'ΔP [kW]' },
    series: [
      { points: sample(() => P0, 0, 1.4, 2), className: 'copper' },
      { points: sample((b) => b * b * Pk, 0, 1.4, 120), className: 'green' },
      { points: sample((b) => P0 + b * b * Pk, 0, 1.4, 120) },
    ],
    vlines: [{ x: bOpt, label: `βopt = ${fmt(bOpt, 2)}` }],
    markers: [{ x: bOpt, y: P0, label: 'ΔPCu = ΔP₀', above: false }],
    legend: [{ label: 'ΔP₀ (železo)', className: 'copper' }, { label: 'β² · ΔPk (vinutie)', className: 'green' }, { label: 'spolu' }],
  };
  return lineChart(o);
}

/** Vonkajšia (zaťažovacia) charakteristika U2 = f(β) pri rôznom charaktere záťaže. */
export function outputCharacteristicChart(): SVGSVGElement {
  const uR = 1.5;
  const uX = Math.sqrt(6 * 6 - uR * uR);
  const u2 = (b: number, cos: number, sign: number) => 100 - b * (uR * cos + sign * uX * Math.sqrt(1 - cos * cos));
  return lineChart({
    ariaLabel: 'Sekundárne napätie klesá so zaťažením pri odporovej a induktívnej záťaži, pri kapacitnej záťaži môže stúpať',
    width: 440,
    x: { min: 0, max: 1.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], format: (v) => fmt(v), label: 'β [–]' },
    y: { min: 92, max: 104, ticks: [92, 94, 96, 98, 100, 102, 104], format: (v) => fmt(v), label: 'U₂ / U₂₀ [%]' },
    series: [
      { points: sample((b) => u2(b, 1, 1), 0, 1.2, 40) },
      { points: sample((b) => u2(b, 0.8, 1), 0, 1.2, 40), className: 'copper' },
      { points: sample((b) => u2(b, 0.8, -1), 0, 1.2, 40), className: 'green' },
    ],
    legend: [{ label: 'záťaž R' }, { label: 'RL (0,8 ind.)', className: 'copper' }, { label: 'RC (0,8 kap.)', className: 'green' }],
  });
}

// ------------------------------------------------------------------ trojfázový a špeciálne transformátory

/** Trojfázový jadrový transformátor v reze: tri stĺpy, na každom vinutie NN a VN jednej fázy. */
export function threePhaseCoreFigure(): SVGSVGElement {
  const win = (x: number, w: number, cls: 'mch-nn' | 'mch-vn') => s('rect', { x, y: 72, width: w, height: 72, rx: 2, class: cls });
  const legs = [58, 220, 382];
  const parts: SVGElement[] = [
    s('path', { d: 'M44 40H396V176H44ZM72 68V148H206V68ZM234 68V148H368V68Z', class: 'core', 'fill-rule': 'evenodd' }),
    win(34, 8, 'mch-nn'), win(19, 12, 'mch-vn'), win(74, 8, 'mch-nn'), win(85, 12, 'mch-vn'),
    win(196, 8, 'mch-nn'), win(181, 12, 'mch-vn'), win(236, 8, 'mch-nn'), win(247, 12, 'mch-vn'),
    win(358, 8, 'mch-nn'), win(343, 12, 'mch-vn'), win(398, 8, 'mch-nn'), win(409, 12, 'mch-vn'),
  ];
  legs.forEach((x, i) => {
    parts.push(
      s('line', { x1: x, y1: 140, x2: x, y2: 84, class: 'varr' }),
      arrowHead(x, 78, -90, 4.4, 'arr'),
      qty(x, 30, `Φ_${i + 1}`, 'middle', 'trace'),
      small(x, 196, ['1U – 2U', '1V – 2V', '1W – 2W'][i], 'middle', 'label'),
    );
  });
  parts.push(
    s('rect', { x: 66, y: 209, width: 16, height: 10, rx: 2, class: 'mch-vn' }),
    small(88, 218, 'vinutie VN (1U, 1V, 1W)', 'start'),
    s('rect', { x: 250, y: 209, width: 16, height: 10, rx: 2, class: 'mch-nn' }),
    small(272, 218, 'vinutie NN (2U, 2V, 2W)', 'start'),
  );
  return schematic(440, 228, 'Trojfázový transformátor s jadrom s tromi stĺpmi; na každom stĺpe je vinutie VN aj NN jednej fázy, toky Φ1, Φ2, Φ3 sú posunuté o 120°', ...parts);
}

const add = (p: Pt, d: Pt, k: number): Pt => [r1(p[0] + d[0] * k), r1(p[1] + d[1] * k)];

/** Úsek vodiča s cievkou v strede. */
function coilSegment(a: Pt, b: Pt, humps: number, from = 0.2, to = 0.8, side?: Pt): SVGElement[] {
  const d: Pt = [b[0] - a[0], b[1] - a[1]];
  const c1 = add(a, d, from);
  const c2 = add(a, d, to);
  return [wire(a, c1), coil(c1, c2, humps, side), wire(c2, b)];
}

/** Zapojenie vinutí trojfázového transformátora: hviezda, trojuholník a lomená hviezda (cik-cak). */
export function windingConnectionsFigure(): SVGSVGElement {
  const parts: SVGElement[] = [];
  const lab = (p: Pt, t: string) => small(p[0], p[1] + 4, t, 'middle', 'label');
  // Hviezda so stredným vodičom.
  const cy: Pt = [85, 100];
  const dirs: Pt[] = [[0, -1], [0.866, 0.5], [-0.866, 0.5]];
  dirs.forEach((d, i) => {
    const end = add(cy, d, 64);
    parts.push(...coilSegment(cy, end, 3, 0.22, 0.78), terminal(end), lab(add(cy, d, 78), 'UVW'[i]));
  });
  parts.push(wire(cy, [85, 146]), terminal([85, 146]), lab([85, 162], 'N'), dot(cy), small(85, 192, 'hviezda Y, y', 'middle', 'label'));
  // Trojuholník.
  const cd: Pt = [250, 110];
  const vtx: Pt[] = dirs.map((d) => add(cd, d, 58));
  vtx.forEach((v, i) => {
    const w = vtx[(i + 1) % 3];
    const mid: Pt = [(v[0] + w[0]) / 2 - cd[0], (v[1] + w[1]) / 2 - cd[1]];
    parts.push(...coilSegment(v, w, 4, 0.25, 0.75, mid));
    const out = add(cd, dirs[i], 74);
    parts.push(wire(v, out), dot(v), terminal(out), lab(add(cd, dirs[i], 88), 'UVW'[i]));
  });
  parts.push(small(250, 192, 'trojuholník D, d', 'middle', 'label'));
  // Lomená hviezda: každá fáza má dve polovice vinutia na rôznych stĺpoch.
  const cz: Pt = [410, 96];
  const zz: [Pt, Pt][] = [[[0, -1], [-0.866, -0.5]], [[0.866, 0.5], [0.866, -0.5]], [[-0.866, 0.5], [0, 1]]];
  zz.forEach(([d1, d2], i) => {
    const p1 = add(cz, d1, 37);
    const p2 = add(p1, d2, 37);
    parts.push(...coilSegment(cz, p1, 2, 0.18, 0.86), ...coilSegment(p1, p2, 2, 0.14, 0.82), dot(p1), terminal(p2), lab(add(p2, d2, 14), 'UVW'[i]));
  });
  parts.push(wire(cz, [410, 146]), terminal([410, 146]), lab([410, 162], 'N'), dot(cz), small(420, 192, 'lomená hviezda Z, z', 'middle', 'label'));
  return schematic(500, 200, 'Zapojenie vinutí trojfázového transformátora: hviezda so stredným vodičom, trojuholník a lomená hviezda', ...parts);
}

/** Autotransformátor: jedno vinutie s odbočkou, spoločnou časťou tečie rozdiel prúdov. */
export function autotransformerFigure(): SVGSVGElement {
  return schematic(400, 236, 'Autotransformátor: vstupné napätie U1 na celom vinutí, výstupné napätie U2 z odbočky; spoločnou časťou vinutia tečie rozdiel prúdov I2 − I1',
    comp('acsource', [56, 40], [56, 200], { label: 'U_1', side: 'left' }),
    wire([56, 40], [190, 40], [190, 44]),
    coil([190, 44], [190, 196], 8, [-1, 0]),
    wire([190, 196], [190, 200]),
    wire([56, 200], [320, 200]),
    ...coreLines(164, 50, 164, 190),
    wire([190, 120], [320, 120]),
    dot([190, 120]), dot([190, 200]),
    comp('resistor', [320, 120], [320, 200], { label: 'Z', side: 'right' }),
    currentArrow([118, 40], 'r', 'I_1'),
    currentArrow([262, 120], 'r', 'I_2'),
    s('line', { x1: 206, y1: 188, x2: 206, y2: 152, class: 'varr' }),
    arrowHead(206, 146, -90, 4.4, 'arr'),
    fx(216, 182, 'I_2 − I_1', 'start', 'trace'),
    small(216, 156, 'spoločná časť', 'start'),
    small(206, 80, 'sériová časť', 'start'),
    voltageArrow([358, 134], [358, 188], 'U_2', 'right'),
  );
}

/** Merací transformátor prúdu s ampérmetrom a merací transformátor napätia s voltmetrom. */
export function instrumentTransformersFigure(): SVGSVGElement {
  return schematic(470, 248, 'Merací transformátor prúdu (MTP) v sérii s vedením a ampérmetrom na sekundári; merací transformátor napätia (MTN) medzi vodičmi s voltmetrom na sekundári',
    wire([26, 40], [440, 40]),
    wire([26, 212], [440, 212]),
    terminal([26, 40]), terminal([26, 212]),
    note(14, 45, 'L', 'end'), note(14, 217, 'N', 'end'),
    comp('resistor', [440, 40], [440, 212], { label: 'Z', side: 'right' }),
    currentArrow([62, 40], 'r', 'I_1'),
    // MTP
    s('line', { x1: 96, y1: 40, x2: 156, y2: 40, class: 'w thick' }),
    ...coreLines(100, 50, 152, 50, 5),
    coil([102, 68], [150, 68], 4, [0, -1]),
    wire([102, 68], [102, 126]),
    wire([150, 68], [150, 126]),
    comp('ammeter', [102, 126], [150, 126], { label: 'I_2', side: 'below' }),
    small(96, 30, 'P1'), small(156, 30, 'P2'),
    small(94, 92, 'S1', 'end'), small(158, 92, 'S2', 'start'),
    small(126, 184, 'MTP', 'middle', 'label'),
    // MTN
    dot([262, 40]),
    wire([262, 40], [262, 80]),
    coil([262, 80], [262, 160], 4, [1, 0]),
    wire([262, 160], [262, 212]),
    dot([262, 212]),
    ...coreLines(280, 76, 280, 164),
    coil([304, 80], [304, 160], 4, [-1, 0]),
    wire([304, 80], [350, 80]),
    wire([304, 160], [350, 160]),
    comp('voltmeter', [350, 80], [350, 160], { label: 'U_2', side: 'right' }),
    small(250, 76, 'A', 'end'), small(250, 174, 'N', 'end'),
    small(314, 72, 'a', 'start'), small(314, 176, 'n', 'start'),
    small(292, 196, 'MTN', 'middle', 'label'),
  );
}

// ------------------------------------------------------------------ asynchrónny motor

/** Prierez dvojpólového asynchrónneho motora: stator s trojfázovým vinutím a klietkový rotor. */
export function motorCrossSectionFigure(): SVGSVGElement {
  const cx = 170;
  const cy = 150;
  const P = (deg: number, r: number): Pt => [r1(cx + r * Math.cos((deg * Math.PI) / 180)), r1(cy + r * Math.sin((deg * Math.PI) / 180))];
  const parts: SVGElement[] = [
    s('path', { d: `M${cx - 118} ${cy}a118 118 0 1 0 236 0a118 118 0 1 0 -236 0ZM${cx - 74} ${cy}a74 74 0 1 0 148 0a74 74 0 1 0 -148 0Z`, class: 'core', 'fill-rule': 'evenodd' }),
    s('circle', { cx, cy, r: 68, class: 'core' }),
  ];
  for (let i = 0; i < 16; i++) {
    const [x, y] = P(i * 22.5 + 11.25, 58);
    parts.push(s('circle', { cx: x, cy: y, r: 4.2, class: 'mch-bar' }));
  }
  parts.push(s('circle', { cx, cy, r: 13, class: 'b' }));
  const slots: [string, number, 'u' | 'v' | 'w'][] = [
    ['U1', -90, 'u'], ['W2', -30, 'w'], ['V1', 30, 'v'], ['U2', 90, 'u'], ['W1', 150, 'w'], ['V2', 210, 'v'],
  ];
  const txt = { u: 'copper', v: 'trace', w: 'good' };
  for (const [name, deg, ph] of slots) {
    const [x, y] = P(deg, 90);
    const [lx, ly] = P(deg, 134);
    parts.push(
      s('circle', { cx: x, cy: y, r: 9, class: `mch-ph-${ph}` }),
      small(lx, ly + 5, name, 'middle', `label ${txt[ph]}`),
    );
  }
  const [ax, ay] = P(-150, 38);
  const [bx, by] = P(-30, 38);
  parts.push(
    s('path', { d: `M${ax} ${ay}A38 38 0 0 1 ${bx} ${by}`, class: 'varr' }),
    arrowHead(bx + 1, by + 1.7, 60, 4.4, 'arr'),
    qty(cx, 104, 'n', 'middle', 'trace'),
    small(270, 154, 'stator'),
    small(cx, 196, 'rotor'),
  );
  return schematic(340, 300, 'Prierez dvojpólového asynchrónneho motora: v drážkach statora sú strany cievok U1–U2, V1–V2, W1–W2 posunuté o 120°, rotor nakrátko má hliníkové tyče', ...parts);
}

/** Svorkovnica asynchrónneho motora so spojkami pre zapojenie do hviezdy a do trojuholníka. */
export function terminalBoxFigure(): SVGSVGElement {
  const parts: SVGElement[] = [];
  for (const [ox, kind] of [[0, 'Y'], [210, 'D']] as const) {
    const xs = [ox + 55, ox + 105, ox + 155];
    const top = 82;
    const bot = 142;
    parts.push(
      s('line', { x1: xs[0], y1: top, x2: xs[1], y2: bot, class: 'w thin dash ink2' }),
      s('line', { x1: xs[1], y1: top, x2: xs[2], y2: bot, class: 'w thin dash ink2' }),
      s('line', { x1: xs[2], y1: top, x2: xs[0], y2: bot, class: 'w thin dash ink2' }),
    );
    xs.forEach((x, i) => {
      parts.push(wire([x, 36], [x, top - 8]), small(x, 28, `L${i + 1}`, 'middle', 'label'));
      parts.push(s('circle', { cx: x, cy: top, r: 8, class: 'b' }), s('circle', { cx: x, cy: bot, r: 8, class: 'b' }));
      parts.push(small(x + 12, top - 9, ['U1', 'V1', 'W1'][i], 'start'), small(x + 12, bot + 21, ['W2', 'U2', 'V2'][i], 'start'));
    });
    if (kind === 'Y') {
      parts.push(s('rect', { x: xs[0] - 8, y: bot - 6, width: xs[2] - xs[0] + 16, height: 12, rx: 3, class: 'mch-link' }));
    } else {
      for (const x of xs) parts.push(s('rect', { x: x - 6, y: top - 7, width: 12, height: bot - top + 14, rx: 3, class: 'mch-link' }));
    }
    for (const x of xs) parts.push(s('circle', { cx: x, cy: top, r: 2.6, class: 'f' }), s('circle', { cx: x, cy: bot, r: 2.6, class: 'f' }));
    parts.push(small(ox + 105, 192, kind === 'Y' ? 'do hviezdy (Y)' : 'do trojuholníka (D)', 'middle', 'label'));
  }
  return schematic(420, 202, 'Svorkovnica asynchrónneho motora: spojky pre zapojenie do hviezdy spájajú svorky W2, U2, V2; pre trojuholník spájajú U1 s W2, V1 s U2 a W1 s V2', ...parts);
}

/** Moment klietkového motora pri sklze s (Klossov vzťah s kritickým sklzom, ktorý rastie so sklzom – vytláčanie prúdu v tyčiach). */
function cageTorque(sl: number): number {
  if (sl <= 0) return 0;
  const sk = 0.12 * (1 + 4 * sl);
  return (2 * 2.5) / (sl / sk + sk / sl);
}

/** Typická momentová charakteristika klietkového asynchrónneho motora M = f(n). */
export function torqueCharacteristicChart(): SVGSVGElement {
  const ns = 1500;
  const nk = ns * (1 - 0.12 / (1 - 0.48));
  const nn = ns * (1 - 0.0278);
  const o: ChartOptions = {
    ariaLabel: 'Momentová charakteristika asynchrónneho motora: záberový moment pri n = 0, maximálny (zvratový) moment a menovitý moment blízko synchrónnych otáčok',
    width: 440,
    height: 250,
    x: { min: 0, max: ns, ticks: [0, 250, 500, 750, 1000, 1250, 1500], format: (v) => fmt(v), label: 'n [ot/min]' },
    y: { min: 0, max: 3, ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], format: (v) => fmt(v), label: 'M / Mn' },
    series: [{ points: sample((n) => cageTorque((ns - n) / ns), 0, ns, 300) }],
    markers: [
      { x: 0, y: cageTorque(1), label: 'Mz – záberový', above: true },
      { x: nk, y: 2.5, label: 'Mmax', above: true },
      { x: nn, y: 1, label: 'Mn' },
    ],
  };
  const svg = lineChart(o);
  svg.append(
    chartNote(o, 560, 1.25, 'nestabilná oblasť', 'middle', 'mch-muted'),
    chartNote(o, 1495, 2.88, 'stabilná oblasť', 'end', 'mch-muted'),
    chartNote(o, 1470, 0.18, 'ns', 'end', 'mch-trace'),
  );
  return svg;
}

// ------------------------------------------------------------------ jednosmerné stroje

/** Princíp komutátora: závit medzi pólmi N a S, dvojlamelový komutátor a kefy. */
export function commutatorFigure(): SVGSVGElement {
  const cx = 190;
  const cy = 128;
  const seg = (a0: number, a1: number) => {
    const P = (deg: number, r: number) => `${r1(cx + r * Math.cos((deg * Math.PI) / 180))} ${r1(cy + r * Math.sin((deg * Math.PI) / 180))}`;
    return s('path', { d: `M${P(a0, 22)}A22 22 0 0 1 ${P(a1, 22)}L${P(a1, 13)}A13 13 0 0 0 ${P(a0, 13)}Z`, class: 'mch-seg' });
  };
  return schematic(380, 272, 'Princíp jednosmerného motora: závit kotvy medzi pólmi N a S je cez komutátor a kefy pripojený na zdroj; sily F na strany závitu vytvoria moment',
    s('path', { d: 'M30 68H140A78 78 0 0 0 140 188H30Z', class: 'mch-pole-n' }),
    s('path', { d: 'M350 68H240A78 78 0 0 1 240 188H350Z', class: 'mch-pole-s' }),
    small(70, 134, 'N', 'middle', 'label'),
    small(310, 134, 'S', 'middle', 'label'),
    s('circle', { cx, cy, r: 66, class: 'core' }),
    // Indukčná čiara poľa N → S.
    s('line', { x1: 136, y1: 74, x2: 238, y2: 74, class: 'mch-flux' }),
    arrowHead(244, 74, 0, 4.4, 'mch-flux-head'),
    qty(172, 68, 'B', 'middle', 'trace'),
    // Spojenie strán závitu s lamelami (čelo vinutia vpredu).
    s('path', { d: `M146 120L${cx - 11} ${cy - 19}`, class: 'w copper' }),
    s('path', { d: `M234 120L${cx + 11} ${cy - 19}`, class: 'w copper' }),
    seg(100, 260),
    seg(280, 440),
    s('circle', { cx, cy, r: 5, class: 'b' }),
    // Strany závitu: vľavo prúd do papiera, vpravo z papiera.
    s('circle', { cx: 142, cy, r: 9, class: 'b' }),
    s('path', { d: 'M136 122L148 134M148 122L136 134', class: 'w thin' }),
    s('circle', { cx: 238, cy, r: 9, class: 'b' }),
    s('circle', { cx: 238, cy, r: 2.6, class: 'f' }),
    // Kefy a prívody.
    s('rect', { x: 152, y: 121, width: 16, height: 14, rx: 2, class: 'mch-brush' }),
    s('rect', { x: 212, y: 121, width: 16, height: 14, rx: 2, class: 'mch-brush' }),
    wire([160, 135], [160, 238]),
    wire([220, 135], [220, 238]),
    terminal([160, 240]), terminal([220, 240]),
    note(160, 262, '+'), note(220, 262, '−'),
    // Sily na strany závitu.
    s('line', { x1: 142, y1: 140, x2: 142, y2: 164, class: 'varr' }),
    arrowHead(142, 170, 90, 4.4, 'arr'),
    qty(132, 166, 'F', 'end', 'trace'),
    s('line', { x1: 238, y1: 116, x2: 238, y2: 92, class: 'varr' }),
    arrowHead(238, 86, -90, 4.4, 'arr'),
    qty(248, 96, 'F', 'start', 'trace'),
    // Smer otáčania.
    s('path', { d: 'M230 59A80 80 0 0 0 150 59', class: 'varr' }),
    arrowHead(147, 61, 150, 4.4, 'arr'),
    qty(cx, 38, 'n', 'middle', 'trace'),
  );
}

/** Armatúra (kotva) jednosmerného motora: krúžok s písmenom M a kefami. */
function armature(x: number, cy: number): SVGElement[] {
  return [
    s('circle', { cx: x, cy, r: 16, class: 'b' }),
    s('rect', { x: x - 6, y: cy - 22, width: 12, height: 6, class: 'f' }),
    s('rect', { x: x - 6, y: cy + 16, width: 12, height: 6, class: 'f' }),
    small(x, cy + 5, 'M', 'middle', 'label'),
  ];
}

/** Zapojenie jednosmerného motora s derivačným a so sériovým budením, s rozbehovým odporom. */
export function dcConnectionsFigure(): SVGSVGElement {
  return schematic(440, 234, 'Jednosmerný motor s derivačným budením (budiace vinutie paralelne ku kotve) a so sériovým budením (budiace vinutie v sérii s kotvou); Rs je rozbehový odpor',
    // derivačné
    terminal([30, 40]), terminal([30, 196]),
    note(18, 45, '+', 'end'), note(18, 201, '−', 'end'),
    wire([33, 40], [170, 40]), wire([33, 196], [170, 196]),
    currentArrow([56, 40], 'r', 'I'),
    comp('inductor', [86, 40], [86, 196]),
    small(76, 122, 'budenie', 'end'),
    currentArrow([86, 66], 'd', 'I_b', 'right'),
    dot([86, 40]), dot([86, 196]),
    comp('varres', [170, 40], [170, 100], { label: 'R_s', side: 'right' }),
    wire([170, 100], [170, 122]),
    currentArrow([170, 108], 'd', 'I_a', 'right'),
    ...armature(170, 144),
    wire([170, 166], [170, 196]),
    small(104, 226, 'derivačné budenie', 'middle', 'label'),
    // sériové
    terminal([250, 40]), terminal([250, 196]),
    note(238, 45, '+', 'end'), note(238, 201, '−', 'end'),
    wire([253, 40], [268, 40]),
    comp('varres', [268, 40], [316, 40], { label: 'R_s' }),
    wire([316, 40], [334, 40]),
    comp('inductor', [334, 40], [386, 40]),
    small(360, 24, 'budenie'),
    wire([386, 40], [404, 40], [404, 98]),
    currentArrow([404, 70], 'd', 'I', 'right'),
    ...armature(404, 120),
    wire([404, 142], [404, 196], [253, 196]),
    small(330, 226, 'sériové budenie', 'middle', 'label'),
  );
}

/** Otáčkové (mechanické) charakteristiky n = f(M) motora s derivačným a so sériovým budením. */
export function dcSpeedChart(): SVGSVGElement {
  const o: ChartOptions = {
    ariaLabel: 'Pri derivačnom budení otáčky so zaťažením klesajú len málo, pri sériovom budení prudko klesajú a pri malom zaťažení nebezpečne rastú',
    width: 440,
    height: 250,
    x: { min: 0, max: 2, ticks: [0, 0.5, 1, 1.5, 2], format: (v) => fmt(v), label: 'M / Mn' },
    y: { min: 0, max: 3, ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3], format: (v) => fmt(v), label: 'n / nn' },
    series: [
      { points: sample((m) => 1.05 - 0.05 * m, 0, 2, 20) },
      { points: sample((m) => 1.1 / Math.sqrt(m) - 0.1, 0.1, 2, 200), className: 'copper' },
    ],
    markers: [{ x: 1, y: 1, label: 'menovitý bod', above: true }],
    legend: [{ label: 'derivačné (cudzie) budenie' }, { label: 'sériové budenie', className: 'copper' }],
  };
  const svg = lineChart(o);
  svg.append(chartNote(o, 0.42, 2.7, 'naprázdno by sa „rozbehol“', 'start', 'mch-copper'));
  return svg;
}
