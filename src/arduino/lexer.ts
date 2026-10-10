/**
 * Lexikálny analyzátor jazyka Arduino (podmnožina C/C++): rozdelí program na tokeny,
 * vynechá komentáre a spracuje príkazy predprocesora #include a #define.
 */

export interface Token {
  t: 'id' | 'num' | 'str' | 'chr' | 'op' | 'eof';
  /** Text tokenu (pri reťazci a znaku už dekódovaná hodnota). */
  v: string;
  line: number;
  num?: number;
  float?: boolean;
  unsigned?: boolean;
  long?: boolean;
}

/** Chyba v programe s číslom riadka (počítané od 1). */
export class CompileError extends Error {
  constructor(message: string, readonly line: number) {
    super(message);
  }
}

export interface Include {
  name: string;
  line: number;
}

export interface LexResult {
  tokens: Token[];
  includes: Include[];
}

const OPS = [
  '<<=', '>>=', '...',
  '++', '--', '->', '&&', '||', '==', '!=', '<=', '>=', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '::',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '[', ']', '{', '}',
];

const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdPart = (c: string) => /[A-Za-z0-9_]/.test(c);

/** Rozdelí text na tokeny bez predprocesora. */
function scan(src: string, firstLine: number, out: Token[]): void {
  let i = 0;
  let line = firstLine;
  const err = (msg: string) => new CompileError(msg, line);
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
      i += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = line;
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line += 1;
        i += 1;
      }
      if (i >= src.length) throw new CompileError('Komentár /* … nie je ukončený znakmi */.', start);
      i += 2;
      continue;
    }
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < src.length && isIdPart(src[j])) j += 1;
      out.push({ t: 'id', v: src.slice(i, j), line });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xX][0-9A-Fa-f]+|0[bB][01]+|[0-9]*\.[0-9]+(?:[eE][+-]?[0-9]+)?|[0-9]+\.(?:[eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+|[0-9]+)([A-Za-z_][A-Za-z0-9_]*)?/.exec(src.slice(i));
      if (!m) throw err(`Neplatné číslo.`);
      const [whole, body, suffixRaw = ''] = m;
      const suffix = suffixRaw.toLowerCase();
      const isFloat = /[.eE]/.test(body) && !/^0[xX]/.test(body);
      let value: number;
      if (/^0[xX]/.test(body)) value = parseInt(body.slice(2), 16);
      else if (/^0[bB]/.test(body)) value = parseInt(body.slice(2), 2);
      else if (isFloat) value = parseFloat(body);
      else if (body.length > 1 && body[0] === '0') {
        if (/[89]/.test(body)) throw err(`Číslo ${body} začína nulou, preto je osmičkové – a v ňom nie sú číslice 8 ani 9. Vynechaj úvodnú nulu.`);
        value = parseInt(body, 8);
      } else value = parseInt(body, 10);
      if (isFloat ? !['', 'f'].includes(suffix) : !['', 'u', 'l', 'ul', 'lu', 'll', 'ull'].includes(suffix)) {
        throw err(`Neznáma prípona čísla „${suffixRaw}“ v ${whole}.`);
      }
      out.push({ t: 'num', v: whole, line, num: value, float: isFloat, unsigned: suffix.includes('u'), long: suffix.includes('l') });
      i += whole.length;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let value = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\n') throw err(quote === '"' ? 'Reťazec nie je ukončený úvodzovkami ".' : "Znak nie je ukončený apostrofom '.");
        if (src[j] === '\\') {
          const [ch, len] = escape(src, j, line);
          value += ch;
          j += len;
        } else {
          value += src[j];
          j += 1;
        }
      }
      if (j >= src.length) throw err(quote === '"' ? 'Reťazec nie je ukončený úvodzovkami ".' : "Znak nie je ukončený apostrofom '.");
      if (quote === "'") {
        if (value.length !== 1) throw err(value.length ? `V apostrofoch môže byť len jeden znak – text patrí do úvodzoviek: "${value}".` : 'Prázdny znak \'\'.');
        out.push({ t: 'chr', v: value, line, num: value.charCodeAt(0) });
      } else {
        out.push({ t: 'str', v: value, line });
      }
      i = j + 1;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw err(`Nečakaný znak „${c}“.`);
    out.push({ t: 'op', v: op, line });
    i += op.length;
  }
}

function escape(src: string, j: number, line: number): [string, number] {
  const n = src[j + 1];
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v', '?': '?' };
  if (n === 'x') {
    const m = /^[0-9A-Fa-f]{1,2}/.exec(src.slice(j + 2));
    if (!m) throw new CompileError('Za \\x musí nasledovať šestnástkové číslo.', line);
    return [String.fromCharCode(parseInt(m[0], 16)), 2 + m[0].length];
  }
  if (n in simple) return [simple[n], 2];
  throw new CompileError(`Neznáma escape sekvencia \\${n ?? ''}.`, line);
}

/**
 * Predprocesor a tokenizácia. Podporuje #include (zaznamená knižnicu) a #define bez parametrov
 * (meno sa nahradí hodnotou). Ostatné príkazy sa ignorujú.
 */
export function lex(source: string): LexResult {
  const includes: Include[] = [];
  const macros = new Map<string, Token[]>();
  const raw: Token[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let chunk: string[] = [];
  let chunkStart = 1;
  const flush = (nextLine: number) => {
    if (chunk.length) scan(chunk.join('\n'), chunkStart, raw);
    chunk = [];
    chunkStart = nextLine;
  };
  for (let k = 0; k < lines.length; k++) {
    const lineNo = k + 1;
    const text = lines[k];
    // Predprocesor: riadok začínajúci znakom # (mimo komentára /* */ – to pri jednoduchých programoch stačí).
    if (/^\s*#/.test(text)) {
      flush(lineNo + 1);
      let directive = text.trim();
      while (directive.endsWith('\\') && k + 1 < lines.length) {
        k += 1;
        directive = `${directive.slice(0, -1)} ${lines[k].trim()}`;
        chunkStart = k + 2;
      }
      const m = /^#\s*(\w+)\s*(.*)$/.exec(directive);
      if (!m) continue;
      const [, name, rest] = m;
      if (name === 'include') {
        const inc = /^[<"]([^>"]+)[>"]/.exec(rest);
        if (!inc) throw new CompileError('Za #include patrí názov knižnice, napr. #include <Servo.h>.', lineNo);
        includes.push({ name: inc[1].trim(), line: lineNo });
      } else if (name === 'define') {
        const d = /^([A-Za-z_]\w*)(\()?\s*(.*)$/.exec(rest);
        if (!d) throw new CompileError('Za #define patrí meno a hodnota, napr. #define LED 13.', lineNo);
        if (d[2]) throw new CompileError(`Makro ${d[1]}(…) s parametrami nie je podporované – napíš namiesto neho funkciu.`, lineNo);
        const body: Token[] = [];
        scan(d[3].replace(/\/\/.*$/, ''), lineNo, body);
        macros.set(d[1], body);
      } else if (name === 'undef') {
        macros.delete(rest.trim());
      }
      continue;
    }
    chunk.push(text);
  }
  flush(lines.length + 1);

  const tokens: Token[] = [];
  const expand = (tok: Token, depth: number) => {
    const body = tok.t === 'id' ? macros.get(tok.v) : undefined;
    if (!body || depth > 20) {
      tokens.push(tok);
      return;
    }
    for (const b of body) expand({ ...b, line: tok.line }, depth + 1);
  };
  for (const tok of raw) expand(tok, 0);
  // Susedné reťazce sa spájajú: "Ahoj " "svet".
  const merged: Token[] = [];
  for (const tok of tokens) {
    const prev = merged[merged.length - 1];
    if (tok.t === 'str' && prev?.t === 'str') prev.v += tok.v;
    else merged.push(tok);
  }
  merged.push({ t: 'eof', v: '', line: lines.length });
  return { tokens: merged, includes };
}
