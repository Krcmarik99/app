/**
 * Interaktívny obvod na úvodnej stránke: napätie a odpor sa menia posuvníkmi,
 * bodky na vodičoch ukazujú prúd a rezistor sa „zahrieva“ podľa výkonu.
 */
import { E12 } from '../lib/electro';
import { h, s } from '../lib/dom';
import { formatSI } from '../lib/units';
import { comp, schematic, wire } from './schematic';

/** Hodnoty odporu na posuvníku: rada E12 od 10 Ω do 1 kΩ. */
const R_STEPS = [10, 100, 1000].flatMap((d) => E12.map((e) => Number((e * d).toPrecision(3)))).filter((r) => r <= 1000);
const RATED_POWER = 0.25;

export function heroCircuit(): HTMLElement {
  let U = 9;
  let R = 330;

  const top = 36;
  const bottom = 164;
  const left = 64;
  const right = 268;
  const flow = s('path', {
    d: `M${left} ${100 - 4}V${top}H${right}V${100 - 18}M${right} ${100 + 18}V${bottom}H${166 + 11}M${166 - 11} ${bottom}H${left}V${100 + 4}`,
    class: 'flow',
  });
  const resistor = comp('resistor', [right, top], [right, bottom], { label: 'R', side: 'right' });
  const svg = schematic(
    330, 196, 'Jednoduchý obvod: zdroj, ampérmeter a rezistor',
    wire([left, top], [right, top]),
    wire([left, bottom], [right, bottom]),
    flow,
    comp('battery', [left, top], [left, bottom], { label: 'U', side: 'left' }),
    comp('ammeter', [196, bottom], [136, bottom]),
    resistor,
  );
  const body = resistor.querySelector('rect') as SVGRectElement;

  const uOut = h('output', { class: 'slider-value', for: 'hero-u' });
  const rOut = h('output', { class: 'slider-value', for: 'hero-r' });
  const iOut = h('strong', { class: 'readout-value' });
  const pOut = h('strong', { class: 'readout-value' });
  const status = h('p', { class: 'hero-status', 'aria-live': 'polite' });

  const uInput = h('input', { id: 'hero-u', type: 'range', min: 0, max: 24, step: 0.5, value: U });
  const rInput = h('input', { id: 'hero-r', type: 'range', min: 0, max: R_STEPS.length - 1, step: 1, value: R_STEPS.indexOf(R) });

  let speed = 0;
  const update = () => {
    U = Number(uInput.value);
    R = R_STEPS[Number(rInput.value)];
    const I = U / R;
    const P = U * I;
    uOut.textContent = formatSI(U, 'V', 3);
    rOut.textContent = formatSI(R, 'Ω', 3);
    iOut.textContent = formatSI(I, 'A', 3);
    pOut.textContent = formatSI(P, 'W', 3);
    speed = I === 0 ? 0 : 18 + 130 * Math.sqrt(I / 2.4);
    const heat = Math.min(1, Math.sqrt(P / (RATED_POWER * 4)));
    body.style.fill = `color-mix(in srgb, var(--copper) ${Math.round(heat * 85)}%, var(--surface))`;
    const over = P > RATED_POWER;
    status.className = `hero-status ${over ? 'is-over' : 'is-ok'}`;
    status.textContent = over
      ? `Rezistor 0,25 W je preťažený – mení na teplo ${formatSI(P, 'W', 2)}.`
      : U === 0 ? 'Bez napätia neteče prúd.' : 'Rezistor 0,25 W výkon bez problémov znesie.';
  };
  uInput.addEventListener('input', update);
  rInput.addEventListener('input', update);
  update();

  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && typeof requestAnimationFrame === 'function') {
    let offset = 0;
    let last = 0;
    const tick = (t: number) => {
      if (!svg.isConnected && last !== 0) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      offset -= speed * dt;
      flow.style.strokeDashoffset = String(offset % 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return h('div', { class: 'hero-lab' },
    h('div', { class: 'sch-panel hero-sch' }, svg),
    h('div', { class: 'hero-controls' },
      h('div', { class: 'slider' },
        h('label', { for: 'hero-u' }, 'Napätie zdroja ', h('i', { class: 'v' }, 'U')),
        uInput,
        uOut,
      ),
      h('div', { class: 'slider' },
        h('label', { for: 'hero-r' }, 'Odpor ', h('i', { class: 'v' }, 'R')),
        rInput,
        rOut,
      ),
      h('div', { class: 'readouts' },
        h('div', { class: 'readout' }, h('span', { class: 'readout-label' }, 'Prúd ', h('i', { class: 'v' }, 'I'), ' = U / R'), iOut),
        h('div', { class: 'readout' }, h('span', { class: 'readout-label' }, 'Výkon ', h('i', { class: 'v' }, 'P'), ' = U · I'), pOut),
      ),
      status,
    ),
  );
}
