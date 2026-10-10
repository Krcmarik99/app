/**
 * Spoločné pomôcky na kreslenie súčiastok do mriežky: prepočet súradníc, otočenie,
 * čiary, texty a popisy súčiastok.
 */
import { s } from '../lib/dom';
import { formatSI } from '../lib/units';
import { num, rotate, type Part, type Pt } from './parts';

export const G = 20;
/** Veľkosť plochy na zapájanie v políčkach mriežky. */
export const COLS = 48;
export const ROWS = 34;

export const px = ([x, y]: Pt): Pt => [x * G, y * G];
export const r1 = (n: number) => Math.round(n * 10) / 10;

export function arrow(x: number, y: number, angleDeg: number, size = 4.5): SVGPolygonElement {
  const a = (angleDeg * Math.PI) / 180;
  const p = (dx: number, dy: number) => `${r1(x + dx * Math.cos(a) - dy * Math.sin(a))},${r1(y + dx * Math.sin(a) + dy * Math.cos(a))}`;
  return s('polygon', { points: `${p(0, 0)} ${p(-size * 1.6, -size * 0.75)} ${p(-size * 1.6, size * 0.75)}`, class: 'f' });
}

export const line = (x1: number, y1: number, x2: number, y2: number, cls = 'w') => s('line', { x1, y1, x2, y2, class: cls });

/** Skupina otočená podľa súčiastky; (0, 0) je prvý vývod. */
export function rotated(part: Part, ...children: SVGElement[]): SVGGElement {
  const [x, y] = px([part.x, part.y]);
  return s('g', { transform: `translate(${x} ${y}) rotate(${part.rot * 90})` }, ...children);
}

/** Bod zadaný v pixeloch v súradniciach súčiastky prepočíta na pixely schémy. */
export function local(part: Part, lx: number, ly: number): Pt {
  const [rx, ry] = rotate([lx, ly], part.rot);
  return [part.x * G + rx, part.y * G + ry];
}

export function text(x: number, y: number, value: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'middle'): SVGTextElement {
  return s('text', { x: r1(x), y: r1(y), 'text-anchor': anchor, class: cls }, value);
}

/** Dvojpól s vlastným telom (polovičná dĺžka `half` v smere vodiča). */
export function twoPole(part: Part, half: number, ...body: SVGElement[]): SVGGElement {
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
    case 'lamp': return [formatSI(num(p.U, 12), 'V', 3), formatSI(num(p.P, 5), 'W', 3)];
    case 'capacitor': return [formatSI(num(p.C, 1e-6), 'F', 3)];
    case 'ecap': return [formatSI(num(p.C, 1e-4), 'F', 3), `${String(p.umax).replace('.', ',')} V`];
    case 'inductor': return [formatSI(num(p.L, 0.1), 'H', 3)];
    case 'dc': return [formatSI(num(p.U, 12), 'V', 4)];
    case 'ac': return [formatSI(num(p.U, 10), 'V', 4), formatSI(num(p.f, 50), 'Hz', 3)];
    case 'bjt': return [p.type === 'pnp' ? 'PNP' : 'NPN'];
    case 'mosfet': return [p.type === 'p' ? 'P-MOS' : 'N-MOS'];
    case 'pot': return [formatSI(num(p.R, 10000), 'Ω', 3), `${Math.round(num(p.pos, 50))} %`];
    case 'ldr': {
      const lux = num(p.lux, 100);
      return [`${lux < 10 ? String(lux).replace('.', ',') : Math.round(lux)} lx`];
    }
    case 'buzzer': return [p.type === 'active' ? 'aktívny' : ''];
    default: return [];
  }
}

/** Popis súčiastky: kurzívou označenie, pod ním hodnota. */
export function labels(part: Part, anchorLocal: Pt, dirAway: Pt): SVGElement[] {
  const [ax, ay] = local(part, anchorLocal[0], anchorLocal[1]);
  const [dx, dy] = rotate(dirAway, part.rot);
  const anchor: 'start' | 'middle' | 'end' = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle';
  const lines = [part.name, ...valueLabel(part)].filter(Boolean);
  const total = (lines.length - 1) * 13;
  const y0 = dy > 0 ? ay + 12 : dy < 0 ? ay - total - 2 : ay - total / 2 + 4;
  return lines.map((t, i) => text(ax, y0 + i * 13, t, i === 0 ? 'lab-name' : 'val', anchor));
}

