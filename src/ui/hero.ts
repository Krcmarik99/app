/**
 * Interaktívny obvod na úvodnej stránke: napätie a odpor sa menia posuvníkmi alebo
 * zadaním hodnoty, bodky na vodičoch ukazujú prúd a rezistor sa „zahrieva“ podľa výkonu.
 * Druhá schéma zapojí do obvodu LED s predradným rezistorom.
 */
import { E12, LED_COLORS } from '../lib/electro';
import { h, s } from '../lib/dom';
import { fmt, formatSI, parseQuantity, siParts } from '../lib/units';
import { segmented } from '../views/calc-kit';
import { comp, schematic, wire } from './schematic';

/** Hodnoty od `from` po `to` s krokom `step`. */
function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(Number((from + i * step).toFixed(1)));
  return out;
}

const U_MAX = 500;
/** Napätie na posuvníku 0 až 500 V: jemný krok pri malých napätiach, hrubší pri veľkých. */
const U_STEPS = [...range(0, 10, 0.5), ...range(11, 30, 1), ...range(32, 100, 2), ...range(105, 200, 5), ...range(210, U_MAX, 10)];

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
/** Najväčší trvalý prúd bežnej LED. */
const LED_MAX = 0.02;
/** Pod týmto prúdom LED svieti len slabo. */
const LED_DIM = 0.5e-3;
/** Farba svitu LED v schéme. */
const LED_GLOW: Record<string, string> = {
  red: '#ff3b2f', yellow: '#ffc21a', green: '#22d65a', blue: '#3d7bff', white: '#a9c8ff',
};

/** Rýchlosť bodiek rastie s logaritmom prúdu: od 100 nA (pomaly) po stovky kA (najrýchlejšie). */
function flowSpeed(I: number): number {
  if (I === 0) return 0;
  const t = Math.min(1, Math.max(0, (Math.log10(I) + 7) / 12.7));
  return 10 + 240 * t * t;
}

/** Poloha posuvníka najbližšie k zadanej hodnote (pri odpore v logaritmickej mierke). */
function nearestIndex(steps: number[], x: number, log: boolean): number {
  if (log && x === 0) return 0;
  const dist = (a: number) => (log ? (a === 0 ? Infinity : Math.abs(Math.log(a / x))) : Math.abs(a - x));
  let best = 0;
  steps.forEach((a, i) => {
    if (dist(a) < dist(steps[best])) best = i;
  });
  return best;
}

type Mode = 'r' | 'led';

interface Circuit {
  svg: SVGSVGElement;
  flow: SVGPathElement;
  body: SVGRectElement;
  led?: { group: SVGGElement; glow: SVGCircleElement; stops: SVGStopElement[] };
}

const TOP = 36;
const BOTTOM = 164;
const LEFT = 64;
const RIGHT = 268;
const MID = 100;
const CX = 166;

function resistorCircuit(): Circuit {
  const flow = s('path', {
    d: `M${LEFT} ${MID - 4}V${TOP}H${RIGHT}V${MID - 18}M${RIGHT} ${MID + 18}V${BOTTOM}H${CX + 11}M${CX - 11} ${BOTTOM}H${LEFT}V${MID + 4}`,
    class: 'flow',
  });
  const resistor = comp('resistor', [RIGHT, TOP], [RIGHT, BOTTOM], { label: 'R', side: 'right' });
  const svg = schematic(
    330, 196, 'Jednoduchý obvod: zdroj, ampérmeter a rezistor',
    wire([LEFT, TOP], [RIGHT, TOP]),
    wire([LEFT, BOTTOM], [RIGHT, BOTTOM]),
    flow,
    comp('battery', [LEFT, TOP], [LEFT, BOTTOM], { label: 'U', side: 'left' }),
    comp('ammeter', [CX + 30, BOTTOM], [CX - 30, BOTTOM]),
    resistor,
  );
  return { svg, flow, body: resistor.querySelector('rect') as SVGRectElement };
}

function ledCircuit(): Circuit {
  const flow = s('path', {
    d: `M${LEFT} ${MID - 4}V${TOP}H${CX - 18}M${CX + 18} ${TOP}H${RIGHT}V${MID - 8}M${RIGHT} ${MID + 8}V${BOTTOM}H${CX + 11}M${CX - 11} ${BOTTOM}H${LEFT}V${MID + 4}`,
    class: 'flow',
  });
  const stops = [
    s('stop', { offset: '0%', 'stop-opacity': 0.9 }),
    s('stop', { offset: '45%', 'stop-opacity': 0.45 }),
    s('stop', { offset: '100%', 'stop-opacity': 0 }),
  ];
  const glow = s('circle', { cx: RIGHT, cy: MID, r: 34, fill: 'url(#hero-led-glow)', class: 'led-glow' });
  const resistor = comp('resistor', [CX - 48, TOP], [CX + 48, TOP], { label: 'R' });
  const led = comp('led', [RIGHT, TOP], [RIGHT, BOTTOM], { value: 'LED', side: 'left' });
  const svg = schematic(
    330, 196, 'Obvod s LED: zdroj, predradný rezistor, LED a ampérmeter',
    s('defs', null, s('radialGradient', { id: 'hero-led-glow' }, ...stops)),
    glow,
    wire([LEFT, TOP], [RIGHT, TOP]),
    wire([LEFT, BOTTOM], [RIGHT, BOTTOM]),
    flow,
    comp('battery', [LEFT, TOP], [LEFT, BOTTOM], { label: 'U', side: 'left' }),
    comp('ammeter', [CX + 30, BOTTOM], [CX - 30, BOTTOM]),
    resistor,
    led,
  );
  return { svg, flow, body: resistor.querySelector('rect') as SVGRectElement, led: { group: led, glow, stops } };
}

interface Entry {
  input: HTMLInputElement;
  show(x: number): void;
}

/**
 * Políčko na zadanie vlastnej hodnoty. Prijme desatinnú čiarku aj predpony (4,7k = 4,7 kΩ),
 * šípky ↑ ↓ menia hodnotu o stotinu zobrazenej jednotky, so Shiftom o celú jednotku.
 */
function entry(
  id: string, label: string, unit: string, max: number, rangeText: string,
  format: (x: number) => string, unitStep: (x: number) => number,
  onValue: (x: number) => void, onError: (id: string, error: string | null) => void,
): Entry {
  const input = h('input', {
    id, type: 'text', class: 'slider-field', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': label,
  });
  let current = 0;
  const setValid = (valid: boolean) => {
    input.classList.toggle('is-invalid', !valid);
    if (valid) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
    onError(id, valid ? null : `${label} zadaj v rozsahu ${rangeText}.`);
  };
  const show = (x: number) => {
    current = x;
    input.value = format(x);
    setValid(true);
  };
  input.addEventListener('input', () => {
    const x = parseQuantity(input.value, unit);
    const valid = Number.isFinite(x) && x >= 0 && x <= max;
    setValid(valid);
    if (valid) {
      current = x;
      onValue(x);
    }
  });
  // Po potvrdení (Enter, opustenie políčka) sa hodnota prepíše do úhľadného tvaru,
  // neplatný zápis sa vráti na poslednú platnú hodnotu.
  input.addEventListener('change', () => show(current));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const step = unitStep(current) * (e.shiftKey ? 1 : 0.01);
    const next = (Math.round(current / step) + (e.key === 'ArrowUp' ? 1 : -1)) * step;
    show(Math.min(max, Math.max(0, Number(next.toPrecision(12)))));
    onValue(current);
  });
  return { input, show };
}

const vi = (sym: string) => h('i', { class: 'v' }, sym);
const uF = () => h('span', null, vi('U'), h('sub', null, 'F'));

export function heroCircuit(): HTMLElement {
  let U = 9;
  let R = 330;
  let mode: Mode = 'r';
  let color = LED_COLORS[0];
  let speed = 0;

  const circuits: Record<Mode, Circuit> = { r: resistorCircuit(), led: ledCircuit() };
  let active = circuits.r;
  const panel = h('div', { class: 'sch-panel hero-sch' }, active.svg);

  const iLabel = h('span', { class: 'readout-label' });
  const pLabel = h('span', { class: 'readout-label' });
  const iOut = h('strong', { class: 'readout-value' });
  const pOut = h('strong', { class: 'readout-value' });
  const status = h('p', { class: 'hero-status', 'aria-live': 'polite' });

  const hint = h('p', { class: 'hero-entry-hint' });
  const errors = new Map<string, string>();
  const setError = (id: string, error: string | null) => {
    if (error) errors.set(id, error);
    else errors.delete(id);
    const first = [...errors.values()][0];
    hint.textContent = first ?? 'Hodnotu môžeš aj napísať, napr. 12,25 V alebo 4,7k (= 4,7 kΩ). Šípky ↑ ↓ v políčku ju menia o stotinu.';
    hint.classList.toggle('is-error', !!first);
  };

  const uInput = h('input', { id: 'hero-u', type: 'range', min: 0, max: U_STEPS.length - 1, step: 1, value: U_STEPS.indexOf(U) });
  const rInput = h('input', { id: 'hero-r', type: 'range', min: 0, max: R_STEPS.length - 1, step: 1, value: R_STEPS.indexOf(R) });

  const update = () => {
    const UF = mode === 'led' ? color[2] : 0;
    // Napätie, ktoré zostane na rezistore. LED vedie až nad svojím napätím U_F.
    const UR = Math.max(0, U - UF);
    const short = R === 0 && UR > 0;
    const I = UR === 0 ? 0 : UR / R;
    const P = UR * I;
    uInput.setAttribute('aria-valuetext', formatSI(U, 'V', 6));
    rInput.setAttribute('aria-valuetext', formatSI(R, 'Ω', 6));
    iOut.textContent = short ? '∞ A' : formatSI(I, 'A', 4);
    pOut.textContent = short ? '∞ W' : formatSI(P, 'W', 4);
    speed = flowSpeed(I);
    active.flow.classList.toggle('is-short', short);
    const heat = short ? 0 : Math.min(1, Math.sqrt(P / (RATED_POWER * 4)));
    active.body.style.fill = `color-mix(in srgb, var(--copper) ${Math.round(heat * 85)}%, var(--surface))`;

    const overload = P > RATED_POWER * 10
      ? `by zhorel – musel by premeniť na teplo ${formatSI(P, 'W', 2)}`
      : P > RATED_POWER ? `je preťažený – mení na teplo ${formatSI(P, 'W', 2)}` : null;
    let tone: 'ok' | 'over' | 'idle' = 'ok';
    let text: string;
    if (mode === 'r') {
      if (short) {
        tone = 'over';
        text = 'Skrat! Pri R = 0 Ω by v ideálnom obvode tiekol nekonečne veľký prúd – v skutočnosti ho obmedzí len vnútorný odpor zdroja a odpor vodičov.';
      } else if (overload) {
        tone = 'over';
        text = `Rezistor 0,25 W ${overload}.`;
      } else if (U === 0) {
        tone = 'idle';
        text = 'Bez napätia neteče prúd.';
      } else {
        text = 'Rezistor 0,25 W výkon bez problémov znesie.';
      }
    } else {
      const led = active.led!;
      const burnt = short || I > LED_MAX;
      const glow = burnt ? 0 : Math.sqrt(Math.min(1, I / LED_MAX));
      const glowColor = LED_GLOW[color[0]];
      led.group.classList.toggle('is-burnt', burnt);
      led.glow.style.opacity = String(glow);
      for (const stop of led.stops) stop.setAttribute('stop-color', glowColor);
      (led.group.querySelector('polygon') as SVGPolygonElement).style.fill = burnt
        ? ''
        : `color-mix(in srgb, ${glowColor} ${Math.round(glow * 100)}%, var(--surface))`;
      const rMin = formatSI(UR / LED_MAX, 'Ω', 3);
      if (U === 0) {
        tone = 'idle';
        text = 'Bez napätia neteče prúd.';
      } else if (UR === 0) {
        tone = 'idle';
        text = `LED nesvieti – otvorí sa až nad ${fmt(UF)} V, pri menšom napätí ňou prúd neteče.`;
      } else if (short) {
        tone = 'over';
        text = `Bez predradného rezistora nič neobmedzuje prúd – LED okamžite zhorí. Pri ${formatSI(U, 'V', 4)} potrebuje rezistor aspoň ${rMin}.`;
      } else if (burnt) {
        tone = 'over';
        text = `LED znesie najviac 20 mA, tu by tieklo ${formatSI(I, 'A', 3)} – zhorí. Predradný rezistor musí mať aspoň ${rMin}.`;
      } else if (overload) {
        tone = 'over';
        text = `LED svieti, ale rezistor 0,25 W ${overload}.`;
      } else if (I < LED_DIM) {
        tone = 'idle';
        text = `LED svieti len slabo – prúd ${formatSI(I, 'A', 3)} je malý.`;
      } else {
        text = `LED svieti, prúd ${formatSI(I, 'A', 3)} je v bezpečnom rozsahu do 20 mA.`;
      }
    }
    status.className = `hero-status is-${tone}`;
    status.textContent = text;
  };

  const uEntry = entry(
    'hero-u-val', 'Napätie zdroja', 'V', U_MAX, '0 až 500 V',
    (x) => `${fmt(x, 6)} V`, () => 1,
    (x) => {
      U = x;
      uInput.value = String(nearestIndex(U_STEPS, x, false));
      update();
    },
    setError,
  );
  const rEntry = entry(
    'hero-r-val', 'Odpor', 'Ω', R_MAX, '0 Ω až 5 MΩ',
    (x) => formatSI(x, 'Ω', 6), (x) => 10 ** siParts(x).exp,
    (x) => {
      R = x;
      rInput.value = String(nearestIndex(R_STEPS, x, true));
      update();
    },
    setError,
  );
  uInput.addEventListener('input', () => {
    U = U_STEPS[Number(uInput.value)];
    uEntry.show(U);
    update();
  });
  rInput.addEventListener('input', () => {
    R = R_STEPS[Number(rInput.value)];
    rEntry.show(R);
    update();
  });

  const colorSelect = h('select', { id: 'hero-led-color', class: 'field-input', 'aria-label': 'Farba LED' },
    LED_COLORS.map(([id, name, uf]) => h('option', { value: id }, `${name} LED (≈ ${fmt(uf)} V)`)),
  );
  const colorBox = h('div', { class: 'field-box hero-color', hidden: true }, colorSelect);
  colorSelect.addEventListener('change', () => {
    color = LED_COLORS.find(([id]) => id === colorSelect.value) ?? LED_COLORS[0];
    update();
  });

  const setMode = (m: Mode) => {
    active.flow.classList.remove('is-short');
    mode = m;
    active = circuits[m];
    panel.replaceChildren(active.svg);
    colorBox.hidden = m !== 'led';
    if (m === 'r') {
      iLabel.replaceChildren('Prúd ', vi('I'), ' = U / R');
      pLabel.replaceChildren('Výkon ', vi('P'), ' = U · I');
    } else {
      iLabel.replaceChildren('Prúd ', vi('I'), ' = (U − ', uF(), ') / R');
      pLabel.replaceChildren('Výkon ', vi('P'), h('sub', null, 'R'), ' = (U − ', uF(), ') · I');
    }
    update();
  };

  uEntry.show(U);
  rEntry.show(R);
  setMode('r');

  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && typeof requestAnimationFrame === 'function') {
    let offset = 0;
    let last = 0;
    const tick = (t: number) => {
      if (!panel.isConnected && last !== 0) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      offset -= speed * dt;
      active.flow.style.strokeDashoffset = String(offset % 1000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return h('div', { class: 'hero-lab' },
    panel,
    h('div', { class: 'hero-controls' },
      h('div', { class: 'seg-row' },
        segmented<Mode>('hero-mode', 'Schéma obvodu', [['r', 'Rezistor'], ['led', 'LED s rezistorom']], mode, setMode),
        colorBox,
      ),
      h('div', { class: 'slider' },
        h('label', { for: 'hero-u' }, 'Napätie zdroja ', vi('U')),
        uInput,
        uEntry.input,
      ),
      h('div', { class: 'slider' },
        h('label', { for: 'hero-r' }, 'Odpor ', vi('R')),
        rInput,
        rEntry.input,
      ),
      hint,
      h('div', { class: 'readouts' },
        h('div', { class: 'readout' }, iLabel, iOut),
        h('div', { class: 'readout' }, pLabel, pOut),
      ),
      status,
    ),
  );
}
