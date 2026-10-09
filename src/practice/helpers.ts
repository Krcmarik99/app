/**
 * Spoločné pomôcky pre generátory príkladov: formátovanie hodnôt do textu
 * a vytvorenie číselnej otázky s automatickou voľbou predpony.
 */
import { E12 } from '../lib/electro';
import { pick, type Rng } from '../lib/random';
import { fmt, formatBase, formatSI, scaleExp, siParts } from '../lib/units';
import type { FigureFn, NumericQuestion, Question } from './types';

export type Generator = (rng: Rng) => Question;

/** Hodnota s predponou: 4,7 kΩ. */
export const q = (v: number, unit: string, sig = 3) => formatSI(v, unit, sig);
/** Hodnota v základnej jednotke: 0,0047 A. */
export const b = (v: number, unit: string, sig = 4) => formatBase(v, unit, sig);
export const n = (v: number, sig = 4) => fmt(v, sig);
export const round3 = (x: number) => Number(x.toPrecision(3));

/** Výsledok v základnej jednotke aj s predponou, ak sa líšia: „0,0255 A = **25,5 mA**“. */
export function res(v: number, unit: string): string {
  const base = b(v, unit, 3);
  const pref = q(v, unit);
  return base === pref ? `**${pref}**` : `${base} = **${pref}**`;
}

export function e12(rng: Rng, decades: readonly number[]): number {
  return round3(pick(rng, E12) * pick(rng, decades));
}

export interface NumericOptions {
  figure?: FigureFn;
  /** Výsledok sa zadáva presne v tejto jednotke (bez automatickej predpony). */
  fixedUnit?: boolean;
  tolerance?: number;
}

export function numeric(
  lessonId: string,
  prompt: string,
  valueSI: number,
  baseUnit: string,
  solution: string[],
  opts: NumericOptions = {},
): NumericQuestion {
  let unit = baseUnit;
  let answer = valueSI;
  if (!opts.fixedUnit) {
    const { exp, prefix } = siParts(valueSI, 3);
    unit = prefix + baseUnit;
    answer = scaleExp(valueSI, exp);
  }
  return {
    kind: 'numeric', lessonId, prompt, figure: opts.figure, unit, answer,
    tolerance: opts.tolerance ?? 0.02, solution, autoUnit: !opts.fixedUnit,
  };
}

export function hoursText(h: number): string {
  if (h < 1) return `${n(h * 60)} minút`;
  if (h === 1) return '1 hodinu';
  if (h < 5) return `${n(h)} hodiny`;
  return `${n(h)} hodín`;
}
