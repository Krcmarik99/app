/**
 * Prekladač programu pre Arduino do jednoduchého zásobníkového bajtkódu.
 * Typy zodpovedajú Arduinu UNO (ATmega328P): int má 16 bitov, long 32 bitov, float a double
 * sú 32-bitové. Pretečenie celých čísel sa správa rovnako ako na skutočnom Arduine.
 */
import {
  CompileError, parse,
  type ArrTy, type Expr, type FuncDef, type InitList, type ObjTy, type Program, type Scalar, type Stmt, type Ty, type VarDecl,
} from './parser';

export const OP = {
  PUSH: 1, POP: 2, DUP: 3, DUP2: 4, SWAP: 5,
  LOADG: 6, STOREG: 7, LOADL: 8, STOREL: 9, LOADIDX: 10, STOREIDX: 11,
  BIN: 12, CMP: 13, NEG: 14, BNOT: 15, LNOT: 16, CONV: 17,
  JMP: 18, JZ: 19, JNZ: 20, CALL: 21, RET: 22, RETV: 23, NATIVE: 24, NEWARR: 25, HALT: 26,
} as const;

/** Počet operandov za každou inštrukciou. */
export const OPERANDS: Record<number, number> = {
  [OP.PUSH]: 1, [OP.POP]: 0, [OP.DUP]: 0, [OP.DUP2]: 0, [OP.SWAP]: 0,
  [OP.LOADG]: 1, [OP.STOREG]: 1, [OP.LOADL]: 1, [OP.STOREL]: 1, [OP.LOADIDX]: 0, [OP.STOREIDX]: 0,
  [OP.BIN]: 2, [OP.CMP]: 2, [OP.NEG]: 1, [OP.BNOT]: 1, [OP.LNOT]: 0, [OP.CONV]: 2,
  [OP.JMP]: 1, [OP.JZ]: 1, [OP.JNZ]: 1, [OP.CALL]: 2, [OP.RET]: 0, [OP.RETV]: 0, [OP.NATIVE]: 1, [OP.NEWARR]: 1, [OP.HALT]: 0,
};

export const TYPES: Scalar[] = ['bool', 'char', 'i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'f32', 'str', 'void'];
export const TY = Object.fromEntries(TYPES.map((t, i) => [t, i])) as Record<Scalar, number>;
export const BINOPS = ['+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>'];
export const CMPOPS = ['<', '>', '<=', '>=', '==', '!='];

export interface NativeCall {
  name: string;
  argc: number;
  tys: Scalar[];
  ret: Scalar;
}

export interface ArrayTemplate {
  dims: number[];
  fill: number | string;
  /** Počiatočné hodnoty (vnorené polia), ak sú všetky konštantné. */
  init?: unknown[];
}

export interface FuncInfo {
  name: string;
  addr: number;
  nparams: number;
  nlocals: number;
  ret: Scalar;
}

export interface Diagnostic {
  line: number;
  message: string;
}

export interface Compiled {
  code: number[];
  lines: number[];
  consts: unknown[];
  funcs: FuncInfo[];
  nglobals: number;
  entry: number;
  warnings: Diagnostic[];
  /** Odhad obsadenej pamäte RAM globálnymi premennými (bajty). */
  ramBytes: number;
  /** Mená globálnych premenných (pre zobrazenie). */
  globalNames: string[];
}

export type CompileResult = { ok: true; program: Compiled } | { ok: false; error: Diagnostic };

type Num = Exclude<Scalar, 'str' | 'void'>;
const NUMERIC: Scalar[] = ['bool', 'char', 'i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'f32'];
const isNum = (t: Ty): t is Num => typeof t === 'string' && NUMERIC.includes(t);
const isInt = (t: Ty): t is Exclude<Num, 'f32'> => isNum(t) && t !== 'f32';
const isArr = (t: Ty): t is ArrTy => typeof t === 'object' && 'arr' in t;
const isObj = (t: Ty): t is ObjTy => typeof t === 'object' && 'obj' in t;

const TYPE_NAMES: Record<Scalar, string> = {
  bool: 'bool', char: 'char', i8: 'signed char', u8: 'byte', i16: 'int', u16: 'unsigned int', i32: 'long', u32: 'unsigned long',
  f32: 'float', str: 'String', void: 'void',
};

export function typeName(t: Ty): string {
  if (typeof t === 'string') return TYPE_NAMES[t];
  if (isArr(t)) return `pole ${typeName(t.arr)}[]`;
  return t.obj === 'LCD' ? 'LiquidCrystal_I2C' : t.obj;
}

function promote(t: Scalar): Scalar {
  return t === 'bool' || t === 'char' || t === 'i8' || t === 'u8' ? 'i16' : t;
}

/** Obvyklé aritmetické konverzie jazyka C pre AVR. */
export function arith(a: Scalar, b: Scalar): Scalar {
  if (a === 'f32' || b === 'f32') return 'f32';
  const pa = promote(a);
  const pb = promote(b);
  if (pa === pb) return pa;
  const rank = (t: Scalar) => (t === 'i32' || t === 'u32' ? 2 : 1);
  const signed = (t: Scalar) => t === 'i16' || t === 'i32';
  if (signed(pa) === signed(pb)) return rank(pa) >= rank(pb) ? pa : pb;
  const [s, u] = signed(pa) ? [pa, pb] : [pb, pa];
  return rank(u) >= rank(s) ? u : s;
}

function sizeOf(t: Ty): number {
  if (isArr(t)) return (t.size ?? 0) * sizeOf(t.arr);
  if (isObj(t)) return t.obj === 'LCD' ? 8 : 1;
  return { bool: 1, char: 1, i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4, str: 6, void: 0 }[t];
}

const BUILTIN_CONSTS: Record<string, [number, Scalar]> = {
  HIGH: [1, 'i16'], LOW: [0, 'i16'], INPUT: [0, 'i16'], OUTPUT: [1, 'i16'], INPUT_PULLUP: [2, 'i16'],
  LED_BUILTIN: [13, 'i16'], A0: [14, 'u8'], A1: [15, 'u8'], A2: [16, 'u8'], A3: [17, 'u8'], A4: [18, 'u8'], A5: [19, 'u8'],
  true: [1, 'bool'], false: [0, 'bool'], NULL: [0, 'i16'],
  PI: [Math.fround(Math.PI), 'f32'], HALF_PI: [Math.fround(Math.PI / 2), 'f32'], TWO_PI: [Math.fround(Math.PI * 2), 'f32'],
  DEG_TO_RAD: [Math.fround(Math.PI / 180), 'f32'], RAD_TO_DEG: [Math.fround(180 / Math.PI), 'f32'], EULER: [Math.fround(Math.E), 'f32'],
  DEC: [10, 'i16'], HEX: [16, 'i16'], OCT: [8, 'i16'], BIN: [2, 'i16'],
  LSBFIRST: [0, 'i16'], MSBFIRST: [1, 'i16'], CHANGE: [1, 'i16'], FALLING: [2, 'i16'], RISING: [3, 'i16'],
};

/** Funkcie, ktoré Arduino pozná, ale tu nie sú (s vysvetlením). */
const UNSUPPORTED_FUNCS: Record<string, string> = {
  attachInterrupt: 'Prerušenia (attachInterrupt) tu nie sú podporované – stav tlačidla čítaj v loop() pomocou digitalRead().',
  detachInterrupt: 'Prerušenia nie sú podporované.',
  pulseIn: 'pulseIn() tu nie je podporované.',
  shiftOut: 'shiftOut() tu nie je podporované.',
  shiftIn: 'shiftIn() tu nie je podporované.',
  sprintf: 'sprintf() nie je podporované – text poskladaj pomocou String(…) alebo viacerých volaní print().',
  snprintf: 'snprintf() nie je podporované – text poskladaj pomocou String(…).',
  malloc: 'Dynamická pamäť (malloc) nie je podporovaná.',
  free: 'Dynamická pamäť nie je podporovaná.',
  strcpy: 'Funkcie pre text v štýle C (strcpy, strcat, …) nie sú podporované – použi typ String.',
  strcat: 'Funkcie pre text v štýle C nie sú podporované – použi typ String.',
  strcmp: 'Funkcie pre text v štýle C nie sú podporované – texty porovnaj pomocou ==.',
};

const FUNCS = [
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'analogReference', 'delay', 'delayMicroseconds', 'millis', 'micros',
  'tone', 'noTone', 'map', 'constrain', 'min', 'max', 'abs', 'sq', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'exp', 'log', 'log10', 'fabs', 'floor', 'ceil', 'round', 'fmod', 'radians', 'degrees', 'random', 'randomSeed', 'bitRead', 'bitSet',
  'bitClear', 'bitWrite', 'bit', 'lowByte', 'highByte', 'isDigit', 'isAlpha', 'isAlphaNumeric', 'isSpace', 'isUpperCase', 'isLowerCase',
  'isPunct', 'F', 'String', 'yield', 'interrupts', 'noInterrupts', 'pgm_read_byte', 'pgm_read_word', 'isnan', 'isinf', 'atoi', 'atol', 'atof',
];

const SUPPORTED_LIBS = ['Arduino.h', 'Servo.h', 'Wire.h', 'LiquidCrystal_I2C.h', 'math.h', 'stdlib.h', 'avr/pgmspace.h', 'string.h', 'stdint.h'];

interface Sym {
  where: 'g' | 'l';
  slot: number;
  ty: Ty;
  isConst: boolean;
  constVal?: number;
}

interface FuncEntry {
  def: FuncDef;
  idx: number;
  info: FuncInfo;
}

interface LoopCtx {
  breaks: number[];
  continues: number[] | null;
}

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

class Compiler {
  readonly code: number[] = [];
  readonly lines: number[] = [];
  readonly consts: unknown[] = [];
  private readonly constIdx = new Map<string, number>();
  private readonly globals = new Map<string, Sym>();
  private readonly globalNames: string[] = [];
  private nglobals = 0;
  private readonly funcs = new Map<string, FuncEntry>();
  private readonly funcList: FuncInfo[] = [];
  private readonly enums = new Map<string, number>();
  readonly warnings: Diagnostic[] = [];
  private readonly libs = new Set<string>();
  private scopes: Map<string, Sym>[] = [];
  private nlocals = 0;
  private fn: FuncEntry | null = null;
  private loops: LoopCtx[] = [];
  private readonly staticInits: { sym: Sym; decl: VarDecl }[] = [];
  private line = 0;
  private ram = 9;

  // ------------------------------------------------------------------ výstup

  private emit(op: number, ...args: number[]): number {
    const at = this.code.length;
    this.code.push(op, ...args);
    for (let i = 0; i <= args.length; i++) this.lines.push(this.line);
    return at;
  }

  private k(value: unknown): number {
    if (typeof value === 'number' || typeof value === 'string') {
      const key = `${typeof value}:${String(value)}${Object.is(value, -0) ? '-0' : ''}`;
      const found = this.constIdx.get(key);
      if (found !== undefined) return found;
      this.constIdx.set(key, this.consts.length);
    }
    this.consts.push(value);
    return this.consts.length - 1;
  }

  private push(value: number | string): void {
    this.emit(OP.PUSH, this.k(value));
  }

  private jump(op: number): number {
    return this.emit(op, -1) + 1;
  }

  private patch(at: number, target = this.code.length): void {
    this.code[at] = target;
  }

  private err(message: string, line = this.line): CompileError {
    return new CompileError(message, line);
  }

  private warn(message: string, line = this.line): void {
    if (!this.warnings.some((w) => w.line === line && w.message === message)) this.warnings.push({ line, message });
  }

  /** Prevedie hodnotu na vrchu zásobníka z typu `from` na typ `to`. */
  private conv(from: Ty, to: Ty, what = 'hodnotu'): void {
    if (from === to) return;
    if (isNum(from) && isNum(to)) {
      if (from !== to) this.emit(OP.CONV, TY[from], TY[to]);
      return;
    }
    if (isNum(from) && to === 'str') {
      this.emit(OP.CONV, TY[from], TY.str);
      return;
    }
    if (isArr(from) && isArr(to)) {
      if (typeName(from.arr) !== typeName(to.arr) && !(isNum(from.arr) && isNum(to.arr) && sizeOf(from.arr) === sizeOf(to.arr))) {
        throw this.err(`Pole typu ${typeName(from)} sa nedá odovzdať ako ${typeName(to)}.`);
      }
      return;
    }
    if (from === 'str' && isNum(to)) {
      throw this.err(`Text (String) sa nedá použiť ako číslo (${typeName(to)}). Na prevod použi .toInt() alebo .toFloat().`);
    }
    if (from === 'void') throw this.err(`Funkcia nevracia žiadnu hodnotu (void) – nedá sa použiť ako ${what}.`);
    throw this.err(`Typ ${typeName(from)} sa nedá použiť ako ${typeName(to)}.`);
  }

  /** Typ výrazu bez vygenerovania kódu (výraz sa „preloží naprázdno“). */
  private typeOf(x: Expr): Ty {
    const n = this.code.length;
    const m = this.lines.length;
    const line = this.line;
    const t = this.expr(x);
    this.code.length = n;
    this.lines.length = m;
    this.line = line;
    return t;
  }

  // ------------------------------------------------------------------ mená

  private lookup(name: string): Sym | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const s = this.scopes[i].get(name);
      if (s) return s;
    }
    return this.globals.get(name);
  }

  private unknown(name: string, line: number): CompileError {
    const known = [
      ...this.scopes.flatMap((s) => [...s.keys()]), ...this.globals.keys(), ...this.funcs.keys(), ...this.enums.keys(),
      ...Object.keys(BUILTIN_CONSTS), ...FUNCS, 'Serial',
    ];
    const lower = name.toLowerCase();
    const same = known.find((k) => k.toLowerCase() === lower);
    const close = same ?? known.filter((k) => k.length >= 3 && levenshtein(k, name) <= (name.length > 5 ? 2 : 1))[0];
    const hint = close ? ` Nemyslel si „${close}“?${same ? ' (Na veľkosti písmen záleží.)' : ''}` : '';
    return new CompileError(`„${name}“ nie je deklarované.${hint}`, line);
  }

  private declare(name: string, ty: Ty, isConst: boolean, line: number, isStatic = false): Sym {
    if (this.fn && !isStatic) {
      const scope = this.scopes[this.scopes.length - 1];
      if (scope.has(name)) throw this.err(`Premenná „${name}“ je v tomto bloku už deklarovaná.`, line);
      const sym: Sym = { where: 'l', slot: this.nlocals++, ty, isConst };
      scope.set(name, sym);
      return sym;
    }
    const sym: Sym = { where: 'g', slot: this.nglobals++, ty, isConst };
    if (this.fn) {
      const scope = this.scopes[this.scopes.length - 1];
      if (scope.has(name)) throw this.err(`Premenná „${name}“ je v tomto bloku už deklarovaná.`, line);
      scope.set(name, sym);
      this.globalNames.push(`${this.fn.def.name}::${name}`);
    } else {
      if (this.globals.has(name) || this.funcs.has(name)) throw this.err(`„${name}“ je už deklarované.`, line);
      this.globals.set(name, sym);
      this.globalNames.push(name);
    }
    this.ram += sizeOf(ty);
    return sym;
  }

  private load(sym: Sym): void {
    this.emit(sym.where === 'g' ? OP.LOADG : OP.LOADL, sym.slot);
  }

  private store(sym: Sym): void {
    this.emit(sym.where === 'g' ? OP.STOREG : OP.STOREL, sym.slot);
  }

  private temp(): Sym {
    return { where: 'l', slot: this.nlocals++, ty: 'i32', isConst: false };
  }

  // ------------------------------------------------------------------ konštanty

  /** Hodnota konštantného výrazu (veľkosť poľa, case), alebo null. */
  private constEval(x: Expr): number | null {
    switch (x.e) {
      case 'num':
        return x.v;
      case 'id': {
        const sym = this.lookup(x.name);
        if (sym) return sym.constVal ?? null;
        if (this.enums.has(x.name)) return this.enums.get(x.name)!;
        if (x.name in BUILTIN_CONSTS) return BUILTIN_CONSTS[x.name][0];
        const bin = /^B([01]{1,8})$/.exec(x.name);
        return bin ? parseInt(bin[1], 2) : null;
      }
      case 'un': {
        const a = this.constEval(x.a);
        if (a === null) return null;
        return x.op === '-' ? -a : x.op === '+' ? a : x.op === '!' ? (a ? 0 : 1) : ~a;
      }
      case 'bin': {
        const a = this.constEval(x.a);
        const b = this.constEval(x.b);
        if (a === null || b === null) return null;
        switch (x.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b ? (Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b) : null;
          case '%': return b ? a % b : null;
          case '<<': return a << b;
          case '>>': return a >> b;
          case '&': return a & b;
          case '|': return a | b;
          case '^': return a ^ b;
          case '==': return +(a === b);
          case '!=': return +(a !== b);
          case '<': return +(a < b);
          case '>': return +(a > b);
          case '<=': return +(a <= b);
          case '>=': return +(a >= b);
          default: return null;
        }
      }
      case 'cast': {
        const a = this.constEval(x.a);
        return a === null ? null : x.ty === 'f32' ? a : Math.trunc(a);
      }
      case 'sizeof':
        return this.sizeofValue(x);
      case 'cond': {
        const c = this.constEval(x.c);
        return c === null ? null : this.constEval(c ? x.a : x.b);
      }
      default:
        return null;
    }
  }

  private sizeofValue(x: Extract<Expr, { e: 'sizeof' }>): number {
    const t = x.ty ? this.resolveTy(x.ty, x.line) : this.typeOf(x.a!);
    return sizeOf(t);
  }

  /** Doplní veľkosti polí z konštantných výrazov. */
  private resolveTy(t: Ty, line: number, init?: Expr | InitList): Ty {
    if (!isArr(t)) return t;
    let size = t.size;
    if (t.sizeExpr) {
      const v = this.constEval(t.sizeExpr);
      if (v === null || !Number.isInteger(v)) throw this.err('Veľkosť poľa musí byť celé číslo alebo konštanta (const int).', line);
      if (v <= 0) throw this.err('Veľkosť poľa musí byť kladná.', line);
      if (v > 4096) throw this.err(`Pole s ${v} prvkami sa do 2 KB pamäte Arduina UNO nezmestí.`, line);
      size = v;
    } else if (init && 'items' in init) {
      size = init.items.length;
    }
    const inner = this.resolveTy(t.arr, line, init && 'items' in init ? init.items.find((i) => 'items' in i) : undefined);
    if (isArr(inner) && inner.size === null) throw this.err('Vo viacrozmernom poli musí byť zadaná veľkosť vnútorných rozmerov.', line);
    return { arr: inner, size };
  }

  // ------------------------------------------------------------------ program

  compile(prog: Program): Compiled {
    for (const inc of prog.includes) {
      if (!SUPPORTED_LIBS.includes(inc.name)) {
        throw this.err(`Knižnica <${inc.name}> tu nie je k dispozícii. Podporované sú Servo.h, Wire.h a LiquidCrystal_I2C.h.`, inc.line);
      }
      this.libs.add(inc.name);
    }
    // Vstupný bod: init → setup → loop dookola. Adresy funkcií sa doplnia neskôr.
    for (const item of prog.items) {
      if (item.k === 'enum') this.declareEnum(item.en);
      if (item.k === 'func') this.declareFunc(item.fn);
    }
    for (const name of ['setup', 'loop']) {
      const f = this.funcs.get(name);
      if (!f?.def.body) {
        throw this.err(`Program musí obsahovať funkciu void ${name}() { … }${name === 'setup' ? ' – vykoná sa raz po zapnutí' : ' – opakuje sa stále dookola'}.`, 1);
      }
      if (f.def.params.length) throw this.err(`Funkcia ${name}() nemá mať parametre.`, f.def.line);
    }
    const initIdx = this.funcList.length;
    const init = this.addFunc('__init', 'void', 0, 0);
    this.line = 1;
    const entry = this.code.length;
    this.emit(OP.CALL, initIdx, 0);
    this.emit(OP.CALL, this.funcs.get('setup')!.idx, 0);
    const loopAt = this.emit(OP.CALL, this.funcs.get('loop')!.idx, 0);
    this.emit(OP.JMP, loopAt);

    // Globálne premenné: deklarácie v poradí, inicializácia v pseudo-funkcii __init.
    const globalInits: { sym: Sym; decl: VarDecl }[] = [];
    for (const item of prog.items) {
      if (item.k !== 'var') continue;
      const d = item.decl;
      for (const v of d.vars) {
        this.line = v.line;
        const ty = this.resolveTy(v.ty, v.line, v.init);
        const sym = this.declare(v.name, ty, d.isConst, v.line);
        if (d.isConst && isNum(ty) && v.init && !('items' in v.init)) {
          const c = this.constEval(v.init);
          if (c !== null) sym.constVal = ty === 'f32' ? c : Math.trunc(c);
        }
        if (d.isConst && !v.init && !isObj(ty)) throw this.err(`Konštanta „${v.name}“ musí mať hodnotu, napr. const int ${v.name} = 13;`, v.line);
        globalInits.push({ sym, decl: v });
      }
    }

    for (const item of prog.items) {
      if (item.k === 'func' && item.fn.body) this.compileFunc(this.funcs.get(item.fn.name)!);
    }

    // __init
    init.addr = this.code.length;
    this.fn = { def: { name: '__init', ret: 'void', params: [], body: null, line: 1 }, idx: initIdx, info: init };
    this.scopes = [new Map()];
    this.nlocals = 0;
    for (const g of [...globalInits, ...this.staticInits]) this.initVar(g.sym, g.decl);
    this.emit(OP.RETV);
    init.nlocals = this.nlocals;
    this.fn = null;

    return {
      code: this.code, lines: this.lines, consts: this.consts, funcs: this.funcList, nglobals: this.nglobals, entry,
      warnings: this.warnings, ramBytes: this.ram + (this.usesSerial ? 175 : 0), globalNames: this.globalNames,
    };
  }

  private usesSerial = false;

  private declareEnum(en: { values: { name: string; v?: Expr; line: number }[] }): void {
    let next = 0;
    for (const v of en.values) {
      if (v.v) {
        const c = this.constEval(v.v);
        if (c === null) throw this.err('Hodnota v enum musí byť konštanta.', v.line);
        next = c;
      }
      if (this.enums.has(v.name)) throw this.err(`„${v.name}“ je už v enum deklarované.`, v.line);
      this.enums.set(v.name, next);
      next += 1;
    }
  }

  private addFunc(name: string, ret: Scalar, nparams: number, addr: number): FuncInfo {
    const info: FuncInfo = { name, addr, nparams, nlocals: nparams, ret };
    this.funcList.push(info);
    return info;
  }

  private declareFunc(def: FuncDef): void {
    const existing = this.funcs.get(def.name);
    if (existing) {
      const sameSig = existing.def.params.length === def.params.length && existing.def.ret === def.ret;
      if (existing.def.body && def.body) throw this.err(`Funkcia ${def.name}() je definovaná dvakrát.`, def.line);
      if (!sameSig) throw this.err(`Funkcia ${def.name}() je deklarovaná s inými parametrami – rovnaké meno s inými parametrami (preťaženie) tu nie je podporované.`, def.line);
      if (def.body) existing.def = def;
      return;
    }
    const info = this.addFunc(def.name, def.ret, def.params.length, -1);
    this.funcs.set(def.name, { def, idx: this.funcList.length - 1, info });
  }

  private compileFunc(f: FuncEntry): void {
    const def = f.def;
    f.info.addr = this.code.length;
    this.fn = f;
    this.nlocals = 0;
    this.scopes = [new Map()];
    this.loops = [];
    this.line = def.line;
    for (const p of def.params) {
      const ty = this.resolveTy(p.ty, p.line);
      if (isObj(ty) && !p.name) throw this.err('Parameter musí mať meno.', p.line);
      this.declare(p.name || `__p${this.nlocals}`, ty, false, p.line);
    }
    this.block(def.body!, false);
    this.line = def.line;
    if (def.ret === 'void') this.emit(OP.RETV);
    else {
      this.push(def.ret === 'str' ? '' : 0);
      this.emit(OP.RET);
    }
    f.info.nlocals = this.nlocals;
    this.fn = null;
  }

  // ------------------------------------------------------------------ premenné

  private initVar(sym: Sym, v: VarDecl): void {
    this.line = v.line;
    const ty = sym.ty;
    if (isObj(ty)) {
      this.construct(ty, v);
      this.store(sym);
      this.emit(OP.POP);
      return;
    }
    if (isArr(ty)) {
      this.initArray(sym, ty, v.init, v.line);
      return;
    }
    if (v.ctorArgs) {
      // String s("text"); alebo int x(5);
      if (v.ctorArgs.length !== 1) throw this.err(`Premennú ${v.name} inicializuj takto: ${typeName(ty)} ${v.name} = hodnota;`);
      v = { ...v, init: v.ctorArgs[0] };
    }
    if (v.init && 'items' in v.init) {
      if (v.init.items.length !== 1 || 'items' in v.init.items[0]) throw this.err(`Do premennej ${v.name} patrí jedna hodnota, nie zoznam { … }.`);
      v = { ...v, init: v.init.items[0] };
    }
    if (v.init) {
      const t = this.expr(v.init as Expr);
      this.assignConv(t, ty, v.name);
    } else {
      this.push(ty === 'str' ? '' : 0);
    }
    this.store(sym);
    this.emit(OP.POP);
  }

  private construct(ty: ObjTy, v: VarDecl): void {
    if (ty.obj === 'Servo') {
      if (!this.libs.has('Servo.h')) throw this.err('Na servo treba na začiatok programu pridať #include <Servo.h>.');
      if (v.ctorArgs?.length) throw this.err('Servo sa vytvára bez parametrov: Servo servo; Pin nastavíš v setup() cez servo.attach(9);');
      this.nativeEmit('Servo.new', [], 'i16');
      return;
    }
    if (!this.libs.has('LiquidCrystal_I2C.h')) throw this.err('Na LCD displej treba na začiatok programu pridať #include <LiquidCrystal_I2C.h>.');
    const args = v.ctorArgs ?? [];
    if (args.length !== 3) throw this.err(`Zadaj adresu a veľkosť displeja: LiquidCrystal_I2C ${v.name}(0x27, 16, 2);`);
    this.nativeCall('LCD.new', args, ['u8', 'u8', 'u8'], 'i16');
  }

  private initArray(sym: Sym, ty: ArrTy, init: Expr | InitList | undefined, line: number): void {
    const dims: number[] = [];
    let elem: Ty = ty;
    while (isArr(elem)) {
      if (elem.size === null) throw this.err('Pri poli bez zadanej veľkosti musíš uviesť počiatočné hodnoty, napr. int a[] = {1, 2, 3};', line);
      dims.push(elem.size);
      elem = elem.arr;
    }
    if (isObj(elem)) throw this.err('Polia objektov nie sú podporované.', line);
    const fill = elem === 'str' ? '' : 0;
    if (init && !('items' in init)) {
      if (init.e === 'str' && elem === 'char') throw this.err('Text ulož do premennej typu String alebo char text[] = "…";', line);
      throw this.err('Pole sa inicializuje zoznamom hodnôt v zložených zátvorkách, napr. {1, 2, 3}.', line);
    }
    // Konštantné hodnoty sa pripravia vopred, ostatné sa dopočítajú pri štarte.
    const dynamic: { path: number[]; x: Expr }[] = [];
    const build = (list: InitList | undefined, depth: number, path: number[]): unknown[] => {
      const n = dims[depth];
      if (list && list.items.length > n) throw this.err(`Príliš veľa hodnôt – pole má len ${n} prvkov.`, list.line);
      const out: unknown[] = [];
      for (let i = 0; i < n; i++) {
        const item = list?.items[i];
        if (depth + 1 < dims.length) {
          if (item && !('items' in item)) throw this.err('Vo viacrozmernom poli patrí každý riadok do zložených zátvoriek { }.', line);
          out.push(build(item as InitList | undefined, depth + 1, [...path, i]));
        } else if (!item) {
          out.push(fill);
        } else if ('items' in item) {
          throw this.err('Priveľa zložených zátvoriek { } v zozname hodnôt.', item.line);
        } else {
          const c = elem !== 'str' ? this.constEval(item) : item.e === 'str' ? null : null;
          if (elem === 'str' && item.e === 'str') out.push(item.v);
          else if (c !== null && isNum(elem)) out.push(convConst(c, elem as Scalar));
          else {
            out.push(fill);
            dynamic.push({ path: [...path, i], x: item });
          }
        }
      }
      return out;
    };
    const template: ArrayTemplate = { dims, fill, init: build(init as InitList | undefined, 0, []) };
    this.emit(OP.NEWARR, this.k(template));
    this.store(sym);
    this.emit(OP.POP);
    for (const d of dynamic) {
      this.line = d.x.line;
      this.load(sym);
      for (let i = 0; i < d.path.length - 1; i++) {
        this.push(d.path[i]);
        this.emit(OP.LOADIDX);
      }
      this.push(d.path[d.path.length - 1]);
      const t = this.expr(d.x);
      this.assignConv(t, elem, 'prvok poľa');
      this.emit(OP.STOREIDX);
      this.emit(OP.POP);
    }
  }

  /** Prevod pri priradení – s upozornením na typické chyby. */
  private assignConv(from: Ty, to: Ty, what: string): void {
    if (isArr(to)) throw this.err(`Do poľa ${what} sa nedá priradiť naraz – priraďuj jednotlivé prvky, napr. ${what}[0] = …;`);
    if (isObj(to) || isObj(from)) throw this.err('Objekty sa nedajú priraďovať.');
    if (isArr(from)) throw this.err(`Pole sa nedá priradiť do premennej typu ${typeName(to)}.`);
    if (from === 'str' && to !== 'str') throw this.err(`Text sa nedá uložiť do premennej typu ${typeName(to)}. Na prevod textu na číslo použi .toInt().`);
    this.conv(from, to, what);
  }

  // ------------------------------------------------------------------ príkazy

  private block(st: Stmt, newScope = true): void {
    if (newScope) this.scopes.push(new Map());
    if (st.s === 'block') for (const s of st.body) this.stmt(s);
    else this.stmt(st);
    if (newScope) this.scopes.pop();
  }

  private cond(x: Expr): void {
    const t = this.expr(x);
    if (t === 'str') throw this.err('Podmienka musí byť číslo alebo porovnanie – text (String) porovnaj pomocou == alebo .length() > 0.', x.line);
    if (!isNum(t)) throw this.err('Podmienka musí byť číslo alebo porovnanie.', x.line);
    if (x.e === 'asg' && x.op === '=') this.warn('V podmienke je priradenie = . Na porovnanie sa používa == (dve rovnítka).', x.line);
  }

  private stmt(st: Stmt): void {
    this.line = st.line;
    switch (st.s) {
      case 'block':
        this.block(st);
        break;
      case 'empty':
        break;
      case 'expr': {
        const t = this.expr(st.x);
        if (t !== 'void') this.emit(OP.POP);
        if (st.x.e === 'bin' && st.x.op === '==') this.warn('Porovnanie == tu nič nerobí. Ak si chcel priradiť hodnotu, použi jedno rovnítko =.', st.line);
        break;
      }
      case 'decl':
        for (const v of st.vars) {
          this.line = v.line;
          const ty = this.resolveTy(v.ty, v.line, v.init);
          if (isObj(ty)) throw this.err(`Objekt ${typeName(ty)} deklaruj mimo funkcií – na začiatku programu.`, v.line);
          const sym = this.declare(v.name, ty, st.isConst, v.line, st.isStatic);
          if (st.isConst && isNum(ty) && v.init && !('items' in v.init)) {
            const c = this.constEval(v.init);
            if (c !== null) sym.constVal = ty === 'f32' ? c : Math.trunc(c);
          }
          if (st.isStatic) this.staticInits.push({ sym, decl: v });
          else this.initVar(sym, v);
        }
        break;
      case 'if': {
        this.cond(st.c);
        const jElse = this.jump(OP.JZ);
        this.block(st.t);
        if (st.f) {
          const jEnd = this.jump(OP.JMP);
          this.patch(jElse);
          this.block(st.f);
          this.patch(jEnd);
        } else {
          this.patch(jElse);
        }
        break;
      }
      case 'while': {
        const top = this.code.length;
        this.cond(st.c);
        const jEnd = this.jump(OP.JZ);
        const ctx: LoopCtx = { breaks: [], continues: [] };
        this.loops.push(ctx);
        this.block(st.body);
        this.loops.pop();
        this.line = st.line;
        this.emit(OP.JMP, top);
        this.patch(jEnd);
        ctx.breaks.forEach((b) => this.patch(b));
        ctx.continues!.forEach((c) => this.patch(c, top));
        break;
      }
      case 'do': {
        const top = this.code.length;
        const ctx: LoopCtx = { breaks: [], continues: [] };
        this.loops.push(ctx);
        this.block(st.body);
        this.loops.pop();
        const condAt = this.code.length;
        this.line = st.c.line;
        this.cond(st.c);
        this.emit(OP.JNZ, top);
        ctx.breaks.forEach((b) => this.patch(b));
        ctx.continues!.forEach((c) => this.patch(c, condAt));
        break;
      }
      case 'for': {
        this.scopes.push(new Map());
        if (st.init) this.stmt(st.init);
        const top = this.code.length;
        let jEnd = -1;
        if (st.c) {
          this.line = st.line;
          this.cond(st.c);
          jEnd = this.jump(OP.JZ);
        }
        const ctx: LoopCtx = { breaks: [], continues: [] };
        this.loops.push(ctx);
        this.block(st.body);
        this.loops.pop();
        const stepAt = this.code.length;
        if (st.step) {
          this.line = st.line;
          const t = this.expr(st.step);
          if (t !== 'void') this.emit(OP.POP);
        }
        this.emit(OP.JMP, top);
        if (jEnd >= 0) this.patch(jEnd);
        ctx.breaks.forEach((b) => this.patch(b));
        ctx.continues!.forEach((c) => this.patch(c, stepAt));
        this.scopes.pop();
        break;
      }
      case 'switch': {
        const t = this.expr(st.x);
        if (!isInt(t)) throw this.err(t === 'str' ? 'switch nefunguje s textom (String) – použi if a ==.' : 'switch potrebuje celé číslo alebo znak.', st.line);
        const tmp = this.temp();
        this.store(tmp);
        this.emit(OP.POP);
        const seen = new Set<number>();
        const jumps: number[] = [];
        let jDefault = -1;
        for (const c of st.cases) {
          this.line = c.line;
          if (c.v === null) continue;
          const v = this.constEval(c.v);
          if (v === null) throw this.err('Za case musí byť konštanta (číslo, znak alebo konštanta z enum).', c.line);
          const cv = convConst(v, promote(t));
          if (seen.has(cv)) throw this.err(`Hodnota ${v} je v switch dvakrát.`, c.line);
          seen.add(cv);
          this.load(tmp);
          this.conv(t, promote(t));
          this.push(cv);
          this.emit(OP.CMP, CMPOPS.indexOf('=='), TY[promote(t)]);
          jumps.push(this.jump(OP.JNZ));
        }
        jDefault = this.jump(OP.JMP);
        const ctx: LoopCtx = { breaks: [], continues: null };
        this.loops.push(ctx);
        this.scopes.push(new Map());
        let k = 0;
        let hasDefault = false;
        for (const c of st.cases) {
          if (c.v === null) {
            this.patch(jDefault);
            hasDefault = true;
          } else {
            this.patch(jumps[k++]);
          }
          for (const s of c.body) this.stmt(s);
        }
        this.scopes.pop();
        this.loops.pop();
        if (!hasDefault) this.patch(jDefault);
        ctx.breaks.forEach((b) => this.patch(b));
        break;
      }
      case 'break': {
        const ctx = this.loops[this.loops.length - 1];
        if (!ctx) throw this.err('break môže byť len v cykle alebo v switch.', st.line);
        ctx.breaks.push(this.jump(OP.JMP));
        break;
      }
      case 'continue': {
        const ctx = [...this.loops].reverse().find((l) => l.continues);
        if (!ctx) throw this.err('continue môže byť len v cykle.', st.line);
        ctx.continues!.push(this.jump(OP.JMP));
        break;
      }
      case 'return': {
        const ret = this.fn!.def.ret;
        if (ret === 'void') {
          if (st.x) {
            const t = this.typeOf(st.x);
            if (t !== 'void') throw this.err(`Funkcia ${this.fn!.def.name}() je void – nemôže vracať hodnotu.`, st.line);
            this.expr(st.x);
          }
          this.emit(OP.RETV);
        } else {
          if (!st.x) throw this.err(`Funkcia ${this.fn!.def.name}() musí vrátiť hodnotu typu ${typeName(ret)}.`, st.line);
          const t = this.expr(st.x);
          this.assignConv(t, ret, 'návratovú hodnotu');
          this.emit(OP.RET);
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------------ výrazy

  private expr(x: Expr): Ty {
    this.line = x.line;
    switch (x.e) {
      case 'num':
        this.push(x.v);
        return x.ty;
      case 'str':
        this.push(x.v);
        return 'str';
      case 'id':
        return this.ident(x.name, x.line);
      case 'bin':
        return this.binary(x.op, x.a, x.b, x.line);
      case 'log': {
        this.cond(x.a);
        const jShort = this.jump(x.op === '&&' ? OP.JZ : OP.JNZ);
        this.cond(x.b);
        const jShort2 = this.jump(x.op === '&&' ? OP.JZ : OP.JNZ);
        this.push(x.op === '&&' ? 1 : 0);
        const jEnd = this.jump(OP.JMP);
        this.patch(jShort);
        this.patch(jShort2);
        this.push(x.op === '&&' ? 0 : 1);
        this.patch(jEnd);
        return 'bool';
      }
      case 'un': {
        const t = this.expr(x.a);
        if (!isNum(t)) throw this.err(`Operátor ${x.op} sa dá použiť len na čísla.`, x.line);
        if (x.op === '!') {
          this.emit(OP.LNOT);
          return 'bool';
        }
        const p = promote(t);
        this.conv(t, p);
        if (x.op === '-') this.emit(OP.NEG, TY[p]);
        if (x.op === '~') {
          if (p === 'f32') throw this.err('Operátor ~ sa nedá použiť na desatinné číslo.', x.line);
          this.emit(OP.BNOT, TY[p]);
        }
        return p;
      }
      case 'inc':
        return this.increment(x);
      case 'asg':
        return this.assign(x);
      case 'cond': {
        const ta = this.typeOf(x.a);
        const tb = this.typeOf(x.b);
        let t: Ty;
        if (ta === 'str' || tb === 'str') {
          if (ta !== tb) throw this.err('Obe vetvy podmieneného výrazu ? : musia byť text alebo obe čísla.', x.line);
          t = 'str';
        } else if (isNum(ta) && isNum(tb)) t = arith(ta, tb);
        else if (ta === 'void' && tb === 'void') t = 'void';
        else throw this.err('Vetvy podmieneného výrazu ? : majú nezlučiteľné typy.', x.line);
        this.cond(x.c);
        const jElse = this.jump(OP.JZ);
        this.conv(this.expr(x.a), t);
        const jEnd = this.jump(OP.JMP);
        this.patch(jElse);
        this.conv(this.expr(x.b), t);
        this.patch(jEnd);
        return t;
      }
      case 'call':
        return this.call(x.fn, x.args, x.line);
      case 'mcall':
        return this.method(x.obj, x.name, x.args, x.line);
      case 'idx': {
        const ta = this.typeOf(x.a);
        if (ta === 'str') {
          return this.method(x.a, 'charAt', [x.i], x.line);
        }
        this.expr(x.a);
        if (!isArr(ta)) throw this.err('Hranaté zátvorky [ ] sa dajú použiť len na pole.', x.line);
        const ti = this.expr(x.i);
        if (!isInt(ti)) throw this.err('Index poľa musí byť celé číslo.', x.line);
        this.emit(OP.LOADIDX);
        return ta.arr;
      }
      case 'cast': {
        const t = this.expr(x.a);
        if (x.ty === 'str') {
          if (t === 'str') return 'str';
          if (!isNum(t)) throw this.err(`Typ ${typeName(t)} sa nedá previesť na text.`, x.line);
          this.conv(t, 'str');
          return 'str';
        }
        if (t === 'str') throw this.err(`Text sa nedá pretypovať na ${typeName(x.ty)} – použi .toInt() alebo .toFloat().`, x.line);
        this.conv(t, x.ty);
        return x.ty;
      }
      case 'sizeof':
        this.push(this.sizeofValue(x));
        return 'u16';
      case 'comma': {
        const t = this.expr(x.a);
        if (t !== 'void') this.emit(OP.POP);
        return this.expr(x.b);
      }
      case 'addr':
        throw this.err('Operátor & (adresa premennej) tu nie je podporovaný.', x.line);
    }
  }

  private ident(name: string, line: number): Ty {
    const sym = this.lookup(name);
    if (sym) {
      this.load(sym);
      return sym.ty;
    }
    if (this.enums.has(name)) {
      this.push(this.enums.get(name)!);
      return 'i16';
    }
    if (name in BUILTIN_CONSTS) {
      const [v, t] = BUILTIN_CONSTS[name];
      this.push(v);
      return t;
    }
    const bin = /^B([01]{1,8})$/.exec(name);
    if (bin) {
      this.push(parseInt(bin[1], 2));
      return 'i16';
    }
    if (name === 'Serial') {
      this.push(1);
      return 'bool';
    }
    if (this.funcs.has(name) || FUNCS.includes(name)) throw this.err(`${name} je funkcia – volá sa so zátvorkami: ${name}(…)`, line);
    throw this.unknown(name, line);
  }

  private binary(op: string, a: Expr, b: Expr, line: number): Ty {
    const ta = this.expr(a);
    const tb = this.typeOf(b);
    this.line = line;
    const cmp = CMPOPS.includes(op);
    if (ta === 'str' || tb === 'str') {
      if (op === '+') {
        if (!(ta === 'str' || isNum(ta)) || !(tb === 'str' || isNum(tb))) throw this.err('K textu sa dá pripojiť len text alebo číslo.', line);
        if (a.e === 'str' && b.e !== 'str' && tb !== 'str') {
          this.warn('V skutočnom Arduine "text" + číslo nespojí text s číslom. Použi String("text") + číslo.', line);
        }
        this.conv(ta, 'str');
        this.conv(this.expr(b), 'str');
        this.emit(OP.BIN, 0, TY.str);
        return 'str';
      }
      if (cmp) {
        if (ta !== 'str' || tb !== 'str') throw this.err('Text sa dá porovnať len s textom (v úvodzovkách "…").', line);
        this.expr(b);
        this.emit(OP.CMP, CMPOPS.indexOf(op), TY.str);
        return 'bool';
      }
      throw this.err(`Operátor ${op} sa nedá použiť na text.`, line);
    }
    if (!isNum(ta) || !isNum(tb)) {
      if (ta === 'void' || tb === 'void') throw this.err('Funkcia typu void nevracia hodnotu – nedá sa s ňou počítať.', line);
      throw this.err(`Operátor ${op} sa dá použiť len na čísla.`, line);
    }
    if (op === '<<' || op === '>>') {
      if (ta === 'f32' || tb === 'f32') throw this.err(`Posun ${op} sa dá použiť len na celé čísla.`, line);
      const p = promote(ta);
      this.conv(ta, p);
      this.conv(this.expr(b), 'i16');
      this.emit(OP.BIN, BINOPS.indexOf(op), TY[p]);
      return p;
    }
    const t = arith(ta, tb);
    if ((op === '%' || op === '&' || op === '|' || op === '^') && t === 'f32') {
      throw this.err(op === '%' ? 'Operátor % (zvyšok po delení) sa nedá použiť na desatinné čísla – použi fmod().' : `Operátor ${op} sa nedá použiť na desatinné čísla.`, line);
    }
    this.conv(ta, t);
    this.conv(this.expr(b), t);
    if (cmp) {
      this.emit(OP.CMP, CMPOPS.indexOf(op), TY[t]);
      return 'bool';
    }
    if (op === '/' && t !== 'f32') {
      const cb = this.constEval(b);
      if (cb === 0) throw this.err('Delenie nulou.', line);
    }
    this.emit(OP.BIN, BINOPS.indexOf(op), TY[t]);
    return t;
  }

  /** Prístup k miestu, kam sa dá zapisovať: premenná alebo prvok poľa (pole a index sú už na zásobníku). */
  private lvalue(x: Expr, what: string): { k: 'var'; sym: Sym } | { k: 'elem'; ty: Ty } | { k: 'chr'; sym: Sym } {
    if (x.e === 'id') {
      const sym = this.lookup(x.name);
      if (!sym) {
        if (x.name in BUILTIN_CONSTS || this.enums.has(x.name)) throw this.err(`${x.name} je konštanta – nedá sa zmeniť.`, x.line);
        throw this.unknown(x.name, x.line);
      }
      if (sym.isConst) throw this.err(`„${x.name}“ je konštanta (const) – nedá sa zmeniť.`, x.line);
      if (isArr(sym.ty)) throw this.err(`Do poľa ${x.name} sa nedá priradiť naraz – priraďuj jednotlivé prvky, napr. ${x.name}[0] = …;`, x.line);
      if (isObj(sym.ty)) throw this.err('Objekty sa nedajú priraďovať.', x.line);
      return { k: 'var', sym };
    }
    if (x.e === 'idx') {
      if (x.a.e === 'id') {
        const sym = this.lookup(x.a.name);
        if (sym?.ty === 'str') {
          if (sym.isConst) throw this.err(`„${x.a.name}“ je konštanta (const) – nedá sa zmeniť.`, x.line);
          this.load(sym);
          const ti = this.expr(x.i);
          if (!isInt(ti)) throw this.err('Index musí byť celé číslo.', x.line);
          return { k: 'chr', sym };
        }
      }
      const ta = this.expr(x.a);
      if (!isArr(ta)) throw this.err('Hranaté zátvorky [ ] sa dajú použiť len na pole.', x.line);
      if (isArr(ta.arr)) throw this.err('Do riadku viacrozmerného poľa sa nedá priradiť naraz.', x.line);
      if (x.a.e === 'id' && this.lookup(x.a.name)?.isConst) throw this.err(`Pole „${x.a.name}“ je konštantné (const) – nedá sa meniť.`, x.line);
      const ti = this.expr(x.i);
      if (!isInt(ti)) throw this.err('Index poľa musí byť celé číslo.', x.line);
      return { k: 'elem', ty: ta.arr };
    }
    throw this.err(`${what} sa dá len do premennej alebo prvku poľa.`, x.line);
  }

  private assign(x: Extract<Expr, { e: 'asg' }>): Ty {
    const lv = this.lvalue(x.a, 'Priradiť');
    this.line = x.line;
    if (lv.k === 'chr') {
      if (x.op !== '=') throw this.err('Znak v texte sa dá len priradiť (=).', x.line);
      const t = this.expr(x.b);
      if (!isInt(t)) throw this.err('Do textu na pozíciu [i] sa dá priradiť len znak, napr. \'A\'.', x.line);
      this.conv(t, 'char');
      this.nativeEmit('String.setCharAt', ['str', 'i16', 'char'], 'str');
      this.store(lv.sym);
      this.emit(OP.POP);
      return 'void';
    }
    const target = lv.k === 'var' ? lv.sym.ty : lv.ty;
    if (x.op === '=') {
      const t = this.expr(x.b);
      this.assignConv(t, target, x.a.e === 'id' ? x.a.name : 'prvok poľa');
    } else {
      const op = x.op.slice(0, -1);
      if (lv.k === 'var') this.load(lv.sym);
      else {
        this.emit(OP.DUP2);
        this.emit(OP.LOADIDX);
      }
      if (target === 'str') {
        if (op !== '+') throw this.err(`Operátor ${x.op} sa nedá použiť na text.`, x.line);
        const tb = this.expr(x.b);
        if (!(tb === 'str' || isNum(tb))) throw this.err('K textu sa dá pripojiť len text alebo číslo.', x.line);
        this.conv(tb, 'str');
        this.emit(OP.BIN, 0, TY.str);
      } else {
        if (!isNum(target)) throw this.err(`Operátor ${x.op} sa dá použiť len na čísla.`, x.line);
        const tb = this.typeOf(x.b);
        if (!isNum(tb)) throw this.err(tb === 'str' ? 'Text sa nedá pripočítať k číslu.' : `Operátor ${x.op} potrebuje číslo.`, x.line);
        if (op === '<<' || op === '>>') {
          const p = promote(target);
          this.conv(target, p);
          this.conv(this.expr(x.b), 'i16');
          this.emit(OP.BIN, BINOPS.indexOf(op), TY[p]);
          this.conv(p, target);
        } else {
          const t = arith(target, tb);
          if ((op === '%' || op === '&' || op === '|' || op === '^') && t === 'f32') throw this.err(`Operátor ${x.op} sa nedá použiť na desatinné čísla.`, x.line);
          this.conv(target, t);
          this.conv(this.expr(x.b), t);
          this.emit(OP.BIN, BINOPS.indexOf(op), TY[t]);
          this.conv(t, target);
        }
      }
    }
    if (lv.k === 'var') this.store(lv.sym);
    else this.emit(OP.STOREIDX);
    return target;
  }

  private increment(x: Extract<Expr, { e: 'inc' }>): Ty {
    const lv = this.lvalue(x.a, x.op === '++' ? 'Zvýšiť' : 'Znížiť');
    if (lv.k === 'chr') throw this.err(`${x.op} sa nedá použiť na znak v texte.`, x.line);
    const target = lv.k === 'var' ? lv.sym.ty : lv.ty;
    if (!isNum(target)) throw this.err(`${x.op} sa dá použiť len na číselnú premennú.`, x.line);
    const p = target === 'f32' ? 'f32' : promote(target);
    const op = BINOPS.indexOf(x.op === '++' ? '+' : '-');
    let tmp: Sym | null = null;
    if (lv.k === 'var') {
      this.load(lv.sym);
      if (!x.prefix) this.emit(OP.DUP);
    } else {
      this.emit(OP.DUP2);
      this.emit(OP.LOADIDX);
      if (!x.prefix) {
        tmp = this.temp();
        this.store(tmp);
      }
    }
    this.conv(target, p);
    this.push(1);
    this.emit(OP.BIN, op, TY[p]);
    this.conv(p, target);
    if (lv.k === 'var') {
      this.store(lv.sym);
      if (!x.prefix) this.emit(OP.POP);
    } else {
      this.emit(OP.STOREIDX);
      if (tmp) {
        this.emit(OP.POP);
        this.load(tmp);
      }
    }
    return target;
  }

  // ------------------------------------------------------------------ volania

  /** Preloží argumenty s prevodom na zadané typy ('*' = ponechať typ) a zavolá natívnu funkciu. */
  private nativeCall(name: string, args: Expr[], params: (Scalar | '*')[], ret: Scalar): Scalar {
    const tys: Scalar[] = [];
    args.forEach((a, i) => {
      const t = this.expr(a);
      const want = params[i] ?? '*';
      if (want === '*') {
        if (!(isNum(t) || t === 'str')) throw this.err(`Hodnota typu ${typeName(t)} sa tu nedá použiť.`, a.line);
        tys.push(t as Scalar);
      } else {
        if (t === 'str' && want !== 'str') throw this.err(`Funkcia ${name.replace(/^\w+\./, '')} tu potrebuje číslo, nie text.`, a.line);
        if (isArr(t) || isObj(t)) throw this.err(`Funkcia ${name.replace(/^\w+\./, '')} tu potrebuje ${want === 'str' ? 'text' : 'číslo'}.`, a.line);
        this.conv(t, want);
        tys.push(want);
      }
    });
    this.nativeEmit(name, tys, ret);
    return ret;
  }

  private nativeEmit(name: string, tys: Scalar[], ret: Scalar): void {
    const desc: NativeCall = { name, argc: tys.length, tys, ret };
    this.emit(OP.NATIVE, this.k(desc));
  }

  private argc(name: string, args: Expr[], min: number, max = min, usage = ''): void {
    if (args.length < min || args.length > max) {
      const n = min === max ? `${min}` : `${min} až ${max}`;
      throw this.err(`Funkcia ${name}() potrebuje ${n} ${min === 1 && max === 1 ? 'hodnotu' : 'hodnoty'}${usage ? `: ${usage}` : ''}.`);
    }
  }

  private numType(args: Expr[]): Scalar {
    let t: Scalar | null = null;
    for (const a of args) {
      const ta = this.typeOf(a);
      if (!isNum(ta)) throw this.err('Tu patrí číslo.', a.line);
      t = t ? arith(t, ta) : promote(ta);
    }
    return t ?? 'i16';
  }

  private call(name: string, args: Expr[], line: number): Ty {
    this.line = line;
    const user = this.funcs.get(name);
    if (user) return this.callUser(user, args);
    if (name in UNSUPPORTED_FUNCS) throw this.err(UNSUPPORTED_FUNCS[name]);
    const n = (t: Scalar) => new Array<Scalar>(args.length).fill(t);
    switch (name) {
      case 'pinMode':
        this.argc(name, args, 2, 2, 'pinMode(pin, OUTPUT)');
        return this.nativeCall(name, args, ['u8', 'u8'], 'void');
      case 'digitalWrite':
        this.argc(name, args, 2, 2, 'digitalWrite(pin, HIGH)');
        return this.nativeCall(name, args, ['u8', 'u8'], 'void');
      case 'digitalRead':
        this.argc(name, args, 1, 1, 'digitalRead(pin)');
        return this.nativeCall(name, args, ['u8'], 'i16');
      case 'analogRead':
        this.argc(name, args, 1, 1, 'analogRead(A0)');
        return this.nativeCall(name, args, ['u8'], 'i16');
      case 'analogWrite':
        this.argc(name, args, 2, 2, 'analogWrite(pin, 0 až 255)');
        return this.nativeCall(name, args, ['u8', 'i16'], 'void');
      case 'analogReference':
        this.argc(name, args, 1);
        return this.nativeCall('nop', args, ['u8'], 'void');
      case 'delay':
        this.argc(name, args, 1, 1, 'delay(milisekundy)');
        return this.nativeCall(name, args, ['u32'], 'void');
      case 'delayMicroseconds':
        this.argc(name, args, 1, 1, 'delayMicroseconds(mikrosekundy)');
        return this.nativeCall(name, args, ['u16'], 'void');
      case 'millis':
      case 'micros':
        this.argc(name, args, 0);
        return this.nativeCall(name, args, [], 'u32');
      case 'tone':
        this.argc(name, args, 2, 3, 'tone(pin, frekvencia) alebo tone(pin, frekvencia, trvanie)');
        return this.nativeCall(name, args, ['u8', 'u16', 'u32'], 'void');
      case 'noTone':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['u8'], 'void');
      case 'map':
        this.argc(name, args, 5, 5, 'map(hodnota, odMin, odMax, doMin, doMax)');
        return this.nativeCall(name, args, n('i32'), 'i32');
      case 'constrain': {
        this.argc(name, args, 3, 3, 'constrain(hodnota, min, max)');
        const t = this.numType(args);
        return this.nativeCall(name, args, n(t), t);
      }
      case 'min':
      case 'max': {
        this.argc(name, args, 2);
        const t = this.numType(args);
        return this.nativeCall(name, args, n(t), t);
      }
      case 'abs':
      case 'sq': {
        this.argc(name, args, 1);
        const t = this.numType(args);
        return this.nativeCall(name, args, [t], t);
      }
      case 'sqrt': case 'sin': case 'cos': case 'tan': case 'asin': case 'acos': case 'atan': case 'exp': case 'log': case 'log10':
      case 'fabs': case 'floor': case 'ceil': case 'radians': case 'degrees':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['f32'], 'f32');
      case 'pow': case 'atan2': case 'fmod':
        this.argc(name, args, 2);
        return this.nativeCall(name, args, ['f32', 'f32'], 'f32');
      case 'round':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['f32'], 'i32');
      case 'isnan': case 'isinf':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['f32'], 'bool');
      case 'random':
        this.argc(name, args, 1, 2, 'random(max) alebo random(min, max)');
        return this.nativeCall(name, args, n('i32'), 'i32');
      case 'randomSeed':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['u32'], 'void');
      case 'bitRead': {
        this.argc(name, args, 2, 2, 'bitRead(hodnota, bit)');
        const t = this.numType([args[0]]);
        return this.nativeCall(name, args, [t, 'i16'], 'i16');
      }
      case 'bit':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['i16'], 'u32');
      case 'lowByte':
      case 'highByte':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['u32'], 'u8');
      case 'bitSet':
      case 'bitClear':
      case 'bitWrite': {
        // Makrá, ktoré menia premennú: bitSet(x, n) je x |= (1UL << n).
        this.argc(name, args, name === 'bitWrite' ? 3 : 2);
        const lv = this.lvalue(args[0], name);
        if (lv.k === 'chr') throw this.err(`${name} sa nedá použiť na znak v texte.`);
        const target = lv.k === 'var' ? lv.sym.ty : lv.ty;
        if (!isInt(target)) throw this.err(`${name} sa dá použiť len na celočíselnú premennú.`);
        if (lv.k === 'var') this.load(lv.sym);
        else {
          this.emit(OP.DUP2);
          this.emit(OP.LOADIDX);
        }
        this.conv(target, 'u32');
        this.conv(this.expr(args[1]), 'i16');
        if (name === 'bitWrite') this.conv(this.expr(args[2]), 'bool');
        this.nativeEmit(name, name === 'bitWrite' ? ['u32', 'i16', 'bool'] : ['u32', 'i16'], 'u32');
        this.conv('u32', target);
        if (lv.k === 'var') this.store(lv.sym);
        else this.emit(OP.STOREIDX);
        return target;
      }
      case 'isDigit': case 'isAlpha': case 'isAlphaNumeric': case 'isSpace': case 'isUpperCase': case 'isLowerCase': case 'isPunct':
        this.argc(name, args, 1);
        return this.nativeCall(name, args, ['i16'], 'bool');
      case 'F':
        this.argc(name, args, 1);
        if (args[0].e !== 'str') throw this.err('F(…) sa používa len s textom v úvodzovkách: F("text").');
        return this.expr(args[0]);
      case 'String': {
        this.argc(name, args, 0, 2, 'String(hodnota) alebo String(hodnota, HEX)');
        if (!args.length) {
          this.push('');
          return 'str';
        }
        const t = this.typeOf(args[0]);
        if (t === 'str' && args.length === 1) return this.expr(args[0]);
        if (!isNum(t) && t !== 'str') throw this.err('String(…) potrebuje číslo alebo text.');
        return this.nativeCall('String', args, ['*', 'i16'], 'str');
      }
      case 'atoi':
      case 'atol':
        this.argc(name, args, 1);
        return this.nativeCall('String.toInt', args, ['str'], name === 'atoi' ? 'i16' : 'i32');
      case 'atof':
        this.argc(name, args, 1);
        return this.nativeCall('String.toFloat', args, ['str'], 'f32');
      case 'pgm_read_byte':
      case 'pgm_read_word': {
        this.argc(name, args, 1);
        const a = args[0];
        if (a.e !== 'addr') throw this.err(`${name}(&pole[i]) potrebuje adresu prvku poľa.`);
        const t = this.expr(a.a);
        if (!isNum(t)) throw this.err(`${name} číta len čísla.`);
        const r: Scalar = name === 'pgm_read_byte' ? 'u8' : 'u16';
        this.conv(t, r);
        return r;
      }
      case 'yield':
      case 'interrupts':
      case 'noInterrupts':
        this.argc(name, args, 0);
        return this.nativeCall('nop', args, [], 'void');
      default:
        if (this.lookup(name)) throw this.err(`„${name}“ je premenná, nie funkcia.`);
        throw this.unknown(name, line);
    }
  }

  private callUser(f: FuncEntry, args: Expr[]): Ty {
    const params = f.def.params;
    if (args.length !== params.length) {
      const sig = params.map((p) => `${typeName(this.resolveTy(p.ty, p.line))}${p.name ? ` ${p.name}` : ''}`).join(', ');
      throw this.err(`Funkcia ${f.def.name}(${sig}) potrebuje ${params.length} ${params.length === 1 ? 'hodnotu' : 'hodnôt'}, dostala ${args.length}.`);
    }
    args.forEach((a, i) => {
      const want = this.resolveTy(params[i].ty, params[i].line);
      const t = this.expr(a);
      if (isObj(want) || isObj(t)) {
        if (!isObj(want) || !isObj(t) || want.obj !== t.obj) throw this.err(`Parameter ${i + 1} funkcie ${f.def.name}() má byť ${typeName(want)}.`, a.line);
        return;
      }
      if (isArr(want) !== isArr(t)) throw this.err(`Parameter ${i + 1} funkcie ${f.def.name}() má byť ${typeName(want)}, nie ${typeName(t)}.`, a.line);
      if (isArr(want)) this.conv(t, want);
      else this.assignConv(t, want, `parameter ${params[i].name || i + 1}`);
    });
    this.emit(OP.CALL, f.idx, args.length);
    return f.def.ret;
  }

  private method(objX: Expr, name: string, args: Expr[], line: number): Ty {
    this.line = line;
    if (objX.e === 'id' && objX.name === 'Serial' && !this.lookup('Serial')) return this.serial(name, args);
    if (objX.e === 'id' && objX.name === 'Wire' && !this.lookup('Wire')) {
      if (!['begin', 'setClock', 'end'].includes(name)) throw this.err(`Wire.${name}() tu nie je podporované – LCD displej ovládaj cez knižnicu LiquidCrystal_I2C.`);
      return this.nativeCall('nop', args, args.map(() => 'u32' as const), 'void');
    }
    const t = this.typeOf(objX);
    if (t === 'str') return this.stringMethod(objX, name, args);
    if (!isObj(t)) {
      if (objX.e === 'id' && !this.lookup(objX.name)) throw this.unknown(objX.name, objX.line);
      throw this.err(`Za bodkou nasleduje funkcia objektu, ale ${typeName(t)} žiadne nemá.`);
    }
    this.expr(objX);
    const self: Scalar[] = ['i16'];
    if (t.obj === 'Servo') {
      const sig: Record<string, [number, number, (Scalar | '*')[], Scalar]> = {
        attach: [1, 3, ['u8', 'i16', 'i16'], 'u8'], write: [1, 1, ['i16'], 'void'], writeMicroseconds: [1, 1, ['i16'], 'void'],
        read: [0, 0, [], 'i16'], readMicroseconds: [0, 0, [], 'i16'], attached: [0, 0, [], 'bool'], detach: [0, 0, [], 'void'],
      };
      const s = sig[name];
      if (!s) throw this.err(`Servo nemá funkciu ${name}(). Použi attach(pin), write(uhol), read() alebo detach().`);
      this.argc(`${typeName(t)}.${name}`, args, s[0], s[1]);
      return this.nativeCallSelf(`Servo.${name}`, args, s[2], s[3], self);
    }
    // LiquidCrystal_I2C
    const lcd: Record<string, [number, number, (Scalar | '*')[], Scalar]> = {
      init: [0, 0, [], 'void'], begin: [0, 3, ['u8', 'u8', 'u8'], 'void'], clear: [0, 0, [], 'void'], home: [0, 0, [], 'void'],
      setCursor: [2, 2, ['u8', 'u8'], 'void'], print: [1, 2, ['*', 'i16'], 'u16'], println: [0, 2, ['*', 'i16'], 'u16'], write: [1, 1, ['u8'], 'u16'],
      backlight: [0, 0, [], 'void'], noBacklight: [0, 0, [], 'void'], setBacklight: [1, 1, ['u8'], 'void'],
      display: [0, 0, [], 'void'], noDisplay: [0, 0, [], 'void'], cursor: [0, 0, [], 'void'], noCursor: [0, 0, [], 'void'],
      blink: [0, 0, [], 'void'], noBlink: [0, 0, [], 'void'], scrollDisplayLeft: [0, 0, [], 'void'], scrollDisplayRight: [0, 0, [], 'void'],
      leftToRight: [0, 0, [], 'void'], rightToLeft: [0, 0, [], 'void'], autoscroll: [0, 0, [], 'void'], noAutoscroll: [0, 0, [], 'void'],
    };
    if (name === 'createChar') {
      this.argc('lcd.createChar', args, 2, 2, 'lcd.createChar(číslo 0 až 7, pole s 8 bajtmi)');
      this.conv(this.expr(args[0]), 'u8');
      const ta = this.expr(args[1]);
      if (!isArr(ta) || !isInt(ta.arr)) throw this.err('Druhý parameter createChar je pole s 8 číslami (riadky znaku).');
      this.nativeEmit('LCD.createChar', ['i16', 'u8', 'i16'], 'void');
      return 'void';
    }
    const s = lcd[name];
    if (!s) throw this.err(`LCD displej nemá funkciu ${name}(). Bežne sa používa init(), backlight(), clear(), setCursor(stĺpec, riadok) a print(…).`);
    this.argc(`lcd.${name}`, args, s[0], s[1]);
    return this.nativeCallSelf(`LCD.${name}`, args, s[2], s[3], self);
  }

  private nativeCallSelf(name: string, args: Expr[], params: (Scalar | '*')[], ret: Scalar, self: Scalar[]): Scalar {
    const tys: Scalar[] = [...self];
    args.forEach((a, i) => {
      const t = this.expr(a);
      const want = params[i] ?? '*';
      if (want === '*') {
        if (!(isNum(t) || t === 'str')) throw this.err(`Hodnota typu ${typeName(t)} sa tu nedá použiť.`, a.line);
        tys.push(t as Scalar);
      } else {
        if (!isNum(t)) throw this.err(`Tu patrí číslo, nie ${typeName(t)}.`, a.line);
        this.conv(t, want);
        tys.push(want);
      }
    });
    this.nativeEmit(name, tys, ret);
    return ret;
  }

  private serial(name: string, args: Expr[]): Ty {
    this.usesSerial = true;
    switch (name) {
      case 'begin':
        this.argc('Serial.begin', args, 1, 2, 'Serial.begin(9600)');
        return this.nativeCall('Serial.begin', args.slice(0, 1), ['u32'], 'void');
      case 'end':
      case 'flush':
        this.argc(`Serial.${name}`, args, 0);
        return this.nativeCall('nop', args, [], 'void');
      case 'print':
      case 'println':
        this.argc(`Serial.${name}`, args, name === 'print' ? 1 : 0, 2);
        return this.nativeCall(`Serial.${name}`, args, ['*', 'i16'], 'u16');
      case 'write':
        this.argc('Serial.write', args, 1);
        return this.nativeCall('Serial.write', args, [this.typeOf(args[0]) === 'str' ? 'str' : 'u8'], 'u16');
      case 'available':
      case 'read':
      case 'peek':
      case 'availableForWrite':
        this.argc(`Serial.${name}`, args, 0);
        return this.nativeCall(`Serial.${name}`, args, [], 'i16');
      case 'parseInt':
        this.argc('Serial.parseInt', args, 0);
        return this.nativeCall('Serial.parseInt', args, [], 'i32');
      case 'parseFloat':
        this.argc('Serial.parseFloat', args, 0);
        return this.nativeCall('Serial.parseFloat', args, [], 'f32');
      case 'readString':
        this.argc('Serial.readString', args, 0);
        return this.nativeCall('Serial.readString', args, [], 'str');
      case 'readStringUntil':
        this.argc('Serial.readStringUntil', args, 1, 1, "Serial.readStringUntil('\\n')");
        return this.nativeCall('Serial.readStringUntil', args, ['char'], 'str');
      case 'setTimeout':
        this.argc('Serial.setTimeout', args, 1);
        return this.nativeCall('Serial.setTimeout', args, ['u32'], 'void');
      default:
        throw this.err(`Serial nemá funkciu ${name}(). Bežne sa používa Serial.begin(9600), Serial.print(…), Serial.println(…), Serial.available() a Serial.read().`);
    }
  }

  private stringMethod(objX: Expr, name: string, args: Expr[]): Ty {
    const mutators: Record<string, [number, number, Scalar[]]> = {
      toUpperCase: [0, 0, []], toLowerCase: [0, 0, []], trim: [0, 0, []], replace: [2, 2, ['str', 'str']],
      remove: [1, 2, ['i16', 'i16']], setCharAt: [2, 2, ['i16', 'char']],
    };
    if (name in mutators || name === 'concat') {
      // Funkcie, ktoré menia samotný text: s.toUpperCase(); → s = upper(s)
      const lv = this.lvalue(objX, `Funkcia ${name}()`);
      if (lv.k === 'chr') throw this.err(`${name}() sa nedá použiť na jeden znak.`);
      if (lv.k === 'var') this.load(lv.sym);
      else {
        this.emit(OP.DUP2);
        this.emit(OP.LOADIDX);
      }
      if (name === 'concat') {
        this.argc('concat', args, 1);
        const t = this.expr(args[0]);
        if (!isNum(t) && t !== 'str') throw this.err('concat() pripojí text alebo číslo.');
        this.conv(t, 'str');
        this.emit(OP.BIN, 0, TY.str);
      } else {
        const [min, max, params] = mutators[name];
        this.argc(name, args, min, max);
        const tys: Scalar[] = ['str'];
        args.forEach((a, i) => {
          const t = this.expr(a);
          if (params[i] === 'str' ? t !== 'str' : !isNum(t)) throw this.err(`${name}(): ${i + 1}. hodnota má byť ${params[i] === 'str' ? 'text' : 'číslo'}.`, a.line);
          this.conv(t, params[i]);
          tys.push(params[i]);
        });
        this.nativeEmit(`String.${name}`, tys, 'str');
      }
      if (lv.k === 'var') this.store(lv.sym);
      else this.emit(OP.STOREIDX);
      this.emit(OP.POP);
      return 'void';
    }
    const sig: Record<string, [number, number, (Scalar | '*')[], Scalar]> = {
      length: [0, 0, [], 'u16'], charAt: [1, 1, ['i16'], 'char'], substring: [1, 2, ['i16', 'i16'], 'str'],
      indexOf: [1, 2, ['*', 'i16'], 'i16'], lastIndexOf: [1, 1, ['*'], 'i16'], toInt: [0, 0, [], 'i32'], toFloat: [0, 0, [], 'f32'],
      equals: [1, 1, ['str'], 'bool'], equalsIgnoreCase: [1, 1, ['str'], 'bool'], startsWith: [1, 1, ['str'], 'bool'],
      endsWith: [1, 1, ['str'], 'bool'], compareTo: [1, 1, ['str'], 'i16'], c_str: [0, 0, [], 'str'], isEmpty: [0, 0, [], 'bool'],
    };
    const s = sig[name];
    if (!s) throw this.err(`Text (String) nemá funkciu ${name}().`);
    this.argc(name, args, s[0], s[1]);
    this.expr(objX);
    const tys: Scalar[] = ['str'];
    args.forEach((a, i) => {
      const t = this.expr(a);
      const want = s[2][i];
      if (want === '*') {
        if (t !== 'str' && t !== 'char' && !isNum(t)) throw this.err(`${name}() potrebuje text alebo znak.`, a.line);
        tys.push(t as Scalar);
      } else if (want === 'str') {
        if (t !== 'str') throw this.err(`${name}() potrebuje text.`, a.line);
        tys.push('str');
      } else {
        if (!isNum(t)) throw this.err(`${name}() potrebuje číslo.`, a.line);
        this.conv(t, want);
        tys.push(want);
      }
    });
    if (name === 'c_str') return 'str';
    this.nativeEmit(`String.${name}`, tys, s[3]);
    return s[3];
  }
}

/** Prevod konštanty na hodnotu daného typu (ako pri behu programu). */
export function convConst(v: number, t: Scalar): number {
  const int = (x: number) => (Number.isFinite(x) ? Math.trunc(x) : 0);
  switch (t) {
    case 'bool': return v !== 0 ? 1 : 0;
    case 'char':
    case 'i8': return (int(v) << 24) >> 24;
    case 'u8': return int(v) & 0xff;
    case 'i16': return (int(v) << 16) >> 16;
    case 'u16': return int(v) & 0xffff;
    case 'i32': return int(v) | 0;
    case 'u32': return int(v) >>> 0;
    case 'f32': return Math.fround(v);
    default: return v;
  }
}

const cache = new Map<string, CompileResult>();

/** Preloží program. Výsledok si pamätá podľa textu programu. */
export function compileSketch(source: string): CompileResult {
  const hit = cache.get(source);
  if (hit) return hit;
  let result: CompileResult;
  try {
    const prog = parse(source);
    result = { ok: true, program: new Compiler().compile(prog) };
  } catch (e) {
    if (e instanceof CompileError) result = { ok: false, error: { line: e.line, message: e.message } };
    else throw e;
  }
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  cache.set(source, result);
  return result;
}
