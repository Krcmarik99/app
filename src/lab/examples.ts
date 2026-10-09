/**
 * Hotové zapojenia na vyskúšanie. Súradnice sú v políčkach mriežky; vodiče sa kreslia
 * po úsekoch tak, aby žiadny vodič neprechádzal cez cudzí vývod.
 */
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
  return { circuit, part, wire };
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
];

export function exampleById(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
