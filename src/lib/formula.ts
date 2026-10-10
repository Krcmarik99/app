/**
 * Jednoduchý zápis vzorcov:
 *   $X        veličina kurzívou (jeden znak, aj grécky)
 *   _{..} ^{..}  dolný a horný index (alebo _x, ^x pre jeden znak)
 *   @f{a}{b}  zlomok
 *   @s{a}     odmocnina
 *   @o{a}     pruh nad výrazom (negácia v logike)
 * Jednotky a čísla sa píšu bežne, sú vzpriamené (podľa ISO 80000).
 */

function textNode(text: string): Text {
  return document.createTextNode(text);
}

function wrap(tag: string, className: string | null, children: Node[]): HTMLElement {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.append(...children);
  return el;
}

function readChar(src: string, i: number): string {
  return String.fromCodePoint(src.codePointAt(i) ?? 32);
}

function parseArg(src: string, i: number): [Node[], number] {
  if (src[i] === '{') return parseSeq(src, i + 1, true);
  if (src[i] === '$') {
    const ch = readChar(src, i + 1);
    return [[wrap('i', 'v', [textNode(ch)])], i + 1 + ch.length];
  }
  const ch = readChar(src, i);
  return [[textNode(ch)], i + ch.length];
}

function parseSeq(src: string, start: number, inGroup: boolean): [Node[], number] {
  const out: Node[] = [];
  let text = '';
  let i = start;
  const flush = () => {
    if (text) out.push(textNode(text));
    text = '';
  };
  while (i < src.length) {
    const ch = src[i];
    if (inGroup && ch === '}') {
      flush();
      return [out, i + 1];
    }
    if (ch === '$' && i + 1 < src.length) {
      flush();
      const v = readChar(src, i + 1);
      out.push(wrap('i', 'v', [textNode(v)]));
      i += 1 + v.length;
    } else if (ch === '_' || ch === '^') {
      flush();
      const [children, next] = parseArg(src, i + 1);
      out.push(wrap(ch === '_' ? 'sub' : 'sup', null, children));
      i = next;
    } else if (ch === '@' && src[i + 1] === 'f') {
      flush();
      const [num, afterNum] = parseArg(src, i + 2);
      const [den, afterDen] = parseArg(src, afterNum);
      out.push(wrap('span', 'frac', [wrap('span', 'num', num), wrap('span', 'den', den)]));
      i = afterDen;
    } else if (ch === '@' && src[i + 1] === 'o') {
      flush();
      const [inner, next] = parseArg(src, i + 2);
      out.push(wrap('span', 'ovl', inner));
      i = next;
    } else if (ch === '@' && src[i + 1] === 's') {
      flush();
      const [rad, next] = parseArg(src, i + 2);
      out.push(wrap('span', 'sqrt', [wrap('span', 'sqrt-sign', [textNode('√')]), wrap('span', 'sqrt-rad', rad)]));
      i = next;
    } else if (ch === '\\' && i + 1 < src.length) {
      text += src[i + 1];
      i += 2;
    } else {
      text += ch;
      i += 1;
    }
  }
  flush();
  return [out, i];
}

/** Vykreslí vzorec do fragmentu. */
export function formula(src: string): DocumentFragment {
  const f = document.createDocumentFragment();
  f.append(...parseSeq(src, 0, false)[0]);
  return f;
}

/** Text s inline vzorcami v `spätných apostrofoch` a **tučným** písmom. */
export function rich(text: string): DocumentFragment {
  const f = document.createDocumentFragment();
  text.split('`').forEach((part, index) => {
    if (index % 2 === 1) {
      const span = document.createElement('span');
      span.className = 'fx';
      span.append(formula(part));
      f.append(span);
      return;
    }
    part.split('**').forEach((chunk, j) => {
      if (!chunk) return;
      if (j % 2 === 1) {
        const strong = document.createElement('strong');
        strong.textContent = chunk;
        f.append(strong);
      } else {
        f.append(chunk);
      }
    });
  });
  return f;
}
