/**
 * Obrázky a interaktívne prvky ku kapitole Číslicová technika: logické značky podľa
 * STN EN 60617-12 (aj tvarové značky ANSI), prevody číselných sústav, Karnaughova mapa,
 * sčítačka, multiplexor, 7-segmentový displej, klopné obvody, čítače a časové diagramy.
 */
import './fig-digital.css';
import { h, s, type Attrs } from '../lib/dom';
import { rich } from '../lib/formula';
import { arrowHead, dot, schematic, wire, type Pt } from './schematic';

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- text so vzorcom v SVG

interface Seg {
  t: string;
  it: boolean;
  ov: boolean;
  sub: boolean;
  sup: boolean;
}

/** Rozloží zápis ako vo vzorcoch ($A kurzívou, _{..}, ^{..}, @o{..} pruh) na úseky. */
function segments(src: string, ov = false, sub = false, sup = false): Seg[] {
  const out: Seg[] = [];
  let text = '';
  let i = 0;
  const flush = () => {
    if (text) out.push({ t: text, it: false, ov, sub, sup });
    text = '';
  };
  const group = (start: number): [string, number] => {
    let depth = 0;
    let j = start;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return [src.slice(start + 1, j), j + 1];
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === '$' && i + 1 < src.length) {
      flush();
      const c = String.fromCodePoint(src.codePointAt(i + 1) ?? 32);
      out.push({ t: c, it: true, ov, sub, sup });
      i += 1 + c.length;
    } else if (ch === '_' || ch === '^') {
      flush();
      let inner: string;
      if (src[i + 1] === '{') [inner, i] = group(i + 1);
      else {
        inner = src[i + 1] ?? '';
        i += 2;
      }
      out.push(...segments(inner, ov, ch === '_', ch === '^'));
    } else if (ch === '@' && src[i + 1] === 'o') {
      flush();
      const [inner, next] = group(i + 2);
      out.push(...segments(inner, true, sub, sup));
      i = next;
    } else {
      text += ch;
      i += 1;
    }
  }
  flush();
  return out;
}

/** Popis v SVG zapísaný ako vzorec: fx(x, y, '$Y = @o{$A · $B}'). */
export function fx(x: number, y: number, src: string, anchor: 'start' | 'middle' | 'end' = 'start', cls = ''): SVGTextElement {
  const t = s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls || null });
  let shift = 0;
  for (const g of segments(src)) {
    const want = g.sub ? 4 : g.sup ? -6 : 0;
    const attrs: Attrs = {};
    if (want !== shift) {
      attrs.dy = want - shift;
      shift = want;
    }
    const classes = [g.it ? 'it' : '', g.sub || g.sup ? 'sub' : ''].filter(Boolean).join(' ');
    if (classes) attrs.class = classes;
    if (g.ov) attrs['text-decoration'] = 'overline';
    t.append(s('tspan', attrs, g.t));
  }
  return t;
}

const txt = (x: number, y: number, text: string, cls = '', anchor: 'start' | 'middle' | 'end' = 'start') =>
  s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls || null }, text);

/** Vstupná alebo výstupná svorka s popisom. */
function term([x, y]: Pt, label: string, side: 'left' | 'right' | 'above' | 'below'): SVGGElement {
  const pos = { left: [x - 8, y + 5, 'end'], right: [x + 8, y + 5, 'start'], above: [x, y - 9, 'middle'], below: [x, y + 20, 'middle'] } as const;
  const [lx, ly, anchor] = pos[side];
  return s('g', null, s('circle', { cx: x, cy: y, r: 3.2, class: 'b' }), fx(lx, ly, label, anchor));
}

// ---------------------------------------------------------------- logické členy

export type Gate = 'not' | 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'xnor';

export const GATES: readonly Gate[] = ['not', 'and', 'or', 'nand', 'nor', 'xor', 'xnor'];
export const TWO_INPUT: readonly Exclude<Gate, 'not'>[] = ['and', 'or', 'nand', 'nor', 'xor', 'xnor'];

export const GATE_NAME: Record<Gate, string> = {
  not: 'NOT', and: 'AND', or: 'OR', nand: 'NAND', nor: 'NOR', xor: 'XOR', xnor: 'XNOR',
};

/** Kvalifikačný symbol v obdĺžnikovej značke podľa STN EN 60617-12. */
export const GATE_QUAL: Record<Gate, string> = {
  not: '1', and: '&', or: '≥1', nand: '&', nor: '≥1', xor: '=1', xnor: '=1',
};

export const GATE_EXPR: Record<Gate, string> = {
  not: '$Y = @o{$A}',
  and: '$Y = $A · $B',
  or: '$Y = $A + $B',
  nand: '$Y = @o{$A · $B}',
  nor: '$Y = @o{$A + $B}',
  xor: '$Y = $A ⊕ $B',
  xnor: '$Y = @o{$A ⊕ $B}',
};

export const GATE_DESC: Record<Gate, string> = {
  not: 'Invertor: výstup je opačný ako vstup.',
  and: 'Logický súčin: výstup je 1 iba vtedy, keď sú všetky vstupy 1.',
  or: 'Logický súčet: výstup je 1, keď je aspoň jeden vstup 1.',
  nand: 'Negovaný súčin: výstup je 0 iba vtedy, keď sú všetky vstupy 1.',
  nor: 'Negovaný súčet: výstup je 1 iba vtedy, keď sú všetky vstupy 0.',
  xor: 'Nonekvivalencia: výstup je 1, keď sú vstupy rôzne.',
  xnor: 'Ekvivalencia: výstup je 1, keď sú vstupy rovnaké.',
};

export function gateOut(g: Gate, a: number, b = 0): number {
  switch (g) {
    case 'not': return a ? 0 : 1;
    case 'and': return a & b;
    case 'or': return a | b;
    case 'nand': return (a & b) ? 0 : 1;
    case 'nor': return (a | b) ? 0 : 1;
    case 'xor': return a ^ b;
    case 'xnor': return (a ^ b) ? 0 : 1;
  }
}

export const isNegated = (g: Gate) => g === 'not' || g === 'nand' || g === 'nor' || g === 'xnor';

export interface GateOpts {
  /** Počet vstupov (NOT 1, ostatné 2). */
  n?: number;
  pitch?: number;
  w?: number;
  inLen?: number;
  outLen?: number;
  /** Vstupy vpravo, výstup vľavo (napr. v puzdre obvodu). */
  mirror?: boolean;
  inCls?: string[];
  outCls?: string;
}

export interface GatePins {
  g: SVGGElement;
  ins: Pt[];
  out: Pt;
}

/** Obdĺžniková značka logického člena (STN EN 60617-12); x je ľavý okraj, cy stred. */
export function iecGate(kind: Gate, x: number, cy: number, o: GateOpts = {}): GatePins {
  const n = o.n ?? (kind === 'not' ? 1 : 2);
  const pitch = o.pitch ?? 20;
  const w = o.w ?? 36;
  const hh = Math.max(40, (n - 1) * pitch + 28);
  const inLen = o.inLen ?? 14;
  const outLen = o.outLen ?? 16;
  const d = o.mirror ? -1 : 1;
  const inEdge = o.mirror ? x + w : x;
  const outEdge = o.mirror ? x : x + w;
  const g = s('g', { class: 'dg-gate' });
  const ins: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const y = r1(cy + (i - (n - 1) / 2) * pitch);
    const x0 = inEdge - d * inLen;
    if (inLen > 0) g.append(s('line', { x1: x0, y1: y, x2: inEdge, y2: y, class: `w ${o.inCls?.[i] ?? ''}`.trim() }));
    ins.push([x0, y]);
  }
  const neg = isNegated(kind);
  const end = outEdge + d * Math.max(outLen, neg ? 8 : 0);
  const from = neg ? outEdge + d * 8 : outEdge;
  if (Math.abs(end - from) > 0.1) g.append(s('line', { x1: from, y1: cy, x2: end, y2: cy, class: `w ${o.outCls ?? ''}`.trim() }));
  g.append(s('rect', { x, y: r1(cy - hh / 2), width: w, height: hh, class: 'b' }));
  g.append(txt(x + w / 2, cy - hh / 2 + 17, GATE_QUAL[kind], 'dg-qual', 'middle'));
  if (neg) g.append(s('circle', { cx: outEdge + d * 4, cy, r: 4, class: 'b' }));
  return { g, ins, out: [end, cy] };
}

/** Tvarová značka (ANSI/IEEE Std 91), aká sa používa v amerických katalógoch. */
export function ansiGate(kind: Gate, x: number, cy: number, o: { inLen?: number; outLen?: number } = {}): GatePins {
  const inLen = o.inLen ?? 14;
  const outLen = o.outLen ?? 16;
  const g = s('g', { class: 'dg-gate' });
  const shape = kind === 'nand' ? 'and' : kind === 'nor' ? 'or' : kind === 'xnor' ? 'xor' : kind;
  const ys = kind === 'not' ? [cy] : [cy - 10, cy + 10];
  let tip: number;
  let inEnd: number;
  let body: SVGElement[];
  const orPath = (bx: number) => `M${bx} ${cy - 20}C${bx + 22} ${cy - 20} ${bx + 36} ${cy - 12} ${bx + 46} ${cy}C${bx + 36} ${cy + 12} ${bx + 22} ${cy + 20} ${bx} ${cy + 20}Q${bx + 10} ${cy} ${bx} ${cy - 20}Z`;
  switch (shape) {
    case 'and':
      tip = x + 40;
      inEnd = x;
      body = [s('path', { d: `M${x} ${cy - 20}h20a20 20 0 0 1 0 40h-20Z`, class: 'b' })];
      break;
    case 'or':
      tip = x + 46;
      inEnd = x + 3.8;
      body = [s('path', { d: orPath(x), class: 'b' })];
      break;
    case 'xor':
      tip = x + 52;
      inEnd = x + 3.8;
      body = [s('path', { d: orPath(x + 6), class: 'b' }), s('path', { d: `M${x} ${cy - 20}Q${x + 10} ${cy} ${x} ${cy + 20}`, class: 'w' })];
      break;
    default:
      tip = x + 30;
      inEnd = x;
      body = [s('path', { d: `M${x} ${cy - 16}L${x + 30} ${cy}L${x} ${cy + 16}Z`, class: 'b' })];
  }
  const ins: Pt[] = ys.map((y) => [x - inLen, y]);
  for (const y of ys) g.append(s('line', { x1: x - inLen, y1: y, x2: inEnd, y2: y, class: 'w' }));
  const neg = isNegated(kind);
  const from = neg ? tip + 8 : tip;
  const end = tip + Math.max(outLen, neg ? 8 : 0);
  if (end - from > 0.1) g.append(s('line', { x1: from, y1: cy, x2: end, y2: cy, class: 'w' }));
  g.append(...body);
  if (neg) g.append(s('circle', { cx: tip + 4, cy, r: 4, class: 'b' }));
  return { g, ins, out: [end, cy] };
}

/** Prehľad značiek všetkých členov: STN EN 60617-12 a tvarové značky ANSI. */
export function gateSymbolsFigure(): SVGSVGElement {
  const rows: [Gate, string][] = [
    ['not', 'negácia'], ['and', 'logický súčin'], ['or', 'logický súčet'], ['nand', 'negovaný súčin'],
    ['nor', 'negovaný súčet'], ['xor', 'nonekvivalencia'], ['xnor', 'ekvivalencia'],
  ];
  const W = 420;
  const top = 40;
  const rowH = 62;
  const parts: SVGElement[] = [
    txt(14, 24, 'Člen', 'label'),
    txt(220, 24, 'STN EN 60617-12', 'label', 'middle'),
    txt(346, 24, 'ANSI (USA)', 'label', 'middle'),
  ];
  rows.forEach(([g, desc], i) => {
    const y0 = top + i * rowH;
    const cy = y0 + rowH / 2;
    parts.push(s('line', { x1: 8, y1: y0, x2: W - 8, y2: y0, class: 'dg-rule' }));
    parts.push(txt(14, cy - 2, GATE_NAME[g], 'note'), txt(14, cy + 15, desc, 'small dg-muted'));
    parts.push(iecGate(g, 202, cy, { inLen: 16, outLen: 18 }).g);
    parts.push(ansiGate(g, 318, cy, { inLen: 16, outLen: 16 }).g);
  });
  return schematic(W, top + rows.length * rowH + 6, 'Značky logických členov NOT, AND, OR, NAND, NOR, XOR a XNOR podľa STN EN 60617-12 a tvarové značky ANSI', ...parts);
}

/** Vytvorenie členov NOT, AND a OR iba z členov NAND. */
export function nandUniversalFigure(): SVGSVGElement {
  const parts: SVGElement[] = [];
  const joined = (x: number, cy: number, label: string, tx: number) => {
    parts.push(term([tx, cy], label, 'left'), wire([tx, cy], [x - 20, cy]), dot([x - 20, cy]),
      wire([x - 20, cy], [x - 20, cy - 10], [x, cy - 10]), wire([x - 20, cy], [x - 20, cy + 10], [x, cy + 10]));
    const gp = iecGate('nand', x, cy, { inLen: 0, outLen: 22 });
    parts.push(gp.g);
    return gp.out;
  };
  // NOT
  parts.push(txt(16, 51, 'NOT', 'note'));
  joined(130, 46, '$A', 84);
  parts.push(fx(198, 51, '$Y = @o{$A}'));
  parts.push(s('line', { x1: 10, y1: 86, x2: 400, y2: 86, class: 'dg-rule' }));
  // AND
  parts.push(txt(16, 135, 'AND', 'note'));
  parts.push(term([84, 120], '$A', 'left'), term([84, 140], '$B', 'left'), wire([84, 120], [130, 120]), wire([84, 140], [130, 140]));
  parts.push(iecGate('nand', 130, 130, { inLen: 0, outLen: 22 }).g);
  parts.push(wire([188, 130], [220, 130]), dot([220, 130]), wire([220, 130], [220, 120], [240, 120]), wire([220, 130], [220, 140], [240, 140]));
  parts.push(fx(204, 122, '@o{$A · $B}', 'middle', 'dg-sm'));
  parts.push(iecGate('nand', 240, 130, { inLen: 0, outLen: 22 }).g);
  parts.push(fx(306, 135, '$Y = $A · $B'));
  parts.push(s('line', { x1: 10, y1: 172, x2: 400, y2: 172, class: 'dg-rule' }));
  // OR
  parts.push(txt(16, 255, 'OR', 'note'));
  joined(130, 210, '$A', 84);
  joined(130, 290, '$B', 84);
  parts.push(wire([188, 210], [220, 210], [220, 240], [240, 240]), wire([188, 290], [220, 290], [220, 260], [240, 260]));
  parts.push(fx(204, 202, '@o{$A}', 'middle', 'dg-sm'), fx(204, 308, '@o{$B}', 'middle', 'dg-sm'));
  parts.push(iecGate('nand', 240, 250, { inLen: 0, outLen: 22 }).g);
  parts.push(fx(306, 255, '$Y = $A + $B'));
  return schematic(410, 322, 'Členy NOT, AND a OR zložené iba z dvojvstupových členov NAND', ...parts);
}

/** Rozloženie vývodov obvodu 74HC00 (4 dvojvstupové členy NAND v puzdre DIP-14). */
export function ic7400Figure(): SVGSVGElement {
  const pinY = (i: number) => 66 + 26 * (i - 1);
  const left = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND'];
  const right = ['V_{CC}', '4B', '4A', '4Y', '3B', '3A', '3Y'];
  const parts: SVGElement[] = [
    txt(220, 24, '74HC00', 'label', 'middle'),
    s('rect', { x: 120, y: 44, width: 200, height: 200, rx: 4, class: 'b' }),
    s('path', { d: 'M210 44A10 10 0 0 0 230 44', class: 'w' }),
  ];
  for (let i = 1; i <= 7; i++) {
    const y = pinY(i);
    parts.push(s('line', { x1: 100, y1: y, x2: 120, y2: y, class: 'w' }), txt(110, y - 5, String(i), 'dg-pin', 'middle'), fx(94, y + 5, left[i - 1], 'end', 'label'));
    parts.push(s('line', { x1: 320, y1: y, x2: 340, y2: y, class: 'w' }), txt(330, y - 5, String(15 - i), 'dg-pin', 'middle'), fx(346, y + 5, right[i - 1], 'start', 'label'));
  }
  // Členy 1 a 2 (vstupy vľavo), výstup vedený pod členom na vývod 3, resp. 6.
  for (const [a, yv] of [[1, 3], [4, 6]] as const) {
    const cy = (pinY(a) + pinY(a + 1)) / 2;
    const gp = iecGate('nand', 146, cy, { pitch: 26, w: 32, inLen: 26, outLen: 18 });
    parts.push(gp.g, wire(gp.out, [gp.out[0], pinY(yv)], [120, pinY(yv)]));
  }
  // Členy 4 a 3 (vstupy vpravo), výstup na vývod 11, resp. 8.
  for (const [a, yv] of [[2, 4], [5, 7]] as const) {
    const cy = (pinY(a) + pinY(a + 1)) / 2;
    const gp = iecGate('nand', 262, cy, { pitch: 26, w: 32, inLen: 26, outLen: 18, mirror: true });
    parts.push(gp.g, wire(gp.out, [gp.out[0], pinY(yv)], [320, pinY(yv)]));
  }
  return schematic(400, 256, 'Rozloženie vývodov obvodu 74HC00: štyri členy NAND, napájanie VCC na vývode 14 a GND na vývode 7', ...parts);
}

/** Dva členy za sebou: X = G1(A, B), Y = G2(X, C). */
export function twoGateFigure(g1: Exclude<Gate, 'not'>, g2: Exclude<Gate, 'not'>): SVGSVGElement {
  const a = iecGate(g1, 100, 50, { inLen: 0, outLen: 22 });
  const b = iecGate(g2, 210, 90, { inLen: 0, outLen: 22 });
  return schematic(330, 140, `Zapojenie dvoch členov: ${GATE_NAME[g1]} so vstupmi A a B, jeho výstup X a vstup C vedú do člena ${GATE_NAME[g2]} s výstupom Y`,
    term([40, 40], '$A', 'left'), term([40, 60], '$B', 'left'), term([40, 100], '$C', 'left'),
    wire([40, 40], a.ins[0]), wire([40, 60], a.ins[1]), wire([40, 100], b.ins[1]),
    a.g, wire(a.out, [180, 50], [180, 80], b.ins[0]), fx(170, 44, '$X', 'middle'),
    b.g, wire(b.out, [292, 90]), term([292, 90], '$Y', 'right'),
  );
}

/** Napäťové úrovne L a H pre vstupy a výstupy TTL a vstupy CMOS 74HC pri 5 V. */
export function logicLevelsFigure(): SVGSVGElement {
  const y = (v: number) => r1(236 - v * 36);
  const parts: SVGElement[] = [s('line', { x1: 60, y1: y(0), x2: 60, y2: y(5) - 6, class: 'dg-axis' })];
  for (let v = 0; v <= 5; v++) {
    parts.push(s('line', { x1: 56, y1: y(v), x2: 60, y2: y(v), class: 'dg-axis' }), txt(52, y(v) + 4, `${v} V`, 'val', 'end'));
  }
  const bars: [number, string, string, number, number][] = [
    [130, 'TTL', 'vstup', 0.8, 2],
    [244, 'TTL', 'výstup', 0.4, 2.4],
    [358, 'CMOS 74HC', 'vstup (5 V)', 1.5, 3.5],
  ];
  const v = (x: number) => String(x).replace('.', ',');
  for (const [cx, t1, t2, lo, hi] of bars) {
    const x = cx - 22;
    parts.push(
      txt(cx, 24, t1, 'label', 'middle'), txt(cx, 40, t2, 'small dg-muted', 'middle'),
      s('rect', { x, y: y(lo), width: 44, height: r1(y(0) - y(lo)), class: 'fill-soft' }),
      s('rect', { x, y: y(hi), width: 44, height: r1(y(lo) - y(hi)), class: 'fill-warn' }),
      s('rect', { x, y: y(5), width: 44, height: r1(y(hi) - y(5)), class: 'fill-copper' }),
      s('rect', { x, y: y(5), width: 44, height: r1(y(0) - y(5)), class: 'w thin', fill: 'none' }),
      txt(cx, (y(0) + y(lo)) / 2 + 5, 'L', 'label', 'middle'),
      txt(cx, (y(hi) + y(5)) / 2 + 5, 'H', 'label', 'middle'),
      txt(cx + 27, y(lo) + 4, `${v(lo)} V`, 'val'),
      txt(cx + 27, y(hi) + 4, `${v(hi)} V`, 'val'),
    );
  }
  const legend: [string, string, number][] = [['fill-soft', 'L – log. 0', 70], ['fill-warn', 'neurčitá oblasť', 176], ['fill-copper', 'H – log. 1', 310]];
  for (const [cls, label, lx] of legend) {
    parts.push(s('rect', { x: lx, y: 262, width: 14, height: 14, class: cls }), s('rect', { x: lx, y: 262, width: 14, height: 14, class: 'w thin', fill: 'none' }), txt(lx + 20, 274, label, 'small'));
  }
  return schematic(430, 290, 'Napäťové úrovne logických obvodov: TTL vstup L do 0,8 V a H od 2 V, TTL výstup L do 0,4 V a H od 2,4 V, CMOS 74HC pri 5 V L do 1,5 V a H od 3,5 V', ...parts);
}

// ---------------------------------------------------------------- číselné sústavy

/** Bajt s váhami bitov a výpočtom hodnoty. */
export function byteWeightsFigure(value = 181): SVGSVGElement {
  const parts: SVGElement[] = [];
  const terms: string[] = [];
  for (let k = 0; k < 8; k++) {
    const i = 7 - k;
    const bit = (value >> i) & 1;
    const x = 34 + k * 44;
    const cx = x + 22;
    if (bit) terms.push(String(2 ** i));
    parts.push(
      fx(cx, 24, `b_{${i}}`, 'middle', 'dg-sm'),
      fx(cx, 46, `2^{${i}}`, 'middle', 'dg-sm dg-muted'),
      s('rect', { x, y: 56, width: 44, height: 40, class: `dg-cell${bit ? ' is-one' : ''}` }),
      txt(cx, 83, String(bit), `dg-big${bit ? ' copper' : ' dg-muted'}`, 'middle'),
      txt(cx, 116, String(2 ** i), `mono${bit ? '' : ' dg-muted'}`, 'middle'),
    );
  }
  parts.push(txt(56, 138, 'MSB', 'label', 'middle'), txt(364, 138, 'LSB', 'label', 'middle'));
  parts.push(fx(210, 170, `${terms.join(' + ')} = ${value}`, 'middle'));
  return schematic(420, 184, `Bajt s hodnotou ${value}: váhy bitov sú mocniny dvoch od 128 (MSB) po 1 (LSB)`, ...parts);
}

/** Prevod do dvojkovej sústavy postupným delením dvoma. */
export function divisionFigure(n: number): SVGSVGElement {
  const rows: [number, number, number][] = [];
  for (let q = n; q > 0; q = Math.floor(q / 2)) rows.push([q, Math.floor(q / 2), q % 2]);
  const y = (i: number) => 58 + i * 28;
  const parts: SVGElement[] = [txt(88, 26, 'delenie dvoma', 'label', 'middle'), txt(212, 26, 'zvyšok', 'label', 'middle')];
  rows.forEach(([q, nq, r], i) => {
    parts.push(
      txt(104, y(i), `${q} : 2`, '', 'end'),
      txt(114, y(i), `= ${nq}`),
      s('rect', { x: 200, y: y(i) - 18, width: 24, height: 24, rx: 4, class: 'dg-cell is-one' }),
      txt(212, y(i), String(r), 'mono copper', 'middle'),
    );
  });
  const last = rows.length - 1;
  parts.push(
    s('line', { x1: 242, y1: y(last) - 2, x2: 242, y2: y(0) - 8, class: 'varr' }),
    arrowHead(242, y(0) - 18, -90, 4.4, 'arr'),
    txt(254, y(0) - 1, 'LSB', 'small'),
    txt(254, y(last) - 1, 'MSB', 'small'),
  );
  const bits = n.toString(2);
  parts.push(fx(20, y(rows.length) + 14, `${n} = ${bits}_{2}`), txt(296, y(rows.length) + 14, 'zvyšky čítaj zdola nahor', 'small dg-muted', 'end'));
  return schematic(310, y(rows.length) + 30, `Prevod čísla ${n} do dvojkovej sústavy delením dvoma: zvyšky čítané zdola nahor dávajú ${bits}`, ...parts);
}

/** Zoskupovanie bitov po štyroch (šestnástková) a po troch (osmičková sústava). */
export function groupingFigure(value = 214): SVGSVGElement {
  const parts: SVGElement[] = [];
  const row = (y: number, size: number, base: number, title: string) => {
    let bits = value.toString(2);
    const pad = (size - (bits.length % size)) % size;
    bits = '0'.repeat(pad) + bits;
    const groups = bits.length / size;
    parts.push(txt(16, y - 38, title, 'label'));
    let x = 40;
    const digits: string[] = [];
    for (let gi = 0; gi < groups; gi++) {
      const chunk = bits.slice(gi * size, gi * size + size);
      const x0 = x;
      for (let k = 0; k < size; k++) {
        const isPad = gi * size + k < pad;
        parts.push(txt(x + 10, y, chunk[k], `dg-big${isPad ? ' dg-muted' : ''}`, 'middle'));
        parts.push(txt(x + 10, y - 22, String(2 ** (size - 1 - k)), 'dg-idx', 'middle'));
        x += 22;
      }
      const x1 = x - 2;
      const d = parseInt(chunk, 2).toString(base).toUpperCase();
      digits.push(d);
      parts.push(
        s('path', { d: `M${x0} ${y + 8}v6h${x1 - x0}v-6`, class: 'w thin' }),
        s('line', { x1: (x0 + x1) / 2, y1: y + 14, x2: (x0 + x1) / 2, y2: y + 20, class: 'w thin' }),
        txt((x0 + x1) / 2, y + 40, d, 'dg-big copper', 'middle'),
      );
      x += 14;
    }
    parts.push(fx(x + 6, y + 40, `= ${digits.join('')}_{${base}}`, 'start'));
  };
  row(70, 4, 16, 'Po štyroch bitoch → šestnástková sústava');
  row(180, 3, 8, 'Po troch bitoch → osmičková sústava');
  return schematic(400, 236, `Číslo ${value.toString(2)} v dvojkovej sústave rozdelené sprava na skupiny po štyroch bitoch (${value.toString(16).toUpperCase()}) a po troch bitoch (${value.toString(8)})`, ...parts);
}

// ---------------------------------------------------------------- kombinačné obvody

const GRAY2 = [0, 1, 3, 2];

export interface KmapGroup {
  cells: number[];
  cls: 'trace' | 'copper' | 'good';
  label?: string;
}

/** Súvislé úseky v cyklickom poradí (skupina cez okraj mapy sa rozdelí na dva). */
function runs(set: number[], len: number): [number, number][] {
  const sorted = [...new Set(set)].sort((a, b) => a - b);
  if (sorted.length === len) return [[0, len - 1]];
  const out: [number, number][] = [];
  for (const v of sorted) {
    const lastRun = out[out.length - 1];
    if (lastRun && lastRun[1] === v - 1) lastRun[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/** Karnaughova mapa pre 2 až 4 premenné (A je najvyšší bit) s vyznačenými skupinami. */
export function kmapFigure(vars: 2 | 3 | 4, ones: readonly number[], groups: KmapGroup[] = [], opts: { idx?: boolean } = {}): SVGSVGElement {
  const rowVars = vars === 4 ? 'AB' : 'A';
  const colVars = vars === 2 ? 'B' : vars === 3 ? 'BC' : 'CD';
  const rowBits = vars === 4 ? 2 : 1;
  const colBits = vars === 2 ? 1 : 2;
  const rowOrder = rowBits === 2 ? GRAY2 : [0, 1];
  const colOrder = colBits === 2 ? GRAY2 : [0, 1];
  const cell = 46;
  const x0 = 78;
  const y0 = 62;
  const nr = rowOrder.length;
  const nc = colOrder.length;
  const bin = (v: number, bits: number) => v.toString(2).padStart(bits, '0');
  const pos = (m: number): [number, number] => [rowOrder.indexOf(m >> colBits), colOrder.indexOf(m & ((1 << colBits) - 1))];
  const set = new Set(ones);
  const parts: SVGElement[] = [
    s('line', { x1: x0 - 44, y1: y0 - 44, x2: x0, y2: y0, class: 'w thin' }),
    fx(x0 - 10, y0 - 30, colVars.split('').map((c) => `$${c}`).join(''), 'middle'),
    fx(x0 - 30, y0 - 4, rowVars.split('').map((c) => `$${c}`).join(''), 'middle'),
  ];
  colOrder.forEach((c, j) => parts.push(txt(x0 + j * cell + cell / 2, y0 - 10, bin(c, colBits), 'mono', 'middle')));
  rowOrder.forEach((r, i) => parts.push(txt(x0 - 8, y0 + i * cell + cell / 2 + 5, bin(r, rowBits), 'mono', 'end')));
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const m = (rowOrder[i] << colBits) | colOrder[j];
      parts.push(s('rect', { x: x0 + j * cell, y: y0 + i * cell, width: cell, height: cell, class: `dg-cell${set.has(m) ? ' is-one' : ''}` }));
    }
  }
  groups.forEach((g, k) => {
    const ps = g.cells.map(pos);
    const inset = 5 + k * 3;
    for (const [r0, r1] of runs(ps.map((p) => p[0]), nr)) {
      for (const [c0, c1] of runs(ps.map((p) => p[1]), nc)) {
        parts.push(s('rect', {
          x: x0 + c0 * cell + inset, y: y0 + r0 * cell + inset,
          width: (c1 - c0 + 1) * cell - 2 * inset, height: (r1 - r0 + 1) * cell - 2 * inset,
          rx: 12, class: `dg-grp ${g.cls}`,
        }));
      }
    }
  });
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const m = (rowOrder[i] << colBits) | colOrder[j];
      const one = set.has(m);
      parts.push(txt(x0 + j * cell + cell / 2, y0 + i * cell + cell / 2 + 7, one ? '1' : '0', one ? 'dg-big' : 'dg-big dg-muted', 'middle'));
      if (opts.idx) parts.push(txt(x0 + j * cell + cell - 4, y0 + i * cell + cell - 5, String(m), 'dg-idx', 'end'));
    }
  }
  const gridBottom = y0 + nr * cell;
  const labeled = groups.filter((g) => g.label);
  labeled.forEach((g, k) => {
    const ly = gridBottom + 30 + k * 26;
    parts.push(s('line', { x1: x0, y1: ly - 5, x2: x0 + 22, y2: ly - 5, class: `dg-grp-key ${g.cls}` }), fx(x0 + 32, ly, g.label ?? ''));
  });
  const W = Math.max(x0 + nc * cell + 20, 260);
  const H = gridBottom + (labeled.length ? 18 + labeled.length * 26 : 14);
  const list = ones.length ? `jednotky v bunkách ${ones.join(', ')}` : 'samé nuly';
  return schematic(W, H, `Karnaughova mapa ${vars} premenných, ${list}`, ...parts);
}

/** Polovičná sčítačka z člena XOR a AND. */
export function halfAdderFigure(): SVGSVGElement {
  const xor = iecGate('xor', 150, 70, { inLen: 0, outLen: 18 });
  const and = iecGate('and', 150, 160, { inLen: 0, outLen: 18 });
  return schematic(370, 196, 'Polovičná sčítačka: súčet S = A XOR B, prenos C = A AND B',
    term([40, 60], '$A', 'left'), term([40, 80], '$B', 'left'),
    wire([40, 60], [150, 60]), wire([40, 80], [150, 80]),
    dot([90, 60]), wire([90, 60], [90, 150], [150, 150]),
    dot([112, 80]), wire([112, 80], [112, 170], [150, 170]),
    xor.g, and.g,
    wire(xor.out, [240, 70]), wire(and.out, [240, 160]),
    term([240, 70], '$S = $A ⊕ $B', 'right'), term([240, 160], '$C = $A · $B', 'right'),
  );
}

/** Multiplexor 4 : 1 – značka s naznačeným prepínačom, ktorý adresa A1 A0 = 10 prepne na vstup D2. */
export function muxFigure(): SVGSVGElement {
  const ys = [66, 98, 130, 162];
  const sel = 2;
  const parts: SVGElement[] = [
    s('rect', { x: 110, y: 30, width: 100, height: 160, class: 'b' }),
    txt(160, 50, 'MUX', 'dg-qual', 'middle'),
  ];
  ys.forEach((y, i) => {
    const on = i === sel;
    parts.push(
      term([70, y], `$D_{${i}}`, 'left'),
      s('line', { x1: 70, y1: y, x2: 132, y2: y, class: `w${on ? ' dg-hi' : ''}` }),
      s('circle', { cx: 134, cy: y, r: 2.6, class: on ? 'dot' : 'b' }),
      txt(118, y - 5, String(i), 'dg-pin'),
    );
  });
  parts.push(
    s('line', { x1: 136, y1: ys[sel], x2: 184, y2: 114, class: 'w dg-hi' }),
    s('circle', { cx: 186, cy: 114, r: 2.6, class: 'dot' }),
    s('line', { x1: 186, y1: 114, x2: 250, y2: 114, class: 'w dg-hi' }),
    term([250, 114], '$Y', 'right'),
  );
  for (const [x, name, val] of [[146, '$A_{1}', '1'], [184, '$A_{0}', '0']] as const) {
    parts.push(s('line', { x1: x, y1: 190, x2: x, y2: 222, class: 'w' }), term([x, 222], name, 'below'), txt(x + 8, 210, val, 'mono copper'));
  }
  parts.push(s('line', { x1: 165, y1: 182, x2: 165, y2: 124, class: 'w dash thin' }));
  parts.push(fx(232, 170, '$A_{1}$A_{0} = 10', 'start', 'dg-sm'), fx(232, 190, '$Y = $D_{2}', 'start', 'dg-sm'));
  return schematic(320, 256, 'Multiplexor 4 : 1: adresa A1 A0 = 10 prepojí dátový vstup D2 na výstup Y', ...parts);
}

const SEG_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
export type SegName = (typeof SEG_NAMES)[number];

/** Segmenty, ktoré svietia pri číslici 0 až 9 (6 s horným a 9 so spodným segmentom). */
export const DIGIT_SEGMENTS: readonly string[] = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];

/** 7-segmentový displej; ox, oy je ľavý horný roh, L dĺžka segmentu. */
function segDigit(ox: number, oy: number, lit: string, L = 56, T = 12): SVGGElement {
  const hseg = (cx: number, cy: number) => `${cx - L / 2},${cy} ${cx - L / 2 + T / 2},${cy - T / 2} ${cx + L / 2 - T / 2},${cy - T / 2} ${cx + L / 2},${cy} ${cx + L / 2 - T / 2},${cy + T / 2} ${cx - L / 2 + T / 2},${cy + T / 2}`;
  const vseg = (cx: number, cy: number) => `${cx},${cy - L / 2} ${cx + T / 2},${cy - L / 2 + T / 2} ${cx + T / 2},${cy + L / 2 - T / 2} ${cx},${cy + L / 2} ${cx - T / 2},${cy + L / 2 - T / 2} ${cx - T / 2},${cy - L / 2 + T / 2}`;
  const mx = ox + L / 2 + 2;
  const rx = ox + L + 4;
  const centers: Record<SegName, [number, number, boolean]> = {
    a: [mx, oy, true], b: [rx, oy + L / 2 + 2, false], c: [rx, oy + 1.5 * L + 6, false], d: [mx, oy + 2 * L + 8, true],
    e: [ox, oy + 1.5 * L + 6, false], f: [ox, oy + L / 2 + 2, false], g: [mx, oy + L + 4, true],
  };
  const g = s('g', null, s('rect', { x: ox - T - 4, y: oy - T - 4, width: L + 2 * T + 12, height: 2 * L + 2 * T + 16, rx: 6, class: 'dg-display' }));
  for (const name of SEG_NAMES) {
    const [cx, cy, horiz] = centers[name];
    g.append(s('polygon', { points: horiz ? hseg(cx, cy) : vseg(cx, cy), class: `dg-seg${lit.includes(name) ? ' is-on' : ''}` }));
  }
  return g;
}

/** Označenie segmentov a až g a príklad rozsvietenej číslice. */
export function sevenSegFigure(digit = 3): SVGSVGElement {
  const L = 56;
  const ox = 70;
  const oy = 40;
  const mx = ox + L / 2 + 2;
  const rx = ox + L + 4;
  const labels: [number, number, string, 'start' | 'middle' | 'end'][] = [
    [mx, oy - 22, 'a', 'middle'], [rx + 24, oy + L / 2 + 7, 'b', 'start'], [rx + 24, oy + 1.5 * L + 11, 'c', 'start'],
    [mx, oy + 2 * L + 38, 'd', 'middle'], [ox - 24, oy + 1.5 * L + 11, 'e', 'end'], [ox - 24, oy + L / 2 + 7, 'f', 'end'],
    [mx, oy + L - 10, 'g', 'middle'],
  ];
  const lit = DIGIT_SEGMENTS[digit];
  return schematic(380, 220, `7-segmentový displej so segmentmi a až g; číslica ${digit} rozsvieti segmenty ${lit.split('').join(', ')}`,
    segDigit(ox, oy, ''),
    ...labels.map(([x, y, t, a]) => txt(x, y, t, 'note', a)),
    segDigit(250, oy, lit),
    txt(282, oy + 2 * L + 40, `číslica ${digit}: ${lit.split('').join(', ')}`, 'small', 'middle'),
  );
}

// ---------------------------------------------------------------- klopné obvody a časové diagramy

export interface Wave {
  label: string;
  levels: readonly number[];
  cls?: 'ink' | 'trace' | 'copper' | 'good';
  small?: boolean;
}

export interface TimingOptions {
  title: string;
  waves: Wave[];
  unit?: number;
  labelW?: number;
  rowH?: number;
  /** Zvislé čiarkované čiary (napr. nábežné hrany). */
  edges?: number[];
  /** Podfarbené úseky [od, do) v jednotkách času. */
  shade?: [number, number][];
  /** Popisy nad diagramom (napr. stav čítača) v strede jednotky. */
  marks?: [number, string][];
  /** Najmenší počet jednotiek času (šírka obrázka sa nemení). */
  minUnits?: number;
}

/** Časový diagram logických signálov; úrovne sú zadané po jednotkách času. */
export function timingDiagram(o: TimingOptions): SVGSVGElement {
  const unit = o.unit ?? 14;
  const labelW = o.labelW ?? 56;
  const rowH = o.rowH ?? 36;
  const amp = 18;
  const n = Math.max(o.minUnits ?? 0, ...o.waves.map((w) => w.levels.length));
  const top = o.marks ? 30 : 12;
  const x0 = labelW;
  const W = labelW + n * unit + 14;
  const H = top + o.waves.length * rowH + 6;
  const X = (u: number) => r1(x0 + u * unit);
  const parts: SVGElement[] = [];
  for (const [a, b] of o.shade ?? []) parts.push(s('rect', { x: X(a), y: top - 2, width: r1((b - a) * unit), height: o.waves.length * rowH, class: 'dg-shade' }));
  for (const e of o.edges ?? []) parts.push(s('line', { x1: X(e), y1: top - 4, x2: X(e), y2: H - 4, class: 'dg-edge' }));
  for (const [u, t] of o.marks ?? []) parts.push(txt(X(u + 0.5), top - 10, t, 'dg-mark', 'middle'));
  o.waves.forEach((w, i) => {
    const base = top + i * rowH + rowH - 8;
    const lv = (l: number) => (l ? base - amp : base);
    parts.push(s('line', { x1: x0, y1: base, x2: X(n), y2: base, class: 'dg-rule' }));
    parts.push(fx(8, base - amp / 2 + 5, w.label, 'start', w.small ? 'small' : ''));
    if (!w.levels.length) return;
    let d = `M${x0} ${lv(w.levels[0])}`;
    for (let u = 1; u < w.levels.length; u++) {
      if (w.levels[u] !== w.levels[u - 1]) d += `H${X(u)}V${lv(w.levels[u])}`;
    }
    d += `H${X(w.levels.length)}`;
    parts.push(s('path', { d, class: `dg-wave ${w.cls ?? 'trace'}` }));
  });
  return schematic(W, H, o.title, ...parts);
}

/** Hladinový (latch) a hranový klopný obvod D pri rovnakých vstupoch. */
export function dTimingFigure(): SVGSVGElement {
  const C = [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1];
  const D = [0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1];
  const latch: number[] = [];
  const ff: number[] = [];
  let ql = 0;
  let qf = 0;
  for (let u = 0; u < C.length; u++) {
    if (C[u]) ql = D[u];
    if (u > 0 && C[u] && !C[u - 1]) qf = D[u - 1];
    latch.push(ql);
    ff.push(qf);
  }
  return timingDiagram({
    title: 'Časový diagram klopného obvodu D: hladinový obvod sleduje D počas C = 1, hranový prevezme D iba pri nábežnej hrane',
    unit: 12,
    labelW: 112,
    edges: [2, 6, 10, 14, 18, 22],
    shade: [[2, 4], [6, 8], [10, 12], [14, 16], [18, 20], [22, 24]],
    waves: [
      { label: 'C (hodiny)', levels: C, cls: 'ink', small: true },
      { label: 'D', levels: D, cls: 'trace' },
      { label: 'Q – hladinový', levels: latch, cls: 'good', small: true },
      { label: 'Q – hranový', levels: ff, cls: 'copper', small: true },
    ],
  });
}

type FfKind = 'D' | 'JK' | 'T';

/** Blok klopného obvodu s popismi vstupov; fall = reaguje na dobežnú hranu. */
function ffBox(x: number, y: number, kind: FfKind, o: { fall?: boolean; w?: number; inLen?: number; outLen?: number } = {}) {
  const w = o.w ?? 56;
  const inLen = o.inLen ?? 14;
  const outLen = o.outLen ?? 14;
  const ins: Record<string, number> = kind === 'JK' ? { J: 16, C: 36, K: 56 } : { [kind]: 20, C: 52 };
  const g = s('g', { class: 'dg-ff' });
  const pins: Record<string, Pt> = {};
  for (const [name, dy] of Object.entries(ins)) {
    const yy = y + dy;
    const isC = name === 'C';
    const stubEnd = isC && o.fall ? x - 8 : x;
    g.append(s('line', { x1: x - inLen, y1: yy, x2: stubEnd, y2: yy, class: 'w' }));
    pins[name] = [x - inLen, yy];
  }
  g.append(s('rect', { x, y, width: w, height: 72, class: 'b' }));
  for (const [name, dy] of Object.entries(ins)) {
    const yy = y + dy;
    if (name === 'C') {
      g.append(s('path', { d: `M${x} ${yy - 6}L${x + 9} ${yy}L${x} ${yy + 6}`, class: 'w thin' }), txt(x + 12, yy + 5, 'C', 'dg-sm'));
      if (o.fall) g.append(s('circle', { cx: x - 4, cy: yy, r: 4, class: 'b' }));
    } else {
      g.append(txt(x + 6, yy + 5, name, 'dg-sm'));
    }
  }
  for (const [name, dy] of [['Q', 20], ['@o{Q}', 52]] as const) {
    const yy = y + dy;
    g.append(s('line', { x1: x + w, y1: yy, x2: x + w + outLen, y2: yy, class: 'w' }), fx(x + w - 6, yy + 5, name, 'end', 'dg-sm'));
    pins[name === 'Q' ? 'Q' : 'Qn'] = [x + w + outLen, yy];
  }
  return { g, pins };
}

/** Klopný obvod RS z dvoch krížovo spojených členov NOR. */
export function rsNorFigure(): SVGSVGElement {
  const top = iecGate('nor', 160, 60, { inLen: 14, outLen: 22 });
  const bot = iecGate('nor', 160, 140, { inLen: 14, outLen: 22 });
  return schematic(340, 196, 'Klopný obvod RS z dvoch členov NOR: výstup každého člena je privedený na vstup druhého',
    term([60, 50], '$R', 'left'), wire([60, 50], top.ins[0]),
    term([60, 150], '$S', 'left'), wire([60, 150], bot.ins[1]),
    top.g, bot.g,
    wire(top.out, [292, 60]), term([292, 60], '$Q', 'right'),
    wire(bot.out, [292, 140]), term([292, 140], '@o{$Q}', 'right'),
    dot([244, 60]), wire([244, 60], [244, 80], [124, 110], [124, 130], bot.ins[0]),
    dot([244, 140]), wire([244, 140], [244, 120], [124, 90], [124, 70], top.ins[1]),
  );
}

/** Asynchrónny 3-bitový čítač z preklápačov T reagujúcich na dobežnú hranu. */
export function counterFigure(): SVGSVGElement {
  const y = 50;
  const parts: SVGElement[] = [term([40, y + 52], 'CLK', 'left'), wire([40, y + 52], [56, y + 52])];
  [70, 190, 310].forEach((x, i) => {
    const ff = ffBox(x, y, 'T', { fall: true });
    const q = ff.pins.Q;
    const jx = q[0] + 10;
    parts.push(ff.g, txt(ff.pins.T[0] - 4, ff.pins.T[1] + 5, '1', 'mono', 'end'));
    parts.push(wire(q, [jx, q[1]], [jx, 34]), term([jx, 34], `$Q_{${i}}`, 'above'));
    if (i < 2) parts.push(dot([jx, q[1]]), wire([jx, q[1]], [jx, y + 52], [x + 120 - 14, y + 52]));
  });
  return schematic(410, 136, 'Asynchrónny trojbitový binárny čítač: výstup Q každého preklápača T je hodinovým vstupom ďalšieho', ...parts);
}

/** Časový diagram asynchrónneho čítača modulo 8 (preklápanie pri dobežnej hrane). */
export function counterTimingFigure(): SVGSVGElement {
  const n = 20;
  const clk: number[] = [];
  const q: number[][] = [[], [], []];
  const marks: [number, string][] = [];
  for (let u = 0; u < n; u++) {
    clk.push(u % 2 === 1 ? 1 : 0);
    const c = Math.floor(u / 2) % 8;
    for (let b = 0; b < 3; b++) q[b].push((c >> b) & 1);
    if (u % 2 === 0) marks.push([u + 0.5, String(c)]);
  }
  return timingDiagram({
    title: 'Časový diagram čítača modulo 8: Q0 má polovičnú frekvenciu hodín, Q1 štvrtinovú, Q2 osminovú; stav sa mení pri dobežnej hrane',
    unit: 16,
    labelW: 50,
    edges: [2, 4, 6, 8, 10, 12, 14, 16, 18],
    marks,
    waves: [
      { label: 'CLK', levels: clk, cls: 'ink', small: true },
      { label: '$Q_{0}', levels: q[0], cls: 'trace' },
      { label: '$Q_{1}', levels: q[1], cls: 'trace' },
      { label: '$Q_{2}', levels: q[2], cls: 'copper' },
    ],
  });
}

/** Štvorbitový posuvný register so sériovým vstupom a paralelnými výstupmi. */
export function shiftRegisterFigure(): SVGSVGElement {
  const y = 56;
  const parts: SVGElement[] = [
    term([30, y + 20], '$D_{S}', 'above'), wire([30, y + 20], [60, y + 20]),
    term([30, 150], 'CLK', 'below'), wire([30, 150], [328, 150]),
  ];
  [72, 164, 256, 348].forEach((x, i) => {
    const ff = ffBox(x, y, 'D', { w: 48, inLen: 12, outLen: 8 });
    const q = ff.pins.Q;
    const bx = x - 20;
    parts.push(ff.g, wire([bx, 150], [bx, y + 52], [x - 12, y + 52]), dot([bx, 150]));
    parts.push(wire(q, [q[0], 34]), term([q[0], 34], `$Q_{${i}}`, 'above'));
    if (i < 3) parts.push(dot(q), wire(q, [x + 92 - 12, q[1]]));
  });
  return schematic(420, 180, 'Štvorbitový posuvný register z klopných obvodov D: každý hodinový impulz posunie údaj o jedno miesto doprava', ...parts);
}

// ---------------------------------------------------------------- interaktívne prvky

let uid = 0;

function frame(eyebrow: string, title: string, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: 'explorer dg-widget' },
    h('div', { class: 'explorer-head' }, h('p', { class: 'eyebrow' }, eyebrow), h('h3', null, title)),
    ...children);
}

function toggleButton(cls: string, label: string, onClick: () => void, ...content: (Node | string)[]): HTMLButtonElement {
  const btn = h('button', { type: 'button', class: cls, 'aria-pressed': 'false', 'aria-label': label }, ...content);
  btn.addEventListener('click', onClick);
  return btn;
}

const setPressed = (btn: HTMLElement, on: boolean) => btn.setAttribute('aria-pressed', on ? 'true' : 'false');

function readouts(rows: [string, string][]): HTMLElement[] {
  return rows.map(([k, v]) => h('div', null, h('dt', null, rich(k)), h('dd', null, v)));
}

const groupBits = (bits: string) => bits.replace(/\B(?=(\d{4})+$)/g, ' ');

/** Osem prepínateľných bitov a posuvník 0 až 255 – hodnota v sústavách a kóde BCD. */
export function byteExplorer(): HTMLElement {
  let value = 181;
  const id = `dg-byte-${(uid += 1)}`;
  const bits = Array.from({ length: 8 }, (_, k) => {
    const i = 7 - k;
    const valueEl = h('span', null, '0');
    const btn = toggleButton('dg-bit', `Bit b${i} s váhou ${2 ** i}`, () => {
      value ^= 1 << i;
      update();
    }, valueEl, h('small', null, String(2 ** i)));
    return { i, btn, valueEl };
  });
  const slider = h('input', { id, type: 'range', min: 0, max: 255, step: 1, value, class: 'dg-range' });
  const out = h('output', { for: id });
  const dl = h('dl', { class: 'explorer-readouts', 'aria-live': 'polite' });
  slider.addEventListener('input', () => {
    value = Number(slider.value);
    update();
  });
  const update = () => {
    for (const b of bits) {
      const on = ((value >> b.i) & 1) === 1;
      setPressed(b.btn, on);
      b.valueEl.textContent = on ? '1' : '0';
    }
    slider.value = String(value);
    out.textContent = String(value);
    const bcd = String(value).split('').map((d) => Number(d).toString(2).padStart(4, '0')).join(' ');
    const signed = value >= 128 ? value - 256 : value;
    dl.replaceChildren(...readouts([
      ['Dvojková', groupBits(value.toString(2).padStart(8, '0'))],
      ['Desiatková', String(value)],
      ['Šestnástková', `${value.toString(16).toUpperCase().padStart(2, '0')} (0x${value.toString(16).toUpperCase().padStart(2, '0')})`],
      ['Osmičková', value.toString(8)],
      ['BCD 8421', bcd],
      ['So znamienkom (doplnok)', signed < 0 ? `−${-signed}` : String(signed)],
    ]));
  };
  update();
  return frame('Interaktívny prvok', 'Bity jedného bajtu',
    h('div', { class: 'dg-section' }, h('p', { class: 'dg-k' }, 'Klikni na bit (b7 vľavo … b0 vpravo), pod číslicou je jeho váha'), h('div', { class: 'dg-bits', role: 'group', 'aria-label': 'Bity b7 až b0' }, bits.map((b) => b.btn))),
    h('div', { class: 'explorer-param' }, h('div', { class: 'explorer-param-head' }, h('label', { for: id }, 'Hodnota 0 až 255'), out), slider),
    dl,
  );
}

/** Výber logického člena, klikateľné vstupy A a B, výstup a pravdivostná tabuľka. */
export function gateExplorer(): HTMLElement {
  let gate: Gate = 'nand';
  let a = 1;
  let b = 0;
  const pick = h('div', { class: 'chips', role: 'group', 'aria-label': 'Logický člen' });
  const chipButtons = GATES.map((g) => {
    const btn = h('button', { type: 'button', class: 'chip-toggle', 'aria-pressed': 'false' }, GATE_NAME[g]);
    btn.addEventListener('click', () => {
      gate = g;
      update();
    });
    pick.append(btn);
    return [g, btn] as const;
  });
  const aBtn = toggleButton('dg-in', 'Vstup A', () => {
    a ^= 1;
    update();
  });
  const bBtn = toggleButton('dg-in', 'Vstup B', () => {
    b ^= 1;
    update();
  });
  const svgBox = h('div', { class: 'sch-panel' });
  const table = h('table', { class: 'dg-truth' });
  const expr = h('p', { class: 'dg-out', 'aria-live': 'polite' });
  const desc = h('p', { class: 'explorer-note' });

  const drawGate = (): SVGSVGElement => {
    const one = gate === 'not';
    const y = gateOut(gate, a, b);
    const gp = iecGate(gate, 104, 60, { inLen: 0, outLen: 30, inCls: [a ? 'dg-hi' : '', b ? 'dg-hi' : ''], outCls: y ? 'dg-hi' : '' });
    const parts: SVGElement[] = [];
    const inputs: [string, number, Pt][] = one ? [['A', a, gp.ins[0]]] : [['A', a, gp.ins[0]], ['B', b, gp.ins[1]]];
    for (const [name, v, p] of inputs) {
      parts.push(s('line', { x1: 40, y1: p[1], x2: p[0], y2: p[1], class: `w${v ? ' dg-hi' : ''}` }), s('circle', { cx: 40, cy: p[1], r: 3.2, class: 'b' }), fx(30, p[1] + 5, `$${name}`, 'end'), txt(58, p[1] - 6, String(v), `mono${v ? ' dg-hi' : ''}`, 'middle'));
    }
    const [ox, oy] = gp.out;
    parts.push(gp.g, txt(ox - 12, oy - 6, String(y), `mono${y ? ' dg-hi' : ''}`, 'middle'));
    if (y) parts.push(s('circle', { cx: ox + 14, cy: oy, r: 15, class: 'dg-glow' }));
    parts.push(s('circle', { cx: ox + 14, cy: oy, r: 10, class: `dg-lamp${y ? ' is-on' : ''}` }), fx(ox + 32, oy + 5, '$Y'));
    return schematic(240, 120, `Člen ${GATE_NAME[gate]}: vstupy A = ${a}${one ? '' : `, B = ${b}`}, výstup Y = ${y}`, ...parts);
  };

  const update = () => {
    const one = gate === 'not';
    for (const [g, btn] of chipButtons) setPressed(btn, g === gate);
    setPressed(aBtn, a === 1);
    setPressed(bBtn, b === 1);
    aBtn.textContent = `A = ${a}`;
    bBtn.textContent = `B = ${b}`;
    bBtn.disabled = one;
    svgBox.replaceChildren(drawGate());
    const combos = one ? [[0, 0], [1, 0]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
    table.replaceChildren(
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'A'), one ? null : h('th', { scope: 'col' }, 'B'), h('th', { scope: 'col' }, 'Y'))),
      h('tbody', null, combos.map(([x, z]) => {
        const active = x === a && (one || z === b);
        return h('tr', { class: active ? 'is-active' : null, 'aria-current': active ? 'true' : null },
          h('td', null, String(x)), one ? null : h('td', null, String(z)), h('td', null, String(gateOut(gate, x, z))));
      })),
    );
    const y = gateOut(gate, a, b);
    expr.replaceChildren(h('span', { class: 'fx' }, rich(GATE_EXPR[gate])), h('span', { class: `dg-lampbox${y ? ' is-on' : ''}` }, `Y = ${y}`));
    desc.textContent = GATE_DESC[gate];
  };
  update();
  return frame('Interaktívny prvok', 'Logický člen',
    pick,
    h('div', { class: 'dg-controls', role: 'group', 'aria-label': 'Vstupy člena' }, aBtn, bBtn),
    h('div', { class: 'dg-stage' }, svgBox, table),
    expr,
    desc,
  );
}

/** Dekodér BCD na 7-segmentový displej: štyri vstupy D C B A (8 4 2 1). */
export function sevenSegExplorer(): HTMLElement {
  let code = 5;
  const weights = [8, 4, 2, 1];
  const names = ['D', 'C', 'B', 'A'];
  const btns = weights.map((w, k) => {
    const valueEl = h('span', null, '0');
    const btn = toggleButton('dg-bit', `Vstup ${names[k]} s váhou ${w}`, () => {
      code ^= w;
      update();
    }, valueEl, h('small', null, `${names[k]} · ${w}`));
    return { w, btn, valueEl };
  });
  const svgBox = h('div', { class: 'sch-panel' });
  const dl = h('dl', { class: 'explorer-readouts', 'aria-live': 'polite' });
  const note = h('p', { class: 'explorer-note' });
  const update = () => {
    for (const x of btns) {
      const on = (code & x.w) !== 0;
      setPressed(x.btn, on);
      x.valueEl.textContent = on ? '1' : '0';
    }
    const valid = code <= 9;
    const lit = valid ? DIGIT_SEGMENTS[code] : '';
    svgBox.replaceChildren(schematic(130, 190, valid ? `Displej ukazuje číslicu ${code}` : 'Neplatný kód BCD – displej je zhasnutý', segDigit(37, 30, lit)));
    dl.replaceChildren(...readouts([
      ['Vstup D C B A', code.toString(2).padStart(4, '0')],
      ['Číslica', valid ? String(code) : '—'],
      ['Svietia segmenty', valid ? lit.split('').join(', ') : 'žiadny'],
    ]));
    note.textContent = valid
      ? 'Dekodér rozsvieti tie segmenty, ktoré tvoria číslicu. Pri spoločnej katóde sú jeho aktívne výstupy v stave H.'
      : `Kombinácia ${code.toString(2)} (${code}) nie je platný kód BCD – napríklad dekodér 4511 displej zhasne.`;
  };
  update();
  return frame('Interaktívny prvok', 'Dekodér BCD na 7-segmentový displej',
    h('div', { class: 'dg-section' }, h('p', { class: 'dg-k' }, 'Vstup BCD – klikni na bity'), h('div', { class: 'dg-bits dg-bits-4', role: 'group', 'aria-label': 'Vstupy dekodéra D C B A' }, btns.map((x) => x.btn))),
    h('div', { class: 'dg-stage' }, svgBox, dl),
    note,
  );
}

interface Step {
  ins: Record<string, number>;
  q0: number;
  q1: number;
}

/** Klopný obvod D, JK alebo T s tlačidlom hodinového impulzu a priebežným časovým diagramom. */
export function flipFlopExplorer(): HTMLElement {
  let kind: FfKind = 'JK';
  let q = 0;
  const inputs: Record<string, number> = { D: 1, J: 1, K: 1, T: 1 };
  let history: Step[] = [];
  const MAX = 8;
  const names = (): string[] => (kind === 'JK' ? ['J', 'K'] : [kind]);
  const pick = h('div', { class: 'chips', role: 'group', 'aria-label': 'Typ klopného obvodu' });
  const kindBtns = (['D', 'JK', 'T'] as const).map((k) => {
    const btn = h('button', { type: 'button', class: 'chip-toggle', 'aria-pressed': 'false' }, `Klopný obvod ${k}`);
    btn.addEventListener('click', () => {
      kind = k;
      history = [];
      q = 0;
      msg.textContent = `Klopný obvod ${k}, výstup vynulovaný.`;
      update();
    });
    pick.append(btn);
    return [k, btn] as const;
  });
  const inBox = h('div', { class: 'dg-controls', role: 'group', 'aria-label': 'Vstupy klopného obvodu' });
  const inBtns: Record<string, HTMLButtonElement> = {};
  for (const name of ['D', 'J', 'K', 'T']) {
    inBtns[name] = toggleButton('dg-in', `Vstup ${name}`, () => {
      inputs[name] ^= 1;
      update();
    });
  }
  const clock = h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'aria-label': 'Hodinový impulz – nábežná hrana' }, 'Hodinový impulz ↑');
  const reset = h('button', { type: 'button', class: 'btn btn-quiet btn-sm' }, 'Vynulovať');
  inBox.append(...Object.values(inBtns), clock, reset);
  const lampQ = h('span', { class: 'dg-lampbox' });
  const lampQn = h('span', { class: 'dg-lampbox' });
  const msg = h('p', { class: 'dg-msg', 'aria-live': 'polite' });
  const svgBox = h('div', { class: 'sch-panel' });

  const next = (cur: number): [number, string] => {
    if (kind === 'D') return [inputs.D, `D = ${inputs.D} → Q = ${inputs.D}`];
    if (kind === 'T') return inputs.T ? [cur ? 0 : 1, 'T = 1 → preklopenie'] : [cur, 'T = 0 → Q sa nemení'];
    const { J, K } = inputs;
    if (J && K) return [cur ? 0 : 1, 'J = K = 1 → preklopenie'];
    if (J) return [1, 'J = 1, K = 0 → nastavenie'];
    if (K) return [0, 'J = 0, K = 1 → nulovanie'];
    return [cur, 'J = K = 0 → Q sa nemení'];
  };

  clock.addEventListener('click', () => {
    const [nq, why] = next(q);
    history.push({ ins: { ...inputs }, q0: q, q1: nq });
    if (history.length > MAX) history.shift();
    q = nq;
    msg.textContent = `Nábežná hrana: ${why}, Q = ${q}.`;
    update();
  });
  reset.addEventListener('click', () => {
    history = [];
    q = 0;
    msg.textContent = 'Výstup vynulovaný, diagram vymazaný.';
    update();
  });

  const update = () => {
    for (const [k, btn] of kindBtns) setPressed(btn, k === kind);
    for (const [name, btn] of Object.entries(inBtns)) {
      btn.hidden = !names().includes(name);
      setPressed(btn, inputs[name] === 1);
      btn.textContent = `${name} = ${inputs[name]}`;
    }
    lampQ.textContent = `Q = ${q}`;
    lampQ.classList.toggle('is-on', q === 1);
    lampQn.replaceChildren(h('span', { class: 'fx' }, rich(`@o{$Q}`)), ` = ${q ? 0 : 1}`);
    lampQn.classList.toggle('is-on', q === 0);
    const clk: number[] = [];
    const qs: number[] = [];
    const ins: Record<string, number[]> = {};
    for (const name of names()) ins[name] = [];
    const edges: number[] = [];
    history.forEach((st, i) => {
      clk.push(0, 0, 1, 1);
      qs.push(st.q0, st.q0, st.q1, st.q1);
      edges.push(i * 4 + 2);
      for (const name of names()) ins[name].push(st.ins[name], st.ins[name], st.ins[name], st.ins[name]);
    });
    clk.push(0, 0);
    qs.push(q, q);
    for (const name of names()) ins[name].push(inputs[name], inputs[name]);
    const seq = history.map((st) => st.q1).join(', ');
    svgBox.replaceChildren(timingDiagram({
      title: history.length ? `Časový diagram, hodnoty Q po impulzoch: ${seq}` : 'Časový diagram – zatiaľ bez hodinových impulzov',
      unit: 10,
      labelW: 44,
      rowH: 34,
      minUnits: MAX * 4 + 2,
      edges,
      waves: [
        { label: 'CLK', levels: clk, cls: 'ink', small: true },
        ...names().map((name) => ({ label: name, levels: ins[name], cls: 'trace' as const })),
        { label: 'Q', levels: qs, cls: 'copper' },
      ],
    }));
  };
  update();
  return frame('Interaktívny prvok', 'Klopný obvod a hodinový impulz',
    pick,
    inBox,
    h('div', { class: 'dg-out' }, lampQ, lampQn),
    msg,
    svgBox,
  );
}
