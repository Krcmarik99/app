import { scaleExp } from './units';

export type ColorId =
  | 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver';

export interface BandColor {
  id: ColorId;
  name: string;
  hex: string;
  digit?: number;
  /** Exponent násobiteľa: ×10^exp. */
  exp?: number;
  /** Tolerancia v percentách. */
  tolerance?: number;
}

export const BAND_COLORS: readonly BandColor[] = [
  { id: 'black', name: 'čierna', hex: '#1d1d1f', digit: 0, exp: 0 },
  { id: 'brown', name: 'hnedá', hex: '#7b4a26', digit: 1, exp: 1, tolerance: 1 },
  { id: 'red', name: 'červená', hex: '#d1281f', digit: 2, exp: 2, tolerance: 2 },
  { id: 'orange', name: 'oranžová', hex: '#ef7a17', digit: 3, exp: 3 },
  { id: 'yellow', name: 'žltá', hex: '#f4cf12', digit: 4, exp: 4 },
  { id: 'green', name: 'zelená', hex: '#2c9a46', digit: 5, exp: 5, tolerance: 0.5 },
  { id: 'blue', name: 'modrá', hex: '#2858cf', digit: 6, exp: 6, tolerance: 0.25 },
  { id: 'violet', name: 'fialová', hex: '#8740bf', digit: 7, exp: 7, tolerance: 0.1 },
  { id: 'grey', name: 'sivá', hex: '#8b8f94', digit: 8, exp: 8, tolerance: 0.05 },
  { id: 'white', name: 'biela', hex: '#f5f5f2', digit: 9, exp: 9 },
  { id: 'gold', name: 'zlatá', hex: '#c8a03a', exp: -1, tolerance: 5 },
  { id: 'silver', name: 'strieborná', hex: '#b8bdc3', exp: -2, tolerance: 10 },
];

export type BandRole = 'digit' | 'multiplier' | 'tolerance';

export function colorById(id: ColorId): BandColor {
  const c = BAND_COLORS.find((b) => b.id === id);
  if (!c) throw new Error(`Neznáma farba ${id}`);
  return c;
}

export function bandRoles(count: 4 | 5): BandRole[] {
  return count === 4
    ? ['digit', 'digit', 'multiplier', 'tolerance']
    : ['digit', 'digit', 'digit', 'multiplier', 'tolerance'];
}

/** Farby, ktoré dávajú zmysel na danej pozícii prúžku. */
export function colorsForBand(role: BandRole, index: number): BandColor[] {
  if (role === 'digit') return BAND_COLORS.filter((c) => c.digit !== undefined && !(index === 0 && c.digit === 0));
  if (role === 'multiplier') return BAND_COLORS.filter((c) => c.exp !== undefined);
  return BAND_COLORS.filter((c) => c.tolerance !== undefined);
}

export interface Decoded {
  ohms: number;
  tolerance: number;
}

export function decodeBands(ids: readonly ColorId[]): Decoded | null {
  if (ids.length !== 4 && ids.length !== 5) return null;
  const roles = bandRoles(ids.length);
  let digits = 0;
  let exp = 0;
  let tolerance = NaN;
  for (let i = 0; i < ids.length; i++) {
    const c = colorById(ids[i]);
    if (roles[i] === 'digit') {
      if (c.digit === undefined) return null;
      digits = digits * 10 + c.digit;
    } else if (roles[i] === 'multiplier') {
      if (c.exp === undefined) return null;
      exp = c.exp;
    } else {
      if (c.tolerance === undefined) return null;
      tolerance = c.tolerance;
    }
  }
  return { ohms: Number(scaleExp(digits, -exp).toPrecision(6)), tolerance };
}

/** Prevedie odpor na farby prúžkov. Hodnota sa zaokrúhli na 2 (4 prúžky) alebo 3 (5 prúžkov) platné číslice. */
export function encodeBands(ohms: number, count: 4 | 5, tolerance = count === 4 ? 5 : 1): { ids: ColorId[]; ohms: number } | null {
  if (!(ohms > 0) || !Number.isFinite(ohms)) return null;
  const sig = count - 2;
  let exp = Math.floor(Math.log10(ohms)) - (sig - 1);
  let digits = Math.round(scaleExp(ohms, exp));
  if (digits >= 10 ** sig) {
    digits = Math.round(digits / 10);
    exp += 1;
  }
  if (exp < -2 || exp > 9) return null;
  const digitIds = String(digits)
    .padStart(sig, '0')
    .split('')
    .map((d) => BAND_COLORS.find((c) => c.digit === Number(d))!.id);
  const multiplier = BAND_COLORS.find((c) => c.exp === exp)!.id;
  const tol = BAND_COLORS.find((c) => c.tolerance === tolerance)?.id ?? 'gold';
  const ids = [...digitIds, multiplier, tol];
  return { ids, ohms: decodeBands(ids)!.ohms };
}

export function bandNames(ids: readonly ColorId[]): string {
  return ids.map((id) => colorById(id).name).join(' – ');
}
