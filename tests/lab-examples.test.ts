import { describe, expect, it } from 'vitest';
import { Simulator, meterReading } from '../src/lab/engine';
import { EXAMPLES, exampleById } from '../src/lab/examples';
import { buildNets } from '../src/lab/netlist';
import type { Circuit, Part } from '../src/lab/parts';

function run(sim: Simulator, seconds: number, chunk = 0.01): void {
  for (let t = 0; t < seconds - 1e-12; t += chunk) sim.advance(Math.min(chunk, seconds - t), 100000);
}

function load(id: string): { circuit: Circuit; byName: (n: string) => Part } {
  const circuit = exampleById(id)!.build();
  return { circuit, byName: (n) => circuit.parts.find((p) => p.name === n)! };
}

const show = (sim: Simulator, part: Part) => meterReading(part, sim.states.get(part.id)!, sim.hasAC)!.value!;

/** Prepne spínače a pokračuje v simulácii so zachovaným nabitím kondenzátorov. */
function toggle(sim: Simulator, circuit: Circuit, on: boolean): Simulator {
  circuit.parts.filter((p) => p.kind === 'switch').forEach((p) => { p.props.on = on; });
  return new Simulator(circuit, sim.exportState());
}

describe('ukážkové zapojenia', () => {
  it('sú celé pospájané a simulujú sa bez chyby', () => {
    for (const ex of EXAMPLES) {
      const circuit = ex.build();
      expect(buildNets(circuit).openTerminals, ex.id).toEqual([]);
      const sim = new Simulator(circuit);
      run(sim, 0.2);
      expect(sim.error, ex.id).toBeNull();
    }
  });

  it('LED s predradným rezistorom', () => {
    const { circuit, byName } = load('led');
    const sim = new Simulator(circuit);
    run(sim, 0.05);
    expect(show(sim, byName('A1'))).toBeGreaterThan(0.0175);
    expect(show(sim, byName('A1'))).toBeLessThan(0.0185);
    expect(show(sim, byName('V1'))).toBeGreaterThan(1.9);
    expect(sim.warnings()).toEqual([]);
  });

  it('žiarovky v sérii svietia slabšie ako samostatná', () => {
    const { circuit, byName } = load('lamps');
    const sim = new Simulator(circuit);
    run(sim, 0.05);
    const p = (n: string) => sim.states.get(byName(n).id)!.p;
    expect(p('Ž1')).toBeCloseTo(1.25, 1);
    expect(p('Ž2')).toBeCloseTo(1.25, 1);
    expect(p('Ž3')).toBeCloseTo(5, 0);
    expect(show(sim, byName('A1'))).toBeCloseTo(5 / 12, 2);
    expect(sim.warnings()).toEqual([]);
  });

  it('kondenzátor sa po zapnutí spínača nabíja', () => {
    const { circuit, byName } = load('rc');
    let sim = new Simulator(circuit);
    run(sim, 0.2);
    expect(show(sim, byName('V1'))).toBeCloseTo(0, 3);
    sim = toggle(sim, circuit, true);
    run(sim, 0.5, 0.005);
    expect(show(sim, byName('V1'))).toBeCloseTo(5 * (1 - Math.exp(-1)), 1);
    sim = toggle(sim, circuit, false);
    run(sim, 1, 0.005);
    expect(show(sim, byName('V1'))).toBeCloseTo(5 * (1 - Math.exp(-1)) * Math.exp(-1), 1);
  });

  it('tranzistor zosilňuje prúd bázy', () => {
    const { circuit, byName } = load('bjt');
    let sim = new Simulator(circuit);
    run(sim, 0.05);
    expect(Math.abs(show(sim, byName('A2')))).toBeLessThan(1e-6);
    sim = toggle(sim, circuit, true);
    run(sim, 0.05);
    const ib = show(sim, byName('A1'));
    const ic = show(sim, byName('A2'));
    expect(ib).toBeGreaterThan(70e-6);
    expect(ic / ib).toBeCloseTo(100, -1);
    expect(sim.warnings()).toEqual([]);
  });

  it('MOSFET spína LED', () => {
    const { circuit, byName } = load('mosfet');
    let sim = new Simulator(circuit);
    run(sim, 0.05);
    expect(Math.abs(sim.states.get(byName('LED1').id)!.i)).toBeLessThan(1e-6);
    sim = toggle(sim, circuit, true);
    run(sim, 0.05);
    expect(show(sim, byName('V1'))).toBeCloseTo(12, 1);
    const i = sim.states.get(byName('LED1').id)!.i;
    expect(i).toBeGreaterThan(0.014);
    expect(i).toBeLessThan(0.02);
    expect(sim.warnings()).toEqual([]);
  });

  it('RC člen v striedavom obvode', () => {
    const { circuit, byName } = load('ac-rc');
    const sim = new Simulator(circuit);
    run(sim, 0.5);
    const xc = 1 / (2 * Math.PI * 50 * 2.2e-6);
    const expected = (10 * xc) / Math.hypot(1000, xc);
    expect(Math.abs(show(sim, byName('V1')) - expected) / expected).toBeLessThan(0.002);
  });

  it('usmerňovač dáva vyhladené jednosmerné napätie', () => {
    const { circuit, byName } = load('rectifier');
    const sim = new Simulator(circuit);
    run(sim, 0.6);
    const u = show(sim, byName('V1'));
    expect(u).toBeGreaterThan(14.5);
    expect(u).toBeLessThan(16.6);
    expect(sim.warnings()).toEqual([]);
  });

  it('wattmeter ukazuje rovnaký výkon ako súčin U · I', () => {
    const { circuit, byName } = load('watt');
    const sim = new Simulator(circuit);
    run(sim, 0.05);
    const p = show(sim, byName('W1'));
    expect(p).toBeCloseTo(show(sim, byName('V1')) * show(sim, byName('A1')), 2);
    expect(p).toBeCloseTo(1.44, 2);
  });
});
