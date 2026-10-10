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
import type { Part } from './parts';
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

const TOP_PINS: [number, string][] = [
  [0, 'GND'], [1, '13'], [2, '12'], [3, '~11'], [4, '~10'], [5, '~9'], [6, '8'],
  [8, '7'], [9, '~6'], [10, '~5'], [11, '4'], [12, '~3'], [13, '2'], [14, 'TX 1'], [15, 'RX 0'],
];
const BOTTOM_PINS: [number, string][] = [
  [4, '3.3V'], [5, '5V'], [6, 'GND'], [7, 'GND'], [10, 'A0'], [11, 'A1'], [12, 'A2'], [13, 'A3'], [14, 'A4'], [15, 'A5'],
];

function header(x0: number, x1: number, y: number, pins: number[]): SVGElement[] {
  return [
    s('rect', { x: x0 * G - 9, y, width: (x1 - x0) * G + 18, height: 12, rx: 1.5, class: 'ard-hdr' }),
    ...pins.map((p) => s('rect', { x: p * G - 2.5, y: y + 3.5, width: 5, height: 5, class: 'ard-hole' })),
  ];
}

function arduino(part: Part, iconOnly: boolean): PartDrawing {
  const ledL = s('rect', { x: 34, y: 54, width: 9, height: 5, rx: 1, class: 'ard-led ard-led-l' });
  const glowL = s('circle', { cx: 38.5, cy: 56.5, r: 11, class: 'ard-glow ard-glow-l', opacity: 0 });
  const ledTx = s('rect', { x: 34, y: 64, width: 9, height: 5, rx: 1, class: 'ard-led ard-led-tx' });
  const ledRx = s('rect', { x: 34, y: 74, width: 9, height: 5, rx: 1, class: 'ard-led ard-led-tx' });
  const ledOn = s('rect', { x: 292, y: 62, width: 9, height: 5, rx: 1, class: 'ard-led ard-led-on' });
  const chipLegs: SVGElement[] = [];
  for (let k = 0; k < 14; k++) {
    chipLegs.push(s('rect', { x: 176 + k * 10, y: 89, width: 4, height: 4, class: 'ard-leg' }));
    chipLegs.push(s('rect', { x: 176 + k * 10, y: 120, width: 4, height: 4, class: 'ard-leg' }));
  }
  const g = at(part,
    ...TOP_PINS.map(([x]) => line(x * G, 0, x * G, 11)),
    ...BOTTOM_PINS.map(([x]) => line(x * G, 9 * G, x * G, 169)),
    s('rect', { x: -36, y: 9, width: 372, height: 162, rx: 9, class: 'ard-board' }),
    s('rect', { x: -46, y: 22, width: 40, height: 42, rx: 2, class: 'ard-usb' }),
    s('rect', { x: -40, y: 28, width: 26, height: 30, rx: 2, class: 'ard-usb-in' }),
    s('rect', { x: -44, y: 108, width: 36, height: 44, rx: 3, class: 'ard-jack' }),
    s('circle', { cx: -26, cy: 130, r: 8, class: 'ard-jack-in' }),
    s('rect', { x: -33, y: 74, width: 18, height: 18, rx: 2, class: 'ard-reset' }),
    s('circle', { cx: -24, cy: 83, r: 5.5, class: 'ard-reset-btn' }),
    ...[[-24, 160], [306, 20], [318, 158]].map(([cx, cy]) => s('circle', { cx, cy, r: 4.5, class: 'ard-mount' })),
    ...header(0, 6, 11, [0, 1, 2, 3, 4, 5, 6]),
    ...header(8, 15, 11, [8, 9, 10, 11, 12, 13, 14, 15]),
    ...header(4, 7, 157, [4, 5, 6, 7]),
    ...header(10, 15, 157, [10, 11, 12, 13, 14, 15]),
    s('rect', { x: 170, y: 92, width: 154, height: 28, rx: 2, class: 'ard-chip' }),
    s('circle', { cx: 177, cy: 106, r: 3, class: 'ard-notch' }),
    ...chipLegs,
    glowL, ledL, ledTx, ledRx, ledOn,
  );
  if (!iconOnly) {
    g.append(
      ...TOP_PINS.map(([x, name]) => t(x * G, 32, name, 'ard-txt')),
      ...BOTTOM_PINS.map(([x, name]) => t(x * G, 152, name, 'ard-txt')),
      t(150, 45, 'DIGITAL (PWM ~)', 'ard-cap'),
      t(110, 140, 'POWER', 'ard-cap'),
      t(250, 140, 'ANALOG IN', 'ard-cap'),
      t(28, 59, 'L', 'ard-tiny', 'end'),
      t(28, 69, 'TX', 'ard-tiny', 'end'),
      t(28, 79, 'RX', 'ard-tiny', 'end'),
      t(312, 67, 'ON', 'ard-tiny', 'start'),
      t(96, 82, 'ARDUINO', 'ard-logo'),
      t(96, 112, 'UNO', 'ard-uno'),
      t(247, 110, 'ATMEGA328P', 'ard-chip-txt'),
      t(-4, 104, part.name, 'lab-name ard-name', 'start'),
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
