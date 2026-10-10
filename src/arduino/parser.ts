/**
 * Syntaktický analyzátor: z tokenov postaví strom programu (deklarácie, funkcie, príkazy
 * a výrazy). Podporuje bežnú podmnožinu jazyka Arduino – premenné, polia, funkcie, if, for,
 * while, do, switch, enum, objekty knižníc (Servo, LiquidCrystal_I2C) a typ String.
 */
import { CompileError, lex, type Include, type Token } from './lexer';

export type Scalar = 'void' | 'bool' | 'char' | 'i8' | 'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32' | 'str';
export type ObjClass = 'Servo' | 'LCD' | 'Serial';
export interface ArrTy {
  arr: Ty;
  size: number | null;
  sizeExpr?: Expr | null;
}
export interface ObjTy {
  obj: ObjClass;
}
export type Ty = Scalar | ArrTy | ObjTy;

export type Expr =
  | { e: 'num'; v: number; ty: Scalar; line: number }
  | { e: 'str'; v: string; line: number }
  | { e: 'id'; name: string; line: number }
  | { e: 'bin'; op: string; a: Expr; b: Expr; line: number }
  | { e: 'log'; op: '&&' | '||'; a: Expr; b: Expr; line: number }
  | { e: 'un'; op: '-' | '+' | '!' | '~'; a: Expr; line: number }
  | { e: 'inc'; op: '++' | '--'; prefix: boolean; a: Expr; line: number }
  | { e: 'asg'; op: string; a: Expr; b: Expr; line: number }
  | { e: 'cond'; c: Expr; a: Expr; b: Expr; line: number }
  | { e: 'call'; fn: string; args: Expr[]; line: number }
  | { e: 'mcall'; obj: Expr; name: string; args: Expr[]; line: number }
  | { e: 'idx'; a: Expr; i: Expr; line: number }
  | { e: 'cast'; ty: Scalar; a: Expr; line: number }
  | { e: 'sizeof'; ty?: Ty; a?: Expr; line: number }
  | { e: 'comma'; a: Expr; b: Expr; line: number }
  | { e: 'addr'; a: Expr; line: number };

export interface InitList {
  e: 'list';
  items: (Expr | InitList)[];
  line: number;
}

export interface VarDecl {
  name: string;
  ty: Ty;
  init?: Expr | InitList;
  ctorArgs?: Expr[];
  line: number;
}

export type Stmt =
  | { s: 'block'; body: Stmt[]; line: number }
  | { s: 'expr'; x: Expr; line: number }
  | { s: 'decl'; vars: VarDecl[]; isConst: boolean; isStatic: boolean; line: number }
  | { s: 'if'; c: Expr; t: Stmt; f?: Stmt; line: number }
  | { s: 'while'; c: Expr; body: Stmt; line: number }
  | { s: 'do'; body: Stmt; c: Expr; line: number }
  | { s: 'for'; init?: Stmt; c?: Expr; step?: Expr; body: Stmt; line: number }
  | { s: 'switch'; x: Expr; cases: { v: Expr | null; line: number; body: Stmt[] }[]; line: number }
  | { s: 'break'; line: number }
  | { s: 'continue'; line: number }
  | { s: 'return'; x?: Expr; line: number }
  | { s: 'empty'; line: number };

export interface Param {
  name: string;
  ty: Ty;
  line: number;
}

export interface FuncDef {
  name: string;
  ret: Scalar;
  params: Param[];
  body: Stmt | null;
  line: number;
}

export interface EnumDef {
  name: string | null;
  values: { name: string; v?: Expr; line: number }[];
  line: number;
}

export type TopItem =
  | { k: 'var'; decl: Extract<Stmt, { s: 'decl' }> }
  | { k: 'func'; fn: FuncDef }
  | { k: 'enum'; en: EnumDef };

export interface Program {
  includes: Include[];
  items: TopItem[];
}

/** Kľúčové slová, ktoré začínajú typ. */
const TYPE_WORDS = new Set([
  'void', 'bool', 'boolean', 'char', 'byte', 'int', 'short', 'long', 'float', 'double', 'word', 'String',
  'unsigned', 'signed', 'size_t', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t',
  'const', 'static', 'volatile', 'Servo', 'LiquidCrystal_I2C', 'LiquidCrystal', 'unsigned long', 'uint64_t', 'int64_t',
]);

const QUALIFIERS = new Set(['const', 'static', 'volatile', 'inline', 'PROGMEM', 'register']);

const UNSUPPORTED: Record<string, string> = {
  struct: 'Štruktúry (struct) nie sú podporované – použi samostatné premenné alebo polia.',
  class: 'Vlastné triedy (class) nie sú podporované.',
  typedef: 'typedef nie je podporovaný – použi priamo názov typu.',
  goto: 'goto nie je podporované – použi cyklus alebo funkciu.',
  template: 'Šablóny (template) nie sú podporované.',
  union: 'union nie je podporovaný.',
  LiquidCrystal: 'Tu je k dispozícii LCD displej s I2C prevodníkom – použi knižnicu <LiquidCrystal_I2C.h> a objekt LiquidCrystal_I2C lcd(0x27, 16, 2);',
};

class Parser {
  private pos = 0;
  private readonly enumTypes = new Set<string>();

  constructor(private readonly toks: Token[]) {}

  private get tok(): Token {
    return this.toks[this.pos];
  }

  private peek(k = 1): Token {
    return this.toks[Math.min(this.pos + k, this.toks.length - 1)];
  }

  private get prevLine(): number {
    return this.toks[Math.max(0, this.pos - 1)].line;
  }

  private next(): Token {
    const t = this.tok;
    if (t.t !== 'eof') this.pos += 1;
    return t;
  }

  private is(v: string): boolean {
    return (this.tok.t === 'op' || this.tok.t === 'id') && this.tok.v === v;
  }

  private accept(v: string): boolean {
    if (this.is(v)) {
      this.next();
      return true;
    }
    return false;
  }

  private describe(t: Token): string {
    if (t.t === 'eof') return 'koniec programu';
    if (t.t === 'str') return `text "${t.v}"`;
    if (t.t === 'chr') return `znak '${t.v}'`;
    return `„${t.v}“`;
  }

  private expect(v: string, what?: string): Token {
    if (this.is(v)) return this.next();
    if (v === ';') throw new CompileError('Chýba bodkočiarka ; na konci príkazu.', this.prevLine);
    if (v === '}' && this.tok.t === 'eof') throw new CompileError('Chýba zatváracia zátvorka } – niektorý blok { nie je uzavretý.', this.prevLine);
    if (v === ')' || v === ']') throw new CompileError(`Chýba zátvorka ${v}${what ? ` ${what}` : ''} – namiesto nej je ${this.describe(this.tok)}.`, this.tok.line);
    throw new CompileError(`Očakávam ${v}${what ? ` ${what}` : ''}, ale je tu ${this.describe(this.tok)}.`, this.tok.line);
  }

  private ident(what: string): Token {
    const t = this.tok;
    if (t.t !== 'id') throw new CompileError(`Očakávam ${what}, ale je tu ${this.describe(t)}.`, t.line);
    if (TYPE_WORDS.has(t.v) && !['Servo', 'LiquidCrystal_I2C'].includes(t.v)) {
      throw new CompileError(`„${t.v}“ je názov typu – nedá sa použiť ako meno.`, t.line);
    }
    return this.next();
  }

  // ------------------------------------------------------------------ typy

  private isTypeStart(at = 0): boolean {
    const t = this.peek(at);
    if (t.t !== 'id') return false;
    return TYPE_WORDS.has(t.v) || QUALIFIERS.has(t.v) || this.enumTypes.has(t.v) || t.v in UNSUPPORTED && t.v !== 'goto';
  }

  /** Prečíta typ (s kvalifikátormi). Vráti aj, či bol const alebo static. */
  private parseType(): { ty: Ty; isConst: boolean; isStatic: boolean; line: number } {
    const line = this.tok.line;
    let isConst = false;
    let isStatic = false;
    const words: string[] = [];
    for (;;) {
      const t = this.tok;
      if (t.t !== 'id') break;
      if (t.v in UNSUPPORTED && !TYPE_WORDS.has(t.v)) throw new CompileError(UNSUPPORTED[t.v], t.line);
      if (t.v === 'LiquidCrystal') throw new CompileError(UNSUPPORTED.LiquidCrystal, t.line);
      if (QUALIFIERS.has(t.v)) {
        if (t.v === 'const') isConst = true;
        if (t.v === 'static') isStatic = true;
        this.next();
        continue;
      }
      if (words.length && !['unsigned', 'signed', 'long', 'short'].includes(words[words.length - 1]) && !['int', 'long', 'char'].includes(t.v)) break;
      if (TYPE_WORDS.has(t.v) || this.enumTypes.has(t.v)) {
        words.push(t.v);
        this.next();
        if (['String', 'Servo', 'LiquidCrystal_I2C', 'float', 'double', 'bool', 'boolean', 'byte', 'word', 'void', 'size_t'].includes(t.v) || /_t$/.test(t.v) || this.enumTypes.has(t.v)) break;
        continue;
      }
      break;
    }
    if (!words.length) throw new CompileError(`Očakávam typ (napr. int), ale je tu ${this.describe(this.tok)}.`, this.tok.line);
    let ty = resolveType(words, line);
    // Ukazovateľ: podporujeme len char* ako text.
    while (this.is('*')) {
      this.next();
      if (ty !== 'char' && ty !== 'str') throw new CompileError('Ukazovatele (*) nie sú podporované – okrem textu typu const char*.', line);
      ty = 'str';
    }
    while (this.tok.t === 'id' && QUALIFIERS.has(this.tok.v)) {
      if (this.tok.v === 'const') isConst = true;
      this.next();
    }
    return { ty, isConst, isStatic, line };
  }

  // ------------------------------------------------------------------ program

  parseProgram(includes: Include[]): Program {
    const items: TopItem[] = [];
    while (this.tok.t !== 'eof') {
      if (this.accept(';')) continue;
      if (this.is('enum')) {
        items.push({ k: 'enum', en: this.parseEnum() });
        continue;
      }
      if (this.tok.t === 'id' && this.tok.v in UNSUPPORTED && !TYPE_WORDS.has(this.tok.v)) throw new CompileError(UNSUPPORTED[this.tok.v], this.tok.line);
      if (!this.isTypeStart()) {
        const t = this.tok;
        if (t.t === 'id' && this.peek().v === '(') {
          throw new CompileError(`Pred funkciou ${t.v}() chýba návratový typ, napr. void ${t.v}().`, t.line);
        }
        throw new CompileError(`Mimo funkcie môžu byť len deklarácie premenných a funkcie – tu je ${this.describe(t)}. Príkazy patria do setup() alebo loop().`, t.line);
      }
      const start = this.pos;
      const { ty } = this.parseType();
      const name = this.ident('meno premennej alebo funkcie');
      if (this.is('(') && typeof ty === 'string') {
        items.push({ k: 'func', fn: this.parseFunc(ty, name) });
        continue;
      }
      this.pos = start;
      items.push({ k: 'var', decl: this.parseDecl() });
    }
    return { includes, items };
  }

  private parseEnum(): EnumDef {
    const line = this.next().line;
    let name: string | null = null;
    if (this.tok.t === 'id' && !this.is('{')) {
      name = this.next().v;
      this.enumTypes.add(name);
    }
    this.expect('{', 'pri enum');
    const values: EnumDef['values'] = [];
    while (!this.is('}')) {
      const id = this.ident('meno hodnoty v enum');
      const v = this.accept('=') ? this.parseAssign() : undefined;
      values.push({ name: id.v, v, line: id.line });
      if (!this.accept(',')) break;
    }
    this.expect('}', 'na konci enum');
    // enum Farba { … } premenna;
    if (this.tok.t === 'id' && name) {
      throw new CompileError(`Deklaruj premennú zvlášť: ${name} premenna;`, this.tok.line);
    }
    this.expect(';');
    return { name, values, line };
  }

  private parseFunc(ret: Scalar, name: Token): FuncDef {
    this.expect('(');
    const params: Param[] = [];
    if (this.is('void') && this.peek().v === ')') this.next();
    while (!this.is(')')) {
      const { ty } = this.parseType();
      if (ty === 'void') throw new CompileError('Parameter nemôže mať typ void.', this.tok.line);
      let pty: Ty = ty;
      let pname = '';
      let pline = this.tok.line;
      if (this.accept('&')) {
        // Odkaz (int &x) – podporujeme len pre objekty a polia; jednoduché premenné by sa nezmenili.
        if (typeof pty === 'string') throw new CompileError('Parametre odovzdávané odkazom (&) nie sú podporované – vráť hodnotu pomocou return.', pline);
      }
      if (this.tok.t === 'id') {
        const id = this.ident('meno parametra');
        pname = id.v;
        pline = id.line;
      }
      const dims: (Expr | null)[] = [];
      while (this.accept('[')) {
        dims.push(this.is(']') ? null : this.parseExpr());
        this.expect(']');
      }
      for (let d = dims.length - 1; d >= 0; d--) pty = { arr: pty, size: null, sizeExpr: dims[d] };
      params.push({ name: pname, ty: pty, line: pline });
      if (!this.accept(',')) break;
    }
    this.expect(')', `za parametrami funkcie ${name.v}`);
    if (this.accept(';')) return { name: name.v, ret, params, body: null, line: name.line };
    if (!this.is('{')) throw new CompileError(`Za hlavičkou funkcie ${name.v}() má byť jej telo v zátvorkách { }.`, this.tok.line);
    const body = this.parseBlock();
    return { name: name.v, ret, params, body, line: name.line };
  }

  /** Deklarácia jednej alebo viacerých premenných rovnakého typu. */
  private parseDecl(): Extract<Stmt, { s: 'decl' }> {
    const { ty, isConst, isStatic, line } = this.parseType();
    if (ty === 'void') throw new CompileError('Premenná nemôže mať typ void.', line);
    const vars: VarDecl[] = [];
    do {
      let vty: Ty = ty;
      if (this.is('*') && (ty === 'char' || ty === 'str')) {
        this.next();
        vty = 'str';
      }
      const id = this.ident('meno premennej');
      const dims: (Expr | null)[] = [];
      while (this.accept('[')) {
        dims.push(this.is(']') ? null : this.parseExpr());
        this.expect(']', 'za veľkosťou poľa');
      }
      while (this.tok.t === 'id' && QUALIFIERS.has(this.tok.v)) this.next();
      const decl: VarDecl = { name: id.v, ty: vty, line: id.line };
      if (this.accept('=')) {
        decl.init = this.is('{') ? this.parseInitList() : this.parseAssign();
      } else if (this.is('(')) {
        this.next();
        const args: Expr[] = [];
        while (!this.is(')')) {
          args.push(this.parseAssign());
          if (!this.accept(',')) break;
        }
        this.expect(')');
        decl.ctorArgs = args;
      } else if (this.is('{')) {
        decl.init = this.parseInitList();
      }
      // char text[] = "…" je text.
      if (vty === 'char' && dims.length === 1 && decl.init && !('items' in decl.init) && decl.init.e === 'str') {
        decl.ty = 'str';
      } else {
        for (let d = dims.length - 1; d >= 0; d--) decl.ty = { arr: decl.ty, size: null, sizeExpr: dims[d] };
      }
      vars.push(decl);
    } while (this.accept(','));
    this.expect(';');
    return { s: 'decl', vars, isConst, isStatic, line };
  }

  private parseInitList(): InitList {
    const line = this.expect('{').line;
    const items: (Expr | InitList)[] = [];
    while (!this.is('}')) {
      items.push(this.is('{') ? this.parseInitList() : this.parseAssign());
      if (!this.accept(',')) break;
    }
    this.expect('}', 'na konci zoznamu hodnôt');
    return { e: 'list', items, line };
  }

  // ------------------------------------------------------------------ príkazy

  private parseBlock(): Extract<Stmt, { s: 'block' }> {
    const line = this.expect('{').line;
    const body: Stmt[] = [];
    while (!this.is('}')) {
      if (this.tok.t === 'eof') this.expect('}');
      body.push(this.parseStmt());
    }
    this.next();
    return { s: 'block', body, line };
  }

  private parseStmt(): Stmt {
    const t = this.tok;
    const line = t.line;
    if (this.is('{')) return this.parseBlock();
    if (this.accept(';')) return { s: 'empty', line };
    if (t.t === 'id') {
      switch (t.v) {
        case 'if': {
          this.next();
          this.expect('(', 'za if');
          const c = this.parseExpr();
          this.expect(')', 'za podmienkou if');
          if (this.is(';')) throw new CompileError('Za if (…) nemá byť bodkočiarka – príkaz by sa vykonal vždy.', this.tok.line);
          const tb = this.parseStmt();
          const f = this.accept('else') ? this.parseStmt() : undefined;
          return { s: 'if', c, t: tb, f, line };
        }
        case 'else':
          throw new CompileError('else bez if – skontroluj zátvorky { } pred ním.', line);
        case 'while': {
          this.next();
          this.expect('(', 'za while');
          const c = this.parseExpr();
          this.expect(')', 'za podmienkou while');
          return { s: 'while', c, body: this.parseStmt(), line };
        }
        case 'do': {
          this.next();
          const body = this.parseStmt();
          if (!this.accept('while')) throw new CompileError('Za do { … } patrí while (podmienka);', this.tok.line);
          this.expect('(');
          const c = this.parseExpr();
          this.expect(')');
          this.expect(';');
          return { s: 'do', body, c, line };
        }
        case 'for': {
          this.next();
          this.expect('(', 'za for');
          let init: Stmt | undefined;
          if (this.accept(';')) init = undefined;
          else if (this.isTypeStart()) init = this.parseDecl();
          else {
            init = { s: 'expr', x: this.parseExpr(), line };
            this.expect(';');
          }
          const c = this.is(';') ? undefined : this.parseExpr();
          this.expect(';');
          const step = this.is(')') ? undefined : this.parseExpr();
          this.expect(')', 'za hlavičkou for');
          return { s: 'for', init, c, step, body: this.parseStmt(), line };
        }
        case 'switch': {
          this.next();
          this.expect('(', 'za switch');
          const x = this.parseExpr();
          this.expect(')');
          this.expect('{');
          const cases: { v: Expr | null; line: number; body: Stmt[] }[] = [];
          while (!this.is('}')) {
            const ct = this.tok;
            if (this.accept('case')) {
              const v = this.parseCond();
              this.expect(':', 'za case');
              cases.push({ v, line: ct.line, body: [] });
            } else if (this.accept('default')) {
              this.expect(':', 'za default');
              cases.push({ v: null, line: ct.line, body: [] });
            } else {
              if (!cases.length) throw new CompileError('V switch musí byť najprv case alebo default.', ct.line);
              if (this.tok.t === 'eof') this.expect('}');
              cases[cases.length - 1].body.push(this.parseStmt());
            }
          }
          this.next();
          return { s: 'switch', x, cases, line };
        }
        case 'break':
          this.next();
          this.expect(';');
          return { s: 'break', line };
        case 'continue':
          this.next();
          this.expect(';');
          return { s: 'continue', line };
        case 'return': {
          this.next();
          if (this.accept(';')) return { s: 'return', line };
          const x = this.parseExpr();
          this.expect(';');
          return { s: 'return', x, line };
        }
        case 'case':
        case 'default':
          throw new CompileError(`${t.v} môže byť len vo vnútri switch.`, line);
        case 'enum':
          throw new CompileError('enum deklaruj mimo funkcií, na začiatku programu.', line);
        default:
          break;
      }
      if (t.v in UNSUPPORTED && !TYPE_WORDS.has(t.v)) throw new CompileError(UNSUPPORTED[t.v], line);
      if (this.isTypeStart() && !(this.peek().t === 'op' && ['(', '.'].includes(this.peek().v) && ['String', 'byte', 'int', 'float', 'long', 'char', 'word', 'bool', 'double'].includes(t.v))) {
        const fn = this.functionAhead();
        if (fn) throw new CompileError(`Funkcia ${fn}() je vo vnútri inej funkcie – pravdepodobne chýba zatváracia zátvorka } na konci funkcie nad ňou.`, line);
        return this.parseDecl();
      }
    }
    const x = this.parseExpr();
    if (!this.is(';') && this.tok.t !== 'eof' && this.tok.line === line && this.tok.t !== 'op') {
      throw new CompileError(`Nerozumiem príkazu – za ${this.describe(this.toks[this.pos - 1])} nasleduje ${this.describe(this.tok)}. Nechýba operátor alebo bodkočiarka?`, line);
    }
    this.expect(';');
    return { s: 'expr', x, line };
  }

  /** Začína tu definícia funkcie (typ meno(…) {)? Vráti jej meno. */
  private functionAhead(): string | null {
    const save = this.pos;
    try {
      const { ty } = this.parseType();
      if (typeof ty !== 'string' || this.tok.t !== 'id' || this.peek().v !== '(') return null;
      const name = this.next().v;
      let depth = 0;
      while (this.peek(0).t !== 'eof') {
        const v = this.next().v;
        if (v === '(') depth += 1;
        else if (v === ')' && --depth === 0) break;
      }
      return this.is('{') ? name : null;
    } catch {
      return null;
    } finally {
      this.pos = save;
    }
  }

  // ------------------------------------------------------------------ výrazy

  parseExpr(): Expr {
    let x = this.parseAssign();
    while (this.is(',')) {
      const line = this.next().line;
      x = { e: 'comma', a: x, b: this.parseAssign(), line };
    }
    return x;
  }

  private parseAssign(): Expr {
    const a = this.parseCond();
    const t = this.tok;
    if (t.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(t.v)) {
      this.next();
      return { e: 'asg', op: t.v, a, b: this.parseAssign(), line: t.line };
    }
    return a;
  }

  private parseCond(): Expr {
    const c = this.parseBinary(1);
    if (this.is('?')) {
      const line = this.next().line;
      const a = this.parseExpr();
      this.expect(':', 'v podmienenom výraze ? :');
      const b = this.parseCond();
      return { e: 'cond', c, a, b, line };
    }
    return c;
  }

  private static readonly PREC: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
  };

  private parseBinary(minPrec: number): Expr {
    let a = this.parseUnary();
    for (;;) {
      const t = this.tok;
      const prec = t.t === 'op' ? Parser.PREC[t.v] : undefined;
      if (prec === undefined || prec < minPrec) return a;
      this.next();
      const b = this.parseBinary(prec + 1);
      a = t.v === '&&' || t.v === '||' ? { e: 'log', op: t.v, a, b, line: t.line } : { e: 'bin', op: t.v, a, b, line: t.line };
    }
  }

  private parseUnary(): Expr {
    const t = this.tok;
    if (t.t === 'op') {
      if (t.v === '++' || t.v === '--') {
        this.next();
        return { e: 'inc', op: t.v, prefix: true, a: this.parseUnary(), line: t.line };
      }
      if (t.v === '-' || t.v === '+' || t.v === '!' || t.v === '~') {
        this.next();
        return { e: 'un', op: t.v, a: this.parseUnary(), line: t.line };
      }
      if (t.v === '&') {
        this.next();
        return { e: 'addr', a: this.parseUnary(), line: t.line };
      }
      if (t.v === '*') throw new CompileError('Ukazovatele (*) nie sú podporované.', t.line);
      // Pretypovanie: (int) x, (float) y
      if (t.v === '(' && this.isTypeStart(1) && !['Servo', 'LiquidCrystal_I2C'].includes(this.peek().v)) {
        const save = this.pos;
        this.next();
        const { ty } = this.parseType();
        if (this.accept(')') && typeof ty === 'string' && ty !== 'void') {
          return { e: 'cast', ty, a: this.parseUnary(), line: t.line };
        }
        this.pos = save;
      }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      this.next();
      this.expect('(', 'za sizeof');
      if (this.isTypeStart()) {
        const { ty } = this.parseType();
        this.expect(')');
        return { e: 'sizeof', ty, line: t.line };
      }
      const a = this.parseExpr();
      this.expect(')');
      return { e: 'sizeof', a, line: t.line };
    }
    return this.parsePostfix(this.parsePrimary());
  }

  private parseArgs(): Expr[] {
    const args: Expr[] = [];
    while (!this.is(')')) {
      args.push(this.parseAssign());
      if (!this.accept(',')) break;
    }
    this.expect(')', 'za argumentmi funkcie');
    return args;
  }

  private parsePostfix(x: Expr): Expr {
    for (;;) {
      const t = this.tok;
      if (t.t !== 'op') return x;
      if (t.v === '[') {
        this.next();
        const i = this.parseExpr();
        this.expect(']');
        x = { e: 'idx', a: x, i, line: t.line };
      } else if (t.v === '.' || t.v === '->') {
        this.next();
        const name = this.ident('meno funkcie objektu');
        if (!this.is('(')) throw new CompileError(`${name.v} – za názvom funkcie objektu patria zátvorky, napr. ${name.v}().`, name.line);
        this.next();
        x = { e: 'mcall', obj: x, name: name.v, args: this.parseArgs(), line: name.line };
      } else if (t.v === '++' || t.v === '--') {
        this.next();
        x = { e: 'inc', op: t.v, prefix: false, a: x, line: t.line };
      } else if (t.v === '(') {
        throw new CompileError('Volať sa dá len funkcia podľa mena.', t.line);
      } else {
        return x;
      }
    }
  }

  private parsePrimary(): Expr {
    const t = this.tok;
    const line = t.line;
    if (t.t === 'num') {
      this.next();
      return { e: 'num', v: t.num!, ty: literalType(t), line };
    }
    if (t.t === 'chr') {
      this.next();
      return { e: 'num', v: t.num!, ty: 'char', line };
    }
    if (t.t === 'str') {
      this.next();
      return { e: 'str', v: t.v, line };
    }
    if (t.t === 'id') {
      // Funkčné pretypovanie: int(x), float(x), String(x), byte(x)
      const casts: Record<string, Scalar> = {
        int: 'i16', float: 'f32', double: 'f32', long: 'i32', byte: 'u8', char: 'char', word: 'u16', bool: 'bool', boolean: 'bool', String: 'str',
      };
      if (t.v in casts && this.peek().v === '(') {
        this.next();
        this.next();
        const args = this.parseArgs();
        if (t.v === 'String') return { e: 'call', fn: 'String', args, line };
        if (args.length !== 1) throw new CompileError(`${t.v}(…) potrebuje práve jednu hodnotu.`, line);
        return { e: 'cast', ty: casts[t.v], a: args[0], line };
      }
      if (TYPE_WORDS.has(t.v) && !['Servo', 'LiquidCrystal_I2C'].includes(t.v)) {
        throw new CompileError(`Tu nečakám typ ${t.v} – deklarácia premennej musí byť samostatný príkaz.`, line);
      }
      this.next();
      if (this.is('(')) {
        this.next();
        return { e: 'call', fn: t.v, args: this.parseArgs(), line };
      }
      return { e: 'id', name: t.v, line };
    }
    if (this.accept('(')) {
      const x = this.parseExpr();
      this.expect(')');
      return x;
    }
    if (t.t === 'eof') throw new CompileError('Program náhle končí – chýba časť výrazu alebo zátvorka.', this.prevLine);
    throw new CompileError(`Tu očakávam hodnotu alebo premennú, ale je tu ${this.describe(t)}.`, line);
  }
}

function resolveType(words: string[], line: number): Ty {
  const w = words.join(' ');
  const map: Record<string, Ty> = {
    void: 'void', bool: 'bool', boolean: 'bool', char: 'char', 'signed char': 'i8', 'unsigned char': 'u8', byte: 'u8', uint8_t: 'u8', int8_t: 'i8',
    int: 'i16', 'signed int': 'i16', signed: 'i16', short: 'i16', 'short int': 'i16', int16_t: 'i16',
    unsigned: 'u16', 'unsigned int': 'u16', 'unsigned short': 'u16', 'unsigned short int': 'u16', word: 'u16', uint16_t: 'u16', size_t: 'u16',
    long: 'i32', 'long int': 'i32', 'signed long': 'i32', 'long long': 'i32', int32_t: 'i32', int64_t: 'i32',
    'unsigned long': 'u32', 'unsigned long int': 'u32', 'unsigned long long': 'u32', uint32_t: 'u32', uint64_t: 'u32',
    float: 'f32', double: 'f32', 'long double': 'f32', String: 'str',
    Servo: { obj: 'Servo' }, LiquidCrystal_I2C: { obj: 'LCD' },
  };
  if (w in map) return map[w];
  if (words.length === 1) return 'i16';  // enum
  throw new CompileError(`Neznámy typ „${w}“.`, line);
}

function literalType(t: Token): Scalar {
  if (t.float) return 'f32';
  const v = t.num!;
  const hexLike = /^0[xXbB0-7]/.test(t.v) && t.v !== '0';
  if (t.unsigned && t.long) return 'u32';
  if (t.unsigned) return v <= 0xffff ? 'u16' : 'u32';
  if (t.long) return v <= 0x7fffffff ? 'i32' : 'u32';
  if (v <= 0x7fff) return 'i16';
  if (hexLike && v <= 0xffff) return 'u16';
  if (v <= 0x7fffffff) return 'i32';
  return 'u32';
}

export function parse(source: string): Program {
  const { tokens, includes } = lex(source);
  return new Parser(tokens).parseProgram(includes);
}

export { CompileError };
