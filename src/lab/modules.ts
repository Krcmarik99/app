/**
 * Kresby Arduina a modulov, ktoré sa k nemu pripájajú: tlačidlo, potenciometer, fotorezistor,
 * teplotný senzor, 7-segmentový a LCD displej, RGB LED, bzučiak a servo. Kresby sa počas
 * simulácie menia (svietiace segmenty, text na LCD, natočenie serva, LED na doske).
 */
import { glyphRows } from '../arduino/font';
import { lcdCursor, lcdVisible } from '../arduino/vm';
import { s } from '../lib/dom';
import { G, arrow, labels, line, px, rotated, twoPole } from './draw';
import { segmentLevel } from './engine';
import { ARD_ROW, type Part } from './parts';
import type { PartDrawing } from './symbols';

const LED_RGB: Record<string, string> = { red: '#ff3b2f', yellow: '#ffc21a', green: '#22d65a', blue: '#3d7bff', white: '#e8f0ff' };

/** Skupina posunutá na polohu súčiastky (moduly sa neotáčajú). */
function at(part: Part, ...children: (SVGElement | null)[]): SVGGElement {
  const [x, y] = px([part.x, part.y]);
  return s('g', { transform: `translate(${x} ${y})` }, ...children.filter((c): c is SVGElement => !!c));
}

const t = (x: number, y: number, value: string, cls: string, anchor: 'start' | 'middle' | 'end' = 'middle') =>
  s('text', { x, y, 'text-anchor': anchor, class: cls }, value);

export function drawModule(part: Part, iconOnly: boolean): PartDrawing | null {
  switch (part.kind) {
    case 'arduino': return arduino(part, iconOnly);
    case 'button': return button(part, iconOnly);
    case 'pot': return pot(part, iconOnly);
    case 'ldr': return ldr(part, iconOnly);
    case 'buzzer': return buzzer(part, iconOnly);
    case 'tmp36': return tmp36(part, iconOnly);
    case 'rgbled': return rgbled(part, iconOnly);
    case 'seg7': return seg7(part, iconOnly);
    case 'lcd': return lcd(part, iconOnly);
    case 'servo': return servo(part, iconOnly);
    default: return null;
  }
}

// ------------------------------------------------------------------ Arduino UNO

/*
 * Doska nakreslená podľa skutočného Arduina UNO (pomer strán, poloha konektorov, logo).
 * (0, 0) je pin GND v hornom rade, dolný rad pinov je o ARD_ROW políčok nižšie.
 * Nepripojiteľné otvory (SCL, SDA, AREF, IOREF, RESET, Vin) sú len nakreslené.
 */
const B = ARD_ROW * G;

/** Horný rad: x v políčkach, popis (prázdny = otvor bez popisu), či je to vývod. */
const TOP_PINS: [number, string, boolean][] = [
  [-3, '', false], [-2, '', false], [-1, 'AREF', false], [0, 'GND', true], [1, '13', true], [2, '12', true], [3, '~11', true],
  [4, '~10', true], [5, '~9', true], [6, '8', true],
  [8, '7', true], [9, '~6', true], [10, '~5', true], [11, '4', true], [12, '~3', true], [13, '2', true], [14, 'TX→1', true], [15, 'RX←0', true],
];
const BOTTOM_PINS: [number, string, boolean][] = [
  [1, '', false], [2, 'IOREF', false], [3, 'RESET', false], [4, '3.3V', true], [5, '5V', true], [6, 'GND', true], [7, 'GND', true], [8, 'Vin', false],
  [10, 'A0', true], [11, 'A1', true], [12, 'A2', true], [13, 'A3', true], [14, 'A4', true], [15, 'A5', true],
];

/** Lišta konektora s otvormi (x0, x1 sú krajné otvory v políčkach, yc stred lišty). */
function header(x0: number, x1: number, yc: number): SVGElement[] {
  const holes: SVGElement[] = [];
  for (let x = x0; x <= x1; x++) holes.push(s('rect', { x: x * G - 3.5, y: yc - 3.5, width: 7, height: 7, class: 'ard-hole' }));
  return [s('rect', { x: x0 * G - 9, y: yc - 7, width: (x1 - x0) * G + 18, height: 14, rx: 1, class: 'ard-hdr' }), ...holes];
}

/** Konektor ICSP (cols × rows kolíkov s roztečou 12 px). */
function icsp(x: number, y: number, cols: number, rows: number): SVGElement[] {
  const out: SVGElement[] = [s('rect', { x: x - 7, y: y - 7, width: (cols - 1) * 12 + 14, height: (rows - 1) * 12 + 14, rx: 1, class: 'ard-icsp' })];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      out.push(s('rect', { x: x + i * 12 - 4, y: y + j * 12 - 4, width: 8, height: 8, class: 'ard-icsp-pin' }));
    }
  }
  return out;
}

/** Logo Arduino: dve slučky (∞) s mínusom a plusom. */
function logo(cx: number, cy: number): SVGElement[] {
  const rx = 19;
  const ry = 14;
  const d = 17;
  return [
    s('ellipse', { cx: cx - d, cy, rx, ry, class: 'ard-logo-ring' }),
    s('ellipse', { cx: cx + d, cy, rx, ry, class: 'ard-logo-ring' }),
    s('rect', { x: cx - d - 7, y: cy - 1.8, width: 14, height: 3.6, class: 'ard-logo-sign' }),
    s('rect', { x: cx + d - 7, y: cy - 1.8, width: 14, height: 3.6, class: 'ard-logo-sign' }),
    s('rect', { x: cx + d - 1.8, y: cy - 7, width: 3.6, height: 14, class: 'ard-logo-sign' }),
  ];
}

/** Zvislý popis pinu (číta sa zdola nahor); pri hornom rade visí pod lištou, pri dolnom stojí nad ňou. */
const pinLabel = (x: number, y: number, text: string, top: boolean) =>
  s('text', { x: 0, y: 0, transform: `translate(${x + 2.6} ${y}) rotate(-90)`, 'text-anchor': top ? 'end' : 'start', class: 'ard-txt' }, text);

function arduino(part: Part, iconOnly: boolean): PartDrawing {
  const ledL = s('rect', { x: -4, y: 74, width: 13, height: 6, rx: 1, class: 'ard-led ard-led-l' });
  const glowL = s('circle', { cx: 2.5, cy: 77, r: 12, class: 'ard-glow ard-glow-l', opacity: 0 });
  const ledTx = s('rect', { x: -4, y: 100, width: 13, height: 6, rx: 1, class: 'ard-led ard-led-tx' });
  const ledRx = s('rect', { x: -4, y: 112, width: 13, height: 6, rx: 1, class: 'ard-led ard-led-tx' });
  const ledOn = s('rect', { x: 250, y: 100, width: 13, height: 6, rx: 1, class: 'ard-led ard-led-on' });
  // Čip ATmega328P v puzdre DIP-28: vývody ako biele čiarky na okrajoch, dva otlačky a výrez.
  const chip: SVGElement[] = [s('rect', { x: 12, y: 194, width: 298, height: 50, rx: 2, class: 'ard-chip' })];
  for (let k = 0; k < 14; k++) {
    const x = 18 + k * 21.2;
    chip.push(s('rect', { x, y: 195.5, width: 10, height: 3, class: 'ard-leg' }), s('rect', { x, y: 239.5, width: 10, height: 3, class: 'ard-leg' }));
  }
  chip.push(
    s('circle', { cx: 36, cy: 219, r: 5, class: 'ard-dimple' }),
    s('circle', { cx: 284, cy: 219, r: 5, class: 'ard-dimple' }),
    s('path', { d: 'M310 211a8 8 0 0 0 0 16z', class: 'ard-notch' }),
  );
  const g = at(part,
    ...TOP_PINS.filter(([, , pin]) => pin).map(([x]) => line(x * G, 0, x * G, 10)),
    ...BOTTOM_PINS.filter(([, , pin]) => pin).map(([x]) => line(x * G, B, x * G, B - 10)),
    // Obrys dosky s typickým výstupkom na pravej strane.
    s('path', { d: 'M-134 9H322V84L336 98V258L322 272V311H-134Q-140 311 -140 305V15Q-140 9 -134 9Z', class: 'ard-board' }),
    // USB-B, napájací konektor a tlačidlo RESET.
    s('rect', { x: -160, y: 58, width: 70, height: 58, rx: 1.5, class: 'ard-usb' }),
    s('rect', { x: -156, y: 62, width: 62, height: 24, class: 'ard-usb-in' }),
    s('rect', { x: -129, y: 115, width: 10, height: 6, rx: 2, class: 'ard-usb-tab' }),
    s('rect', { x: -154, y: 238, width: 70, height: 48, rx: 2, class: 'ard-jack' }),
    s('rect', { x: -94, y: 242, width: 8, height: 40, rx: 1.5, class: 'ard-jack-in' }),
    s('rect', { x: -136, y: 15, width: 28, height: 28, rx: 1.5, class: 'ard-reset' }),
    ...[[-139, 19], [-139, 33], [-108, 19], [-108, 33]].map(([x, y]) => s('rect', { x, y, width: 3, height: 6, class: 'ard-reset-pad' })),
    s('circle', { cx: -122, cy: 29, r: 7.5, class: 'ard-reset-btn' }),
    ...[[-86, 19], [322, 112], [321, 256], [-14, 296]].map(([cx, cy]) => s('circle', { cx, cy, r: 7, class: 'ard-mount' })),
    ...header(-3, 6, 17),
    ...header(8, 15, 17),
    ...header(1, 8, B - 17),
    ...header(10, 15, B - 17),
    ...icsp(-62, 36, 3, 2),
    ...icsp(304, 134, 2, 3),
    ...chip,
    ...logo(84, 90),
    s('rect', { x: 146, y: 74, width: 74, height: 34, rx: 7, class: 'ard-uno-box' }),
    glowL, ledL, ledTx, ledRx, ledOn,
  );
  if (!iconOnly) {
    g.append(
      ...TOP_PINS.filter(([, name]) => name).map(([x, name]) => pinLabel(x * G, 27, name, true)),
      ...BOTTOM_PINS.filter(([, name]) => name).map(([x, name]) => pinLabel(x * G, B - 27, name, false)),
      s('line', { x1: 14, y1: 52, x2: 306, y2: 52, class: 'ard-rule' }),
      t(190, 62, 'DIGITAL (PWM ~)', 'ard-cap'),
      s('line', { x1: 108, y1: 270, x2: 168, y2: 270, class: 'ard-rule' }),
      t(138, 266, 'POWER', 'ard-cap'),
      s('line', { x1: 192, y1: 270, x2: 308, y2: 270, class: 'ard-rule' }),
      t(250, 266, 'ANALOG IN', 'ard-cap'),
      t(-10, 80, 'L', 'ard-tiny', 'end'),
      t(-10, 106, 'TX', 'ard-tiny', 'end'),
      t(-10, 118, 'RX', 'ard-tiny', 'end'),
      t(268, 106, 'ON', 'ard-tiny', 'start'),
      t(84, 121, 'ARDUINO', 'ard-logo'),
      t(183, 101, 'UNO', 'ard-uno'),
      t(-132, 176, part.name, 'lab-name ard-name', 'start'),
    );
  }
  return {
    g: s('g', { class: 'lab-part lab-arduino' }, g),
    live: ({ sim }) => {
      const mcu = sim?.mcus.get(part.id);
      const on = !!sim;
      const lv = mcu?.outputLevel(13) ?? 0;
      glowL.setAttribute('opacity', lv > 0.01 ? (0.35 + 0.65 * lv).toFixed(2) : '0');
      ledL.classList.toggle('is-on', lv > 0.01);
      const now = mcu?.time ?? 0;
      ledTx.classList.toggle('is-on', !!mcu && mcu.txAt >= 0 && now - mcu.txAt < 0.06);
      ledRx.classList.toggle('is-on', !!mcu && mcu.rxAt >= 0 && now - mcu.rxAt < 0.06);
      ledOn.classList.toggle('is-on', on);
    },
  };
}

// ------------------------------------------------------------------ tlačidlo, potenciometer, fotorezistor, bzučiak

function button(part: Part, iconOnly: boolean): PartDrawing {
  const up = s('g', { class: 'btn-up' },
    line(-13, -7, 13, -7), line(0, -7, 0, -16), line(-6, -16, 6, -16));
  const down = s('g', { class: 'btn-down' },
    line(-13, -2.2, 13, -2.2), line(0, -2.2, 0, -11), line(-6, -11, 6, -11));
  const g = s('g', { class: 'lab-part lab-button' }, twoPole(part, 13,
    s('circle', { cx: -11, cy: 0, r: 2.2, class: 'b' }),
    s('circle', { cx: 11, cy: 0, r: 2.2, class: 'b' }),
    up, down,
  ));
  if (!iconOnly) g.append(...labels(part, [1.5 * G, -21], [0, -1]));
  return {
    g,
    live: ({ sim }) => g.classList.toggle('is-pressed', !!sim?.isPressed(part.id)),
  };
}

function pot(part: Part, iconOnly: boolean): PartDrawing {
  const g = s('g', { class: 'lab-part lab-pot' }, rotated(part,
    line(0, 0, 22, 0),
    line(58, 0, 80, 0),
    s('rect', { x: 22, y: -7, width: 36, height: 14, class: 'b' }),
    line(40, 40, 40, 17),
    arrow(40, 8, -90, 4),
  ));
  if (!iconOnly) g.append(...labels(part, [40, -15], [0, -1]));
  return { g };
}

function ldr(part: Part, iconOnly: boolean): PartDrawing {
  const g = s('g', { class: 'lab-part lab-ldr' }, twoPole(part, 18,
    s('rect', { x: -18, y: -7, width: 36, height: 14, class: 'b' }),
    line(-17, -23, -7, -12, 'w thin'),
    arrow(-5, -10, 47, 3),
    line(-7, -25, 3, -14, 'w thin'),
    arrow(5, -12, 47, 3),
  ));
  if (!iconOnly) g.append(...labels(part, [1.5 * G, -30], [0, -1]));
  return { g };
}

function buzzer(part: Part, iconOnly: boolean): PartDrawing {
  const waves = s('g', { class: 'buzz-wave' },
    s('path', { d: 'M48 -22a10 10 0 0 1 0 12', class: 'w thin' }),
    s('path', { d: 'M53 -27a17 17 0 0 1 0 22', class: 'w thin' }),
  );
  const g = s('g', { class: 'lab-part lab-buzzer' }, rotated(part,
    line(0, 0, 18, 0), line(18, 0, 18, -4),
    line(60, 0, 42, 0), line(42, 0, 42, -4),
    s('path', { d: 'M11 -4h38a19 19 0 0 0 -38 0z', class: 'b' }),
    s('path', { d: 'M8 -12h6M11 -15v6', class: 'w thin' }),
    waves,
  ));
  if (!iconOnly) g.append(...labels(part, [1.5 * G, -28], [0, -1]));
  return {
    g,
    live: ({ st }) => g.classList.toggle('is-sounding', !!st?.extra.snd),
  };
}

// ------------------------------------------------------------------ teplotný senzor TMP36

function tmp36(part: Part, iconOnly: boolean): PartDrawing {
  const temp = t(54, -24, '', 'val', 'start');
  const g = at(part,
    line(0, 0, 0, -10), line(20, 0, 20, -10), line(40, 0, 40, -10),
    s('path', { d: 'M-10 -10V-34Q-10 -50 20 -50Q50 -50 50 -34V-10Z', class: 'tmp-body' }),
    t(20, -32, 'TMP36', 'mod-txt'),
    iconOnly ? null : t(0, -14, '+', 'mod-in'),
    iconOnly ? null : t(20, -14, 'V', 'mod-in'),
    iconOnly ? null : t(40, -14, '−', 'mod-in'),
    iconOnly ? null : t(-16, -30, part.name, 'lab-name', 'end'),
    iconOnly ? null : temp,
  );
  return {
    g: s('g', { class: 'lab-part lab-tmp36' }, g),
    live: () => {
      temp.textContent = `${String(Number(part.props.temp ?? 22).toFixed(1)).replace('.', ',')} °C`;
    },
  };
}

// ------------------------------------------------------------------ RGB LED

const RGB_FILL = ['#ff3b2f', '#22d65a', '#3d7bff'];

function rgbled(part: Part, iconOnly: boolean): PartDrawing {
  const ca = part.props.type === 'ca';
  const glows = RGB_FILL.map((c, k) => s('circle', { cx: 30, cy: k * 60, r: 18, class: 'rgb-glow', fill: c, opacity: 0 }));
  const mix = s('circle', { cx: 92, cy: 6, r: 12, class: 'rgb-mix' });
  const mixGlow = s('circle', { cx: 92, cy: 6, r: 22, class: 'rgb-glow', opacity: 0 });
  const diode = (y: number, k: number) => {
    // Pri spoločnej katóde vedie dióda zľava doprava, pri spoločnej anóde naopak.
    const tri = ca ? '38,-9 38,9 22,0' : '22,-9 22,9 38,0';
    const bar = ca ? 22 : 38;
    return s('g', { transform: `translate(0 ${y})` },
      line(0, 0, 60, 0),
      s('polygon', { points: tri, class: `b rgb-tri rgb-tri-${k}` }),
      line(bar, -9, bar, 9),
      line(31, -12, 37, -19, 'w thin'),
      arrow(39, -21.5, -50, 3),
    );
  };
  const g = at(part,
    ...glows,
    diode(0, 0), diode(60, 1), diode(120, 2),
    line(60, 0, 60, 120),
    line(60, 60, 80, 60),
    s('circle', { cx: 60, cy: 60, r: 3.4, class: 'dot' }),
    mixGlow, mix,
    ...(iconOnly ? [] : [
      t(-6, -6, 'R', 'mod-tiny', 'end'), t(-6, 54, 'G', 'mod-tiny', 'end'), t(-6, 114, 'B', 'mod-tiny', 'end'),
      t(74, 54, ca ? '+' : '−', 'mod-tiny'),
      t(66, 132, part.name, 'lab-name', 'start'),
    ]),
  );
  return {
    g: s('g', { class: 'lab-part lab-rgbled' }, g),
    live: ({ st }) => {
      const lv = [0, 1, 2].map((k) => Math.sqrt(segmentLevel(st, k)));
      lv.forEach((v, k) => glows[k].setAttribute('opacity', v < 0.02 ? '0' : (0.25 + 0.7 * v).toFixed(2)));
      const max = Math.max(...lv);
      if (max < 0.02) {
        mixGlow.setAttribute('opacity', '0');
        mix.style.fill = '';
        return;
      }
      const c = `rgb(${Math.round((255 * lv[0]) / max)}, ${Math.round((255 * lv[1]) / max)}, ${Math.round((255 * lv[2]) / max)})`;
      mix.style.fill = c;
      mixGlow.style.fill = c;
      mixGlow.setAttribute('opacity', (0.3 + 0.6 * max).toFixed(2));
    },
  };
}

// ------------------------------------------------------------------ 7-segmentový displej

const SEG_GEOM: string[] = (() => {
  const H = (x1: number, x2: number, y: number) => `${x1},${y} ${x1 + 4},${y - 4} ${x2 - 4},${y - 4} ${x2},${y} ${x2 - 4},${y + 4} ${x1 + 4},${y + 4}`;
  const V = (x: number, y1: number, y2: number) => `${x},${y1} ${x + 4},${y1 + 4} ${x + 4},${y2 - 4} ${x},${y2} ${x - 4},${y2 - 4} ${x - 4},${y1 + 4}`;
  // a b c d e f g
  return [H(17, 55, 23), V(57, 25, 59), V(57, 63, 97), H(17, 55, 99), V(15, 63, 97), V(15, 25, 59), H(17, 55, 61)];
})();

function seg7(part: Part, iconOnly: boolean): PartDrawing {
  const color = LED_RGB[String(part.props.color)] ?? LED_RGB.red;
  const segs = SEG_GEOM.map((pts) => s('polygon', { points: pts, class: 'seg-seg' }));
  const dp = s('circle', { cx: 70, cy: 99, r: 4, class: 'seg-seg' });
  const all = [...segs, dp];
  const top = ['g', 'f', 'COM', 'a', 'b'];
  const bottom = ['e', 'd', 'COM', 'c', 'dp'];
  const g = at(part,
    ...[0, 1, 2, 3, 4].map((k) => line(k * G, 0, k * G, 9)),
    ...[0, 1, 2, 3, 4].map((k) => line(k * G, 6 * G, k * G, 111)),
    s('rect', { x: -15, y: 9, width: 110, height: 102, rx: 4, class: 'seg-body' }),
    s('g', { transform: 'translate(8 0) skewX(-6) translate(6 0)' }, ...all),
    ...(iconOnly ? [] : [
      ...top.map((n, k) => t(k * G, 19, n, 'seg-txt')),
      ...bottom.map((n, k) => t(k * G, 108, n, 'seg-txt')),
      t(102, 64, part.name, 'lab-name', 'start'),
    ]),
  );
  return {
    g: s('g', { class: 'lab-part lab-seg7' }, g),
    live: ({ st }) => {
      all.forEach((el, k) => {
        const lv = segmentLevel(st, k);
        if (lv < 0.01) {
          el.style.fill = '';
          el.style.filter = '';
        } else {
          el.style.fill = `color-mix(in srgb, ${color} ${Math.round(35 + 65 * Math.sqrt(lv))}%, #3a2a2a)`;
          el.style.filter = lv > 0.15 ? `drop-shadow(0 0 3px ${color})` : '';
        }
      });
    },
  };
}

// ------------------------------------------------------------------ LCD 16 × 2

const PX = 2.4;
const PITCH = 14.4;
const ROW_H = 22.2;
const SCREEN_X = 62;
const SCREEN_Y = 4;

function pixelRect(x: number, y: number): string {
  return `M${x.toFixed(1)} ${y.toFixed(1)}h2v2h-2z`;
}

/** Mriežka všetkých bodov (nesvietiacich). */
const LCD_GRID: string = (() => {
  let d = '';
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 16; c++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 5; x++) d += pixelRect(SCREEN_X + c * PITCH + x * PX, SCREEN_Y + r * ROW_H + y * PX);
      }
    }
  }
  return d;
})();

function lcd(part: Part, iconOnly: boolean): PartDrawing {
  const screen = s('rect', { x: SCREEN_X - 8, y: SCREEN_Y - 8, width: 16 * PITCH - 2.4 + 16, height: 2 * ROW_H - 3 + 16, rx: 2, class: 'lcd-screen' });
  const grid = s('path', { d: LCD_GRID, class: 'lcd-px-off' });
  const lit = s('path', { d: '', class: 'lcd-px-on' });
  const names = ['GND', 'VCC', 'SDA', 'SCL'];
  const g = at(part,
    ...[0, 1, 2, 3].map((k) => line(0, k * G, 10, k * G)),
    s('rect', { x: 9, y: -26, width: 307, height: 112, rx: 5, class: 'lcd-pcb' }),
    ...[[18, -17], [307, -17], [18, 77], [307, 77]].map(([cx, cy]) => s('circle', { cx, cy, r: 4, class: 'ard-mount' })),
    s('rect', { x: SCREEN_X - 16, y: SCREEN_Y - 18, width: 16 * PITCH - 2.4 + 32, height: 2 * ROW_H - 3 + 36, rx: 3, class: 'lcd-bezel' }),
    screen, grid, lit,
    ...(iconOnly ? [] : [
      ...names.map((n, k) => t(14, k * G + 3.5, n, 'ard-txt', 'start')),
      t(12, -32, part.name, 'lab-name', 'start'),
    ]),
  );
  let shown = '';
  return {
    g: s('g', { class: 'lab-part lab-lcd' }, g),
    live: ({ sim }) => {
      const state = sim?.lcds.get(part.id);
      const st = sim?.states.get(part.id);
      const powered = !!sim && !!st?.extra.on;
      const backlit = powered && !!state?.backlight;
      g.classList.toggle('is-off', !powered);
      g.classList.toggle('is-backlit', backlit);
      if (!powered || !state) {
        if (shown !== 'off') lit.setAttribute('d', '');
        shown = 'off';
        return;
      }
      const blinkPhase = Math.floor((sim?.time ?? 0) / 0.5) % 2;
      const key = `${state.version}|${state.initialized}|${state.displayOn}|${state.blinkOn ? blinkPhase : ''}|${state.cursorOn}`;
      if (key === shown) return;
      shown = key;
      let d = '';
      if (!state.initialized) {
        // Displej bez inicializácie ukazuje v prvom riadku plné obdĺžniky.
        for (let c = 0; c < 16; c++) for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) d += pixelRect(SCREEN_X + c * PITCH + x * PX, SCREEN_Y + y * PX);
      } else if (state.displayOn) {
        const rows = lcdVisible(state);
        const cur = lcdCursor(state);
        rows.forEach((row, r) => row.forEach((code, c) => {
          const glyph = glyphRows(code, state.cgram);
          if (cur && cur[0] === c && cur[1] === r) {
            if (state.cursorOn) glyph[7] = 0x1f;
            if (state.blinkOn && blinkPhase === 0) glyph.fill(0x1f);
          }
          glyph.forEach((bits, y) => {
            for (let x = 0; x < 5; x++) if (bits & (1 << (4 - x))) d += pixelRect(SCREEN_X + c * PITCH + x * PX, SCREEN_Y + r * ROW_H + y * PX);
          });
        }));
      }
      lit.setAttribute('d', d);
    },
  };
}

// ------------------------------------------------------------------ servo

function servo(part: Part, iconOnly: boolean): PartDrawing {
  const horn = s('g', { class: 'servo-horn' },
    s('path', { d: 'M-5 0L-3.5 -34A3.5 3.5 0 0 1 3.5 -34L5 0A5 5 0 0 1 -5 0Z', class: 'servo-arm' }),
    s('circle', { cx: 0, cy: 0, r: 7, class: 'servo-hub' }),
    ...[-26, -18, -10].map((y) => s('circle', { cx: 0, cy: y, r: 1.2, class: 'servo-hole' })),
  );
  const hornWrap = s('g', { transform: 'translate(108 20) rotate(0)' }, horn);
  const angle = t(64, 7, '', 'mod-txt servo-angle');
  const g = at(part,
    line(0, 0, 40, 0, 'servo-wire servo-gnd'),
    line(0, G, 40, G, 'servo-wire servo-vcc'),
    line(0, 2 * G, 40, 2 * G, 'servo-wire servo-sig'),
    s('rect', { x: 26, y: 8, width: 12, height: 24, rx: 2, class: 'servo-tab' }),
    s('rect', { x: 128, y: 8, width: 10, height: 24, rx: 2, class: 'servo-tab' }),
    s('rect', { x: 36, y: -14, width: 94, height: 68, rx: 4, class: 'servo-body' }),
    s('circle', { cx: 108, cy: 20, r: 15, class: 'servo-gear' }),
    hornWrap,
    t(64, 46, 'SG90', 'mod-txt'),
    iconOnly ? null : angle,
    ...(iconOnly ? [] : [
      t(4, -4, 'GND', 'mod-tiny', 'start'),
      t(4, G - 4, '+5V', 'mod-tiny', 'start'),
      t(4, 2 * G - 4, 'signál', 'mod-tiny', 'start'),
      t(36, -20, part.name, 'lab-name', 'start'),
    ]),
  );
  return {
    g: s('g', { class: 'lab-part lab-servo' }, g),
    live: ({ sim }) => {
      const a = sim?.servoAngle(part.id) ?? 90;
      // 0° = rameno doprava, 90° = hore, 180° = doľava.
      hornWrap.setAttribute('transform', `translate(108 20) rotate(${(90 - a).toFixed(1)})`);
      angle.textContent = `${Math.round(a)}°`;
    },
  };
}
