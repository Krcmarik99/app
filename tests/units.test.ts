import { describe, expect, it } from 'vitest';
import { fmt, fmtSci, formatSI, parseNumber, parseQuantity, siParts } from '../src/lib/units';

const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('formátovanie', () => {
  it('používa desatinnú čiarku', () => {
    expect(fmt(4.7)).toBe('4,7');
    expect(fmt(0.1 + 0.2)).toBe('0,3');
  });

  it('volí vhodnú predponu SI', () => {
    expect(plain(formatSI(0.0255, 'A'))).toBe('25,5 mA');
    expect(plain(formatSI(4700, 'Ω'))).toBe('4,7 kΩ');
    expect(plain(formatSI(2.2e-6, 'F'))).toBe('2,2 µF');
    expect(plain(formatSI(230, 'V'))).toBe('230 V');
    expect(plain(formatSI(999.96, 'Ω'))).toBe('1 kΩ');
  });

  it('rozloží hodnotu na číslo a predponu', () => {
    expect(siParts(0.00047)).toEqual({ scaled: 470, prefix: 'µ', exp: -6 });
    expect(siParts(1e6).prefix).toBe('M');
  });

  it('píše malé čísla vedecky', () => {
    expect(plain(fmtSci(8.854e-12, 4))).toBe('8,854 · 10⁻¹²');
    expect(fmtSci(12)).toBe('12');
  });
});

describe('čítanie vstupu', () => {
  it('akceptuje čiarku aj bodku', () => {
    expect(parseNumber('4,7')).toBe(4.7);
    expect(parseNumber(' 4.7 ')).toBe(4.7);
    expect(parseNumber('1 500')).toBe(1500);
    expect(parseNumber('-0,5')).toBe(-0.5);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('')).toBeNaN();
  });

  it('rozumie predponám a kódu 4k7', () => {
    expect(parseQuantity('4k7')).toBeCloseTo(4700);
    expect(parseQuantity('4,7k')).toBeCloseTo(4700);
    expect(parseQuantity('2M2')).toBeCloseTo(2.2e6);
    expect(parseQuantity('1R5')).toBeCloseTo(1.5);
    expect(parseQuantity('100n')).toBeCloseTo(1e-7);
    expect(parseQuantity('2,2 µF', 'F')).toBeCloseTo(2.2e-6);
    expect(parseQuantity('25m', 'A')).toBeCloseTo(0.025);
    expect(parseQuantity('25 mA', 'A')).toBeCloseTo(0.025);
    expect(parseQuantity('470 Ω', 'Ω')).toBe(470);
    expect(parseQuantity('1e-3')).toBeCloseTo(0.001);
    expect(parseQuantity('k')).toBeNaN();
  });
});
