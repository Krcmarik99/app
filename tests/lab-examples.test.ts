import { describe, expect, it } from 'vitest';
import { Simulator, meterReading } from '../src/lab/engine';
import { DEMO_FOR, EXAMPLES, exampleById } from '../src/lab/examples';
import { PALETTE } from '../src/lab/parts';
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

  it('každá súčiastka a prístroj má ukážku zapojenia, v ktorej naozaj je', () => {
    for (const item of PALETTE.flatMap((g) => g.items)) {
      const ex = exampleById(DEMO_FOR[item.id]);
      expect(ex, item.id).toBeDefined();
      const parts = ex!.build().parts;
      const has = parts.some((p) => p.kind === item.kind && Object.entries(item.props ?? {}).every(([k, v]) => p.props[k] === v));
      expect(has, `${item.id} v ukážke ${ex!.id}`).toBe(true);
    }
  });

  it('spínač zapne žiarovku', () => {
    const { circuit, byName } = load('switch');
    let sim = new Simulator(circuit);
    run(sim, 0.05);
    expect(Math.abs(show(sim, byName('A1')))).toBeLessThan(1e-6);
    sim = toggle(sim, circuit, true);
    run(sim, 0.05);
    expect(sim.states.get(byName('Ž1').id)!.p).toBeCloseTo(5, 0);
  });

  it('delič napätia: U1 + U2 = U a rovnaký prúd', () => {
    const { circuit, byName } = load('divider');
    const sim = new Simulator(circuit);
    run(sim, 0.05);
    expect(show(sim, byName('A1'))).toBeCloseTo(0.004, 4);
    expect(show(sim, byName('V1'))).toBeCloseTo(4, 2);
    expect(show(sim, byName('V2'))).toBeCloseTo(8, 2);
  });

  it('prúd cievkou narastá s časovou konštantou L/R', () => {
    const { circuit, byName } = load('rl');
    let sim = new Simulator(circuit);
    run(sim, 0.05);
    sim = toggle(sim, circuit, true);
    const tau = 2 / 10.11;
    run(sim, tau, 0.002);
    const iFinal = 6 / 10.11;
    expect(show(sim, byName('A1'))).toBeCloseTo(iFinal * (1 - Math.exp(-1)), 2);
    run(sim, 2, 0.01);
    expect(show(sim, byName('A1'))).toBeCloseTo(iFinal, 2);
    expect(sim.warnings()).toEqual([]);
    sim = toggle(sim, circuit, false);
    run(sim, 0.05, 0.002);
    // Po vypnutí prúd cievky preberie nulová dióda a napätie na cievke ostane malé.
    expect(sim.states.get(byName('D1').id)!.i).toBeGreaterThan(0.4);
    expect(Math.abs(sim.states.get(byName('L1').id)!.u)).toBeLessThan(1.5);
  });

  it('tranzistor PNP a MOSFET P spínajú plusovú vetvu', () => {
    for (const id of ['pnp', 'pmos']) {
      const { circuit, byName } = load(id);
      let sim = new Simulator(circuit);
      run(sim, 0.05);
      expect(Math.abs(sim.states.get(byName('LED1').id)!.i), id).toBeLessThan(1e-9);
      sim = toggle(sim, circuit, true);
      run(sim, 0.05);
      const i = sim.states.get(byName('LED1').id)!.i;
      expect(i, id).toBeGreaterThan(0.012);
      expect(i, id).toBeLessThan(0.02);
      expect(sim.warnings(), id).toEqual([]);
    }
  });

  it('multimeter meria prúd, napätie aj odpor', () => {
    const { circuit, byName } = load('multimeter');
    const sim = new Simulator(circuit);
    run(sim, 0.05);
    const i = 9 / (470 + 1000 + 0.11);
    expect(show(sim, byName('MM1'))).toBeCloseTo(i, 5);
    expect(show(sim, byName('MM2'))).toBeCloseTo(i * 1000, 2);
    expect(show(sim, byName('MM3'))).toBeCloseTo(4700, -1);
  });
});
