/**
 * Formátovanie a čítanie fyzikálnych hodnôt v slovenskom zápise:
 * desatinná čiarka, medzera medzi tisícami, nezalomiteľná medzera pred jednotkou.
 */

const NBSP = ' ';
const formatters = new Map<string, Intl.NumberFormat>();

function numberFormat(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('sk-SK', options);
    formatters.set(key, f);
  }
  return f;
}

export function roundSig(x: number, sig: number): number {
  return x === 0 || !Number.isFinite(x) ? x : Number(x.toPrecision(sig));
}

/** Číslo zaokrúhlené na `sig` platných číslic, napr. 4,7 alebo 1 500. */
export function fmt(value: number, sig = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-15) value = 0;
  return numberFormat(`s${sig}`, { maximumSignificantDigits: sig }).format(value);
}

/** Číslo s pevným počtom desatinných miest, napr. 2,59 (eurá). */
export function fmtFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormat(`f${digits}`, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

const PREFIX: Record<number, string> = {
  12: 'T', 9: 'G', 6: 'M', 3: 'k', 0: '', [-3]: 'm', [-6]: 'µ', [-9]: 'n', [-12]: 'p',
};

/** Vydelí hodnotu 10^exp tak, aby sa čo najmenej stratila presnosť. */
export function scaleExp(value: number, exp: number): number {
  return exp >= 0 ? value / 10 ** exp : value * 10 ** -exp;
}

/** Rozloží hodnotu na číslo a predponu SI tak, aby číslo bolo v rozsahu 1 až 999. */
export function siParts(value: number, sig = 3): { scaled: number; prefix: string; exp: number } {
  if (!Number.isFinite(value) || value === 0) return { scaled: value, prefix: '', exp: 0 };
  let exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  exp = Math.min(12, Math.max(-12, exp));
  let scaled = roundSig(scaleExp(value, exp), sig);
  if (Math.abs(scaled) >= 1000 && exp < 12) {
    exp += 3;
    scaled = roundSig(scaleExp(value, exp), sig);
  } else if (Math.abs(scaled) < 1 && exp > -12) {
    exp -= 3;
    scaled = roundSig(scaleExp(value, exp), sig);
  }
  return { scaled, prefix: PREFIX[exp], exp };
}

/** 0,0255 A → „25,5 mA“, 4700 Ω → „4,7 kΩ“. */
export function formatSI(value: number, unit: string, sig = 3): string {
  if (!Number.isFinite(value)) return '—';
  const { scaled, prefix } = siParts(value, sig);
  return `${fmt(scaled, sig)}${NBSP}${prefix}${unit}`;
}

/** Hodnota v základnej jednotke bez predpony, napr. „0,0255 A“. */
export function formatBase(value: number, unit: string, sig = 4): string {
  return unit ? `${fmt(value, sig)}${NBSP}${unit}` : fmt(value, sig);
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

export function superscript(n: number | string): string {
  return String(n).split('').map((c) => SUPERSCRIPT[c] ?? c).join('');
}

/** Vedecký zápis pre veľmi malé a veľké čísla: 8,854 · 10⁻¹². */
export function fmtSci(value: number, sig = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(value)));
  if (e >= -3 && e <= 5) return fmt(value, sig);
  const mantissa = roundSig(scaleExp(value, e), sig);
  return `${fmt(mantissa, sig)} · 10${superscript(e)}`;
}

/** Číslo, ktoré zadal používateľ: akceptuje desatinnú čiarku aj bodku a medzery. */
export function parseNumber(raw: string): number {
  const s = raw.trim().replace(/[\s  ]/g, '').replace(',', '.').replace('−', '-');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

const PREFIX_EXP: Record<string, number> = {
  p: -12, n: -9, u: -6, 'µ': -6, 'μ': -6, m: -3, k: 3, K: 3, M: 6, G: 9, T: 12,
};

function applyExp(base: number, exp: number): number {
  return exp >= 0 ? base * 10 ** exp : base / 10 ** -exp;
}

/**
 * Hodnota s predponou: „4,7k“, „4k7“, „2,2 µF“, „100m“, „1e-3“.
 * Ak je zadaná jednotka, môže byť na konci vstupu a ignoruje sa.
 */
export function parseQuantity(raw: string, unit = ''): number {
  let s = raw.trim().replace(/[\s  ]/g, '').replace(/,/g, '.').replace(/−/g, '-');
  if (unit) {
    const units = unit === 'Ω' ? ['Ω', 'ohmov', 'ohm', 'Ohm'] : [unit];
    for (const u of units) {
      if (s.endsWith(u) && s.length > u.length) {
        s = s.slice(0, -u.length);
        break;
      }
    }
  }
  if (!s) return NaN;
  const rkm = /^(\d+)([pnuµμmkKMGTR])(\d+)$/.exec(s);
  if (rkm) {
    const exp = rkm[2] === 'R' ? 0 : PREFIX_EXP[rkm[2]];
    return applyExp(Number(`${rkm[1]}.${rkm[3]}`), exp);
  }
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([pnuµμmkKMGT])?$/.exec(s);
  if (!m) return NaN;
  const base = Number(m[1]);
  return m[2] ? applyExp(base, PREFIX_EXP[m[2]]) : base;
}
