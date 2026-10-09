import { describe, expect, it } from 'vitest';
import { decodeBands, encodeBands } from '../src/lib/colorcode';

describe('farebný kód', () => {
  it('prečíta štvorprúžkový rezistor', () => {
    expect(decodeBands(['yellow', 'violet', 'red', 'gold'])).toEqual({ ohms: 4700, tolerance: 5 });
    expect(decodeBands(['brown', 'black', 'orange', 'gold'])).toEqual({ ohms: 10000, tolerance: 5 });
    expect(decodeBands(['red', 'red', 'brown', 'gold'])).toEqual({ ohms: 220, tolerance: 5 });
  });

  it('prečíta päťprúžkový rezistor a zlomkový násobiteľ', () => {
    expect(decodeBands(['brown', 'black', 'black', 'brown', 'brown'])).toEqual({ ohms: 1000, tolerance: 1 });
    expect(decodeBands(['yellow', 'violet', 'gold', 'gold'])).toEqual({ ohms: 4.7, tolerance: 5 });
  });

  it('odmietne neplatné farby', () => {
    expect(decodeBands(['gold', 'violet', 'red', 'gold'])).toBeNull();
    expect(decodeBands(['yellow', 'violet', 'red', 'orange'])).toBeNull();
  });

  it('kódovanie a dekódovanie sú navzájom inverzné', () => {
    for (const ohms of [1, 4.7, 10, 47, 100, 220, 330, 1000, 4700, 22000, 680000, 1e6, 8.2e6]) {
      const enc = encodeBands(ohms, 4)!;
      expect(enc.ohms).toBeCloseTo(ohms, 6);
      expect(decodeBands(enc.ids)!.ohms).toBeCloseTo(ohms, 6);
    }
    expect(encodeBands(4990, 5, 1)!.ids).toEqual(['yellow', 'white', 'white', 'brown', 'brown']);
  });

  it('zaokrúhli hodnotu na platné číslice', () => {
    expect(encodeBands(4730, 4)!.ohms).toBe(4700);
    expect(encodeBands(996, 4)!.ohms).toBe(1000);
    expect(encodeBands(0, 4)).toBeNull();
  });
});
