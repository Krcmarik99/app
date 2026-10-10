/**
 * Virtuálny mikrokontrolér Arduino UNO: vykonáva preložený program (bajtkód), spravuje piny,
 * PWM, tóny, servá, sériovú linku a LCD displej. Čas mikrokontroléra beží spolu so simuláciou
 * obvodu – každá inštrukcia trvá približne toľko ako na skutočnom 16 MHz procesore.
 */
import { BINOPS, OP, TYPES, convConst, type ArrayTemplate, type Compiled, type NativeCall } from './compiler';
import { lcdCode } from './font';
import type { Scalar } from './parser';

/** Čas jednej inštrukcie bajtkódu (asi 4 takty procesora). */
const INSTR = 0.25e-6;
/** Zápisy na piny bližšie ako 10 µs od posledného výpočtu obvodu sa spoja do jedného kroku. */
export const WRITE_MERGE = 10e-6;
const MAX_DEPTH = 200;

export const PIN_COUNT = 20;
export const PWM_PINS = [3, 5, 6, 9, 10, 11];
export const R_PIN = 25;
export const R_PULLUP = 35e3;
export const G_INPUT = 1e-8;

export const MODE = { INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2 } as const;

/** Označenie pinu podľa čísla: 13 → D13, 14 → A0. */
export function pinName(pin: number): string {
  return pin >= 14 ? `A${pin - 14}` : `D${pin}`;
}

const pwmPeriod = (pin: number) => (pin === 5 || pin === 6 ? 1 / 976.5625 : 1 / 490.196);

export interface PinState {
  mode: number;
  out: number;
  /** Strieda PWM (1 až 254), 0 = bez PWM. */
  pwm: number;
  tone: { f: number; t0: number; until: number } | null;
  servo: { us: number; t0: number } | null;
  /** Posledná prečítaná logická úroveň (Schmittov obvod). */
  read: number;
  /** Kedy program naposledy čítal pin. */
  readAt: number;
}

export interface LcdState {
  ddram: Uint8Array;
  cgram: Uint8Array;
  addr: number;
  shift: number;
  displayOn: boolean;
  cursorOn: boolean;
  blinkOn: boolean;
  backlight: boolean;
  ltr: boolean;
  autoscroll: boolean;
  initialized: boolean;
  version: number;
}

export function newLcdState(): LcdState {
  return {
    ddram: new Uint8Array(128).fill(0x20), cgram: new Uint8Array(64), addr: 0, shift: 0, displayOn: true, cursorOn: false,
    blinkOn: false, backlight: true, ltr: true, autoscroll: false, initialized: false, version: 0,
  };
}

/** Prostredie, v ktorom mikrokontrolér beží (obvod). */
export interface McuHost {
  /** Napätie pinu voči GND Arduina. */
  pinVoltage(pin: number): number;
  /** Je pin len vstupom, ku ktorému nie je nič pripojené? */
  pinFloating(pin: number): boolean;
  /** Čas, do ktorého je obvod vypočítaný. */
  circuitTime(): number;
  /** LCD displej na zbernici I2C s danou adresou (pripojený a napájaný), alebo null. */
  lcd(addr: number): LcdState | null;
}

export interface Diagnostic {
  line: number;
  message: string;
}

const YIELD = Symbol('yield');
type NativeResult = unknown | typeof YIELD;

class ServoObj {
  pin = -1;
  us = 1500;
  min = 544;
  max = 2400;
}

class LcdObj {
  constructor(readonly addr: number, readonly cols: number, readonly rows: number) {}
  backlight = false;
}

class RuntimeError extends Error {}

/** Číslo v danej sústave ako Arduino Print (bez znamienka pre iné sústavy ako 10). */
function intText(v: number, base: number, upper = true): string {
  if (base === 10) return String(v);
  if (base < 2 || base > 36) return String(v);
  const u = v < 0 ? v >>> 0 : v;
  const s = u.toString(base);
  return upper ? s.toUpperCase() : s;
}

/** Desatinné číslo ako Print::printFloat na Arduine (počíta sa v 32-bitovej presnosti). */
export function floatText(value: number, digits: number, overflow = true): string {
  if (Number.isNaN(value)) return 'nan';
  if (!Number.isFinite(value)) return 'inf';
  if (overflow && Math.abs(value) > 4294967040) return 'ovf';
  digits = Math.max(0, Math.min(digits, 20));
  const f = Math.fround;
  let out = '';
  let n = f(value);
  if (n < 0) {
    out = '-';
    n = f(-n);
  }
  let rounding = f(0.5);
  for (let i = 0; i < digits; i++) rounding = f(rounding / 10);
  n = f(n + rounding);
  const intPart = Math.floor(n);
  let rem = f(n - intPart);
  out += String(intPart);
  if (digits > 0) out += '.';
  for (let i = 0; i < digits; i++) {
    rem = f(rem * 10);
    const d = Math.min(9, Math.floor(rem));
    out += String(d);
    rem = f(rem - d);
  }
  return out;
}

/** Text hodnoty pri výpise (print) podľa jej typu. */
export function valueText(v: unknown, ty: Scalar, fmt?: number): string {
  if (ty === 'str') return String(v);
  const n = v as number;
  if (ty === 'char' && fmt === undefined) return String.fromCharCode(n & 0xff);
  if (ty === 'f32') return floatText(n, fmt ?? 2);
  return intText(n, fmt ?? 10);
}

/** Prevod na text ako konštruktor String(…) a spájanie textov. */
function stringOf(v: unknown, ty: Scalar, fmt?: number): string {
  if (ty === 'str') return String(v);
  const n = v as number;
  if (ty === 'char') return fmt === undefined ? String.fromCharCode(n & 0xff) : intText(n, fmt, false);
  if (ty === 'f32') return floatText(n, fmt ?? 2, false);
  if (fmt !== undefined && fmt !== 10) {
    const bits = ty === 'i32' || ty === 'u32' ? 32 : 16;
    const u = bits === 16 ? n & 0xffff : n >>> 0;
    return u.toString(fmt);
  }
  return String(n);
}

/** atol / atof: číslo na začiatku textu (inak 0). */
function parseLeading(s: string, float: boolean): number {
  const m = (float ? /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/ : /^\s*[+-]?\d+/).exec(s);
  return m ? Number(m[0].trim()) : 0;
}

export class Mcu {
  program: Compiled | null;
  compileError: Diagnostic | null;
  error: Diagnostic | null = null;
  halted = false;
  time = 0;
  waitUntil = 0;
  /** Výstupy sa zmenili od posledného výpočtu obvodu. */
  dirty = false;
  readonly pins: PinState[] = [];
  /** Upozornenia počas behu (napr. analogWrite na pine bez PWM). */
  readonly notes = new Map<string, Diagnostic>();
  serialLog = '';
  serialVersion = 0;
  serialBegun = false;
  baud = 0;
  private serialIn = '';
  private serialTimeout = 1;
  private txUntil = 0;
  /** Kedy sa naposledy niečo posielalo cez sériovú linku (blikanie LED TX). */
  txAt = -1;
  rxAt = -1;
  host: McuHost | null = null;
  private globals: unknown[] = [];
  private stack: unknown[] = [];
  private sp = 0;
  private locals: unknown[] = [];
  private bp = 0;
  private frames: number[] = [];
  private fn = -1;
  private pc = 0;
  private yielded = false;
  private rng = 1;
  private readonly impls = new Map<NativeCall, (args: unknown[], d: NativeCall) => NativeResult>();
  private readonly servos: ServoObj[] = [];
  private analogNoise = 512;
  startedAt: number;

  /** Text programu, ktorý je v Arduine nahratý. */
  source: string;

  constructor(program: Compiled | null, compileError: Diagnostic | null = null, time = 0, source = '') {
    this.program = program;
    this.compileError = compileError;
    this.source = source;
    this.time = time;
    this.startedAt = time;
    this.reset(time);
  }

  /** Reset ako po stlačení tlačidla RESET: program začne od začiatku. */
  reset(time = this.time): void {
    this.time = time;
    this.waitUntil = time;
    this.error = null;
    this.halted = !this.program;
    this.pins.length = 0;
    for (let p = 0; p < PIN_COUNT; p++) this.pins.push({ mode: MODE.INPUT, out: 0, pwm: 0, tone: null, servo: null, read: 0, readAt: -1 });
    this.dirty = true;
    this.notes.clear();
    this.serialBegun = false;
    this.serialIn = '';
    this.txUntil = time;
    this.servos.length = 0;
    this.rng = 1;
    this.startedAt = time;
    if (!this.program) return;
    this.globals = new Array<unknown>(this.program.nglobals).fill(0);
    this.stack = new Array<unknown>(256);
    this.sp = 0;
    this.locals = [];
    this.bp = 0;
    this.frames = [];
    this.fn = -1;
    this.pc = this.program.entry;
  }

  /** Nahrá nový program (ako cez USB) a spustí ho od začiatku. */
  upload(program: Compiled, source = ''): void {
    this.program = program;
    this.source = source;
    this.compileError = null;
    this.impls.clear();
    this.reset(this.time);
  }

  // ------------------------------------------------------------------ piny pre obvod

  /** Úroveň výstupu v čase t (0 až 1), alebo null, ak pin nie je výstup. */
  private level(p: PinState, t: number): number | null {
    if (p.servo) return (t - p.servo.t0) % 0.02 < p.servo.us * 1e-6 ? 1 : 0;
    if (p.tone && t < p.tone.until) {
      const half = 0.5 / p.tone.f;
      return Math.floor((t - p.tone.t0) / half) % 2 === 0 ? 1 : 0;
    }
    if (p.mode !== MODE.OUTPUT) return null;
    if (p.pwm > 0) return 0;
    return p.out;
  }

  /** Náhradný zdroj pinu: vodivosť g k GND a napätie e (Nortonov zdroj). */
  pinDrive(pin: number, t: number): { g: number; e: number } {
    const p = this.pins[pin];
    if (p.mode === MODE.OUTPUT && p.pwm > 0 && !p.servo && !(p.tone && t < p.tone.until)) {
      const T = pwmPeriod(pin);
      const phase = t - Math.floor(t / T) * T;
      return { g: 1 / R_PIN, e: phase < (p.pwm / 255) * T ? 5 : 0 };
    }
    const lv = this.level(p, t);
    if (lv !== null) return { g: 1 / R_PIN, e: 5 * lv };
    if (p.mode === MODE.INPUT_PULLUP || (p.mode === MODE.INPUT && p.out)) return { g: 1 / R_PULLUP, e: 5 };
    return { g: G_INPUT, e: 0 };
  }

  /** Najbližší okamih po čase t, keď sa niektorý výstup sám zmení (PWM, tón, servo). */
  nextEdge(t: number): number {
    let next = Infinity;
    const eps = 1e-12;
    for (let pin = 0; pin < PIN_COUNT; pin++) {
      const p = this.pins[pin];
      if (p.servo) {
        const T = 0.02;
        const k = Math.floor((t - p.servo.t0) / T);
        const rise = p.servo.t0 + (k + 1) * T;
        const fall = p.servo.t0 + k * T + p.servo.us * 1e-6;
        next = Math.min(next, fall > t + eps ? fall : rise);
        continue;
      }
      if (p.tone && t < p.tone.until) {
        const half = 0.5 / p.tone.f;
        const k = Math.floor((t - p.tone.t0) / half + 1e-9);
        next = Math.min(next, p.tone.t0 + (k + 1) * half, p.tone.until);
        continue;
      }
      if (p.mode === MODE.OUTPUT && p.pwm > 0) {
        const T = pwmPeriod(pin);
        const k = Math.floor(t / T + 1e-9);
        const fall = k * T + (p.pwm / 255) * T;
        next = Math.min(next, fall > t + eps ? fall : (k + 1) * T);
      }
    }
    return next;
  }

  /** Obvod sa dopočítal až po aktuálny čas mikrokontroléra. */
  synced(): void {
    this.dirty = false;
  }

  /** Text poslaný zo sériového monitora. */
  sendSerial(text: string): void {
    // Linka prenáša bajty – diakritika sa vynechá, iné znaky nahradí otáznik.
    this.serialIn += text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\xff]/g, '?');
    this.rxAt = this.time;
  }

  clearSerial(): void {
    this.serialLog = '';
    this.serialVersion += 1;
  }

  /** Strieda PWM pinu (0 až 1) alebo úroveň výstupu – pre zobrazenie. */
  outputLevel(pin: number): number | null {
    const p = this.pins[pin];
    if (p.mode !== MODE.OUTPUT && !p.servo && !p.tone) return null;
    if (p.servo) return p.servo.us / 20000;
    if (p.tone && this.time < p.tone.until) return 0.5;
    if (p.pwm > 0) return p.pwm / 255;
    return p.out;
  }

  // ------------------------------------------------------------------ beh programu

  /**
   * Vykoná program až po čas `limit` (alebo kým nevyčerpá `budget` inštrukcií, prípadne kým
   * nepotrebuje, aby sa obvod dopočítal – vtedy sa zastaví skôr). Vráti počet inštrukcií.
   */
  run(limit: number, budget: number): number {
    this.yielded = false;
    if (this.halted || !this.program) {
      if (this.time < limit) this.time = limit;
      return 0;
    }
    let used = 0;
    while (this.time < limit && !this.yielded && !this.halted && used < budget) {
      if (this.waitUntil > this.time) {
        if (this.waitUntil >= limit) {
          this.time = limit;
          break;
        }
        this.time = this.waitUntil;
      }
      used += this.exec(budget - used, limit);
    }
    if (this.halted && this.time < limit) this.time = limit;
    return used;
  }

  /** Program čaká, kým sa obvod dopočíta (zápis na pin alebo čítanie po zmene výstupov). */
  get waitingForCircuit(): boolean {
    return this.yielded;
  }

  private fail(message: string): never {
    throw new RuntimeError(message);
  }

  private exec(budget: number, limit: number): number {
    const prog = this.program!;
    const code = prog.code;
    const consts = prog.consts;
    const st = this.stack;
    let { pc, sp, bp } = this;
    let t = this.time;
    let n = 0;
    try {
      while (n < budget && t < limit) {
        n += 1;
        t += INSTR;
        const op = code[pc];
        switch (op) {
          case OP.PUSH:
            st[sp++] = consts[code[pc + 1]];
            pc += 2;
            break;
          case OP.POP:
            sp -= 1;
            pc += 1;
            break;
          case OP.DUP:
            st[sp] = st[sp - 1];
            sp += 1;
            pc += 1;
            break;
          case OP.DUP2:
            st[sp] = st[sp - 2];
            st[sp + 1] = st[sp - 1];
            sp += 2;
            pc += 1;
            break;
          case OP.SWAP: {
            const a = st[sp - 1];
            st[sp - 1] = st[sp - 2];
            st[sp - 2] = a;
            pc += 1;
            break;
          }
          case OP.LOADG:
            st[sp++] = this.globals[code[pc + 1]];
            pc += 2;
            break;
          case OP.STOREG:
            this.globals[code[pc + 1]] = st[sp - 1];
            pc += 2;
            break;
          case OP.LOADL:
            st[sp++] = this.locals[bp + code[pc + 1]];
            pc += 2;
            break;
          case OP.STOREL:
            this.locals[bp + code[pc + 1]] = st[sp - 1];
            pc += 2;
            break;
          case OP.LOADIDX: {
            const i = st[--sp] as number;
            const arr = st[sp - 1] as unknown[];
            if (!(i >= 0 && i < arr.length)) {
              this.pc = pc;
              this.fail(`Index ${i} je mimo poľa s ${arr.length} prvkami (dovolené sú 0 až ${arr.length - 1}).`);
            }
            st[sp - 1] = arr[i];
            pc += 1;
            break;
          }
          case OP.STOREIDX: {
            const v = st[--sp];
            const i = st[--sp] as number;
            const arr = st[sp - 1] as unknown[];
            if (!(i >= 0 && i < arr.length)) {
              this.pc = pc;
              this.fail(`Index ${i} je mimo poľa s ${arr.length} prvkami (dovolené sú 0 až ${arr.length - 1}) – zápis by prepísal inú pamäť.`);
            }
            arr[i] = v;
            st[sp - 1] = v;
            pc += 1;
            break;
          }
          case OP.BIN: {
            const b = st[--sp];
            st[sp - 1] = this.bin(code[pc + 1], code[pc + 2], st[sp - 1], b, pc);
            pc += 3;
            break;
          }
          case OP.CMP: {
            const b = st[--sp] as number;
            const a = st[sp - 1] as number;
            let r: boolean;
            switch (code[pc + 1]) {
              case 0: r = a < b; break;
              case 1: r = a > b; break;
              case 2: r = a <= b; break;
              case 3: r = a >= b; break;
              case 4: r = a === b; break;
              default: r = a !== b; break;
            }
            st[sp - 1] = r ? 1 : 0;
            pc += 3;
            break;
          }
          case OP.NEG:
            st[sp - 1] = convConst(-(st[sp - 1] as number), TYPES[code[pc + 1]]);
            pc += 2;
            break;
          case OP.BNOT:
            st[sp - 1] = convConst(~(st[sp - 1] as number), TYPES[code[pc + 1]]);
            pc += 2;
            break;
          case OP.LNOT:
            st[sp - 1] = st[sp - 1] ? 0 : 1;
            pc += 1;
            break;
          case OP.CONV: {
            const from = TYPES[code[pc + 1]];
            const to = TYPES[code[pc + 2]];
            st[sp - 1] = to === 'str' ? stringOf(st[sp - 1], from) : convConst(st[sp - 1] as number, to);
            pc += 3;
            break;
          }
          case OP.JMP:
            pc = code[pc + 1];
            break;
          case OP.JZ:
            pc = st[--sp] ? pc + 2 : code[pc + 1];
            break;
          case OP.JNZ:
            pc = st[--sp] ? code[pc + 1] : pc + 2;
            break;
          case OP.CALL: {
            const f = prog.funcs[code[pc + 1]];
            const argc = code[pc + 2];
            if (this.frames.length / 3 >= MAX_DEPTH) {
              this.pc = pc;
              this.fail('Pretiekol zásobník – funkcia sa volá sama príliš veľa ráz (nekonečná rekurzia?). Arduino UNO má len 2 KB pamäte.');
            }
            const curSize = this.fn >= 0 ? prog.funcs[this.fn].nlocals : 0;
            const nbp = bp + curSize;
            this.frames.push(pc + 3, bp, this.fn);
            for (let i = 0; i < argc; i++) this.locals[nbp + i] = st[sp - argc + i];
            for (let i = argc; i < f.nlocals; i++) this.locals[nbp + i] = 0;
            sp -= argc;
            bp = nbp;
            this.fn = code[pc + 1];
            pc = f.addr;
            break;
          }
          case OP.RET:
          case OP.RETV: {
            const v = op === OP.RET ? st[--sp] : undefined;
            this.fn = this.frames.pop()!;
            bp = this.frames.pop()!;
            pc = this.frames.pop()!;
            if (op === OP.RET) st[sp++] = v;
            break;
          }
          case OP.NATIVE: {
            const d = consts[code[pc + 1]] as NativeCall;
            const args = st.slice(sp - d.argc, sp);
            this.pc = pc;
            this.sp = sp;
            this.bp = bp;
            this.time = t;
            const r = this.native(d, args);
            t = this.time;
            if (r === YIELD) {
              this.yielded = true;
              // Inštrukcia sa vykoná znova, keď sa obvod dopočíta.
              t -= INSTR;
              this.time = t;
              this.sp = sp;
              return n - 1;
            }
            sp -= d.argc;
            if (d.ret !== 'void') st[sp++] = r;
            pc += 2;
            if (this.waitUntil > t || this.halted) {
              this.pc = pc;
              this.sp = sp;
              this.bp = bp;
              this.time = t;
              return n;
            }
            break;
          }
          case OP.NEWARR:
            st[sp++] = buildArray(consts[code[pc + 1]] as ArrayTemplate);
            pc += 2;
            break;
          case OP.HALT:
          default:
            this.halted = true;
            this.pc = pc;
            this.sp = sp;
            this.bp = bp;
            this.time = t;
            return n;
        }
      }
    } catch (e) {
      if (!(e instanceof RuntimeError)) throw e;
      this.halted = true;
      this.error = { line: prog.lines[this.pc] ?? 0, message: e.message };
      this.time = t;
      return n;
    }
    this.pc = pc;
    this.sp = sp;
    this.bp = bp;
    this.time = t;
    return n;
  }

  private bin(op: number, ty: number, a: unknown, b: unknown, pc: number): unknown {
    const t = TYPES[ty];
    if (t === 'str') return String(a) + String(b);
    const x = a as number;
    const y = b as number;
    switch (BINOPS[op]) {
      case '+': return convConst(x + y, t);
      case '-': return convConst(x - y, t);
      case '*':
        if (t === 'i32') return Math.imul(x, y);
        if (t === 'u32') return Math.imul(x, y) >>> 0;
        return convConst(x * y, t);
      case '/':
        if (t !== 'f32' && y === 0) {
          this.pc = pc;
          this.fail('Delenie nulou.');
        }
        return t === 'f32' ? Math.fround(x / y) : convConst(Math.trunc(x / y), t);
      case '%':
        if (y === 0) {
          this.pc = pc;
          this.fail('Zvyšok po delení nulou (% 0).');
        }
        return convConst(x % y, t);
      case '&': return convConst(x & y, t);
      case '|': return convConst(x | y, t);
      case '^': return convConst(x ^ y, t);
      case '<<': {
        const bits = t === 'i32' || t === 'u32' ? 32 : 16;
        return y >= bits || y < 0 ? 0 : convConst(x * 2 ** y, t);
      }
      case '>>': {
        const bits = t === 'i32' || t === 'u32' ? 32 : 16;
        if (y >= bits || y < 0) return x < 0 ? -1 : 0;
        return convConst(Math.floor(x / 2 ** y), t);
      }
      default:
        return 0;
    }
  }

  private note(key: string, message: string): void {
    if (this.notes.has(key) || !this.program) return;
    this.notes.set(key, { line: this.program.lines[this.pc] ?? 0, message });
  }

  // ------------------------------------------------------------------ zabudované funkcie

  private validPin(pin: number, what: string): boolean {
    if (pin >= 0 && pin < PIN_COUNT) return true;
    this.note(`pin:${pin}`, `${what}: pin ${pin} na Arduine UNO neexistuje (sú len 0 až 13 a A0 až A5).`);
    return false;
  }

  /** Zmena výstupu: ak je obvod pozadu, najprv ho treba dopočítať (vráti false). */
  private canWrite(): boolean {
    const host = this.host;
    return !host || this.time - host.circuitTime() <= WRITE_MERGE;
  }

  private canRead(): boolean {
    const host = this.host;
    return !host || !this.dirty || this.time - host.circuitTime() <= 1e-9;
  }

  private sig(p: PinState): string {
    return `${p.mode}|${p.out}|${p.pwm}|${p.tone ? `${p.tone.f}:${p.tone.until}` : ''}|${p.servo ? p.servo.us : ''}`;
  }

  /** Zmení stav pinu; ak sa tým mení výstup, počká na obvod. */
  private changePin(pin: number, apply: (p: PinState) => void): NativeResult {
    const p = this.pins[pin];
    const before = this.sig(p);
    const copy = { ...p };
    apply(copy);
    if (this.sig(copy) === before) return undefined;
    if (!this.canWrite()) return YIELD;
    Object.assign(p, copy);
    this.dirty = true;
    return undefined;
  }

  private serialPins(pin: number): void {
    if (this.serialBegun && (pin === 0 || pin === 1)) {
      this.note('serialpins', 'Piny 0 (RX) a 1 (TX) používa sériová linka (Serial) – na iné účely ich nepoužívaj.');
    }
  }

  private digitalLevel(pin: number): number {
    const host = this.host;
    const p = this.pins[pin];
    p.readAt = this.time;
    if (!host) return p.mode === MODE.OUTPUT ? p.out : p.mode === MODE.INPUT_PULLUP ? 1 : 0;
    if (p.mode === MODE.INPUT && !p.out && host.pinFloating(pin)) {
      this.note(`float:${pin}`, `${pinName(pin)} je vstup, ku ktorému nie je nič pripojené („pláva“) – číta náhodne HIGH aj LOW. Pridaj pull-down rezistor k GND alebo použi pinMode(${pin}, INPUT_PULLUP).`);
      p.read = this.random() < 0.5 ? 1 : 0;
      return p.read;
    }
    const v = host.pinVoltage(pin);
    if (v >= 2.6) p.read = 1;
    else if (v <= 2.1) p.read = 0;
    return p.read;
  }

  private random(): number {
    // xorshift – opakovateľná postupnosť ako random() na Arduine
    let x = this.rng || 1;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng / 4294967296;
  }

  private lcdOf(obj: LcdObj): LcdState | null {
    return this.host?.lcd(obj.addr) ?? null;
  }

  private lcdWrite(lcd: LcdState, code: number): void {
    lcd.ddram[lcd.addr] = code & 0xff;
    const step = lcd.ltr ? 1 : -1;
    let a = lcd.addr + step;
    if (lcd.addr === 0x27 && step > 0) a = 0x40;
    else if (lcd.addr === 0x67 && step > 0) a = 0x00;
    else if (lcd.addr === 0x00 && step < 0) a = 0x67;
    else if (lcd.addr === 0x40 && step < 0) a = 0x27;
    lcd.addr = a;
    if (lcd.autoscroll) lcd.shift += step;
    lcd.version += 1;
  }

  private serialWrite(text: string): number {
    if (!this.serialBegun) {
      this.note('nobegin', 'Serial.print bez Serial.begin(9600) v setup() – na sériový monitor sa nič neodošle.');
      return 0;
    }
    const clean = text.replace(/\r/g, '');
    this.serialLog += clean;
    if (this.serialLog.length > 20000) {
      const cut = this.serialLog.indexOf('\n', this.serialLog.length - 16000);
      this.serialLog = this.serialLog.slice(cut >= 0 ? cut + 1 : this.serialLog.length - 16000);
    }
    this.serialVersion += 1;
    // Odosielanie trvá podľa rýchlosti linky; pri plnom zásobníku (64 B) program čaká.
    const charTime = 10 / (this.baud || 9600);
    this.txUntil = Math.max(this.txUntil, this.time) + text.length * charTime;
    this.txAt = this.time;
    const backlog = this.txUntil - this.time - 64 * charTime;
    if (backlog > 0) this.waitUntil = Math.max(this.waitUntil, this.time + backlog);
    return text.length;
  }

  private native(d: NativeCall, a: unknown[]): NativeResult {
    let impl = this.impls.get(d);
    if (!impl) {
      impl = this.implFor(d.name);
      this.impls.set(d, impl);
    }
    return impl(a, d);
  }

  private implFor(name: string): (a: unknown[], d: NativeCall) => NativeResult {
    const num = (v: unknown) => v as number;
    const cost = (s: number) => {
      this.time += s;
    };
    const f32 = Math.fround;
    switch (name) {
      case 'nop':
        return () => undefined;
      case 'pinMode':
        return (a) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'pinMode')) return undefined;
          const mode = num(a[1]);
          if (mode > 2) {
            this.note('mode', 'pinMode: režim musí byť INPUT, OUTPUT alebo INPUT_PULLUP.');
            return undefined;
          }
          this.serialPins(pin);
          const r = this.changePin(pin, (p) => {
            p.mode = mode;
            if (mode === MODE.INPUT_PULLUP) p.out = 1;
            if (mode === MODE.INPUT) p.out = 0;
            if (mode !== MODE.OUTPUT) p.pwm = 0;
          });
          if (r !== YIELD) cost(3e-6);
          return r;
        };
      case 'digitalWrite':
        return (a) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'digitalWrite')) return undefined;
          const val = num(a[1]) ? 1 : 0;
          const p = this.pins[pin];
          if (p.mode === MODE.INPUT && val) {
            this.note(`nopm:${pin}`, `digitalWrite(${pin}, HIGH) na pine, ktorý nie je výstup – chýba pinMode(${pin}, OUTPUT). Pin len zapol vnútorný pull-up rezistor (asi 35 kΩ), preto LED svieti len slabučko.`);
          }
          this.serialPins(pin);
          const r = this.changePin(pin, (q) => {
            q.out = val;
            q.pwm = 0;
            if (q.mode === MODE.INPUT_PULLUP && !val) q.mode = MODE.INPUT;
          });
          if (r !== YIELD) cost(3.5e-6);
          return r;
        };
      case 'digitalRead':
        return (a) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'digitalRead')) return 0;
          if (!this.canRead()) return YIELD;
          cost(3.5e-6);
          return this.digitalLevel(pin);
        };
      case 'analogRead':
        return (a) => {
          let pin = num(a[0]);
          if (pin < 6) pin += 14;
          if (pin < 14 || pin > 19) {
            this.note(`ar:${pin}`, `analogRead(${num(a[0])}): analógové vstupy sú len A0 až A5.`);
            return 0;
          }
          if (!this.canRead()) return YIELD;
          cost(112e-6);
          const p = this.pins[pin];
          p.readAt = this.time;
          if (this.host && p.mode === MODE.INPUT && !p.out && this.host.pinFloating(pin)) {
            this.note(`afloat:${pin}`, `${pinName(pin)} nie je nikam pripojený – analogRead vracia náhodné hodnoty. Pripoj naň napätie, napr. jazdec potenciometra.`);
            this.analogNoise = Math.max(0, Math.min(1023, this.analogNoise + Math.round((this.random() - 0.5) * 80)));
            return this.analogNoise;
          }
          const v = this.host ? this.host.pinVoltage(pin) : 0;
          return Math.max(0, Math.min(1023, Math.floor((v / 5) * 1024)));
        };
      case 'analogWrite':
        return (a) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'analogWrite')) return undefined;
          let val = num(a[1]);
          if (val < 0 || val > 255) {
            const low = val & 0xff;
            this.note(`awr:${pin}`, `analogWrite(${pin}, ${val}): hodnota má byť 0 až 255. Arduino použije len spodných 8 bitov (${low}). Na prepočet použi map().`);
            val = low === 0 && val !== 0 ? 0 : low;
          }
          const hasPwm = PWM_PINS.includes(pin);
          if (!hasPwm && val > 0 && val < 255) {
            this.note(`nopwm:${pin}`, `Pin ${pin} nemá PWM (~) – analogWrite naň dá len HIGH (hodnota ≥ 128) alebo LOW. PWM majú piny 3, 5, 6, 9, 10 a 11.`);
          }
          this.serialPins(pin);
          const r = this.changePin(pin, (p) => {
            p.mode = MODE.OUTPUT;
            if (val <= 0) {
              p.out = 0;
              p.pwm = 0;
            } else if (val >= 255) {
              p.out = 1;
              p.pwm = 0;
            } else if (hasPwm) {
              p.pwm = val;
            } else {
              p.out = val < 128 ? 0 : 1;
              p.pwm = 0;
            }
          });
          if (r !== YIELD) cost(6e-6);
          return r;
        };
      case 'delay':
        return (a) => {
          this.waitUntil = this.time + num(a[0]) / 1000;
          return undefined;
        };
      case 'delayMicroseconds':
        return (a) => {
          this.waitUntil = this.time + num(a[0]) * 1e-6;
          return undefined;
        };
      case 'millis':
        return () => Math.floor((this.time - this.startedAt) * 1000) >>> 0;
      case 'micros':
        return () => (Math.floor((this.time - this.startedAt) * 1e6 / 4) * 4) >>> 0;
      case 'tone':
        return (a, d) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'tone')) return undefined;
          const f = num(a[1]);
          const other = this.pins.findIndex((p, i) => i !== pin && p.tone && this.time < p.tone.until);
          if (other >= 0) {
            this.note('tone2', `tone(): Arduino vie naraz hrať len jeden tón – pin ${other} ešte hrá, preto sa tón na pine ${pin} nezapne.`);
            return undefined;
          }
          if (f < 31) {
            this.note('tonef', 'tone(): najnižšia frekvencia je 31 Hz.');
            return undefined;
          }
          const dur = d.argc > 2 ? num(a[2]) / 1000 : Infinity;
          const r = this.changePin(pin, (p) => {
            p.mode = MODE.OUTPUT;
            p.pwm = 0;
            const keep = p.tone && p.tone.f === f && this.time < p.tone.until;
            p.tone = { f, t0: keep ? p.tone!.t0 : this.time, until: this.time + dur };
          });
          if (r !== YIELD) cost(10e-6);
          return r;
        };
      case 'noTone':
        return (a) => {
          const pin = num(a[0]);
          if (!this.validPin(pin, 'noTone')) return undefined;
          return this.changePin(pin, (p) => {
            p.tone = null;
            p.out = 0;
          });
        };
      case 'map':
        return (a) => {
          const [x, inMin, inMax, outMin, outMax] = a.map(num);
          if (inMax === inMin) {
            this.fail('map(): druhá a tretia hodnota (rozsah vstupu) sú rovnaké – delenie nulou.');
          }
          const r = Math.trunc(Math.imul(convConst(x - inMin, 'i32'), convConst(outMax - outMin, 'i32')) / convConst(inMax - inMin, 'i32'));
          return convConst(r + outMin, 'i32');
        };
      case 'constrain':
        return (a) => {
          const [x, lo, hi] = a.map(num);
          return x < lo ? lo : x > hi ? hi : x;
        };
      case 'min':
        return (a) => Math.min(num(a[0]), num(a[1]));
      case 'max':
        return (a) => Math.max(num(a[0]), num(a[1]));
      case 'abs':
        return (a, d) => convConst(Math.abs(num(a[0])), d.ret);
      case 'sq':
        return (a, d) => {
          const x = num(a[0]);
          if (d.ret === 'i32') return Math.imul(x, x);
          if (d.ret === 'u32') return Math.imul(x, x) >>> 0;
          return convConst(x * x, d.ret);
        };
      case 'sqrt': return (a) => f32(Math.sqrt(num(a[0])));
      case 'sin': return (a) => f32(Math.sin(num(a[0])));
      case 'cos': return (a) => f32(Math.cos(num(a[0])));
      case 'tan': return (a) => f32(Math.tan(num(a[0])));
      case 'asin': return (a) => f32(Math.asin(num(a[0])));
      case 'acos': return (a) => f32(Math.acos(num(a[0])));
      case 'atan': return (a) => f32(Math.atan(num(a[0])));
      case 'exp': return (a) => f32(Math.exp(num(a[0])));
      case 'log': return (a) => f32(Math.log(num(a[0])));
      case 'log10': return (a) => f32(Math.log10(num(a[0])));
      case 'fabs': return (a) => f32(Math.abs(num(a[0])));
      case 'floor': return (a) => f32(Math.floor(num(a[0])));
      case 'ceil': return (a) => f32(Math.ceil(num(a[0])));
      case 'radians': return (a) => f32(num(a[0]) * (Math.PI / 180));
      case 'degrees': return (a) => f32(num(a[0]) * (180 / Math.PI));
      case 'pow': return (a) => f32(num(a[0]) ** num(a[1]));
      case 'atan2': return (a) => f32(Math.atan2(num(a[0]), num(a[1])));
      case 'fmod': return (a) => f32(num(a[0]) % num(a[1]));
      case 'round': return (a) => convConst(num(a[0]) >= 0 ? Math.trunc(num(a[0]) + 0.5) : Math.trunc(num(a[0]) - 0.5), 'i32');
      case 'isnan': return (a) => (Number.isNaN(num(a[0])) ? 1 : 0);
      case 'isinf': return (a) => (Number.isFinite(num(a[0])) || Number.isNaN(num(a[0])) ? 0 : 1);
      case 'random':
        return (a, d) => {
          const [lo, hi] = d.argc === 1 ? [0, num(a[0])] : [num(a[0]), num(a[1])];
          if (hi <= lo) return d.argc === 1 ? 0 : lo;
          return lo + Math.floor(this.random() * (hi - lo));
        };
      case 'randomSeed':
        return (a) => {
          if (num(a[0])) this.rng = num(a[0]) >>> 0;
          return undefined;
        };
      case 'bitRead': return (a) => (Math.floor(num(a[0]) / 2 ** num(a[1])) & 1);
      case 'bit': return (a) => (num(a[0]) >= 32 ? 0 : 2 ** num(a[0]));
      case 'lowByte': return (a) => num(a[0]) & 0xff;
      case 'highByte': return (a) => (num(a[0]) >>> 8) & 0xff;
      case 'bitSet': return (a) => (num(a[0]) | (num(a[1]) < 32 ? 2 ** num(a[1]) : 0)) >>> 0;
      case 'bitClear': return (a) => (num(a[0]) & ~(num(a[1]) < 32 ? 2 ** num(a[1]) : 0)) >>> 0;
      case 'bitWrite':
        return (a) => {
          const m = num(a[1]) < 32 ? 2 ** num(a[1]) : 0;
          return (num(a[2]) ? num(a[0]) | m : num(a[0]) & ~m) >>> 0;
        };
      case 'isDigit': return (a) => +/[0-9]/.test(String.fromCharCode(num(a[0])));
      case 'isAlpha': return (a) => +/[A-Za-z]/.test(String.fromCharCode(num(a[0])));
      case 'isAlphaNumeric': return (a) => +/[A-Za-z0-9]/.test(String.fromCharCode(num(a[0])));
      case 'isSpace': return (a) => +/[ \t\n\r\f\v]/.test(String.fromCharCode(num(a[0])));
      case 'isUpperCase': return (a) => +/[A-Z]/.test(String.fromCharCode(num(a[0])));
      case 'isLowerCase': return (a) => +/[a-z]/.test(String.fromCharCode(num(a[0])));
      case 'isPunct': return (a) => +/[!-/:-@[-`{-~]/.test(String.fromCharCode(num(a[0])));
      case 'String':
        return (a, d) => stringOf(a[0], d.tys[0], d.argc > 1 ? num(a[1]) : undefined);

      // -------------------------------------------------------------- Serial
      case 'Serial.begin':
        return (a) => {
          this.serialBegun = true;
          this.baud = num(a[0]) || 9600;
          if (this.pins[0].mode === MODE.OUTPUT || this.pins[1].mode === MODE.OUTPUT) this.serialPins(0);
          return undefined;
        };
      case 'Serial.print':
      case 'Serial.println':
        return (a, d) => {
          const text = d.argc ? valueText(a[0], d.tys[0], d.argc > 1 ? num(a[1]) : undefined) : '';
          return this.serialWrite(name === 'Serial.println' ? `${text}\r\n` : text);
        };
      case 'Serial.write':
        return (a, d) => this.serialWrite(d.tys[0] === 'str' ? String(a[0]) : String.fromCharCode(num(a[0]) & 0xff));
      case 'Serial.available':
        return () => this.serialIn.length;
      case 'Serial.availableForWrite':
        return () => 63;
      case 'Serial.read':
        return () => {
          if (!this.serialIn.length) return -1;
          const c = this.serialIn.charCodeAt(0) & 0xff;
          this.serialIn = this.serialIn.slice(1);
          return c;
        };
      case 'Serial.peek':
        return () => (this.serialIn.length ? this.serialIn.charCodeAt(0) & 0xff : -1);
      case 'Serial.parseInt':
      case 'Serial.parseFloat':
        return () => {
          const float = name === 'Serial.parseFloat';
          const m = (float ? /[-0-9.]/ : /[-0-9]/).exec(this.serialIn);
          if (!m) {
            // Nič neprišlo – čaká sa do vypršania času (ako na Arduine).
            this.serialIn = '';
            this.waitUntil = this.time + this.serialTimeout;
            return 0;
          }
          const rest = this.serialIn.slice(m.index);
          const num2 = (float ? /^-?\d*\.?\d*/ : /^-?\d*/).exec(rest)![0];
          this.serialIn = rest.slice(num2.length);
          const v = Number(num2);
          return float ? f32(Number.isFinite(v) ? v : 0) : convConst(Number.isFinite(v) ? v : 0, 'i32');
        };
      case 'Serial.readString':
        return () => {
          const s = this.serialIn;
          this.serialIn = '';
          this.waitUntil = this.time + this.serialTimeout;
          return s;
        };
      case 'Serial.readStringUntil':
        return (a) => {
          const ch = String.fromCharCode(num(a[0]) & 0xff);
          const i = this.serialIn.indexOf(ch);
          if (i >= 0) {
            const s = this.serialIn.slice(0, i);
            this.serialIn = this.serialIn.slice(i + 1);
            return s;
          }
          const s = this.serialIn;
          this.serialIn = '';
          this.waitUntil = this.time + this.serialTimeout;
          return s;
        };
      case 'Serial.setTimeout':
        return (a) => {
          this.serialTimeout = num(a[0]) / 1000;
          return undefined;
        };

      // -------------------------------------------------------------- String
      case 'String.length': return (a) => String(a[0]).length;
      case 'String.charAt':
        return (a) => {
          const s = String(a[0]);
          const i = num(a[1]);
          return i >= 0 && i < s.length ? convConst(s.charCodeAt(i), 'char') : 0;
        };
      case 'String.substring':
        return (a, d) => {
          const s = String(a[0]);
          let from = Math.max(0, num(a[1]));
          let to = d.argc > 2 ? Math.max(0, num(a[2])) : s.length;
          if (from > to) [from, to] = [to, from];
          return s.slice(from, to);
        };
      case 'String.indexOf':
        return (a, d) => {
          const what = d.tys[1] === 'str' ? String(a[1]) : String.fromCharCode(num(a[1]) & 0xff);
          return String(a[0]).indexOf(what, d.argc > 2 ? num(a[2]) : 0);
        };
      case 'String.lastIndexOf':
        return (a, d) => String(a[0]).lastIndexOf(d.tys[1] === 'str' ? String(a[1]) : String.fromCharCode(num(a[1]) & 0xff));
      case 'String.toInt': return (a) => convConst(parseLeading(String(a[0]), false), 'i32');
      case 'String.toFloat': return (a) => f32(parseLeading(String(a[0]), true));
      case 'String.equals': return (a) => +(String(a[0]) === String(a[1]));
      case 'String.equalsIgnoreCase': return (a) => +(String(a[0]).toLowerCase() === String(a[1]).toLowerCase());
      case 'String.startsWith': return (a) => +String(a[0]).startsWith(String(a[1]));
      case 'String.endsWith': return (a) => +String(a[0]).endsWith(String(a[1]));
      case 'String.compareTo': return (a) => Math.sign(String(a[0]).localeCompare(String(a[1])));
      case 'String.isEmpty': return (a) => +(String(a[0]).length === 0);
      case 'String.toUpperCase': return (a) => String(a[0]).toUpperCase();
      case 'String.toLowerCase': return (a) => String(a[0]).toLowerCase();
      case 'String.trim': return (a) => String(a[0]).trim();
      case 'String.replace': return (a) => String(a[0]).split(String(a[1])).join(String(a[2]));
      case 'String.remove':
        return (a, d) => {
          const s = String(a[0]);
          const i = num(a[1]);
          return d.argc > 2 ? s.slice(0, i) + s.slice(i + num(a[2])) : s.slice(0, i);
        };
      case 'String.setCharAt':
        return (a) => {
          const s = String(a[0]);
          const i = num(a[1]);
          if (i < 0 || i >= s.length) return s;
          return s.slice(0, i) + String.fromCharCode(num(a[2]) & 0xff) + s.slice(i + 1);
        };

      // -------------------------------------------------------------- Servo
      case 'Servo.new':
        return () => {
          const s = new ServoObj();
          this.servos.push(s);
          return s;
        };
      case 'Servo.attach':
        return (a, d) => {
          const s = a[0] as ServoObj;
          const pin = num(a[1]);
          if (!this.validPin(pin, 'servo.attach')) return 0;
          if (d.argc > 2) s.min = num(a[2]);
          if (d.argc > 3) s.max = num(a[3]);
          const r = this.changePin(pin, (p) => {
            p.mode = MODE.OUTPUT;
            p.pwm = 0;
            p.servo = { us: s.us, t0: p.servo?.t0 ?? this.time };
          });
          if (r === YIELD) return YIELD;
          s.pin = pin;
          return 1;
        };
      case 'Servo.write':
      case 'Servo.writeMicroseconds':
        return (a) => {
          const s = a[0] as ServoObj;
          let v = num(a[1]);
          let us: number;
          if (name === 'Servo.write' && v < s.min) {
            v = Math.max(0, Math.min(180, v));
            us = Math.round(s.min + ((s.max - s.min) * v) / 180);
          } else {
            us = Math.max(s.min, Math.min(s.max, v));
          }
          if (s.pin < 0) {
            s.us = us;
            this.note('servo', 'servo.write() pred servo.attach(pin) – servo ešte nevie, na ktorom pine je.');
            return undefined;
          }
          const r = this.changePin(s.pin, (p) => {
            p.servo = { us, t0: p.servo?.t0 ?? this.time };
          });
          if (r !== YIELD) {
            s.us = us;
            cost(5e-6);
          }
          return r;
        };
      case 'Servo.read':
        return (a) => {
          const s = a[0] as ServoObj;
          return Math.round(((s.us - s.min) * 180) / (s.max - s.min));
        };
      case 'Servo.readMicroseconds': return (a) => (a[0] as ServoObj).us;
      case 'Servo.attached': return (a) => +((a[0] as ServoObj).pin >= 0);
      case 'Servo.detach':
        return (a) => {
          const s = a[0] as ServoObj;
          if (s.pin < 0) return undefined;
          const r = this.changePin(s.pin, (p) => {
            p.servo = null;
            p.out = 0;
          });
          if (r !== YIELD) s.pin = -1;
          return r;
        };

      // -------------------------------------------------------------- LCD
      case 'LCD.new':
        return (a) => new LcdObj(num(a[0]), num(a[1]), num(a[2]));
      default:
        if (name.startsWith('LCD.')) return this.lcdImpl(name.slice(4));
        return () => {
          this.fail(`Funkcia ${name} nie je dostupná.`);
        };
    }
  }

  private lcdImpl(m: string): (a: unknown[], d: NativeCall) => NativeResult {
    const num = (v: unknown) => v as number;
    const op = (busTime: number, fn: (lcd: LcdState, obj: LcdObj, a: unknown[], d: NativeCall) => unknown) => (a: unknown[], d: NativeCall) => {
      const obj = a[0] as LcdObj;
      this.time += busTime;
      const lcd = this.lcdOf(obj);
      if (!lcd) {
        this.note('lcd', `LCD displej s adresou 0x${obj.addr.toString(16).toUpperCase()} neodpovedá. Skontroluj zapojenie (GND, VCC na 5V, SDA na A4, SCL na A5) a adresu displeja.`);
        return d.ret === 'void' ? undefined : 0;
      }
      const r = fn(lcd, obj, a, d);
      lcd.version += 1;
      return r;
    };
    const printText = (lcd: LcdState, text: string) => {
      for (const ch of text) this.lcdWrite(lcd, lcdCode(ch));
      return text.length;
    };
    switch (m) {
      case 'init':
      case 'begin':
        return op(50e-3, (lcd, obj) => {
          lcd.ddram.fill(0x20);
          lcd.addr = 0;
          lcd.shift = 0;
          lcd.displayOn = true;
          lcd.cursorOn = false;
          lcd.blinkOn = false;
          lcd.ltr = true;
          lcd.autoscroll = false;
          lcd.initialized = true;
          lcd.backlight = obj.backlight;
        });
      case 'clear':
        return op(2e-3, (lcd) => {
          lcd.ddram.fill(0x20);
          lcd.addr = 0;
          lcd.shift = 0;
          lcd.ltr = true;
        });
      case 'home':
        return op(2e-3, (lcd) => {
          lcd.addr = 0;
          lcd.shift = 0;
        });
      case 'setCursor':
        return op(0.3e-3, (lcd, obj, a) => {
          const offsets = [0x00, 0x40, 0x14, 0x54];
          let row = num(a[2]);
          if (row >= obj.rows) row = obj.rows - 1;
          lcd.addr = (num(a[1]) + offsets[row]) & 0x7f;
        });
      case 'print':
      case 'println':
        return (a, d) => {
          const text = d.argc > 1 ? valueText(a[1], d.tys[1], d.argc > 2 ? num(a[2]) : undefined) : '';
          const full = m === 'println' ? `${text}\r\n` : text;
          return op(0.25e-3 * full.length, (lcd) => printText(lcd, full))(a, d);
        };
      case 'write':
        return op(0.25e-3, (lcd, _o, a) => {
          this.lcdWrite(lcd, num(a[1]));
          return 1;
        });
      case 'backlight':
      case 'noBacklight':
      case 'setBacklight':
        return op(0.1e-3, (lcd, obj, a) => {
          obj.backlight = m === 'backlight' || (m === 'setBacklight' && !!num(a[1]));
          lcd.backlight = obj.backlight;
        });
      case 'display': return op(0.1e-3, (lcd) => { lcd.displayOn = true; });
      case 'noDisplay': return op(0.1e-3, (lcd) => { lcd.displayOn = false; });
      case 'cursor': return op(0.1e-3, (lcd) => { lcd.cursorOn = true; });
      case 'noCursor': return op(0.1e-3, (lcd) => { lcd.cursorOn = false; });
      case 'blink': return op(0.1e-3, (lcd) => { lcd.blinkOn = true; });
      case 'noBlink': return op(0.1e-3, (lcd) => { lcd.blinkOn = false; });
      case 'scrollDisplayLeft': return op(0.1e-3, (lcd) => { lcd.shift += 1; });
      case 'scrollDisplayRight': return op(0.1e-3, (lcd) => { lcd.shift -= 1; });
      case 'leftToRight': return op(0.1e-3, (lcd) => { lcd.ltr = true; });
      case 'rightToLeft': return op(0.1e-3, (lcd) => { lcd.ltr = false; });
      case 'autoscroll': return op(0.1e-3, (lcd) => { lcd.autoscroll = true; });
      case 'noAutoscroll': return op(0.1e-3, (lcd) => { lcd.autoscroll = false; });
      case 'createChar':
        return op(1e-3, (lcd, _o, a) => {
          const n = num(a[1]) & 7;
          const rows = a[2] as number[];
          for (let r = 0; r < 8; r++) lcd.cgram[n * 8 + r] = (rows[r] ?? 0) & 0x1f;
        });
      default:
        return () => undefined;
    }
  }
}

function buildArray(t: ArrayTemplate): unknown[] {
  const clone = (v: unknown): unknown => (Array.isArray(v) ? v.map(clone) : v);
  if (t.init) return clone(t.init) as unknown[];
  const make = (depth: number): unknown[] => Array.from({ length: t.dims[depth] }, () => (depth + 1 < t.dims.length ? make(depth + 1) : t.fill));
  return make(0);
}

/** Text na obrazovke LCD: dva riadky po 16 znakov (kódy znakov). */
export function lcdVisible(lcd: LcdState, cols = 16, rows = 2): number[][] {
  const bases = [0x00, 0x40, 0x14, 0x54];
  const out: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: number[] = [];
    for (let c = 0; c < cols; c++) {
      const off = (((c + lcd.shift) % 40) + 40) % 40;
      line.push(lcd.ddram[bases[r] + off]);
    }
    out.push(line);
  }
  return out;
}

/** Kde je kurzor na obrazovke (stĺpec, riadok), alebo null, ak je mimo. */
export function lcdCursor(lcd: LcdState, cols = 16): [number, number] | null {
  const row = lcd.addr >= 0x40 ? 1 : 0;
  const col = (((lcd.addr - (row ? 0x40 : 0) - lcd.shift) % 40) + 40) % 40;
  return col < cols ? [col, row] : null;
}
