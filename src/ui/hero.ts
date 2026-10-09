/**
 * Interaktívny obvod na úvodnej stránke: napätie a odpor sa menia posuvníkmi,
 * bodky na vodičoch ukazujú prúd a rezistor sa „zahrieva“ podľa výkonu.
 */
import { E12 } from '../lib/electro';
import { h, s } from '../lib/dom';
import { formatSI } from '../lib/units';
import { comp, schematic, wire } from './schematic';

/** Hodnoty od `from` po `to` s krokom `step`. */
function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(Number((from + i * step).toFixed(1)));
  return out;
}

/** Napätie na posuvníku 0 až 500 V: jemný krok pri malých napätiach, hrubší pri veľkých. */
const U_STEPS = [...range(0, 10, 0.5), ...range(11, 30, 1), ...range(32, 100, 2), ...range(105, 200, 5), ...range(210, 500, 10)];

/** Odpor na posuvníku: 0 Ω (skrat), potom rada E12 od 1 mΩ až po 5 MΩ. */
const R_MAX = 5e6;
const R_STEPS = [
  0,
  ...Array.from({ length: 10 }, (_, i) => 10 ** (i - 3))
    .flatMap((d) => E12.map((e) => Number((e * d).toPrecision(3))))
    .filter((r) => r < R_MAX),
  R_MAX,
];
const RATED_POWER = 0.25;

/** Rýchlosť bodiek rastie s logaritmom prúdu: od 100 nA (pomaly) po stovky kA (najrýchlejšie). */
function flowSpeed(I: number): number {
  if (I === 0) return 0;
  const t = Math.min(1, Math.max(0, (Math.log10(I) + 7) / 12.7));
  return 10 + 240 * t * t;
}

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

  const uInput = h('input', { id: 'hero-u', type: 'range', min: 0, max: U_STEPS.length - 1, step: 1, value: U_STEPS.indexOf(U) });
  const rInput = h('input', { id: 'hero-r', type: 'range', min: 0, max: R_STEPS.length - 1, step: 1, value: R_STEPS.indexOf(R) });

  let speed = 0;
  const update = () => {
    U = U_STEPS[Number(uInput.value)];
    R = R_STEPS[Number(rInput.value)];
    // Pri R = 0 Ω a nenulovom napätí ide o skrat: ideálny obvod by mal nekonečný prúd.
    const short = R === 0 && U > 0;
    const I = U === 0 ? 0 : U / R;
    const P = U * I;
    uOut.textContent = formatSI(U, 'V', 3);
    rOut.textContent = formatSI(R, 'Ω', 3);
    uInput.setAttribute('aria-valuetext', uOut.textContent);
    rInput.setAttribute('aria-valuetext', rOut.textContent);
    iOut.textContent = short ? '∞ A' : formatSI(I, 'A', 3);
    pOut.textContent = short ? '∞ W' : formatSI(P, 'W', 3);
    speed = flowSpeed(I);
    flow.classList.toggle('is-short', short);
    const heat = short ? 0 : Math.min(1, Math.sqrt(P / (RATED_POWER * 4)));
    body.style.fill = `color-mix(in srgb, var(--copper) ${Math.round(heat * 85)}%, var(--surface))`;
    const over = short || P > RATED_POWER;
    status.className = `hero-status ${over ? 'is-over' : 'is-ok'}`;
    status.textContent = short
      ? 'Skrat! Pri R = 0 Ω by v ideálnom obvode tiekol nekonečne veľký prúd – v skutočnosti ho obmedzí len vnútorný odpor zdroja a odpor vodičov.'
      : P > RATED_POWER * 10
        ? `Rezistor 0,25 W by zhorel – musel by premeniť na teplo ${formatSI(P, 'W', 2)}.`
        : over
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
