/**
 * Simulácia zapojeného obvodu. Uzlová metóda (MNA): každý prvok prispeje vodivosťou a prúdom
 * do sústavy G · u = i. Nelineárne prvky (diódy, tranzistory) sa riešia Newtonovou iteráciou,
 * kondenzátory a cievky časovým krokom metódou BDF2 (Gear), ktorá je presná aj stabilná.
 */
import { LED_COLORS } from '../lib/electro';
import { buildNets, type Nets } from './netlist';
import { num, type Circuit, type Part } from './parts';

export const VT = 0.025852;
const GMIN = 1e-12;
const R_SOURCE = 0.1;
export const R_AMMETER = 0.01;
export const R_VOLTMETER = 1e7;
const R_SWITCH = 1e-3;
const R_SCOPE = 1e6;
const OHM_TEST_I = 1e-6;
const MOS_K = 0.1;
const MOS_LAMBDA = 0.02;
const BJT_IS = 1e-14;
const BJT_BR = 1;
const DIODE_IS = 5e-10;
const DIODE_N = 1.5;
const LED_N = 2;
export const LED_MAX = 0.02;
const DIODE_MAX = 1;
const BJT_MAX = 0.5;
const MOS_MAX = 1;
const SOURCE_MAX = 5;
export const AMMETER_MAX = 10;
export const VOLTMETER_MAX = 1000;
const MAX_ITER = 100;

/** e^x s lineárnym pokračovaním nad x = 80, aby výpočet nepretiekol. */
function safeExp(x: number): number {
  return x > 80 ? Math.exp(80) * (1 + x - 80) : Math.exp(x);
}

/** Obmedzenie zmeny napätia na PN priechode medzi iteráciami (ako v SPICE). */
function pnjlim(vnew: number, vold: number, vt: number, vcrit: number): number {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

const vcritOf = (is: number, vt: number) => vt * Math.log(vt / (Math.SQRT2 * is));

/** Sústava rovníc G · u = i pre uzly okrem referenčného. */
class System {
  readonly m: number;
  readonly A: Float64Array;
  readonly b: Float64Array;

  constructor(private readonly row: Int32Array, m: number) {
    this.m = m;
    this.A = new Float64Array(m * m);
    this.b = new Float64Array(m);
  }

  clear(): void {
    this.A.fill(0);
    this.b.fill(0);
    for (let i = 0; i < this.m; i++) this.A[i * this.m + i] = GMIN;
  }

  private add(r: number, c: number, v: number): void {
    if (r >= 0 && c >= 0) this.A[r * this.m + c] += v;
  }

  /** Vodivosť g medzi uzlami a, b. */
  conductance(a: number, b: number, g: number): void {
    const ra = this.row[a];
    const rb = this.row[b];
    this.add(ra, ra, g);
    this.add(rb, rb, g);
    this.add(ra, rb, -g);
    this.add(rb, ra, -g);
  }

  /** Stály prúd i, ktorý prvok odoberá z uzla a a vracia do uzla b. */
  current(a: number, b: number, i: number): void {
    const ra = this.row[a];
    const rb = this.row[b];
    if (ra >= 0) this.b[ra] -= i;
    if (rb >= 0) this.b[rb] += i;
  }

  /**
   * Linearizovaný nelineárny prvok: prúd do vývodu k je I0[k] + Σ g[k][c] · (U_c − U_c0),
   * kde riadiace napätie U_c je rozdiel napätí uzlov ctrl[c] = [kladný, záporný, U_c0].
   */
  device(nodes: number[], I0: number[], ctrl: [number, number, number][], g: number[][]): void {
    nodes.forEach((node, k) => {
      const r = this.row[node];
      if (r < 0) return;
      let rhs = -I0[k];
      ctrl.forEach(([p, n, v0], c) => {
        const gk = g[k][c];
        if (!gk) return;
        this.add(r, this.row[p], gk);
        this.add(r, this.row[n], -gk);
        rhs += gk * v0;
      });
      this.b[r] += rhs;
    });
  }

  /** Gaussova eliminácia s výberom hlavného prvku. Vráti null pri singulárnej sústave. */
  solve(): Float64Array | null {
    const { m } = this;
    const A = this.A.slice();
    const x = this.b.slice();
    for (let col = 0; col < m; col++) {
      let piv = col;
      let best = Math.abs(A[col * m + col]);
      for (let r = col + 1; r < m; r++) {
        const v = Math.abs(A[r * m + col]);
        if (v > best) {
          best = v;
          piv = r;
        }
      }
      if (best < 1e-300) return null;
      if (piv !== col) {
        for (let c = 0; c < m; c++) {
          const t = A[col * m + c];
          A[col * m + c] = A[piv * m + c];
          A[piv * m + c] = t;
        }
        const t = x[col];
        x[col] = x[piv];
        x[piv] = t;
      }
      const d = A[col * m + col];
      for (let r = col + 1; r < m; r++) {
        const f = A[r * m + col] / d;
        if (!f) continue;
        for (let c = col; c < m; c++) A[r * m + c] -= f * A[col * m + c];
        x[r] -= f * x[col];
      }
    }
    for (let r = m - 1; r >= 0; r--) {
      let s = x[r];
      for (let c = r + 1; c < m; c++) s -= A[r * m + c] * x[c];
      x[r] = s / A[r * m + r];
    }
    return x;
  }
}

type Elem =
  | { t: 'R'; a: number; b: number; g: number }
  | { t: 'C'; a: number; b: number; c: number; part: string }
  | { t: 'L'; a: number; b: number; l: number; part: string }
  | { t: 'V'; a: number; b: number; e: (time: number) => number; part: string }
  | { t: 'I'; a: number; b: number; i: number }
  | { t: 'D'; a: number; k: number; is: number; nvt: number; vcrit: number; key: string }
  | { t: 'Q'; b: number; c: number; e: number; pol: number; bf: number; vcrit: number; key: string }
  | { t: 'M'; g: number; d: number; s: number; pol: number; vth: number; key: string };

/**
 * Okamžité hodnoty na súčiastke a ich priemery za celé periódy striedavého zdroja
 * (stredná hodnota u, i, p a stredná hodnota druhej mocniny pre efektívnu hodnotu).
 */
export interface PartState {
  /** Napätie medzi prvým a druhým vývodom. */
  u: number;
  /** Prúd súčiastkou od prvého vývodu k druhému (pri zdroji: prúd dodávaný do obvodu). */
  i: number;
  p: number;
  extra: Record<string, number>;
  mu: number;
  mu2: number;
  mi: number;
  mi2: number;
  mp: number;
}

export interface SimState {
  capV: Map<string, number>;
  indI: Map<string, number>;
  /** Hodnoty o krok skôr – pre metódu druhého rádu. */
  capV1: Map<string, number>;
  indI1: Map<string, number>;
  /** Dĺžka posledného kroku (0 = bez histórie). */
  hPrev: number;
  time: number;
}

/** Koeficienty derivácie x' ≈ (a0·x₊ − a1·x + a2·x₋) / h; bez histórie implicitná Eulerova metóda. */
interface Bdf {
  a0: number;
  a1: number;
  a2: number;
}

function bdfCoefficients(h: number, hPrev: number): Bdf {
  const w = hPrev > 0 ? h / hPrev : 0;
  if (w <= 0 || w > 2.4) return { a0: 1, a1: 1, a2: 0 };
  return { a0: (1 + 2 * w) / (1 + w), a1: 1 + w, a2: (w * w) / (1 + w) };
}

/** Záznam osciloskopu: čas a napätia oboch kanálov. */
export class Trace {
  readonly t: Float64Array;
  readonly v1: Float64Array;
  readonly v2: Float64Array;
  head = 0;
  size = 0;
  private last = -Infinity;

  constructor(readonly interval: number, readonly capacity = 3000) {
    this.t = new Float64Array(capacity);
    this.v1 = new Float64Array(capacity);
    this.v2 = new Float64Array(capacity);
  }

  push(t: number, v1: number, v2: number): void {
    if (t - this.last < this.interval) return;
    this.last = t;
    this.t[this.head] = t;
    this.v1[this.head] = v1;
    this.v2[this.head] = v2;
    this.head = (this.head + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  /** Vzorky od najstaršieho po najnovší. */
  samples(): { t: number; v1: number; v2: number }[] {
    const out: { t: number; v1: number; v2: number }[] = [];
    const start = (this.head - this.size + this.capacity) % this.capacity;
    for (let k = 0; k < this.size; k++) {
      const i = (start + k) % this.capacity;
      out.push({ t: this.t[i], v1: this.v1[i], v2: this.v2[i] });
    }
    return out;
  }
}

export interface Warning {
  part: string;
  text: string;
}

export class Simulator {
  readonly nets: Nets;
  time: number;
  /** Napätia uzlov voči referenčnému uzlu. */
  x: Float64Array;
  error: string | null = null;
  readonly hasAC: boolean;
  readonly fMax: number;
  readonly fMin: number;
  readonly states = new Map<string, PartState>();
  readonly traces = new Map<string, Trace>();

  private readonly elems: Elem[] = [];
  private readonly row: Int32Array;
  private readonly sys: System;
  private readonly capV: Map<string, number>;
  private readonly indI: Map<string, number>;
  private readonly capV1: Map<string, number>;
  private readonly indI1: Map<string, number>;
  private hPrev: number;
  private readonly lim = new Map<string, number[]>();
  private readonly nonlinear: boolean;
  private readonly partsById = new Map<string, Part>();
  private readonly sums = new Map<string, number[]>();
  /** Dĺžka okna priemerovania – celý počet periód najnižšej frekvencie, aspoň 0,1 s. */
  private readonly avgWindow: number;
  private avgTime = 0;
  private readonly minWindow: number;
  private lastDt = 1e-3;

  constructor(readonly circuit: Circuit, prev?: SimState) {
    this.nets = buildNets(circuit);
    this.capV = new Map(prev?.capV ?? []);
    this.indI = new Map(prev?.indI ?? []);
    this.capV1 = new Map(prev?.capV1 ?? []);
    this.indI1 = new Map(prev?.indI1 ?? []);
    this.hPrev = prev?.hPrev ?? 0;
    this.time = prev?.time ?? 0;

    const N = this.nets.nodeCount;
    const sources = circuit.parts.filter((p) => p.kind === 'dc' || p.kind === 'ac');
    const refPart = sources[0];
    const ref = refPart ? this.nets.partNodes.get(refPart.id)![1] : 0;
    this.row = new Int32Array(Math.max(N, 1));
    let m = 0;
    for (let n = 0; n < N; n++) this.row[n] = n === ref ? -1 : m++;
    this.sys = new System(this.row, m);
    this.x = new Float64Array(Math.max(N, 1));

    const freqs = circuit.parts.filter((p) => p.kind === 'ac').map((p) => num(p.props.f, 50));
    this.hasAC = freqs.length > 0;
    this.fMax = freqs.length ? Math.max(...freqs) : 0;
    this.fMin = freqs.length ? Math.min(...freqs) : 0;
    this.avgWindow = this.hasAC ? Math.ceil(0.1 * this.fMin) / this.fMin : 0;
    this.minWindow = Math.min(...circuit.parts.filter((p) => p.kind === 'scope').map((p) => 10 * num(p.props.tdiv, 5e-3)));

    for (const part of circuit.parts) {
      this.partsById.set(part.id, part);
      this.compile(part, this.nets.partNodes.get(part.id)!);
      this.states.set(part.id, { u: 0, i: 0, p: 0, extra: {}, mu: 0, mu2: 0, mi: 0, mi2: 0, mp: 0 });
      this.sums.set(part.id, [0, 0, 0, 0, 0]);
      if (part.kind === 'scope') {
        const window = 10 * num(part.props.tdiv, 5e-3);
        this.traces.set(part.id, new Trace(window / 1000));
      }
    }
    this.nonlinear = this.elems.some((e) => e.t === 'D' || e.t === 'Q' || e.t === 'M');
  }

  exportState(): SimState {
    return {
      capV: new Map(this.capV), indI: new Map(this.indI), capV1: new Map(this.capV1), indI1: new Map(this.indI1),
      hPrev: this.hPrev, time: this.time,
    };
  }

  private compile(part: Part, nodes: number[]): void {
    const [a, b] = nodes;
    const R = (n1: number, n2: number, r: number) => this.elems.push({ t: 'R', a: n1, b: n2, g: 1 / r });
    switch (part.kind) {
      case 'resistor':
        R(a, b, Math.max(1e-6, num(part.props.R, 1000)));
        break;
      case 'lamp':
        R(a, b, lampResistance(part));
        break;
      case 'capacitor':
      case 'ecap':
        this.elems.push({ t: 'C', a, b, c: Math.max(1e-15, num(part.props.C, 1e-6)), part: part.id });
        break;
      case 'inductor':
        this.elems.push({ t: 'L', a, b, l: Math.max(1e-12, num(part.props.L, 0.1)), part: part.id });
        break;
      case 'diode':
        this.elems.push({ t: 'D', a, k: b, is: DIODE_IS, nvt: DIODE_N * VT, vcrit: vcritOf(DIODE_IS, DIODE_N * VT), key: part.id });
        break;
      case 'led': {
        const uf = LED_COLORS.find(([id]) => id === part.props.color)?.[2] ?? 2;
        const nvt = LED_N * VT;
        const is = LED_MAX / Math.exp(uf / nvt);
        this.elems.push({ t: 'D', a, k: b, is, nvt, vcrit: vcritOf(is, nvt), key: part.id });
        break;
      }
      case 'bjt':
        this.elems.push({
          t: 'Q', b: nodes[0], c: nodes[1], e: nodes[2], pol: part.props.type === 'pnp' ? -1 : 1,
          bf: Math.max(1, num(part.props.beta, 100)), vcrit: vcritOf(BJT_IS, VT), key: part.id,
        });
        break;
      case 'mosfet':
        this.elems.push({
          t: 'M', g: nodes[0], d: nodes[1], s: nodes[2], pol: part.props.type === 'p' ? -1 : 1,
          vth: Math.abs(num(part.props.uth, 2)), key: part.id,
        });
        break;
      case 'dc': {
        const U = num(part.props.U, 12);
        this.elems.push({ t: 'V', a, b, e: () => U, part: part.id });
        break;
      }
      case 'ac': {
        const Um = num(part.props.U, 10) * Math.SQRT2;
        const w = 2 * Math.PI * num(part.props.f, 50);
        this.elems.push({ t: 'V', a, b, e: (time) => Um * Math.sin(w * time), part: part.id });
        break;
      }
      case 'switch':
        if (part.props.on === true) R(a, b, R_SWITCH);
        break;
      case 'ammeter':
        R(a, b, R_AMMETER);
        break;
      case 'voltmeter':
        R(a, b, R_VOLTMETER);
        break;
      case 'multimeter': {
        const mode = String(part.props.mode);
        if (mode.startsWith('A')) R(a, b, R_AMMETER);
        else if (mode === 'ohm') this.elems.push({ t: 'I', a, b, i: -OHM_TEST_I });
        else R(a, b, R_VOLTMETER);
        break;
      }
      case 'wattmeter':
        R(nodes[0], nodes[1], R_AMMETER);
        R(nodes[2], nodes[3], R_VOLTMETER);
        break;
      case 'scope':
        R(nodes[0], nodes[2], R_SCOPE);
        R(nodes[1], nodes[2], R_SCOPE);
        break;
    }
  }

  private v(node: number, x = this.x): number {
    return this.row[node] < 0 ? 0 : x[node];
  }

  private assemble(x: Float64Array, dt: number, time: number, limits: Map<string, number[]>, k: Bdf): boolean {
    const sys = this.sys;
    sys.clear();
    let limited = false;
    const vv = (n: number) => this.v(n, x);
    for (const el of this.elems) {
      switch (el.t) {
        case 'R':
          sys.conductance(el.a, el.b, el.g);
          break;
        case 'C': {
          const v0 = this.capV.get(el.part) ?? 0;
          const v1 = this.capV1.get(el.part) ?? v0;
          sys.conductance(el.a, el.b, (k.a0 * el.c) / dt);
          sys.current(el.a, el.b, -(el.c / dt) * (k.a1 * v0 - k.a2 * v1));
          break;
        }
        case 'L': {
          const i0 = this.indI.get(el.part) ?? 0;
          const i1 = this.indI1.get(el.part) ?? i0;
          sys.conductance(el.a, el.b, dt / (k.a0 * el.l));
          sys.current(el.a, el.b, (k.a1 * i0 - k.a2 * i1) / k.a0);
          break;
        }
        case 'V': {
          const g = 1 / R_SOURCE;
          sys.conductance(el.a, el.b, g);
          sys.current(el.a, el.b, -g * el.e(time));
          break;
        }
        case 'I':
          sys.current(el.a, el.b, el.i);
          break;
        case 'D': {
          const raw = vv(el.a) - vv(el.k);
          const old = limits.get(el.key)?.[0] ?? 0;
          const vd = pnjlim(raw, old, el.nvt, el.vcrit);
          if (Math.abs(vd - raw) > 1e-9) limited = true;
          limits.set(el.key, [vd]);
          const ex = safeExp(vd / el.nvt);
          const id = el.is * (ex - 1);
          const gd = (el.is / el.nvt) * ex + 1e-12;
          sys.device([el.a, el.k], [id, -id], [[el.a, el.k, vd]], [[gd], [-gd]]);
          break;
        }
        case 'Q': {
          const p = el.pol;
          const old = limits.get(el.key) ?? [0, 0];
          const vbeRaw = p * (vv(el.b) - vv(el.e));
          const vbcRaw = p * (vv(el.b) - vv(el.c));
          const vbe = pnjlim(vbeRaw, old[0], VT, el.vcrit);
          const vbc = pnjlim(vbcRaw, old[1], VT, el.vcrit);
          if (Math.abs(vbe - vbeRaw) > 1e-9 || Math.abs(vbc - vbcRaw) > 1e-9) limited = true;
          limits.set(el.key, [vbe, vbc]);
          const q = bjtCurrents(vbe, vbc, el.bf);
          const be: [number, number, number] = p > 0 ? [el.b, el.e, vbe] : [el.e, el.b, vbe];
          const bc: [number, number, number] = p > 0 ? [el.b, el.c, vbc] : [el.c, el.b, vbc];
          sys.device([el.c, el.b, el.e], [p * q.ic, p * q.ib, p * q.ie], [be, bc], [
            [p * q.gcBe, p * q.gcBc],
            [p * q.gbBe, p * q.gbBc],
            [p * q.geBe, p * q.geBc],
          ]);
          break;
        }
        case 'M': {
          const p = el.pol;
          const old = limits.get(el.key) ?? [0];
          const vgsRaw = p * (vv(el.g) - vv(el.s));
          const vdsRaw = p * (vv(el.d) - vv(el.s));
          // Napätie hradla sa v jednej iterácii zmení najviac o 2 V – pomáha zbiehaniu.
          const vgs = old[0] + Math.max(-2, Math.min(2, vgsRaw - old[0]));
          if (Math.abs(vgs - vgsRaw) > 1e-9) limited = true;
          limits.set(el.key, [vgs]);
          sys.conductance(el.d, el.s, GMIN);
          const pair = (n1: number, n2: number, v0: number): [number, number, number] => (p > 0 ? [n1, n2, v0] : [n2, n1, v0]);
          if (vdsRaw >= 0) {
            const m = mosCurrent(vgs, vdsRaw, el.vth);
            sys.device([el.d, el.s], [p * m.id, -p * m.id], [pair(el.g, el.s, vgs), pair(el.d, el.s, vdsRaw)], [
              [p * m.gm, p * m.gds],
              [-p * m.gm, -p * m.gds],
            ]);
          } else {
            // Opačná polarita: úlohy elektródy D a S sa vymenia.
            const vgd = vgs - vdsRaw;
            const m = mosCurrent(vgd, -vdsRaw, el.vth);
            sys.device([el.d, el.s], [-p * m.id, p * m.id], [pair(el.g, el.d, vgd), pair(el.s, el.d, -vdsRaw)], [
              [-p * m.gm, -p * m.gds],
              [p * m.gm, p * m.gds],
            ]);
          }
          break;
        }
      }
    }
    return limited;
  }

  /** Jeden časový krok dĺžky dt. Pri neúspechu skúsi kratšie kroky. */
  step(dt: number, depth = 0): boolean {
    if (this.error) return false;
    if (this.tryStep(dt)) return true;
    if (depth >= 6) {
      this.error = 'Simulácia sa nevie ustáliť – obvod je pravdepodobne nefyzikálny (napríklad skratovaný zdroj cez ideálne prvky).';
      return false;
    }
    return this.step(dt / 2, depth + 1) && this.step(dt / 2, depth + 1);
  }

  private tryStep(dt: number): boolean {
    const time = this.time + dt;
    const limits = new Map<string, number[]>([...this.lim].map(([k, v]) => [k, [...v]]));
    let x = this.x.slice();
    let ok = false;
    const k = bdfCoefficients(dt, this.hPrev);
    for (let iter = 0; iter < MAX_ITER; iter++) {
      const limited = this.assemble(x, dt, time, limits, k);
      const sol = this.sys.solve();
      if (!sol) return false;
      const next = new Float64Array(x.length);
      let maxDiff = 0;
      for (let n = 0; n < x.length; n++) {
        const r = this.row[n];
        next[n] = r < 0 ? 0 : sol[r];
        if (!Number.isFinite(next[n])) return false;
        maxDiff = Math.max(maxDiff, Math.abs(next[n] - x[n]) / (1e-6 + 1e-5 * Math.abs(next[n])));
      }
      x = next;
      if (!this.nonlinear || (!limited && maxDiff < 1 && iter > 0)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
    this.accept(x, dt, time, limits, k);
    return true;
  }

  private accept(x: Float64Array, dt: number, time: number, limits: Map<string, number[]>, k: Bdf): void {
    this.x = x;
    this.time = time;
    this.lastDt = dt;
    this.hPrev = dt;
    for (const [key, v] of limits) this.lim.set(key, v);
    for (const el of this.elems) {
      if (el.t === 'C') {
        const u = this.v(el.a) - this.v(el.b);
        const v0 = this.capV.get(el.part) ?? 0;
        const v1 = this.capV1.get(el.part) ?? v0;
        this.states.get(el.part)!.extra.ic = (el.c * (k.a0 * u - k.a1 * v0 + k.a2 * v1)) / dt;
        this.capV1.set(el.part, v0);
        this.capV.set(el.part, u);
      } else if (el.t === 'L') {
        const u = this.v(el.a) - this.v(el.b);
        const i0 = this.indI.get(el.part) ?? 0;
        const i1 = this.indI1.get(el.part) ?? i0;
        this.indI1.set(el.part, i0);
        this.indI.set(el.part, (dt / el.l) * u / k.a0 + (k.a1 * i0 - k.a2 * i1) / k.a0);
      }
    }
    this.avgTime += dt;
    const latch = this.hasAC && this.avgTime >= this.avgWindow - dt / 2;
    for (const part of this.circuit.parts) this.measure(part, dt, latch);
    if (latch) this.avgTime = 0;
  }

  private measure(part: Part, dt: number, latch: boolean): void {
    const nodes = this.nets.partNodes.get(part.id)!;
    const st = this.states.get(part.id)!;
    const V = (k: number) => this.v(nodes[k]);
    let u = V(0) - V(1);
    let i = 0;
    let p: number | null = null;
    switch (part.kind) {
      case 'resistor':
        i = u / Math.max(1e-6, num(part.props.R, 1000));
        break;
      case 'lamp':
        i = u / lampResistance(part);
        break;
      case 'capacitor':
      case 'ecap':
        i = st.extra.ic ?? 0;
        break;
      case 'inductor':
        i = this.indI.get(part.id) ?? 0;
        break;
      case 'diode':
      case 'led': {
        const el = this.elems.find((e) => e.t === 'D' && e.key === part.id) as Extract<Elem, { t: 'D' }>;
        i = el.is * (safeExp(u / el.nvt) - 1);
        break;
      }
      case 'dc':
      case 'ac': {
        const el = this.elems.find((e) => e.t === 'V' && e.part === part.id) as Extract<Elem, { t: 'V' }> | undefined;
        const e = el ? el.e(this.time) : 0;
        i = (e - u) / R_SOURCE;
        st.extra.e = e;
        break;
      }
      case 'switch':
        i = part.props.on === true ? u / R_SWITCH : 0;
        break;
      case 'ammeter':
        i = u / R_AMMETER;
        break;
      case 'voltmeter':
        i = u / R_VOLTMETER;
        break;
      case 'multimeter': {
        const mode = String(part.props.mode);
        i = mode.startsWith('A') ? u / R_AMMETER : mode === 'ohm' ? -OHM_TEST_I : u / R_VOLTMETER;
        if (mode === 'ohm') st.extra.r = u / OHM_TEST_I;
        break;
      }
      case 'wattmeter':
        i = (V(0) - V(1)) / R_AMMETER;
        u = V(2) - V(3);
        p = u * i;
        break;
      case 'scope':
        u = V(0) - V(2);
        st.extra.v1 = u;
        st.extra.v2 = V(1) - V(2);
        this.traces.get(part.id)?.push(this.time, st.extra.v1, st.extra.v2);
        break;
      case 'bjt': {
        const pol = part.props.type === 'pnp' ? -1 : 1;
        const [b, c, e] = [V(0), V(1), V(2)];
        const el = this.elems.find((x) => x.t === 'Q' && x.key === part.id) as Extract<Elem, { t: 'Q' }>;
        const q = bjtCurrents(pol * (b - e), pol * (b - c), el.bf);
        st.extra = { ib: pol * q.ib, ic: pol * q.ic, ube: b - e, uce: c - e };
        u = c - e;
        i = pol * q.ic;
        p = (c - e) * pol * q.ic + (b - e) * pol * q.ib;
        break;
      }
      case 'mosfet': {
        const pol = part.props.type === 'p' ? -1 : 1;
        const [g, d, s] = [V(0), V(1), V(2)];
        const vth = Math.abs(num(part.props.uth, 2));
        const vgs = pol * (g - s);
        const vds = pol * (d - s);
        const m = vds >= 0 ? mosCurrent(vgs, vds, vth).id : -mosCurrent(vgs - vds, -vds, vth).id;
        st.extra = { ugs: g - s, uds: d - s, id: pol * m };
        u = d - s;
        i = pol * m;
        break;
      }
    }
    st.u = u;
    st.i = i;
    st.p = p ?? u * i;
    if (!this.hasAC) {
      st.mu = u;
      st.mu2 = u * u;
      st.mi = i;
      st.mi2 = i * i;
      st.mp = st.p;
      return;
    }
    const sum = this.sums.get(part.id)!;
    sum[0] += u * dt;
    sum[1] += u * u * dt;
    sum[2] += i * dt;
    sum[3] += i * i * dt;
    sum[4] += st.p * dt;
    if (latch) {
      const T = this.avgTime;
      [st.mu, st.mu2, st.mi, st.mi2, st.mp] = sum.map((s) => s / T);
      sum.fill(0);
    }
  }

  /**
   * Posunie simuláciu o `duration` sekúnd. Krok sa volí podľa najvyššej frekvencie zdrojov;
   * ak by bolo treba priveľa krokov, simulácia sa spomalí (vráti false).
   */
  advance(duration: number, maxSteps = 400): boolean {
    if (this.error || duration <= 0) return true;
    let dt = duration / 20;
    if (this.hasAC) dt = Math.min(dt, 1 / (this.fMax * 80));
    // Osciloskop potrebuje aspoň 400 bodov na šírku obrazovky.
    if (Number.isFinite(this.minWindow)) dt = Math.min(dt, this.minWindow / 400);
    let steps = Math.ceil(duration / dt - 1e-9);
    const full = steps <= maxSteps;
    steps = Math.min(steps, maxSteps);
    for (let s = 0; s < steps; s++) if (!this.step(dt)) return false;
    return full;
  }

  get stepSize(): number {
    return this.lastDt;
  }

  /** Upozornenia na preťažené alebo zle zapojené súčiastky. */
  warnings(): Warning[] {
    const out: Warning[] = [];
    const avg = (st: PartState) => (this.hasAC ? Math.sqrt(Math.max(0, st.mi2)) : Math.abs(st.i));
    for (const part of this.circuit.parts) {
      const st = this.states.get(part.id)!;
      const w = (text: string) => out.push({ part: part.id, text: `${part.name}: ${text}` });
      switch (part.kind) {
        case 'resistor': {
          const pmax = num(part.props.pmax, 0.25);
          const pw = this.hasAC ? st.mp : st.p;
          if (pw > pmax) w(`preťažený – mení na teplo ${fmtW(pw)}, znesie len ${fmtW(pmax)}.`);
          break;
        }
        case 'lamp': {
          const pn = num(part.props.P, 5);
          const pw = this.hasAC ? st.mp : st.p;
          if (pw > pn * 1.3) w(`žiarovka má ${fmtW(pw)}, hoci je len na ${fmtW(pn)} – vlákno sa prepáli. Zníž napätie.`);
          break;
        }
        case 'ecap': {
          const umax = num(part.props.umax, 25);
          if (st.u < -1) w('elektrolytický kondenzátor je zapojený opačne! Kladný vývod musí byť na vyššom napätí.');
          else if (st.u > umax * 1.0001) w(`prekročené menovité napätie ${String(umax).replace('.', ',')} V.`);
          break;
        }
        case 'led':
          if (avg(st) > LED_MAX) w('prúd je väčší ako 20 mA – LED sa zničí. Pridaj predradný rezistor.');
          else if (st.u < -5) w('LED je v závernom smere namáhaná napätím väčším ako 5 V.');
          break;
        case 'diode':
          if (avg(st) > DIODE_MAX) w('prúd diódou je väčší ako 1 A – dióda sa prehreje.');
          break;
        case 'bjt':
          if (Math.abs(st.extra.ic ?? 0) > BJT_MAX) w('prúd kolektora je väčší ako 0,5 A – tranzistor sa zničí.');
          break;
        case 'mosfet':
          if (Math.abs(st.extra.id ?? 0) > MOS_MAX) w('prúd D–S je väčší ako 1 A – MOSFET sa prehreje.');
          break;
        case 'dc':
        case 'ac':
          if (avg(st) > SOURCE_MAX) w('zdroj je preťažený – pravdepodobne skrat.');
          break;
        case 'ammeter':
          if (avg(st) > AMMETER_MAX) w('cez ampérmeter tečie obrovský prúd. Ampérmeter sa zapája do série, nie paralelne!');
          break;
        case 'multimeter':
          if (String(part.props.mode).startsWith('A') && avg(st) > AMMETER_MAX) {
            w('multimeter v režime merania prúdu je zapojený ako skrat. Na meranie napätia prepni na V.');
          }
          break;
      }
    }
    return out;
  }
}

/** Jas LED (podľa prúdu, 20 mA = naplno) alebo žiarovky (podľa výkonu) v rozsahu 0 až 1. */
export function glowLevel(part: Part, st: PartState | undefined, hasAC: boolean): number {
  if (!st) return 0;
  if (part.kind === 'lamp') return Math.min(1, Math.max(0, hasAC ? st.mp : st.p) / num(part.props.P, 5));
  return Math.min(1, (hasAC ? Math.sqrt(Math.max(0, st.mi2)) : Math.max(0, st.i)) / LED_MAX);
}

export interface MeterReading {
  /** Zobrazená hodnota, alebo null pri prekročení rozsahu (OL). */
  value: number | null;
  unit: string;
  /** Krátky popis režimu, napr. „V⎓“. */
  mode: string;
}

/** Čo ukazuje merací prístroj: pri striedavých zdrojoch priemer (⎓) alebo efektívnu hodnotu (~). */
export function meterReading(part: Part, st: PartState, hasAC: boolean): MeterReading | null {
  const dc = (inst: number, mean: number) => (hasAC ? mean : inst);
  const rms = (mean: number, mean2: number) => (hasAC ? Math.sqrt(Math.max(0, mean2 - mean * mean)) : 0);
  const clean = (v: number, tiny: number) => (Math.abs(v) < tiny ? 0 : v);
  const volts = (ac: boolean): MeterReading => {
    const v = clean(ac ? rms(st.mu, st.mu2) : dc(st.u, st.mu), 1e-6);
    return { value: Math.abs(v) > VOLTMETER_MAX ? null : v, unit: 'V', mode: ac ? 'V~' : 'V⎓' };
  };
  const amps = (ac: boolean): MeterReading => {
    const v = clean(ac ? rms(st.mi, st.mi2) : dc(st.i, st.mi), 1e-9);
    return { value: Math.abs(v) > AMMETER_MAX ? null : v, unit: 'A', mode: ac ? 'A~' : 'A⎓' };
  };
  switch (part.kind) {
    case 'voltmeter':
      return volts(part.props.mode === 'AC');
    case 'ammeter':
      return amps(part.props.mode === 'AC');
    case 'wattmeter':
      return { value: clean(dc(st.p, st.mp), 1e-9), unit: 'W', mode: 'P' };
    case 'multimeter': {
      const mode = String(part.props.mode);
      if (mode === 'ohm') {
        const r = st.extra.r ?? Infinity;
        return { value: r > 4e7 || r < -1 ? null : Math.max(0, r), unit: 'Ω', mode: 'Ω' };
      }
      return mode.startsWith('A') ? amps(mode === 'A~') : volts(mode === 'V~');
    }
    default:
      return null;
  }
}

/**
 * Odpor rozžeraveného vlákna žiarovky R = U² / P z menovitých hodnôt. Odpor studeného vlákna
 * je v skutočnosti asi desaťkrát menší – tu ho pre jednoduchosť považujeme za stály.
 */
export function lampResistance(part: Part): number {
  const U = Math.max(0.01, num(part.props.U, 12));
  const P = Math.max(1e-4, num(part.props.P, 5));
  return (U * U) / P;
}

const fmtW = (w: number) => `${String(Number(w.toPrecision(3))).replace('.', ',')} W`;

/** Ebersov–Mollov model tranzistora NPN: prúdy do vývodov a ich derivácie podľa U_BE a U_BC. */
function bjtCurrents(vbe: number, vbc: number, bf: number) {
  const ef = safeExp(vbe / VT);
  const er = safeExp(vbc / VT);
  const If = BJT_IS * (ef - 1);
  const Ir = BJT_IS * (er - 1);
  const gf = (BJT_IS / VT) * ef + 1e-12;
  const gr = (BJT_IS / VT) * er + 1e-12;
  const ic = If - Ir - Ir / BJT_BR;
  const ib = If / bf + Ir / BJT_BR;
  return {
    ic, ib, ie: -(ic + ib),
    gcBe: gf, gcBc: -gr - gr / BJT_BR,
    gbBe: gf / bf, gbBc: gr / BJT_BR,
    geBe: -gf - gf / bf, geBc: gr,
  };
}

/** Kvadratický model MOSFETu (Shichman–Hodges) pre U_DS ≥ 0. */
function mosCurrent(vgs: number, vds: number, vth: number): { id: number; gm: number; gds: number } {
  const vov = vgs - vth;
  if (vov <= 0) return { id: 0, gm: 0, gds: 0 };
  const cl = 1 + MOS_LAMBDA * vds;
  if (vds < vov) {
    const core = 2 * vov * vds - vds * vds;
    return { id: MOS_K * core * cl, gm: MOS_K * 2 * vds * cl, gds: MOS_K * (2 * vov - 2 * vds) * cl + MOS_K * core * MOS_LAMBDA };
  }
  return { id: MOS_K * vov * vov * cl, gm: 2 * MOS_K * vov * cl, gds: MOS_K * vov * vov * MOS_LAMBDA };
}
