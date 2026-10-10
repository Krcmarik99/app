/**
 * Schematické značky súčiastok pre zapájanie obvodov (podľa STN EN 60617).
 * Dvojpóly kreslí `comp` zo schém lekcií, tranzistory, MOSFET, wattmeter, multimeter
 * a osciloskop majú vlastné značky. Texty sa neotáčajú spolu so súčiastkou.
 */
import { s } from '../lib/dom';
import { comp, type CompKind } from '../ui/schematic';
import { G, arrow, labels, line, local, px, rotated, text, twoPole } from './draw';
import { drawModule } from './modules';
import { KINDS, terminalsOf, type Part, type Pt, type Rot } from './parts';
import type { PartState, Simulator } from './engine';

export { G, valueLabel } from './draw';

/** Ako ďaleko od vodiča siaha značka – podľa toho sa odsadí popis. */
const EXTENT: Partial<Record<Part['kind'], number>> = {
  resistor: 7, lamp: 11, capacitor: 12, ecap: 15, inductor: 6, diode: 9, led: 21, dc: 12, ac: 13, switch: 12,
};

const COMP: Partial<Record<Part['kind'], CompKind>> = {
  resistor: 'resistor', lamp: 'lamp', capacitor: 'capacitor', ecap: 'ecap', inductor: 'inductor',
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
  /** Prekreslenie stavu počas simulácie (displeje, servo, tlačidlo, LED na doske Arduina). */
  live?: (ctx: LiveCtx) => void;
}

export interface LiveCtx {
  sim: Simulator | null;
  st: PartState | undefined;
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
  const module = drawModule(part, iconOnly);
  if (module) return module;
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
    if (part.kind === 'led' || part.kind === 'lamp') {
      const [cx, cy] = centerOf(part);
      const lamp = part.kind === 'lamp';
      out.glow = s('circle', {
        cx, cy, r: lamp ? 30 : 22, class: 'lab-glow', fill: `url(#lab-glow-${lamp ? 'lamp' : part.props.color})`, opacity: 0,
      });
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
  const body = KINDS[part.kind].body;
  if (part.kind === 'scope' || body) {
    const c = body
      ? [local(part, body[0] * G, body[1] * G), local(part, body[2] * G, body[3] * G)]
      : [local(part, G, -0.8 * G), local(part, 4.4 * G, 2.8 * G)];
    x0 = Math.min(x0, ...c.map((p) => p[0]));
    x1 = Math.max(x1, ...c.map((p) => p[0]));
    y0 = Math.min(y0, ...c.map((p) => p[1]));
    y1 = Math.max(y1, ...c.map((p) => p[1]));
  }
  const pad = body ? 4 : 12;
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
  const body = KINDS[kind].body;
  if (body) [x0, x1, y0, y1] = [body[0] * G, body[2] * G, body[1] * G, body[3] * G];
  if (kind === 'pot') [x0, x1, y0, y1] = [0, 80, -16, 42];
  const pad = 4;
  return s('svg', {
    viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`,
    class: 'sch lab-icon', 'aria-hidden': 'true', focusable: 'false',
  }, drawPart(part, true).g);
}
