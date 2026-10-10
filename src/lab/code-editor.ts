/**
 * Jednoduchý editor programu: textové pole so zvýrazňovaním syntaxe, číslami riadkov,
 * odsadzovaním klávesom Tab a automatickým odsadením nového riadka.
 */
import { h } from '../lib/dom';

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'const', 'static',
  'volatile', 'sizeof', 'enum', 'struct', 'true', 'false', 'unsigned', 'signed',
]);
const TYPES = new Set([
  'void', 'int', 'long', 'short', 'float', 'double', 'char', 'byte', 'bool', 'boolean', 'word', 'String', 'size_t',
  'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'Servo', 'LiquidCrystal_I2C',
]);
const CONSTS = new Set(['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'PI', 'DEC', 'HEX', 'BIN', 'OCT']);
const BUILTINS = new Set([
  'setup', 'loop', 'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'delayMicroseconds', 'millis',
  'micros', 'tone', 'noTone', 'map', 'constrain', 'min', 'max', 'abs', 'random', 'randomSeed', 'Serial', 'Wire', 'sqrt', 'pow',
]);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML so zvýraznenými časťami programu. */
export function highlight(code: string): string {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(^[ \t]*#[^\n]*)|(\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[uUlLfF]*\b)|([A-Za-z_]\w*)/gm;
  let out = '';
  let last = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    out += esc(code.slice(last, m.index));
    const [tok, comment, str, pre, numb, word] = m;
    let cls = '';
    if (comment) cls = 'c-com';
    else if (str) cls = 'c-str';
    else if (pre) cls = 'c-pre';
    else if (numb) cls = 'c-num';
    else if (word) cls = KEYWORDS.has(word) ? 'c-key' : TYPES.has(word) ? 'c-type' : CONSTS.has(word) ? 'c-const' : BUILTINS.has(word) ? 'c-fn' : '';
    out += cls ? `<span class="${cls}">${esc(tok)}</span>` : esc(tok);
    last = m.index + tok.length;
  }
  return `${out}${esc(code.slice(last))}\n`;
}

export interface CodeEditor {
  el: HTMLElement;
  textarea: HTMLTextAreaElement;
  get value(): string;
  setValue(code: string): void;
  /** Zvýrazní riadok s chybou (null = žiadny). */
  mark(line: number | null, kind?: 'error' | 'warn'): void;
  goTo(line: number): void;
}

export function codeEditor(initial: string, label: string, onInput: (code: string) => void): CodeEditor {
  const gutter = h('pre', { class: 'code-gutter', 'aria-hidden': 'true' });
  const hl = h('pre', { class: 'code-hl', 'aria-hidden': 'true' });
  const ta = h('textarea', {
    class: 'code-input', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', 'aria-label': label,
  });
  ta.value = initial;
  const area = h('div', { class: 'code-area' }, hl, ta);
  const el = h('div', { class: 'code-edit' }, h('div', { class: 'code-gutter-wrap' }, gutter), area);
  let marked: { line: number; kind: string } | null = null;
  let tabOut = false;

  // Posúva sa samotné textové pole; zvýraznenie a čísla riadkov ho nasledujú.
  const follow = () => {
    hl.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    gutter.style.transform = `translateY(${-ta.scrollTop}px)`;
  };

  const refresh = () => {
    const code = ta.value;
    hl.innerHTML = highlight(code);
    const lines = code.split('\n');
    gutter.replaceChildren(...lines.map((_, i) => h('span', {
      class: marked && marked.line === i + 1 ? `is-${marked.kind}` : null,
    }, String(i + 1))));
    el.style.setProperty('--code-lines', String(Math.max(8, lines.length)));
    follow();
  };
  ta.addEventListener('scroll', follow);

  /** Vloží text tak, aby fungovalo aj Ctrl+Z v prehliadači. */
  const insert = (text: string, start = ta.selectionStart, end = ta.selectionEnd) => {
    ta.setSelectionRange(start, end);
    const ok = typeof document.execCommand === 'function' && document.execCommand(text ? 'insertText' : 'delete', false, text);
    if (!ok) {
      ta.setRangeText(text, start, end, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  };

  ta.addEventListener('input', () => {
    refresh();
    onInput(ta.value);
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tabOut = true;
      return;
    }
    if (e.key === 'Tab' && !tabOut && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const v = ta.value;
      const lineStart = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      if (e.shiftKey) {
        const spaces = /^ {1,2}/.exec(v.slice(lineStart))?.[0].length ?? 0;
        if (spaces) {
          const pos = ta.selectionStart;
          insert('', lineStart, lineStart + spaces);
          ta.setSelectionRange(Math.max(lineStart, pos - spaces), Math.max(lineStart, pos - spaces));
        }
      } else {
        insert('  ');
      }
      return;
    }
    tabOut = false;
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const v = ta.value;
      const pos = ta.selectionStart;
      const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
      const line = v.slice(lineStart, pos);
      let indent = /^\s*/.exec(line)![0];
      if (/\{\s*$/.test(line)) indent += '  ';
      insert(`\n${indent}`);
      return;
    }
    if (e.key === '}') {
      const v = ta.value;
      const pos = ta.selectionStart;
      const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
      const before = v.slice(lineStart, pos);
      if (/^ {2,}$/.test(before)) {
        e.preventDefault();
        insert(`${before.slice(2)}}`, lineStart, pos);
      }
    }
  });
  refresh();

  return {
    el,
    textarea: ta,
    get value() {
      return ta.value;
    },
    setValue(code: string) {
      if (code === ta.value) return;
      ta.value = code;
      refresh();
    },
    mark(line, kind = 'error') {
      marked = line ? { line, kind } : null;
      refresh();
    },
    goTo(line) {
      const lines = ta.value.split('\n');
      const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
      ta.focus();
      ta.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
      ta.scrollTop = Math.max(0, (line - 4) * lh);
      follow();
    },
  };
}
