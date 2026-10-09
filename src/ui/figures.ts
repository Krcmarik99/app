import { s } from '../lib/dom';
import { colorById, type ColorId } from '../lib/colorcode';
import { fmt } from '../lib/units';
import { lineChart, sample } from './chart';
import {
  comp, currentArrow, dot, qty, schematic, terminal, valueText, voltageArrow, wire,
  type CompKind,
} from './schematic';

export interface Labeled {
  label: string;
  value?: string;
}

const LEFT = 60;

export function seriesFigure(
  items: Labeled[],
  opts: { kind?: CompKind; source?: Labeled; voltages?: boolean } = {},
): SVGSVGElement {
  const kind = opts.kind ?? 'resistor';
  const top = 52;
  const bottom = opts.voltages ? 170 : 150;
  const step = 84;
  const x0 = LEFT + 26;
  const xEnd = x0 + items.length * step;
  const right = xEnd + 26;
  const parts: SVGElement[] = [
    comp('battery', [LEFT, top], [LEFT, bottom], { label: opts.source?.label ?? 'U', value: opts.source?.value, side: 'left' }),
    wire([LEFT, top], [x0, top]),
  ];
  items.forEach((it, i) => {
    const a = x0 + i * step;
    parts.push(comp(kind, [a, top], [a + step, top], { label: it.label, value: it.value }));
    if (opts.voltages) parts.push(voltageArrow([a + 14, top + 24], [a + step - 14, top + 24], `U_${i + 1}`, 'below'));
  });
  parts.push(wire([xEnd, top], [right, top], [right, bottom], [LEFT, bottom]));
  parts.push(currentArrow([right, (top + bottom) / 2], 'd', 'I', 'right'));
  const title = `Sériové zapojenie: ${items.map((i) => i.label.replace('_', '')).join(', ')}`;
  return schematic(right + 34, bottom + 22, title, ...parts);
}

export function parallelFigure(items: Labeled[], opts: { kind?: CompKind; source?: Labeled; branchCurrents?: boolean } = {}): SVGSVGElement {
  const kind = opts.kind ?? 'resistor';
  const top = 40;
  const bottom = 166;
  const x0 = LEFT + 92;
  const step = 96;
  const xs = items.map((_, i) => x0 + i * step);
  const xEnd = xs[xs.length - 1];
  const parts: SVGElement[] = [
    comp('battery', [LEFT, top], [LEFT, bottom], { label: opts.source?.label ?? 'U', value: opts.source?.value, side: 'left' }),
    wire([LEFT, top], [xEnd, top]),
    wire([LEFT, bottom], [xEnd, bottom]),
    currentArrow([LEFT + 44, top], 'r', 'I'),
  ];
  items.forEach((it, i) => {
    const x = xs[i];
    parts.push(comp(kind, [x, top], [x, bottom], { label: it.label, value: it.value, side: 'right' }));
    if (i < items.length - 1) parts.push(dot([x, top]), dot([x, bottom]));
    if (opts.branchCurrents !== false) parts.push(currentArrow([x, top + 20], 'd', `I_${i + 1}`, 'left'));
  });
  const title = `Paralelné zapojenie: ${items.map((i) => i.label.replace('_', '')).join(', ')}`;
  return schematic(xEnd + 84, bottom + 22, title, ...parts);
}

export function mixedFigure(r: [Labeled, Labeled, Labeled], source?: Labeled): SVGSVGElement {
  const top = 52;
  const bottom = 172;
  return schematic(
    380, 196, 'Zmiešané zapojenie: R1 v sérii s paralelnou kombináciou R2 a R3',
    comp('battery', [LEFT, top], [LEFT, bottom], { label: source?.label ?? 'U', value: source?.value, side: 'left' }),
    wire([LEFT, top], [86, top]),
    comp('resistor', [86, top], [170, top], r[0]),
    wire([170, top], [310, top]),
    comp('resistor', [220, top], [220, bottom], { ...r[1], side: 'right' }),
    comp('resistor', [310, top], [310, bottom], { ...r[2], side: 'right' }),
    wire([310, bottom], [LEFT, bottom]),
    dot([220, top]),
    dot([220, bottom]),
  );
}

export function ohmFigure(): SVGSVGElement {
  const top = 44;
  const bottom = 164;
  return schematic(
    352, 190, 'Meranie prúdu ampérmetrom a napätia voltmetrom',
    comp('battery', [LEFT, top], [LEFT, bottom], { label: 'U', side: 'left' }),
    wire([LEFT, top], [96, top]),
    comp('ammeter', [96, top], [150, top]),
    wire([150, top], [310, top]),
    currentArrow([188, top], 'r', 'I'),
    comp('resistor', [236, top], [236, bottom], { label: 'R', side: 'left' }),
    comp('voltmeter', [310, top], [310, bottom]),
    wire([LEFT, bottom], [310, bottom]),
    dot([236, top]),
    dot([236, bottom]),
  );
}

export function nodeFigure(labels: [string, string, string, string] = ['I_1', 'I_2', 'I_3', 'I_4'], values?: string[]): SVGSVGElement {
  const c: [number, number] = [170, 104];
  const parts: SVGElement[] = [
    wire([40, c[1]], [300, c[1]]),
    wire([c[0], 22], [c[0], 186]),
    dot(c),
    currentArrow([100, c[1]], 'r', labels[0]),
    currentArrow([c[0], 58], 'd', labels[1], 'right'),
    currentArrow([240, c[1]], 'r', labels[2]),
    currentArrow([c[0], 150], 'd', labels[3], 'right'),
  ];
  if (values) {
    const pos: [number, number, 'start' | 'middle' | 'end'][] = [
      [100, c[1] + 22, 'middle'], [c[0] - 12, 62, 'end'], [240, c[1] + 22, 'middle'], [c[0] - 12, 154, 'end'],
    ];
    values.forEach((val, i) => {
      if (val) parts.push(valueText(pos[i][0], pos[i][1], val, pos[i][2]));
    });
  }
  return schematic(340, 206, 'Uzol s dvoma prúdmi vtekajúcimi a dvoma vytekajúcimi', ...parts);
}

export function dividerFigure(o: { r1?: Labeled; r2?: Labeled; source?: Labeled; out?: string } = {}): SVGSVGElement {
  const top = 30;
  const mid = 122;
  const bottom = 214;
  const x = 170;
  const out = 248;
  return schematic(
    310, 236, 'Nezaťažený delič napätia z rezistorov R1 a R2',
    comp('battery', [LEFT, top], [LEFT, bottom], { label: o.source?.label ?? 'U', value: o.source?.value, side: 'left' }),
    wire([LEFT, top], [x, top]),
    comp('resistor', [x, top], [x, mid], { ...(o.r1 ?? { label: 'R_1' }), side: 'left' }),
    comp('resistor', [x, mid], [x, bottom], { ...(o.r2 ?? { label: 'R_2' }), side: 'left' }),
    wire([x, bottom], [LEFT, bottom]),
    wire([x, mid], [out, mid]),
    wire([x, bottom], [out, bottom]),
    dot([x, mid]),
    dot([x, bottom]),
    terminal([out, mid]),
    terminal([out, bottom]),
    voltageArrow([out + 14, mid + 6], [out + 14, bottom - 6], o.out ?? 'U_2', 'right'),
  );
}

export function realSourceFigure(): SVGSVGElement {
  const top = 44;
  const bottom = 166;
  return schematic(
    372, 200, 'Reálny zdroj: ideálny zdroj Ue so sériovým vnútorným odporom Ri a záťaž Rz',
    s('rect', { x: 22, y: 18, width: 160, height: 170, rx: 6, class: 'box' }),
    s('text', { x: 30, y: 182, class: 'val' }, 'reálny zdroj'),
    comp('battery', [72, top], [72, bottom], { label: 'U_e', side: 'left' }),
    wire([72, top], [96, top]),
    comp('resistor', [96, top], [164, top], { label: 'R_i' }),
    wire([164, top], [214, top]),
    wire([72, bottom], [214, bottom]),
    terminal([214, top]),
    terminal([214, bottom]),
    wire([217, top], [316, top]),
    wire([217, bottom], [316, bottom]),
    comp('resistor', [316, top], [316, bottom], { label: 'R_z', side: 'right' }),
    voltageArrow([232, top + 12], [232, bottom - 12], 'U', 'right'),
    currentArrow([282, top], 'r', 'I'),
  );
}

export function rcFigure(): SVGSVGElement {
  const top = 46;
  const bottom = 166;
  return schematic(
    352, 190, 'Nabíjanie kondenzátora C cez rezistor R',
    comp('battery', [LEFT, top], [LEFT, bottom], { label: 'U', side: 'left' }),
    wire([LEFT, top], [86, top]),
    comp('switch', [86, top], [136, top]),
    comp('resistor', [136, top], [220, top], { label: 'R' }),
    wire([220, top], [290, top]),
    comp('capacitor', [290, top], [290, bottom], { label: 'C', side: 'right' }),
    voltageArrow([266, top + 34], [266, bottom - 34], 'u_C', 'left'),
    wire([290, bottom], [LEFT, bottom]),
  );
}

export function ledFigure(o: { r?: Labeled; source?: Labeled } = {}): SVGSVGElement {
  const top = 46;
  const bottom = 166;
  return schematic(
    340, 190, 'LED s predradným rezistorom',
    comp('battery', [LEFT, top], [LEFT, bottom], { label: o.source?.label ?? 'U', value: o.source?.value, side: 'left' }),
    wire([LEFT, top], [100, top]),
    comp('resistor', [100, top], [184, top], o.r ?? { label: 'R' }),
    wire([184, top], [260, top]),
    currentArrow([222, top], 'r', 'I_F'),
    comp('led', [260, top], [260, bottom], { value: 'LED', side: 'right' }),
    voltageArrow([238, top + 40], [238, bottom - 40], 'U_F', 'left'),
    wire([260, bottom], [LEFT, bottom]),
  );
}

export function rlcFigure(): SVGSVGElement {
  const top = 50;
  const bottom = 166;
  return schematic(
    360, 190, 'Sériový obvod RLC napájaný striedavým napätím',
    comp('acsource', [LEFT, top], [LEFT, bottom], { label: 'u', side: 'left' }),
    wire([LEFT, top], [84, top]),
    comp('resistor', [84, top], [158, top], { label: 'R' }),
    comp('inductor', [158, top], [240, top], { label: 'L' }),
    wire([240, top], [300, top]),
    currentArrow([270, top], 'r', 'I'),
    comp('capacitor', [300, top], [300, bottom], { label: 'C', side: 'right' }),
    wire([300, bottom], [LEFT, bottom]),
  );
}

export function impedanceTriangle(R: number, X: number, labels = { r: 'R', x: 'X', z: 'Z' }, values?: { r: string; x: string; z: string }): SVGSVGElement {
  const W = 360;
  const H = 230;
  const padL = 54;
  const padR = 104;
  const padV = 40;
  const ar = Math.abs(R) || 1e-9;
  const ax = Math.abs(X) || 1e-9;
  const k = Math.min((W - padL - padR) / ar, (H - 2 * padV) / ax);
  const w = Math.max(ar * k, 2);
  const hgt = Math.abs(X) * k;
  const up = X >= 0;
  const by = up ? H - padV : padV;
  const o: [number, number] = [padL, by];
  const pr: [number, number] = [padL + w, by];
  const px: [number, number] = [padL + w, up ? by - hgt : by + hgt];
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const phi = Math.atan2(hgt, w);
  const arcR = Math.min(34, w * 0.5);
  const ax2 = padL + arcR * Math.cos(phi);
  const ay2 = up ? by - arcR * Math.sin(phi) : by + arcR * Math.sin(phi);
  const parts: SVGElement[] = [
    s('polygon', { points: `${o.join(',')} ${pr.map(r1).join(',')} ${px.map(r1).join(',')}`, class: 'tri-fill' }),
    s('line', { x1: o[0], y1: o[1], x2: r1(pr[0]), y2: pr[1], class: 'tri-r' }),
    s('line', { x1: r1(pr[0]), y1: pr[1], x2: r1(px[0]), y2: r1(px[1]), class: 'tri-x' }),
    s('line', { x1: o[0], y1: o[1], x2: r1(px[0]), y2: r1(px[1]), class: 'tri-z' }),
  ];
  if (hgt > 4) {
    parts.push(
      s('path', { d: `M${r1(padL + arcR)} ${by}A${r1(arcR)} ${r1(arcR)} 0 0 ${up ? 0 : 1} ${r1(ax2)} ${r1(ay2)}`, class: 'w thin' }),
      qty(padL + arcR + 8, up ? by - 6 : by + 16, 'φ', 'start'),
    );
  }
  const rY = up ? by + 20 : by - 22;
  parts.push(qty(padL + w / 2, rY, labels.r));
  if (values) parts.push(valueText(padL + w / 2, rY + 14, values.r));
  const xMid = (by + px[1]) / 2;
  parts.push(qty(px[0] + 10, xMid, labels.x, 'start'));
  if (values) parts.push(valueText(px[0] + 10, xMid + 14, values.x, 'start'));
  const zx = padL + w / 2 - 14;
  const zy = (by + px[1]) / 2 + (up ? -10 : 18);
  parts.push(qty(zx, zy, labels.z, 'end'));
  if (values) parts.push(valueText(zx, zy + 14, values.z, 'end'));
  return schematic(W, H, 'Trojuholník impedancií', ...parts);
}

export function resistorBands(ids: readonly ColorId[]): SVGSVGElement {
  const five = ids.length === 5;
  const xs = five ? [94, 114, 134, 154, 204] : [98, 122, 146, 204];
  const svg = s(
    'svg',
    { viewBox: '0 0 300 90', width: 360, class: 'resistor-art', role: 'img', 'aria-label': `Rezistor s prúžkami: ${ids.map((i) => colorById(i).name).join(', ')}` },
    s('line', { x1: 8, y1: 45, x2: 292, y2: 45, class: 'lead' }),
    s('rect', { x: 66, y: 20, width: 168, height: 50, rx: 16, class: five ? 'res-body res-film' : 'res-body' }),
  );
  ids.forEach((id, i) => {
    svg.append(s('rect', { x: xs[i], y: 20.5, width: 12, height: 49, class: 'band', fill: colorById(id).hex }));
  });
  svg.append(s('rect', { x: 66, y: 20, width: 168, height: 50, rx: 16, class: 'res-shine' }));
  return svg;
}

export function rcCurveChart(): SVGSVGElement {
  return lineChart({
    ariaLabel: 'Napätie na kondenzátore pri nabíjaní v percentách napätia zdroja',
    x: { min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5], format: (v) => (v === 0 ? '0' : `${v}τ`), label: 'čas t' },
    y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], format: (v) => `${v} %`, label: 'u / U' },
    series: [{ points: sample((t) => 100 * (1 - Math.exp(-t)), 0, 5) }],
    markers: [
      { x: 1, y: 63.2, label: '63,2 %' },
      { x: 3, y: 95.0, label: '95 %' },
      { x: 5, y: 99.3, label: '99,3 %' },
    ],
  });
}

export function sineChart(): SVGSVGElement {
  const um = 230 * Math.SQRT2;
  return lineChart({
    ariaLabel: 'Sínusové napätie siete 230 V, 50 Hz počas dvoch periód',
    x: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40], format: (v) => `${v}`, label: 't [ms]' },
    y: { min: -380, max: 380, ticks: [-300, -150, 0, 150, 300], format: (v) => fmt(v), label: 'u [V]' },
    series: [{ points: sample((t) => um * Math.sin(2 * Math.PI * 50 * (t / 1000)), 0, 40, 200) }],
    hlines: [
      { y: um, label: 'Uₘ ≈ 325 V' },
      { y: 230, label: 'U = 230 V' },
    ],
  });
}

export function groundSymbol(): SVGSVGElement {
  return schematic(
    120, 60, 'Uzemnenie',
    s('line', { x1: 60, y1: 6, x2: 60, y2: 30, class: 'w' }),
    s('line', { x1: 44, y1: 30, x2: 76, y2: 30, class: 'w' }),
    s('line', { x1: 50, y1: 37, x2: 70, y2: 37, class: 'w' }),
    s('line', { x1: 56, y1: 44, x2: 64, y2: 44, class: 'w' }),
  );
}

export function symbolFigure(kind: CompKind, title: string): SVGSVGElement {
  return schematic(120, 60, title, comp(kind, [8, 34], [112, 34]));
}

export type FigureId =
  | 'ohm' | 'series' | 'series-voltages' | 'parallel' | 'mixed' | 'node' | 'divider' | 'real-source'
  | 'rc' | 'rc-curve' | 'led' | 'rlc' | 'sine' | 'impedance' | 'bands';

export const FIGURES: Record<FigureId, () => SVGSVGElement> = {
  ohm: ohmFigure,
  series: () => seriesFigure([{ label: 'R_1' }, { label: 'R_2' }, { label: 'R_3' }]),
  'series-voltages': () => seriesFigure([{ label: 'R_1' }, { label: 'R_2' }, { label: 'R_3' }], { voltages: true }),
  parallel: () => parallelFigure([{ label: 'R_1' }, { label: 'R_2' }, { label: 'R_3' }]),
  mixed: () => mixedFigure([{ label: 'R_1' }, { label: 'R_2' }, { label: 'R_3' }]),
  node: () => nodeFigure(),
  divider: () => dividerFigure(),
  'real-source': realSourceFigure,
  rc: rcFigure,
  'rc-curve': rcCurveChart,
  led: () => ledFigure(),
  rlc: rlcFigure,
  sine: sineChart,
  impedance: () => impedanceTriangle(4, 3, { r: 'R', x: 'X', z: 'Z' }),
  bands: () => resistorBands(['yellow', 'violet', 'red', 'gold']),
};
