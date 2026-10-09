import { describe, expect, it } from 'vitest';
import { Simulator, meterReading } from '../src/lab/engine';
import { buildNets, routeWire } from '../src/lab/netlist';
import { KINDS, terminalsOf, type Circuit, type Part, type PartKind, type PropValue, type Rot, type Wire } from '../src/lab/parts';

interface Spec {
  kind: PartKind;
  nodes: string[];
  props?: Record<string, PropValue>;
}

/**
 * Postaví obvod zo zoznamu súčiastok a mien uzlov: každý vývod sa spojí vodičom s „rozbočovačom“
 * daného uzla ďaleko od súčiastok.
 */
function build(specs: Spec[]): { circuit: Circuit; parts: Part[] } {
  const names: string[] = [];
  const hub = (n: string): [number, number] => {
    let k = names.indexOf(n);
    if (k < 0) k = names.push(n) - 1;
    return [5000 + 37 * k, 7000 + 101 * k * k];
  };
  const parts: Part[] = specs.map((s, i) => ({
    id: `p${i}`, kind: s.kind, name: `${KINDS[s.kind].prefix}${i}`, x: i * 10, y: 0, rot: 0 as Rot,
    props: { ...KINDS[s.kind].defaults, ...s.props },
  }));
  const wires: Wire[] = [];
  parts.forEach((p, i) => terminalsOf(p).forEach((t, k) => wires.push({ id: `w${i}-${k}`, a: t, b: hub(specs[i].nodes[k]) })));
  return { circuit: { parts, wires }, parts };
}

function run(sim: Simulator, seconds: number, chunk = 0.01): void {
  for (let t = 0; t < seconds - 1e-12; t += chunk) sim.advance(Math.min(chunk, seconds - t), 100000);
}

const reading = (sim: Simulator, part: Part) => meterReading(part, sim.states.get(part.id)!, sim.hasAC)!.value!;

describe('uzly obvodu', () => {
  it('spojí konce vodičov a odbočku, ale nie kríženie', () => {
    const circuit: Circuit = {
      parts: [],
      wires: [
        { id: 'a', a: [0, 0], b: [10, 0] },
        { id: 'b', a: [5, 0], b: [5, 5] },
        { id: 'c', a: [2, -3], b: [2, 3] },
        { id: 'd', a: [10, 0], b: [10, 4] },
      ],
    };
    const nets = buildNets(circuit);
    expect(nets.junctions).toEqual([[5, 0]]);
    expect(nets.nodeCount).toBe(2);
  });

  it('nájde nepripojené vývody a trasuje vodič do L', () => {
    const part: Part = { id: 'r', kind: 'resistor', name: 'R1', x: 0, y: 0, rot: 1, props: {} };
    expect(terminalsOf(part)).toEqual([[0, 0], [0, 3]]);
    const nets = buildNets({ parts: [part], wires: [{ id: 'w', a: [0, 0], b: [4, 0] }] });
    expect(nets.openTerminals).toEqual([[0, 3]]);
    expect(routeWire([0, 0], [3, 2])).toEqual([[[0, 0], [3, 0]], [[3, 0], [3, 2]]]);
    expect(routeWire([0, 0], [0, 2])).toEqual([[[0, 0], [0, 2]]]);
  });
});

describe('simulácia', () => {
  it('delič napätia a voltmeter', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 12 } },
      { kind: 'resistor', nodes: ['+', 'm'], props: { R: 1000 } },
      { kind: 'resistor', nodes: ['m', '0'], props: { R: 2000 } },
      { kind: 'voltmeter', nodes: ['m', '0'] },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01);
    expect(reading(sim, parts[3])).toBeCloseTo(8, 2);
  });

  it('ampérmeter v sérii a Ohmov zákon', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 9 } },
      { kind: 'ammeter', nodes: ['+', 'a'] },
      { kind: 'resistor', nodes: ['a', '0'], props: { R: 330 } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01);
    expect(reading(sim, parts[1])).toBeCloseTo(9 / 330.11, 5);
    expect(sim.warnings()).toEqual([]);
  });

  it('ampérmeter zapojený paralelne k zdroju hlási skrat', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 12 } },
      { kind: 'ammeter', nodes: ['+', '0'] },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01);
    expect(meterReading(parts[1], sim.states.get(parts[1].id)!, false)!.value).toBeNull();
    expect(sim.warnings().map((w) => w.text).join(' ')).toContain('do série');
  });

  it('LED s predradným rezistorom', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 5 } },
      { kind: 'resistor', nodes: ['+', 'a'], props: { R: 150 } },
      { kind: 'led', nodes: ['a', '0'], props: { color: 'red' } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01);
    const led = sim.states.get(parts[2].id)!;
    expect(led.i).toBeGreaterThan(0.018);
    expect(led.i).toBeLessThan(0.021);
    expect(led.u).toBeGreaterThan(1.9);
    expect(led.u).toBeLessThan(2.1);
  });

  it('LED bez rezistora zhorí a dióda v závernom smere nevedie', () => {
    const led = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 5 } },
      { kind: 'led', nodes: ['+', '0'] },
    ]);
    const s1 = new Simulator(led.circuit);
    run(s1, 0.01);
    expect(s1.warnings().map((w) => w.text).join(' ')).toContain('LED sa zničí');

    const diode = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 12 } },
      { kind: 'resistor', nodes: ['+', 'a'], props: { R: 1000 } },
      { kind: 'diode', nodes: ['0', 'a'] },
    ]);
    const s2 = new Simulator(diode.circuit);
    run(s2, 0.01);
    expect(Math.abs(s2.states.get(diode.parts[2].id)!.i)).toBeLessThan(1e-6);
  });

  it('žiarovka má pri menovitom napätí menovitý výkon a pri vyššom sa prepáli', () => {
    const make = (U: number) => build([
      { kind: 'dc', nodes: ['+', '0'], props: { U } },
      { kind: 'lamp', nodes: ['+', '0'], props: { U: 12, P: 5 } },
    ]);
    const ok = make(12);
    const s1 = new Simulator(ok.circuit);
    run(s1, 0.01);
    const st = s1.states.get(ok.parts[1].id)!;
    expect(st.p).toBeCloseTo(5, 1);
    expect(st.i).toBeCloseTo(5 / 12, 2);
    expect(s1.warnings()).toEqual([]);

    const over = make(24);
    const s2 = new Simulator(over.circuit);
    run(s2, 0.01);
    expect(s2.warnings().map((w) => w.text).join(' ')).toContain('prepáli');
  });

  it('nabíjanie kondenzátora cez rezistor (τ = RC)', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 10 } },
      { kind: 'resistor', nodes: ['+', 'a'], props: { R: 1000 } },
      { kind: 'capacitor', nodes: ['a', '0'], props: { C: 1e-3 } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 1, 0.005);
    expect(sim.states.get(parts[2].id)!.u).toBeCloseTo(10 * (1 - Math.exp(-1)), 1);
  });

  it('nábeh prúdu cievkou (τ = L/R)', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 10 } },
      { kind: 'resistor', nodes: ['+', 'a'], props: { R: 10 } },
      { kind: 'inductor', nodes: ['a', '0'], props: { L: 0.1 } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01, 0.0005);
    expect(sim.states.get(parts[2].id)!.i).toBeCloseTo((10 / 10.1) * (1 - Math.exp(-0.01 * 10.1 / 0.1)), 1);
  });

  it('tranzistor NPN v aktívnom režime a v saturácii', () => {
    const make = (rb: number) => build([
      { kind: 'dc', nodes: ['vcc', '0'], props: { U: 12 } },
      { kind: 'dc', nodes: ['vb', '0'], props: { U: 5 } },
      { kind: 'resistor', nodes: ['vb', 'b'], props: { R: rb } },
      { kind: 'resistor', nodes: ['vcc', 'c'], props: { R: 1000 } },
      { kind: 'bjt', nodes: ['b', 'c', '0'], props: { type: 'npn', beta: 100 } },
    ]);
    const active = make(1e6);
    const s1 = new Simulator(active.circuit);
    run(s1, 0.01);
    const t1 = s1.states.get(active.parts[4].id)!;
    expect(t1.extra.ic / t1.extra.ib).toBeCloseTo(100, 0);
    expect(t1.extra.ic).toBeGreaterThan(0.0004);
    expect(t1.extra.ic).toBeLessThan(0.0005);

    const sat = make(10000);
    const s2 = new Simulator(sat.circuit);
    run(s2, 0.01);
    const t2 = s2.states.get(sat.parts[4].id)!;
    expect(t2.extra.uce).toBeLessThan(0.3);
    expect(t2.extra.ic).toBeGreaterThan(0.0115);
  });

  it('tranzistor PNP spína záťaž voči kladnému napätiu', () => {
    const { circuit, parts } = build([
      { kind: 'dc', nodes: ['vcc', '0'], props: { U: 12 } },
      { kind: 'resistor', nodes: ['b', '0'], props: { R: 22000 } },
      { kind: 'resistor', nodes: ['c', '0'], props: { R: 1000 } },
      { kind: 'bjt', nodes: ['b', 'c', 'vcc'], props: { type: 'pnp', beta: 100 } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.01);
    const t = sim.states.get(parts[3].id)!;
    expect(t.extra.ic).toBeLessThan(-0.005);
    expect(t.extra.uce).toBeGreaterThan(-0.3);
  });

  it('MOSFET N a P ako spínač', () => {
    const nmos = (ug: number) => build([
      { kind: 'dc', nodes: ['vcc', '0'], props: { U: 12 } },
      { kind: 'dc', nodes: ['g', '0'], props: { U: ug } },
      { kind: 'resistor', nodes: ['vcc', 'd'], props: { R: 1000 } },
      { kind: 'mosfet', nodes: ['g', 'd', '0'], props: { type: 'n', uth: 2 } },
    ]);
    const on = nmos(10);
    const s1 = new Simulator(on.circuit);
    run(s1, 0.01);
    expect(s1.states.get(on.parts[3].id)!.extra.id).toBeGreaterThan(0.0115);
    const off = nmos(1);
    const s2 = new Simulator(off.circuit);
    run(s2, 0.01);
    expect(Math.abs(s2.states.get(off.parts[3].id)!.extra.id)).toBeLessThan(1e-6);

    const pmos = build([
      { kind: 'dc', nodes: ['vcc', '0'], props: { U: 12 } },
      { kind: 'resistor', nodes: ['d', '0'], props: { R: 1000 } },
      { kind: 'mosfet', nodes: ['0', 'd', 'vcc'], props: { type: 'p', uth: 2 } },
    ]);
    const s3 = new Simulator(pmos.circuit);
    run(s3, 0.01);
    expect(s3.states.get(pmos.parts[2].id)!.extra.id).toBeLessThan(-0.0115);
  });

  it('striedavý zdroj: efektívne hodnoty a wattmeter', () => {
    const { circuit, parts } = build([
      { kind: 'ac', nodes: ['a', '0'], props: { U: 10, f: 50 } },
      { kind: 'wattmeter', nodes: ['a', 'b', 'a', '0'] },
      { kind: 'ammeter', nodes: ['b', 'c'], props: { mode: 'AC' } },
      { kind: 'resistor', nodes: ['c', '0'], props: { R: 100, pmax: '2' } },
      { kind: 'voltmeter', nodes: ['c', '0'], props: { mode: 'AC' } },
      { kind: 'voltmeter', nodes: ['c', '0'], props: { mode: 'DC' } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 1);
    expect(reading(sim, parts[4])).toBeCloseTo(10, 0);
    expect(reading(sim, parts[2])).toBeCloseTo(0.1, 2);
    expect(reading(sim, parts[1])).toBeCloseTo(1, 1);
    expect(Math.abs(reading(sim, parts[5]))).toBeLessThan(0.3);
  });

  it('jednocestný usmerňovač s vyhladzovacím kondenzátorom', () => {
    const { circuit, parts } = build([
      { kind: 'ac', nodes: ['a', '0'], props: { U: 10, f: 50 } },
      { kind: 'diode', nodes: ['a', 'k'] },
      { kind: 'ecap', nodes: ['k', '0'], props: { C: 1e-3, umax: '25' } },
      { kind: 'resistor', nodes: ['k', '0'], props: { R: 1000 } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.5);
    const u = sim.states.get(parts[2].id)!.u;
    expect(u).toBeGreaterThan(12);
    expect(u).toBeLessThan(14.2);
    expect(sim.warnings()).toEqual([]);
  });

  it('multimeter meria odpor a varuje pri opačne zapojenom elektrolyte', () => {
    const ohm = build([
      { kind: 'multimeter', nodes: ['a', '0'], props: { mode: 'ohm' } },
      { kind: 'resistor', nodes: ['a', '0'], props: { R: 4700 } },
    ]);
    const s1 = new Simulator(ohm.circuit);
    run(s1, 0.01);
    expect(reading(s1, ohm.parts[0])).toBeCloseTo(4700, -1);

    const open = build([{ kind: 'multimeter', nodes: ['a', 'b'], props: { mode: 'ohm' } }]);
    const s2 = new Simulator(open.circuit);
    run(s2, 0.01);
    expect(meterReading(open.parts[0], s2.states.get(open.parts[0].id)!, false)!.value).toBeNull();

    const rev = build([
      { kind: 'dc', nodes: ['+', '0'], props: { U: 12 } },
      { kind: 'resistor', nodes: ['+', 'a'], props: { R: 100 } },
      { kind: 'ecap', nodes: ['0', 'a'], props: { C: 1e-4 } },
    ]);
    const s3 = new Simulator(rev.circuit);
    run(s3, 0.1);
    expect(s3.warnings().map((w) => w.text).join(' ')).toContain('opačne');
  });

  it('osciloskop zaznamenáva oba kanály', () => {
    const { circuit, parts } = build([
      { kind: 'ac', nodes: ['a', '0'], props: { U: 10, f: 50 } },
      { kind: 'resistor', nodes: ['a', 'b'], props: { R: 1000 } },
      { kind: 'resistor', nodes: ['b', '0'], props: { R: 1000 } },
      { kind: 'scope', nodes: ['a', 'b', '0'], props: { tdiv: '0.005' } },
    ]);
    const sim = new Simulator(circuit);
    run(sim, 0.1);
    const samples = sim.traces.get(parts[3].id)!.samples();
    expect(samples.length).toBeGreaterThan(500);
    const max1 = Math.max(...samples.map((s) => s.v1));
    const max2 = Math.max(...samples.map((s) => s.v2));
    expect(max1).toBeCloseTo(10 * Math.SQRT2, 0);
    expect(max2).toBeCloseTo(5 * Math.SQRT2, 0);
  });
});
