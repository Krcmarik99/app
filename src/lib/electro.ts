/** Vzťahy zo základov elektrotechniky. Všetky hodnoty sú v základných jednotkách SI. */

export const EPSILON_0 = 8.854e-12; // F/m
export const MU_0 = 4 * Math.PI * 1e-7; // H/m

export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2] as const;
export const E24 = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0,
  3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1,
] as const;

export function seriesSum(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/** Výsledok paralelného spojenia rezistorov (alebo sériového spojenia kondenzátorov). */
export function reciprocalSum(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  if (values.some((v) => v === 0)) return 0;
  return 1 / values.reduce((sum, v) => sum + 1 / v, 0);
}

export function dividerOutput(uIn: number, r1: number, r2: number): number {
  return (uIn * r2) / (r1 + r2);
}

export interface OhmValues {
  U: number;
  I: number;
  R: number;
  P: number;
}

export type OhmKey = keyof OhmValues;

/** Z ľubovoľných dvoch veličín U, I, R, P dopočíta zvyšné dve. */
export function solveOhm(a: OhmKey, av: number, b: OhmKey, bv: number): OhmValues | null {
  if (a === b) return null;
  const k: Partial<OhmValues> = { [a]: av, [b]: bv };
  const { U, I, R, P } = k;
  if (U !== undefined && I !== undefined) return { U, I, R: U / I, P: U * I };
  if (U !== undefined && R !== undefined) return { U, R, I: U / R, P: (U * U) / R };
  if (U !== undefined && P !== undefined) return { U, P, I: P / U, R: (U * U) / P };
  if (I !== undefined && R !== undefined) return { I, R, U: R * I, P: R * I * I };
  if (I !== undefined && P !== undefined) return { I, P, U: P / I, R: P / (I * I) };
  if (R !== undefined && P !== undefined) return { R, P, U: Math.sqrt(P * R), I: Math.sqrt(P / R) };
  return null;
}

/** R = ρ · l / S, kde ρ je v Ω·mm²/m, l v metroch a S v mm². */
export function wireResistance(rho: number, length: number, area: number): number {
  return (rho * length) / area;
}

export function resistanceAtTemperature(r20: number, alpha: number, temperature: number): number {
  return r20 * (1 + alpha * (temperature - 20));
}

export function chargingVoltage(u: number, t: number, tau: number): number {
  return u * (1 - Math.exp(-t / tau));
}

export function dischargingVoltage(u0: number, t: number, tau: number): number {
  return u0 * Math.exp(-t / tau);
}

export function inductiveReactance(f: number, l: number): number {
  return 2 * Math.PI * f * l;
}

export function capacitiveReactance(f: number, c: number): number {
  return 1 / (2 * Math.PI * f * c);
}

export function resonanceFrequency(l: number, c: number): number {
  return 1 / (2 * Math.PI * Math.sqrt(l * c));
}

export interface RlcResult {
  XL: number;
  XC: number;
  X: number;
  Z: number;
  /** Fázový posun napätia voči prúdu v stupňoch (kladný = induktívny charakter). */
  phi: number;
  cosPhi: number;
}

/** Sériový obvod RLC. Nulová L znamená bez cievky, nulová C bez kondenzátora. */
export function seriesRlc(r: number, l: number, c: number, f: number): RlcResult {
  const XL = l > 0 ? inductiveReactance(f, l) : 0;
  const XC = c > 0 ? capacitiveReactance(f, c) : 0;
  const X = XL - XC;
  const Z = Math.hypot(r, X);
  const phi = (Math.atan2(X, r) * 180) / Math.PI;
  return { XL, XC, X, Z, phi, cosPhi: Z === 0 ? 1 : r / Z };
}

export function ledResistor(uSupply: number, uLed: number, iLed: number): number {
  return (uSupply - uLed) / iLed;
}

export type Rounding = 'nearest' | 'up' | 'down';

/** Najbližšia normalizovaná hodnota z rady E12/E24. */
export function nearestStandard(value: number, series: readonly number[] = E12, mode: Rounding = 'nearest'): number {
  if (!(value > 0) || !Number.isFinite(value)) return NaN;
  const decade = Math.floor(Math.log10(value));
  const candidates: number[] = [];
  for (let d = decade - 1; d <= decade + 1; d++) {
    for (const base of series) candidates.push(Number((base * 10 ** d).toPrecision(3)));
  }
  const tolerance = value * 1e-9;
  const pool =
    mode === 'up' ? candidates.filter((c) => c >= value - tolerance)
      : mode === 'down' ? candidates.filter((c) => c <= value + tolerance)
        : candidates;
  return pool.reduce((best, c) => (Math.abs(c - value) < Math.abs(best - value) ? c : best), pool[0]);
}
