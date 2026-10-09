import { describe, expect, it } from 'vitest';
import {
  E12, E24, chargingVoltage, dividerOutput, nearestStandard, reciprocalSum, resonanceFrequency,
  resistanceAtTemperature, seriesRlc, seriesSum, solveOhm, wireResistance,
} from '../src/lib/electro';

describe('obvodové vzťahy', () => {
  it('sériové a paralelné spájanie', () => {
    expect(seriesSum([100, 220, 330])).toBe(650);
    expect(reciprocalSum([220, 330])).toBeCloseTo(132);
    expect(reciprocalSum([300, 300, 300])).toBeCloseTo(100);
    expect(reciprocalSum([100, 0])).toBe(0);
  });

  it('delič napätia', () => {
    expect(dividerOutput(12, 10e3, 4.7e3)).toBeCloseTo(3.837, 3);
  });

  it('Ohmov zákon z ľubovoľnej dvojice', () => {
    const ref = { U: 12, I: 0.024, R: 500, P: 0.288 };
    const keys = ['U', 'I', 'R', 'P'] as const;
    for (const a of keys) {
      for (const b of keys) {
        if (a === b) continue;
        const r = solveOhm(a, ref[a], b, ref[b])!;
        for (const k of keys) expect(r[k]).toBeCloseTo(ref[k], 6);
      }
    }
    expect(solveOhm('U', 1, 'U', 2)).toBeNull();
  });

  it('odpor vodiča a teplota', () => {
    expect(wireResistance(0.0178, 50, 1.5)).toBeCloseTo(0.5933, 4);
    expect(resistanceAtTemperature(12, 0.0039, 80)).toBeCloseTo(14.808, 3);
  });

  it('nabíjanie kondenzátora', () => {
    expect(chargingVoltage(10, 1, 1)).toBeCloseTo(6.321, 3);
  });

  it('sériový obvod RLC zodpovedá príkladu z lekcie', () => {
    const r = seriesRlc(40, 0.1, 47e-6, 50);
    expect(r.XL).toBeCloseTo(31.42, 2);
    expect(r.XC).toBeCloseTo(67.73, 1);
    expect(r.Z).toBeCloseTo(54.02, 1);
    expect(r.cosPhi).toBeCloseTo(0.74, 2);
    expect(r.phi).toBeLessThan(0);
  });

  it('pri rezonancii sa reaktancie vyrušia', () => {
    const f0 = resonanceFrequency(0.01, 1e-6);
    const r = seriesRlc(10, 0.01, 1e-6, f0);
    expect(r.Z).toBeCloseTo(10, 6);
  });

  it('normalizované rady', () => {
    expect(E12).toHaveLength(12);
    expect(E24).toHaveLength(24);
    expect(nearestStandard(196, E12, 'up')).toBe(220);
    expect(nearestStandard(196, E12, 'down')).toBe(180);
    expect(nearestStandard(4600, E12)).toBe(4700);
    expect(nearestStandard(1000, E12, 'up')).toBe(1000);
    expect(nearestStandard(9.5, E12, 'up')).toBe(10);
  });
});
