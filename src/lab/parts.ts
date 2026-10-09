/**
 * Katalóg súčiastok a meracích prístrojov pre zapájanie obvodov: názvy, vývody,
 * nastaviteľné parametre a predvolené hodnoty. Súradnice sú v políčkach mriežky.
 */
import { LED_COLORS } from '../lib/electro';

export type PartKind =
  | 'resistor' | 'lamp' | 'capacitor' | 'ecap' | 'inductor' | 'diode' | 'led' | 'bjt' | 'mosfet'
  | 'dc' | 'ac' | 'switch'
  | 'ammeter' | 'voltmeter' | 'multimeter' | 'wattmeter' | 'scope';

export type Pt = [number, number];
export type Rot = 0 | 1 | 2 | 3;
export type PropValue = number | string | boolean;

export interface Part {
  id: string;
  kind: PartKind;
  /** Označenie v schéme, napr. R1. */
  name: string;
  /** Poloha prvého vývodu v políčkach mriežky. */
  x: number;
  y: number;
  /** Otočenie o 90° v smere hodinových ručičiek. */
  rot: Rot;
  props: Record<string, PropValue>;
}

export interface Wire {
  id: string;
  a: Pt;
  b: Pt;
}

export interface Circuit {
  parts: Part[];
  wires: Wire[];
}

export interface PropDef {
  key: string;
  label: string;
  /** Číselná hodnota s jednotkou (dá sa písať s predponami: 4k7, 100µ). */
  unit?: string;
  min?: number;
  max?: number;
  options?: [string, string][];
  hint?: string;
}

export interface KindInfo {
  name: string;
  prefix: string;
  /** Vývody v políčkach mriežky pri otočení 0. */
  terminals: Pt[];
  terminalNames: string[];
  props: PropDef[];
  defaults: Record<string, PropValue>;
}

const TWO: Pt[] = [[0, 0], [3, 0]];

export const LED_OPTIONS: [string, string][] = LED_COLORS.map(([id, name]) => [id, name]);
export const MULTIMETER_MODES: [string, string][] = [
  ['V=', 'V⎓ jednosmerné napätie'], ['V~', 'V~ striedavé napätie'],
  ['A=', 'A⎓ jednosmerný prúd'], ['A~', 'A~ striedavý prúd'], ['ohm', 'Ω odpor'],
];
const METER_MODES: [string, string][] = [['DC', 'jednosmerné (⎓)'], ['AC', 'striedavé (~), efektívna hodnota']];
export const TIME_DIVS = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
export const VOLT_DIVS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];

export const KINDS: Record<PartKind, KindInfo> = {
  resistor: {
    name: 'Rezistor', prefix: 'R', terminals: TWO, terminalNames: ['1', '2'],
    props: [
      { key: 'R', label: 'Odpor', unit: 'Ω', min: 1e-3, max: 1e9 },
      { key: 'pmax', label: 'Dovolené zaťaženie', options: [['0.125', '0,125 W'], ['0.25', '0,25 W'], ['0.6', '0,6 W'], ['1', '1 W'], ['2', '2 W'], ['5', '5 W']] },
    ],
    defaults: { R: 1000, pmax: '0.25' },
  },
  lamp: {
    name: 'Žiarovka', prefix: 'Ž', terminals: TWO, terminalNames: ['1', '2'],
    props: [
      { key: 'U', label: 'Menovité napätie', unit: 'V', min: 0.5, max: 1000 },
      { key: 'P', label: 'Menovitý výkon', unit: 'W', min: 0.01, max: 5000 },
    ],
    defaults: { U: 12, P: 5 },
  },
  capacitor: {
    name: 'Kondenzátor', prefix: 'C', terminals: TWO, terminalNames: ['1', '2'],
    props: [{ key: 'C', label: 'Kapacita', unit: 'F', min: 1e-12, max: 10 }],
    defaults: { C: 10e-6 },
  },
  ecap: {
    name: 'Elektrolytický kondenzátor', prefix: 'C', terminals: TWO, terminalNames: ['+', '−'],
    props: [
      { key: 'C', label: 'Kapacita', unit: 'F', min: 1e-9, max: 10 },
      { key: 'umax', label: 'Menovité napätie', options: ['6.3', '10', '16', '25', '35', '50', '63', '100', '400'].map((v) => [v, `${v.replace('.', ',')} V`]) },
    ],
    defaults: { C: 470e-6, umax: '25' },
  },
  inductor: {
    name: 'Cievka', prefix: 'L', terminals: TWO, terminalNames: ['1', '2'],
    props: [{ key: 'L', label: 'Indukčnosť', unit: 'H', min: 1e-9, max: 100 }],
    defaults: { L: 0.1 },
  },
  diode: {
    name: 'Dióda', prefix: 'D', terminals: TWO, terminalNames: ['A', 'K'],
    props: [],
    defaults: {},
  },
  led: {
    name: 'LED dióda', prefix: 'LED', terminals: TWO, terminalNames: ['A', 'K'],
    props: [{ key: 'color', label: 'Farba', options: LED_OPTIONS }],
    defaults: { color: 'red' },
  },
  bjt: {
    name: 'Tranzistor', prefix: 'T', terminals: [[0, 0], [2, -2], [2, 2]], terminalNames: ['B', 'C', 'E'],
    props: [
      { key: 'type', label: 'Typ', options: [['npn', 'NPN'], ['pnp', 'PNP']] },
      { key: 'beta', label: 'Zosilňovací činiteľ h21E', min: 10, max: 1000, hint: 'Koľkokrát je prúd kolektora väčší ako prúd bázy.' },
    ],
    defaults: { type: 'npn', beta: 100 },
  },
  mosfet: {
    name: 'MOSFET', prefix: 'T', terminals: [[0, 0], [2, -2], [2, 2]], terminalNames: ['G', 'D', 'S'],
    props: [
      { key: 'type', label: 'Kanál', options: [['n', 'N (otvára sa kladným U_GS)'], ['p', 'P (otvára sa záporným U_GS)']] },
      { key: 'uth', label: 'Prahové napätie U_GS(th)', unit: 'V', min: 0.3, max: 10 },
    ],
    defaults: { type: 'n', uth: 2 },
  },
  dc: {
    name: 'Jednosmerný zdroj', prefix: 'Z', terminals: TWO, terminalNames: ['+', '−'],
    props: [{ key: 'U', label: 'Napätie', unit: 'V', min: 0, max: 1000 }],
    defaults: { U: 12 },
  },
  ac: {
    name: 'Striedavý zdroj', prefix: 'Z', terminals: TWO, terminalNames: ['1', '2'],
    props: [
      { key: 'U', label: 'Efektívne napätie', unit: 'V', min: 0, max: 1000, hint: 'Amplitúda je √2-krát väčšia.' },
      { key: 'f', label: 'Frekvencia', unit: 'Hz', min: 0.1, max: 100000 },
    ],
    defaults: { U: 10, f: 50 },
  },
  switch: {
    name: 'Spínač', prefix: 'S', terminals: TWO, terminalNames: ['1', '2'],
    props: [],
    defaults: { on: false },
  },
  ammeter: {
    name: 'Ampérmeter', prefix: 'A', terminals: TWO, terminalNames: ['+', '−'],
    props: [{ key: 'mode', label: 'Meria', options: METER_MODES }],
    defaults: { mode: 'DC' },
  },
  voltmeter: {
    name: 'Voltmeter', prefix: 'V', terminals: TWO, terminalNames: ['+', '−'],
    props: [{ key: 'mode', label: 'Meria', options: METER_MODES }],
    defaults: { mode: 'DC' },
  },
  multimeter: {
    name: 'Multimeter', prefix: 'MM', terminals: TWO, terminalNames: ['V/A/Ω', 'COM'],
    props: [{ key: 'mode', label: 'Funkcia', options: MULTIMETER_MODES }],
    defaults: { mode: 'V=' },
  },
  wattmeter: {
    name: 'Wattmeter', prefix: 'W', terminals: [[0, 0], [4, 0], [2, -2], [2, 2]], terminalNames: ['I*', 'I', 'U*', 'U'],
    props: [],
    defaults: {},
  },
  scope: {
    name: 'Osciloskop', prefix: 'OSC', terminals: [[0, 0], [0, 1], [0, 2]], terminalNames: ['CH1', 'CH2', '⏚'],
    props: [
      { key: 'tdiv', label: 'Čas na dielik', options: TIME_DIVS.map((t) => [String(t), formatDiv(t, 's')]) },
      { key: 'v1', label: 'CH1 – napätie na dielik', options: [['auto', 'automaticky'], ...VOLT_DIVS.map((v): [string, string] => [String(v), formatDiv(v, 'V')])] },
      { key: 'v2', label: 'CH2 – napätie na dielik', options: [['auto', 'automaticky'], ...VOLT_DIVS.map((v): [string, string] => [String(v), formatDiv(v, 'V')])] },
    ],
    defaults: { tdiv: '0.005', v1: 'auto', v2: 'auto' },
  },
};

function formatDiv(x: number, unit: string): string {
  const [scaled, prefix] = x >= 1 ? [x, ''] : x >= 1e-3 ? [x * 1e3, 'm'] : [x * 1e6, 'µ'];
  return `${String(Number(scaled.toPrecision(3))).replace('.', ',')} ${prefix}${unit}/d`;
}

/** Položky palety: druh súčiastky a prípadne prednastavené parametre (NPN/PNP, N/P kanál). */
export interface PaletteItem {
  id: string;
  kind: PartKind;
  label: string;
  props?: Record<string, PropValue>;
}

export const PALETTE: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'Meracie prístroje',
    items: [
      { id: 'ammeter', kind: 'ammeter', label: 'Ampérmeter' },
      { id: 'voltmeter', kind: 'voltmeter', label: 'Voltmeter' },
      { id: 'multimeter', kind: 'multimeter', label: 'Multimeter' },
      { id: 'wattmeter', kind: 'wattmeter', label: 'Wattmeter' },
      { id: 'scope', kind: 'scope', label: 'Osciloskop' },
    ],
  },
  {
    title: 'Zdroje a spínače',
    items: [
      { id: 'dc', kind: 'dc', label: 'Zdroj DC' },
      { id: 'ac', kind: 'ac', label: 'Zdroj AC' },
      { id: 'switch', kind: 'switch', label: 'Spínač' },
    ],
  },
  {
    title: 'Súčiastky',
    items: [
      { id: 'resistor', kind: 'resistor', label: 'Rezistor' },
      { id: 'lamp', kind: 'lamp', label: 'Žiarovka' },
      { id: 'capacitor', kind: 'capacitor', label: 'Kondenzátor' },
      { id: 'ecap', kind: 'ecap', label: 'Elektrolytický kondenzátor' },
      { id: 'inductor', kind: 'inductor', label: 'Cievka' },
      { id: 'diode', kind: 'diode', label: 'Dióda' },
      { id: 'led', kind: 'led', label: 'LED dióda' },
      { id: 'npn', kind: 'bjt', label: 'Tranzistor NPN', props: { type: 'npn' } },
      { id: 'pnp', kind: 'bjt', label: 'Tranzistor PNP', props: { type: 'pnp' } },
      { id: 'nmos', kind: 'mosfet', label: 'MOSFET N', props: { type: 'n' } },
      { id: 'pmos', kind: 'mosfet', label: 'MOSFET P', props: { type: 'p' } },
    ],
  },
];

/** Otočí bod (v políčkach) o `rot` × 90° okolo počiatku. */
export function rotate([x, y]: Pt, rot: Rot): Pt {
  switch (rot) {
    case 0: return [x, y];
    case 1: return [-y, x];
    case 2: return [-x, -y];
    case 3: return [y, -x];
  }
}

/** Polohy vývodov súčiastky v mriežke. */
export function terminalsOf(part: Pick<Part, 'kind' | 'x' | 'y' | 'rot'>): Pt[] {
  return KINDS[part.kind].terminals.map((t) => {
    const [dx, dy] = rotate(t, part.rot);
    return [part.x + dx, part.y + dy];
  });
}

export function displayName(part: Part): string {
  if (part.kind === 'bjt') return `Tranzistor ${part.props.type === 'pnp' ? 'PNP' : 'NPN'}`;
  if (part.kind === 'mosfet') return `MOSFET s kanálom ${part.props.type === 'p' ? 'P' : 'N'}`;
  return KINDS[part.kind].name;
}

/** Najbližšie voľné označenie pre daný druh, napr. R3. */
export function nextName(circuit: Circuit, kind: PartKind): string {
  const prefix = KINDS[kind].prefix;
  const used = new Set(circuit.parts.map((p) => p.name));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createPart(circuit: Circuit, kind: PartKind, x: number, y: number, props: Record<string, PropValue> = {}, rot: Rot = 0): Part {
  return { id: newId('p'), kind, name: nextName(circuit, kind), x, y, rot, props: { ...KINDS[kind].defaults, ...props } };
}

export const num = (v: PropValue | undefined, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

/** Načíta obvod z uloženého JSON-u a zahodí poškodené položky. */
export function parseCircuit(raw: unknown): Circuit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { parts?: unknown; wires?: unknown };
  if (!Array.isArray(r.parts) || !Array.isArray(r.wires)) return null;
  const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n));
  const parts = r.parts.filter((p): p is Part => {
    const q = p as Partial<Part> | null;
    return !!q && typeof q.id === 'string' && typeof q.kind === 'string' && q.kind in KINDS
      && Number.isInteger(q.x) && Number.isInteger(q.y) && [0, 1, 2, 3].includes(q.rot as number)
      && typeof q.name === 'string' && !!q.props && typeof q.props === 'object';
  }).map((p) => ({ ...p, props: { ...KINDS[p.kind].defaults, ...p.props } }));
  const wires = r.wires.filter((w): w is Wire => {
    const q = w as Partial<Wire> | null;
    return !!q && typeof q.id === 'string' && isPt(q.a) && isPt(q.b);
  });
  return { parts, wires };
}
