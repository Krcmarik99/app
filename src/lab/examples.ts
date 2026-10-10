/**
 * Hotové zapojenia na vyskúšanie. Súradnice sú v políčkach mriežky; vodiče sa kreslia
 * po úsekoch tak, aby žiadny vodič neprechádzal cez cudzí vývod.
 */
import {
  BLINK_SKETCH, BUTTON_SKETCH, FADE_SKETCH, LCD_SKETCH, LDR_SKETCH, POT_SKETCH, RGB_SKETCH, SEG7_SKETCH, SWEEP_SKETCH,
  TMP36_SERIAL_SKETCH, TONE_SKETCH, TRAFFIC_SKETCH,
} from '../arduino/sketches';
import { createPart, newId, type Circuit, type PartKind, type Pt, type PropValue, type Rot } from './parts';

export interface Example {
  id: string;
  title: string;
  description: string;
  build: () => Circuit;
}

function builder() {
  const circuit: Circuit = { parts: [], wires: [] };
  const part = (kind: PartKind, x: number, y: number, rot: Rot, props: Record<string, PropValue> = {}) => {
    const p = createPart(circuit, kind, x, y, props, rot);
    circuit.parts.push(p);
    return p;
  };
  /** Lomený vodič cez zadané body. */
  const wire = (...pts: Pt[]) => {
    for (let i = 1; i < pts.length; i++) circuit.wires.push({ id: newId('w'), a: pts[i - 1], b: pts[i] });
  };
  /** Arduino UNO s programom; vráti polohy jeho pinov. */
  const arduino = (x: number, y: number, code: string) => {
    part('arduino', x, y, 0, { code });
    const at = (dx: number, dy: number): Pt => [x + dx, y + dy];
    return {
      GND: at(0, 0), D13: at(1, 0), D12: at(2, 0), D11: at(3, 0), D10: at(4, 0), D9: at(5, 0), D8: at(6, 0),
      D7: at(8, 0), D6: at(9, 0), D5: at(10, 0), D4: at(11, 0), D3: at(12, 0), D2: at(13, 0),
      V3: at(4, 9), V5: at(5, 9), GND2: at(6, 9), GND3: at(7, 9), A0: at(10, 9), A4: at(14, 9), A5: at(15, 9),
    };
  };
  return { circuit, part, wire, arduino };
}

/** LED s predradným rezistorom nad pinom Arduina (pin je pri x, vodič späť na GND vľavo). */
function ledColumn(b: ReturnType<typeof builder>, pin: Pt, gnd: Pt, color: string): void {
  const [x, y] = pin;
  b.wire(pin, [x, y - 2]);
  b.part('resistor', x, y - 2, 3, { R: 220 });
  b.part('led', x, y - 5, 3, { color });
  b.wire([x, y - 8], [gnd[0] - 3, y - 8], [gnd[0] - 3, y - 2], [gnd[0], y - 2], gnd);
}

export const EXAMPLES: Example[] = [
  {
    id: 'led',
    title: 'LED s predradným rezistorom',
    description: 'Ampérmeter v sérii meria prúd LED, voltmeter paralelne napätie na nej. Skús zmenšiť odpor rezistora.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 6, 8, 1, { U: 9 });
      wire([6, 8], [10, 8]);
      part('ammeter', 10, 8, 0);
      wire([13, 8], [16, 8]);
      part('resistor', 16, 8, 0, { R: 390 });
      wire([19, 8], [24, 8], [28, 8]);
      part('led', 24, 8, 1, { color: 'red' });
      part('voltmeter', 28, 8, 1);
      wire([28, 11], [24, 11], [6, 11]);
      return circuit;
    },
  },
  {
    id: 'lamps',
    title: 'Žiarovky sériovo a paralelne',
    description: 'Dve rovnaké žiarovky v sérii majú každá len polovicu napätia, a preto svietia slabo. Žiarovka zapojená samostatne svieti naplno.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 4, 1, { U: 12 });
      wire([4, 4], [12, 4], [20, 4]);
      wire([4, 7], [4, 12], [12, 12], [20, 12]);
      part('lamp', 12, 4, 1, { U: 12, P: 5 });
      part('lamp', 12, 7, 1, { U: 12, P: 5 });
      wire([12, 10], [12, 12]);
      part('lamp', 20, 4, 1, { U: 12, P: 5 });
      part('ammeter', 20, 7, 1);
      wire([20, 10], [20, 12]);
      return circuit;
    },
  },
  {
    id: 'rc',
    title: 'Nabíjanie a vybíjanie kondenzátora',
    description: 'Zapni spínač S1 a sleduj na osciloskope, ako sa kondenzátor nabíja. Po vypnutí sa vybíja cez R2.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 8, 1, { U: 10 });
      wire([4, 8], [7, 8]);
      part('switch', 7, 8, 0, { on: false });
      wire([10, 8], [12, 8]);
      part('resistor', 12, 8, 0, { R: 10000 });
      wire([15, 8], [20, 8], [25, 8], [29, 8], [38, 8]);
      part('ecap', 20, 8, 1, { C: 100e-6, umax: '25' });
      part('resistor', 25, 8, 1, { R: 10000 });
      part('voltmeter', 29, 8, 1);
      part('scope', 38, 8, 0, { tdiv: '0.5', v1: 'auto', v2: 'auto' });
      wire([10, 8], [10, 5], [36, 5], [36, 9], [38, 9]);
      wire([38, 10], [38, 11], [29, 11], [25, 11], [20, 11], [4, 11]);
      return circuit;
    },
  },
  {
    id: 'bjt',
    title: 'Tranzistor ako spínač',
    description: 'Malý prúd bázy (A1) riadi oveľa väčší prúd kolektora (A2). Zapni S1 a porovnaj ich – pomer je zosilňovací činiteľ. Pri menšom R1 tranzistor prejde do nasýtenia.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 2, 1, { U: 9 });
      wire([4, 2], [20, 2]);
      wire([4, 5], [4, 18], [20, 18]);
      part('switch', 10, 2, 1, { on: false });
      part('resistor', 10, 5, 1, { R: 100000 });
      wire([10, 8], [10, 13], [12, 13]);
      part('ammeter', 12, 13, 0);
      wire([15, 13], [18, 13]);
      part('resistor', 20, 2, 1, { R: 470 });
      part('led', 20, 5, 1, { color: 'green' });
      part('ammeter', 20, 8, 1);
      part('bjt', 18, 13, 0, { type: 'npn', beta: 100 });
      wire([20, 15], [20, 18]);
      part('voltmeter', 24, 11, 1);
      wire([20, 11], [24, 11]);
      wire([24, 14], [24, 15], [20, 15]);
      return circuit;
    },
  },
  {
    id: 'mosfet',
    title: 'MOSFET spína LED',
    description: 'Hradlo MOSFETu neodoberá prúd – stačí naň priviesť napätie. Rezistor 100 kΩ ho po vypnutí S1 vybije.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 2, 1, { U: 12 });
      wire([4, 2], [20, 2]);
      wire([4, 5], [4, 16], [20, 16]);
      part('switch', 10, 2, 1, { on: false });
      wire([10, 5], [10, 10], [18, 10]);
      part('resistor', 14, 10, 1, { R: 100000 });
      wire([14, 13], [14, 16]);
      part('resistor', 20, 2, 1, { R: 560 });
      part('led', 20, 5, 1, { color: 'blue' });
      part('mosfet', 18, 10, 0, { type: 'n', uth: 2 });
      wire([20, 12], [20, 16]);
      part('voltmeter', 7, 10, 1);
      wire([7, 10], [10, 10]);
      wire([7, 13], [7, 16]);
      return circuit;
    },
  },
  {
    id: 'ac-rc',
    title: 'Striedavý prúd: RC člen a fázový posun',
    description: 'Osciloskop ukazuje napätie zdroja (CH1) a kondenzátora (CH2). Napätie na kondenzátore zaostáva a je menšie.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('ac', 4, 6, 1, { U: 10, f: 50 });
      wire([4, 6], [10, 6]);
      part('resistor', 10, 6, 0, { R: 1000 });
      wire([13, 6], [18, 6], [22, 6], [26, 6], [26, 7], [32, 7]);
      part('capacitor', 18, 6, 1, { C: 2.2e-6 });
      part('voltmeter', 22, 6, 1, { mode: 'AC' });
      part('scope', 32, 6, 0, { tdiv: '0.005', v1: 'auto', v2: 'auto' });
      wire([4, 6], [4, 3], [30, 3], [30, 6], [32, 6]);
      wire([32, 8], [28, 8], [28, 9], [22, 9], [18, 9], [4, 9]);
      return circuit;
    },
  },
  {
    id: 'rectifier',
    title: 'Usmerňovač s vyhladzovacím kondenzátorom',
    description: 'Dióda prepustí len kladné polvlny, elektrolytický kondenzátor ich vyhladí. Skús ho zmenšiť alebo odpojiť.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('ac', 4, 6, 1, { U: 12, f: 50 });
      wire([4, 6], [9, 6]);
      part('diode', 9, 6, 0);
      wire([12, 6], [17, 6], [22, 6], [26, 6], [30, 6], [30, 7], [36, 7]);
      part('ecap', 17, 6, 1, { C: 470e-6, umax: '25' });
      part('resistor', 22, 6, 1, { R: 2200 });
      part('voltmeter', 26, 6, 1);
      part('scope', 36, 6, 0, { tdiv: '0.005', v1: 'auto', v2: 'auto' });
      wire([4, 6], [4, 3], [34, 3], [34, 6], [36, 6]);
      wire([36, 8], [32, 8], [32, 9], [26, 9], [22, 9], [17, 9], [4, 9]);
      return circuit;
    },
  },
  {
    id: 'watt',
    title: 'Výkon: wattmeter, ampérmeter a voltmeter',
    description: 'Wattmeter meria výkon priamo. Porovnaj ho so súčinom U · I z voltmetra a ampérmetra.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 6, 1, { U: 12 });
      wire([4, 6], [8, 6]);
      part('wattmeter', 8, 6, 0);
      wire([10, 4], [8, 4], [8, 6]);
      wire([12, 6], [15, 6]);
      part('ammeter', 15, 6, 0);
      wire([18, 6], [20, 6], [24, 6]);
      part('resistor', 20, 6, 1, { R: 100, pmax: '2' });
      part('voltmeter', 24, 6, 1);
      wire([24, 9], [20, 9], [10, 9], [4, 9]);
      wire([10, 8], [10, 9]);
      return circuit;
    },
  },
  {
    id: 'switch',
    title: 'Spínač a žiarovka',
    description: 'Spínač je v sérii so žiarovkou. Keď je vypnutý, obvod je prerušený a prúd netečie – klikni naň a žiarovka sa rozsvieti.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 6, 1, { U: 12 });
      wire([4, 6], [8, 6]);
      part('switch', 8, 6, 0, { on: false });
      wire([11, 6], [14, 6]);
      part('ammeter', 14, 6, 0);
      wire([17, 6], [22, 6]);
      part('lamp', 22, 6, 1, { U: 12, P: 5 });
      wire([22, 9], [4, 9]);
      return circuit;
    },
  },
  {
    id: 'divider',
    title: 'Rezistory v sérii – delič napätia',
    description: 'Oboma rezistormi tečie rovnaký prúd (ampérmeter v sérii). Napätie zdroja sa rozdelí v pomere odporov: U₁ + U₂ = U (voltmetre paralelne k rezistorom).',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 6, 1, { U: 12 });
      wire([4, 6], [8, 6]);
      part('ammeter', 8, 6, 0);
      wire([11, 6], [14, 6]);
      part('resistor', 14, 6, 0, { R: 1000 });
      wire([17, 6], [20, 6]);
      part('resistor', 20, 6, 0, { R: 2000 });
      part('voltmeter', 14, 3, 0);
      wire([14, 3], [14, 6]);
      wire([17, 3], [17, 6]);
      part('voltmeter', 20, 3, 0);
      wire([20, 3], [20, 6]);
      wire([23, 3], [23, 6]);
      wire([23, 6], [28, 6], [28, 9], [4, 9]);
      return circuit;
    },
  },
  {
    id: 'rl',
    title: 'Cievka: oneskorený nábeh prúdu',
    description: 'Po zapnutí S1 prúd cievkou (ampérmeter) rastie postupne s časovou konštantou τ = L / R ≈ 0,2 s. Dióda pri vypnutí odvedie prúd cievky a chráni spínač pred napäťovou špičkou.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 6, 1, { U: 6 });
      wire([4, 6], [7, 6]);
      part('switch', 7, 6, 0, { on: false });
      wire([10, 6], [12, 6]);
      part('ammeter', 12, 6, 0);
      wire([15, 6], [17, 6]);
      part('resistor', 17, 6, 0, { R: 10, pmax: '5' });
      wire([20, 6], [25, 6], [29, 6], [34, 6]);
      part('inductor', 25, 6, 1, { L: 2 });
      part('diode', 29, 9, 3);
      part('scope', 34, 6, 0, { tdiv: '0.1', v1: 'auto', v2: 'auto' });
      wire([10, 6], [10, 3], [33, 3], [33, 7], [34, 7]);
      wire([34, 8], [32, 8], [32, 9], [29, 9], [25, 9], [4, 9]);
      return circuit;
    },
  },
  {
    id: 'pnp',
    title: 'Tranzistor PNP ako spínač',
    description: 'PNP sa otvára, keď je báza zápornejšia ako emitor. Emitor je na plusovej vetve, po zapnutí S1 tečie prúd bázy (A2) do zeme a kolektorom (A1) sa rozsvieti LED. Rezistor R3 drží tranzistor zatvorený, kým je S1 vypnutý.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 2, 1, { U: 9 });
      wire([4, 2], [20, 2], [24, 2]);
      wire([20, 2], [20, 4]);
      wire([4, 5], [4, 18], [20, 18], [33, 18]);
      part('bjt', 22, 6, 2, { type: 'pnp', beta: 100 });
      part('ammeter', 20, 8, 1);
      part('led', 20, 11, 1, { color: 'yellow' });
      part('resistor', 20, 14, 1, { R: 470 });
      wire([20, 17], [20, 18]);
      wire([22, 6], [24, 6]);
      part('resistor', 24, 6, 0, { R: 10000 });
      part('resistor', 24, 2, 1, { R: 100000 });
      wire([24, 5], [24, 6]);
      wire([27, 6], [28, 6]);
      part('ammeter', 28, 6, 0);
      wire([31, 6], [33, 6]);
      part('switch', 33, 6, 1, { on: false });
      wire([33, 9], [33, 18]);
      return circuit;
    },
  },
  {
    id: 'pmos',
    title: 'MOSFET s kanálom P ako spínač',
    description: 'MOSFET P spína plusovú vetvu: otvorí sa, keď je hradlo aspoň o 2 V zápornejšie ako source. S1 stiahne hradlo k zemi, rezistor 100 kΩ ho po vypnutí vráti na +12 V.',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 2, 1, { U: 12 });
      wire([4, 2], [20, 2], [26, 2]);
      wire([20, 2], [20, 4]);
      wire([4, 5], [4, 18], [20, 18], [26, 18]);
      part('mosfet', 22, 6, 2, { type: 'p', uth: 2 });
      part('led', 20, 8, 1, { color: 'red' });
      part('resistor', 20, 11, 1, { R: 560 });
      wire([20, 14], [20, 18]);
      wire([22, 6], [26, 6]);
      part('resistor', 26, 2, 1, { R: 100000 });
      wire([26, 5], [26, 6]);
      part('switch', 26, 6, 1, { on: false });
      wire([26, 9], [26, 18]);
      return circuit;
    },
  },
  {
    id: 'multimeter',
    title: 'Multimeter: prúd, napätie a odpor',
    description: 'MM1 meria prúd – je zapojený do série. MM2 meria napätie na R2 – je paralelne. MM3 meria odpor rezistora R3, ktorý nie je pripojený k zdroju (odpor sa meria bez napätia).',
    build: () => {
      const { circuit, part, wire } = builder();
      part('dc', 4, 6, 1, { U: 9 });
      wire([4, 6], [7, 6]);
      part('multimeter', 7, 6, 0, { mode: 'A=' });
      wire([10, 6], [12, 6]);
      part('resistor', 12, 6, 0, { R: 470 });
      wire([15, 6], [20, 6], [24, 6]);
      part('resistor', 20, 6, 1, { R: 1000 });
      part('multimeter', 24, 6, 1, { mode: 'V=' });
      wire([24, 9], [20, 9], [4, 9]);
      part('resistor', 32, 6, 1, { R: 4700 });
      part('multimeter', 36, 6, 1, { mode: 'ohm' });
      wire([32, 6], [36, 6]);
      wire([32, 9], [36, 9]);
      return circuit;
    },
  },
  // ------------------------------------------------------------------ Arduino
  {
    id: 'ard-blink',
    title: 'Arduino: blikanie LED',
    description: 'Prvý program: LED na pine 13 sa zapína a vypína každú pol sekundu. Rovnako bliká aj malá LED „L“ na doske. Program je v editore pod schémou – skús zmeniť čas v delay() a nahrať ho znova.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, BLINK_SKETCH);
      ledColumn(b, a.D13, a.GND, 'red');
      return b.circuit;
    },
  },
  {
    id: 'ard-button',
    title: 'Arduino: tlačidlo a LED',
    description: 'Kým držíš tlačidlo S1 (klikni naň a drž), pin 2 je na 5 V a LED svieti. Rezistor 10 kΩ (pull-down) drží pin na 0 V, keď tlačidlo pustíš – bez neho by vstup „plával“.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, BUTTON_SKETCH);
      ledColumn(b, a.D13, a.GND, 'green');
      b.wire(a.D2, [19, 11], [30, 11]);
      b.part('button', 30, 5, 1);
      b.wire([30, 8], [30, 11]);
      b.part('resistor', 30, 11, 1, { R: 10000 });
      b.wire([30, 14], [30, 25], [12, 25], a.GND2);
      b.wire([30, 5], [30, 3], [34, 3], [34, 26], [11, 26], a.V5);
      return b.circuit;
    },
  },
  {
    id: 'ard-fade',
    title: 'Arduino: PWM a plynulý jas LED',
    description: 'analogWrite na pine 9 rýchlo zapína a vypína výstup (PWM, 490 Hz). Čím dlhšie je zapnutý, tým jasnejšie LED svieti. Osciloskop ukazuje napätie na LED (CH1) a na pine 9 (CH2).',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, FADE_SKETCH);
      ledColumn(b, a.D9, a.GND, 'red');
      b.part('scope', 30, 9, 0, { tdiv: '0.0005', v1: '1', v2: '2' });
      b.wire([11, 9], [30, 9]);
      b.wire([11, 13], [28, 13], [28, 10], [30, 10]);
      b.wire([30, 11], [29, 11], [29, 25], [12, 25], a.GND2);
      return b.circuit;
    },
  },
  {
    id: 'ard-pot',
    title: 'Arduino: potenciometer a analogRead',
    description: 'Jazdec potenciometra dáva napätie 0 až 5 V na vstup A0. Program ho číta (0 až 1023), podľa neho nastaví jas LED a hodnotu vypisuje na sériový monitor. Polohu jazdca zmeníš vo vlastnostiach P1.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, POT_SKETCH);
      ledColumn(b, a.D9, a.GND, 'yellow');
      // Vývod 1 na GND, vývod 2 na 5 V: čím väčšie percento, tým väčšie napätie na A0.
      b.part('pot', 24, 8, 0, { R: 10000, pos: 50 });
      b.wire([24, 8], [24, 6], [11, 6]);
      b.wire([26, 10], [26, 24], [16, 24], a.A0);
      b.wire([28, 8], [30, 8], [30, 26], [11, 26], a.V5);
      return b.circuit;
    },
  },
  {
    id: 'ard-traffic',
    title: 'Arduino: semafor',
    description: 'Tri LED na pinoch 12, 11 a 10 sa striedajú ako na semafore. Program používa vlastnú funkciu svetla(), ktorá zapne zvolené svetlá a počká.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, TRAFFIC_SKETCH);
      b.wire(a.D12, [8, 11], [13, 11]);
      b.wire(a.D11, [9, 12], [17, 12], [17, 11]);
      b.wire(a.D10, [10, 13], [21, 13], [21, 11]);
      ([[13, 'red'], [17, 'yellow'], [21, 'green']] as const).forEach(([x, color]) => {
        b.part('resistor', x, 11, 3, { R: 220 });
        b.part('led', x, 8, 3, { color });
      });
      b.wire([13, 5], [13, 3]);
      b.wire([17, 5], [17, 3]);
      b.wire([21, 5], [21, 3], [3, 3], [3, 12], [6, 12], a.GND);
      return b.circuit;
    },
  },
  {
    id: 'ard-seg7',
    title: 'Arduino: 7-segmentový displej',
    description: 'Program počíta od 0 do 9. Pre jednoduchosť má displej len jeden rezistor na spoločnej katóde – preto číslica 8 svieti slabšie ako 1. Správne je dať vlastný rezistor ku každému segmentu.',
    build: () => {
      const b = builder();
      const a = b.arduino(4, 18, SEG7_SKETCH);
      b.part('seg7', 24, 5, 0, { type: 'cc', color: 'red' });
      b.wire(a.D8, [10, 3], [25, 3], [25, 5]);
      b.wire(a.D7, [12, 4], [24, 4], [24, 5]);
      b.wire(a.D6, [13, 13], [24, 13], [24, 11]);
      b.wire(a.D5, [14, 14], [25, 14], [25, 11]);
      b.wire(a.D4, [15, 15], [27, 15], [27, 11]);
      b.wire(a.D3, [16, 16], [30, 16], [30, 3], [28, 3], [28, 5]);
      b.wire(a.D2, [17, 17], [31, 17], [31, 1], [27, 1], [27, 5]);
      b.wire([26, 5], [26, 2], [21, 2]);
      b.part('resistor', 18, 2, 0, { R: 220 });
      b.wire([18, 2], [3, 2], [3, 17], [4, 17], a.GND);
      return b.circuit;
    },
  },
  {
    id: 'ard-lcd',
    title: 'Arduino: LCD displej',
    description: 'LCD displej s prevodníkom I2C potrebuje len štyri vodiče: GND, VCC (5 V), SDA na A4 a SCL na A5. Program naň vypíše text a čas od zapnutia.',
    build: () => {
      const b = builder();
      const a = b.arduino(4, 4, LCD_SKETCH);
      b.part('lcd', 8, 19, 0, { addr: '39' });
      b.wire(a.GND2, [10, 17], [7, 17], [7, 19], [8, 19]);
      b.wire(a.V5, [9, 16], [6, 16], [6, 20], [8, 20]);
      b.wire(a.A4, [18, 15], [26, 15], [26, 24], [5, 24], [5, 21], [8, 21]);
      b.wire(a.A5, [19, 14], [27, 14], [27, 25], [4, 25], [4, 22], [8, 22]);
      return b.circuit;
    },
  },
  {
    id: 'ard-servo',
    title: 'Arduino: servomotor',
    description: 'Knižnica Servo posiela na pin 9 impulzy každých 20 ms – ich šírka (0,5 až 2,4 ms) určuje uhol ramena. Servo má hnedý vodič na GND, červený na 5 V a oranžový na signál.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, SWEEP_SKETCH);
      b.part('servo', 14, 6, 0);
      b.wire(a.D9, [11, 8], [14, 8]);
      b.wire(a.V5, [11, 25], [3, 25], [3, 7], [14, 7]);
      b.wire(a.GND2, [12, 26], [2, 26], [2, 6], [14, 6]);
      return b.circuit;
    },
  },
  {
    id: 'ard-tone',
    title: 'Arduino: bzučiak a tlačidlo',
    description: 'Po zapnutí zahrá krátku melódiu, potom hrá tón 440 Hz, kým držíš tlačidlo. Tlačidlo je proti zemi a pin má zapnutý vnútorný pull-up (INPUT_PULLUP) – stlačené tlačidlo je LOW. Zvuk zapneš kliknutím na stránku.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, TONE_SKETCH);
      b.wire(a.D8, [12, 11]);
      b.part('buzzer', 12, 11, 3, { type: 'passive' });
      b.wire(a.D2, [19, 11]);
      b.part('button', 19, 11, 3);
      b.wire([19, 8], [19, 6], [12, 6]);
      b.wire([12, 8], [12, 6], [3, 6], [3, 12], [6, 12], a.GND);
      return b.circuit;
    },
  },
  {
    id: 'ard-ldr',
    title: 'Arduino: nočné svetlo s fotorezistorom',
    description: 'Fotorezistor s rezistorom 10 kΩ tvoria delič napätia na A0. Keď sa zotmie (nastav malé osvetlenie vo vlastnostiach fotorezistora), hodnota klesne pod prah a LED sa rozsvieti.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, LDR_SKETCH);
      ledColumn(b, a.D13, a.GND, 'white');
      b.part('ldr', 26, 14, 1, { lux: 100 });
      b.part('resistor', 26, 17, 1, { R: 10000 });
      b.wire([26, 17], [24, 17], [24, 24], [16, 24], a.A0);
      b.wire([26, 14], [26, 12], [28, 12], [28, 26], [11, 26], a.V5);
      b.wire([26, 20], [26, 25], [12, 25], a.GND2);
      return b.circuit;
    },
  },
  {
    id: 'ard-tmp36',
    title: 'Arduino: teplomer s TMP36',
    description: 'Senzor TMP36 dáva napätie úmerné teplote (0,5 V pri 0 °C, +10 mV na °C). Program ho prepočíta na stupne a vypisuje na sériový monitor. Teplotu okolia zmeníš vo vlastnostiach senzora.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, TMP36_SERIAL_SKETCH);
      b.part('tmp36', 20, 10, 0, { temp: 22 });
      b.wire([20, 10], [20, 11], [2, 11], [2, 26], [11, 26], a.V5);
      b.wire([21, 10], [21, 12], [25, 12], [25, 24], [16, 24], a.A0);
      b.wire([22, 10], [22, 11], [26, 11], [26, 25], [12, 25], a.GND2);
      return b.circuit;
    },
  },
  {
    id: 'ard-rgb',
    title: 'Arduino: RGB LED',
    description: 'RGB LED má v jednom puzdre červenú, zelenú a modrú LED so spoločnou katódou. Každá je cez rezistor na PWM pine – zmiešaním ich jasu vznikajú ďalšie farby.',
    build: () => {
      const b = builder();
      const a = b.arduino(6, 14, RGB_SKETCH);
      b.part('rgbled', 20, 4, 0, { type: 'cc' });
      ([[a.D11, 4], [a.D10, 7], [a.D9, 10]] as const).forEach(([pin, y]) => {
        b.wire(pin, [pin[0], y], [13, y]);
        b.part('resistor', 13, y, 0, { R: 220 });
        b.wire([16, y], [20, y]);
      });
      b.wire([24, 7], [26, 7], [26, 25], [12, 25], a.GND2);
      return b.circuit;
    },
  },
];

export function exampleById(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}

/** Ukážka zapojenia pre každú položku palety (podľa id položky). */
export const DEMO_FOR: Record<string, string> = {
  ammeter: 'led', voltmeter: 'divider', multimeter: 'multimeter', wattmeter: 'watt', scope: 'ac-rc',
  dc: 'switch', ac: 'ac-rc', switch: 'switch',
  resistor: 'divider', lamp: 'lamps', capacitor: 'ac-rc', ecap: 'rc', inductor: 'rl', diode: 'rectifier', led: 'led',
  npn: 'bjt', pnp: 'pnp', nmos: 'mosfet', pmos: 'pmos',
  arduino: 'ard-blink', button: 'ard-button', pot: 'ard-pot', ldr: 'ard-ldr', tmp36: 'ard-tmp36', seg7: 'ard-seg7',
  lcd: 'ard-lcd', rgbled: 'ard-rgb', buzzer: 'ard-tone', servo: 'ard-servo',
};

/** Id položky palety pre súčiastku na doske (tranzistor a MOSFET podľa typu). */
export function paletteIdOf(kind: PartKind, props: Record<string, PropValue> = {}): string {
  if (kind === 'bjt') return props.type === 'pnp' ? 'pnp' : 'npn';
  if (kind === 'mosfet') return props.type === 'p' ? 'pmos' : 'nmos';
  return kind;
}
