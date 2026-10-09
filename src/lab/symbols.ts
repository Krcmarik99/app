/**
 * Schematické značky súčiastok pre zapájanie obvodov (podľa STN EN 60617).
 * Dvojpóly kreslí `comp` zo schém lekcií, tranzistory, MOSFET, wattmeter, multimeter
 * a osciloskop majú vlastné značky. Texty sa neotáčajú spolu so súčiastkou.
 */
import { s } from '../lib/dom';
import { formatSI } from '../lib/units';
import { comp, type CompKind } from '../ui/schematic';
import { KINDS, num, rotate, terminalsOf, type Part, type Pt, type Rot } from './parts';

export const G = 20;

const px = ([x, y]: Pt): Pt => [x * G, y * G];
const r1 = (n: number) => Math.round(n * 10) / 10;

function arrow(x: number, y: number, angleDeg: number, size = 4.5): SVGPolygonElement {
  const a = (angleDeg * Math.PI) / 180;
  const p = (dx: number, dy: number) => `${r1(x + dx * Math.cos(a) - dy * Math.sin(a))},${r1(y + dx * Math.sin(a) + dy * Math.cos(a))}`;
  return s('polygon', { points: `${p(0, 0)} ${p(-size * 1.6, -size * 0.75)} ${p(-size * 1.6, size * 0.75)}`, class: 'f' });
}

const line = (x1: number, y1: number, x2: number, y2: number, cls = 'w') => s('line', { x1, y1, x2, y2, class: cls });

/** Skupina otočená podľa súčiastky; (0, 0) je prvý vývod. */
function rotated(part: Part, ...children: SVGElement[]): SVGGElement {
  const [x, y] = px([part.x, part.y]);
  return s('g', { transform: `translate(${x} ${y}) rotate(${part.rot * 90})` }, ...children);
}

/** Bod zadaný v pixeloch v súradniciach súčiastky prepočíta na pixely schémy. */
function local(part: Part, lx: number, ly: number): Pt {
  const [rx, ry] = rotate([lx, ly], part.rot);
  return [part.x * G + rx, part.y * G + ry];
}

function text(x: number, y: number, value: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'middle'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls }, value);
}

/** Dvojpól s vlastným telom (polovičná dĺžka `half` v smere vodiča). */
function twoPole(part: Part, half: number, ...body: SVGElement[]): SVGGElement {
  const mid = 1.5 * G;
  return rotated(part,
    line(0, 0, mid - half, 0),
    line(mid + half, 0, 3 * G, 0),
    s('g', { transform: `translate(${mid} 0)` }, ...body),
  );
}

/** Hodnota súčiastky v schéme (jeden alebo dva riadky). */
export function valueLabel(part: Part): string[] {
  const p = part.props;
  switch (part.kind) {
    case 'resistor': return [formatSI(num(p.R, 1000), 'Ω', 3)];
    case 'capacitor': return [formatSI(num(p.C, 1e-6), 'F', 3)];
    case 'ecap': return [formatSI(num(p.C, 1e-4), 'F', 3), `${String(p.umax).replace('.', ',')} V`];
    case 'inductor': return [formatSI(num(p.L, 0.1), 'H', 3)];
    case 'dc': return [formatSI(num(p.U, 12), 'V', 4)];
    case 'ac': return [formatSI(num(p.U, 10), 'V', 4), formatSI(num(p.f, 50), 'Hz', 3)];
    case 'bjt': return [p.type === 'pnp' ? 'PNP' : 'NPN'];
    case 'mosfet': return [p.type === 'p' ? 'P-MOS' : 'N-MOS'];
    default: return [];
  }
}

/** Popis súčiastky: kurzívou označenie, pod ním hodnota. */
function labels(part: Part, anchorLocal: Pt, dirAway: Pt): SVGElement[] {
  const [ax, ay] = local(part, anchorLocal[0], anchorLocal[1]);
  const [dx, dy] = rotate(dirAway, part.rot);
  const anchor: 'start' | 'middle' | 'end' = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
  const lines = [part.name, ...valueLabel(part)].filter(Boolean);
  const total = (lines.length - 1) * 13;
  const y0 = dy > 0 ? ay + 12 : dy < 0 ? ay - total - 2 : ay - total / 2 + 4;
  return lines.map((t, i) => text(ax, y0 + i * 13, t, i === 0 ? 'lab-name' : 'val', anchor));
}

/** Ako ďaleko od vodiča siaha značka – podľa toho sa odsadí popis. */
const EXTENT: Partial<Record<Part['kind'], number>> = {
  resistor: 7, capacitor: 12, ecap: 15, inductor: 6, diode: 9, led: 21, dc: 12, ac: 13, switch: 12,
};

const COMP: Partial<Record<Part['kind'], CompKind>> = {
  resistor: 'resistor', capacitor: 'capacitor', ecap: 'ecap', inductor: 'inductor',
  diode: 'diode', led: 'led', dc: 'battery', ac: 'acsource', ammeter: 'ammeter', voltmeter: 'voltmeter',
};

export interface PartDrawing {
  g: SVGGElement;
  /** Teleso rezistora – zafarbí sa podľa zahrievania. */
  body?: SVGElement;
  /** Svit LED. */
  glow?: SVGCircleElement;
  /** Displej meracieho prístroja. */
  display?: SVGTextElement;
  displayBox?: SVGRectElement;
}

/** Stred súčiastky v pixeloch (priemer polôh vývodov). */
export function centerOf(part: Part): Pt {
  const t = terminalsOf(part);
  const cx = t.reduce((a, p) => a + p[0], 0) / t.length;
  const cy = t.reduce((a, p) => a + p[1], 0) / t.length;
  return [cx * G, cy * G];
}

function multiTerminal(part: Part, iconOnly: boolean): SVGGElement {
  const g = s('g');
  switch (part.kind) {
    case 'bjt': {
      const pnp = part.props.type === 'pnp';
      g.append(rotated(part,
        s('circle', { cx: 27, cy: 0, r: 19, class: 'b' }),
        line(0, 0, 17, 0),
        line(17, -10, 17, 10, 'p'),
        line(17, -5, 40, -17),
        line(40, -17, 40, -40),
        line(17, 5, 40, 17),
        line(40, 17, 40, 40),
        pnp ? arrow(22, 7.7, 208.6) : arrow(36, 14.8, 28.6),
      ));
      if (!iconOnly) g.append(...labels(part, [50, 0], [1, 0]));
      break;
    }
    case 'mosfet': {
      const p = part.props.type === 'p';
      g.append(rotated(part,
        line(0, 0, 13, 0),
        line(13, -14, 13, 14),
        line(19, -17, 19, -8),
        line(19, -4, 19, 4),
        line(19, 8, 19, 17),
        line(19, -12, 40, -12),
        line(40, -12, 40, -40),
        line(19, 12, 40, 12),
        line(40, 12, 40, 40),
        line(19, 0, 40, 0),
        line(40, 0, 40, 12),
        p ? arrow(36, 0, 0, 4) : arrow(21, 0, 180, 4),
      ));
      if (!iconOnly) g.append(...labels(part, [50, 0], [1, 0]));
      break;
    }
    case 'wattmeter': {
      const cx = 2 * G;
      g.append(rotated(part,
        line(0, 0, cx - 14, 0),
        line(cx + 14, 0, 4 * G, 0),
        line(cx, -2 * G, cx, -14),
        line(cx, 14, cx, 2 * G),
        s('circle', { cx, cy: 0, r: 14, class: 'b' }),
        line(cx - 14, 0, cx + 14, 0, 'p'),
      ));
      const [mx, my] = local(part, cx, 0);
      const [sx, sy] = local(part, 7, -7);
      const [ux, uy] = local(part, cx - 7, -2 * G + 9);
      g.append(text(mx, my - 3, 'W', 'meter'), text(sx, sy + 4, '*', 'lab-star'), text(ux, uy + 4, '*', 'lab-star'));
      break;
    }
    case 'scope': {
      g.append(rotated(part,
        line(0, 0, G, 0), line(0, G, G, G), line(0, 2 * G, G, 2 * G),
        s('rect', { x: G, y: -0.8 * G, width: 3.4 * G, height: 3.6 * G, rx: 4, class: 'b' }),
        s('rect', { x: G + 14, y: -0.8 * G + 6, width: 3.4 * G - 20, height: 30, rx: 2, class: 'lab-scope-screen' }),
        s('path', { d: `M${G + 18} ${-0.8 * G + 21}c5-14 9-14 13 0s8 14 13 0s8-14 13 0`, class: 'lab-scope-wave' }),
      ));
      if (!iconOnly) {
        ['1', '2', '⏚'].forEach((t, i) => {
          const [x, y] = local(part, G + 8, i * G);
          g.append(text(x, y + 4, t, 'lab-pin'));
        });
        const [nx, ny] = local(part, 2.7 * G, 2.75 * G + 13);
        g.append(text(nx, ny, part.name, 'lab-name'));
      }
      break;
    }
  }
  return g;
}

export function drawPart(part: Part, iconOnly = false): PartDrawing {
  const a = px([part.x, part.y]);
  const terms = terminalsOf(part);
  const horizontal = part.rot % 2 === 0;
  const out: PartDrawing = { g: s('g', { class: `lab-part lab-${part.kind}` }) };
  const kindComp = COMP[part.kind];
  if (kindComp) {
    const b = px(terms[1]);
    const drawn = comp(kindComp, a, b);
    out.g.append(drawn);
    if (part.kind === 'resistor') out.body = drawn.querySelector('rect') ?? undefined;
    if (part.kind === 'led') {
      const [cx, cy] = centerOf(part);
      out.glow = s('circle', { cx, cy, r: 22, class: 'lab-glow', fill: `url(#lab-glow-${part.props.color})`, opacity: 0 });
      out.g.prepend(out.glow);
    }
    if (part.kind === 'dc' && !iconOnly) {
      const [x, y] = local(part, -6, -8);
      out.g.append(text(x, y + 4, '+', 'lab-pin'));
    }
  } else if (part.kind === 'switch') {
    const on = part.props.on === true;
    out.g.append(twoPole(part, 13,
      s('circle', { cx: -11, cy: 0, r: 2.2, class: 'b' }),
      on ? line(-9.5, -1.6, 11, -2.6) : line(-9.5, -1.5, 12, -11),
      s('circle', { cx: 11, cy: 0, r: 2.2, class: 'b' }),
    ));
  } else if (part.kind === 'multimeter') {
    out.g.append(twoPole(part, 14,
      s('rect', { x: -14, y: -14, width: 28, height: 28, rx: 5, class: 'b' }),
    ));
    const [cx, cy] = centerOf(part);
    const mode = String(part.props.mode);
    const sym = mode === 'ohm' ? 'Ω' : mode.replace('=', '⎓');
    out.g.append(text(cx, cy + 4.5, sym, 'meter'));
  } else {
    out.g.append(multiTerminal(part, iconOnly));
  }

  if (iconOnly) return out;

  if ((kindComp || part.kind === 'switch') && !['ammeter', 'voltmeter'].includes(part.kind)) {
    out.g.append(...labels(part, [1.5 * G, -(EXTENT[part.kind] ?? 10) - 5], [0, -1]));
  }
  // Displej meracieho prístroja.
  if (['ammeter', 'voltmeter', 'multimeter', 'wattmeter'].includes(part.kind)) {
    const [cx, cy] = centerOf(part);
    const watt = part.kind === 'wattmeter';
    const dx = watt || !horizontal ? 1 : 0;
    const dy = !watt && horizontal ? -1 : 0;
    // Wattmeter: displej vpravo pod kruhom, aby nezakryl vývody ani susedné prístroje.
    const wx = watt ? cx + 22 : cx + dx * 28;
    const wy = watt ? cy + (horizontal ? 18 : 0) : cy + dy * 28;
    const anchor = dx > 0 ? 'start' : 'middle';
    const w = 74;
    const boxX = anchor === 'start' ? wx - 4 : wx - w / 2;
    out.displayBox = s('rect', { x: boxX, y: wy - 12, width: w, height: 18, rx: 3, class: 'lab-display-box' });
    out.display = text(anchor === 'start' ? wx + w / 2 - 4 : wx, wy + 1.5, '—', 'lab-display');
    out.g.append(out.displayBox, out.display);
  }
  return out;
}

/** Plocha, za ktorú sa súčiastka dá chytiť myšou alebo prstom. */
export function hitBox(part: Part): { x: number; y: number; width: number; height: number } {
  const pts = terminalsOf(part).map(px);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  if (part.kind === 'scope') {
    const c = [local(part, G, -0.8 * G), local(part, 4.4 * G, 2.8 * G)];
    x0 = Math.min(x0, ...c.map((p) => p[0]));
    x1 = Math.max(x1, ...c.map((p) => p[0]));
    y0 = Math.min(y0, ...c.map((p) => p[1]));
    y1 = Math.max(y1, ...c.map((p) => p[1]));
  }
  const pad = 12;
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
}

/** Malá ikona súčiastky do palety. */
export function partIcon(kind: Part['kind'], props: Record<string, string | number | boolean> = {}): SVGSVGElement {
  const part: Part = { id: 'icon', kind, name: '', x: 0, y: 0, rot: 0 as Rot, props: { ...KINDS[kind].defaults, ...props } };
  const terms = terminalsOf(part).map(px);
  const xs = terms.map((p) => p[0]);
  const ys = terms.map((p) => p[1]);
  let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys) - 16, Math.max(...ys) + 16];
  // Ikony viacpólov orežeme na telo značky, aby neboli príliš malé.
  if (kind === 'scope') [x0, x1, y0, y1] = [0, 4.6 * G, -0.9 * G, 2.9 * G];
  if (kind === 'bjt' || kind === 'mosfet') [x0, x1, y0, y1] = [0, 48, -28, 28];
  if (kind === 'wattmeter') [x0, x1, y0, y1] = [8, 72, -26, 26];
  const pad = 4;
  return s('svg', {
    viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`,
    class: 'sch lab-icon', 'aria-hidden': 'true', focusable: 'false',
  }, drawPart(part, true).g);
}
