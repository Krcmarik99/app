/**
 * Náhľad ukážkového zapojenia: statická schéma s hodnotami po krátkej simulácii
 * a so zvýraznenou súčiastkou, o ktorej je reč.
 */
import { s } from '../lib/dom';
import { formatSI } from '../lib/units';
import { Simulator, glowLevel, meterReading } from './engine';
import { buildNets } from './netlist';
import type { Circuit, Part } from './parts';
import { G, drawPart, hitBox } from './symbols';

const cache = new Map<string, SVGSVGElement>();

/** Simulácia ukážky na 0,4 s, aby merače ukazovali ustálené hodnoty. */
function settle(circuit: Circuit): Simulator | null {
  try {
    const sim = new Simulator(JSON.parse(JSON.stringify(circuit)) as Circuit);
    for (let t = 0; t < 0.4 - 1e-9; t += 0.02) sim.advance(0.02, 5000);
    return sim.error ? null : sim;
  } catch {
    return null;
  }
}

export function circuitPreview(key: string, title: string, circuit: Circuit, focus: (p: Part) => boolean): SVGSVGElement {
  const cached = cache.get(key);
  if (cached) return cached.cloneNode(true) as SVGSVGElement;

  const sim = settle(circuit);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const part of circuit.parts) {
    const b = hitBox(part);
    xs.push(b.x, b.x + b.width);
    ys.push(b.y, b.y + b.height);
  }
  for (const w of circuit.wires) {
    xs.push(w.a[0] * G, w.b[0] * G);
    ys.push(w.a[1] * G, w.b[1] * G);
  }
  // Vpravo a hore miesto na popisy a displeje meracích prístrojov.
  const x0 = Math.min(...xs) - 16;
  const x1 = Math.max(...xs) + 70;
  const y0 = Math.min(...ys) - 34;
  const y1 = Math.max(...ys) + 20;

  const g = s('g');
  for (const part of circuit.parts.filter(focus)) {
    const b = hitBox(part);
    g.append(s('rect', { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, rx: 8, class: 'lab-focus' }));
  }
  for (const w of circuit.wires) {
    g.append(s('line', { x1: w.a[0] * G, y1: w.a[1] * G, x2: w.b[0] * G, y2: w.b[1] * G, class: 'w' }));
  }
  for (const part of circuit.parts) {
    const d = drawPart(part);
    const st = sim?.states.get(part.id);
    if (d.display) {
      const r = sim && st ? meterReading(part, st, sim.hasAC) : null;
      d.display.textContent = !r ? '—' : r.value === null ? 'OL' : formatSI(Math.abs(r.value) < 1e-12 ? 0 : r.value, r.unit, 4);
    }
    if (d.glow) {
      const b = glowLevel(part, st, sim?.hasAC ?? false);
      d.glow.setAttribute('opacity', b < 0.005 ? '0' : String((0.25 + 0.75 * Math.sqrt(b)).toFixed(2)));
    }
    g.append(d.g);
  }
  for (const [x, y] of buildNets(circuit).junctions) g.append(s('circle', { cx: x * G, cy: y * G, r: 3.4, class: 'dot' }));

  const svg = s('svg', {
    viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, class: 'sch lab-preview-svg', role: 'img',
    'aria-label': `Ukážka zapojenia: ${title}`,
  }, s('title', null, title), g);
  cache.set(key, svg);
  return svg.cloneNode(true) as SVGSVGElement;
}
