/**
 * Kalkulačky kapitoly Číslicová technika: prevod čísla medzi desiatkovou, dvojkovou
 * a šestnástkovou sústavou s kódom BCD, počtom bitov a postupom delenia dvoma.
 */
import { h } from '../lib/dom';
import { divisionFigure } from '../ui/fig-digital';
import { type CalculatorInfo, errorMsg, result, segmented, v } from './calc-kit';

type Base = '10' | '2' | '16';

const MAX = (1n << 64n) - 1n;
const NBSP = ' ';
const SUB: Record<Base, string> = { '10': 'DEC', '2': 'BIN', '16': 'HEX' };
const HINT: Record<Base, string> = {
  '10': 'Celé číslo, môže byť aj záporné (napr. 181 alebo −45).',
  '2': 'Iba číslice 0 a 1, medzery sa ignorujú (napr. 1011 0101).',
  '16': 'Číslice 0 až 9 a písmená A až F, predpona 0x je dovolená (napr. 0xD6).',
};

const dec = (x: bigint) => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
const grp = (bits: string) => bits.replace(/\B(?=([01]{4})+$)/g, ' ');
const hexStr = (x: bigint) => x.toString(16).toUpperCase();

/** Prečíta číslo v zadanej sústave, alebo vráti text chyby. */
function parse(raw: string, base: Base): bigint | string {
  let t = raw.replace(/[\s_ ]/g, '');
  if (!t) return 'Zadaj číslo.';
  let neg = false;
  if (/^[−-]/.test(t)) {
    if (base !== '10') return 'Záporné číslo zadaj v desiatkovej sústave – kalkulačka ukáže jeho dvojkový doplnok.';
    neg = true;
    t = t.slice(1);
  }
  let value: bigint;
  if (base === '10') {
    if (!/^\d+$/.test(t)) return 'Desiatkové číslo smie obsahovať iba číslice 0 až 9.';
    value = BigInt(t);
  } else if (base === '2') {
    t = t.replace(/^0b/i, '');
    if (!/^[01]+$/.test(t)) return 'Dvojkové číslo smie obsahovať iba číslice 0 a 1.';
    value = BigInt(`0b${t}`);
  } else {
    t = t.replace(/^0x/i, '').replace(/h$/i, '');
    if (!/^[0-9a-f]+$/i.test(t)) return 'Šestnástkové číslo smie obsahovať iba číslice 0 až 9 a písmená A až F.';
    value = BigInt(`0x${t}`);
  }
  if (value > MAX) return `Kalkulačka prevádza čísla do 64 bitov, teda najviac ${dec(MAX)}.`;
  if (neg) {
    if (value > 1n << 63n) return 'Záporné číslo musí byť aspoň −2⁶³, aby sa zmestilo do 64 bitov.';
    value = -value;
  }
  return value;
}

function format(x: bigint, base: Base): string {
  if (base === '10') return x.toString();
  if (base === '2') return grp(x.toString(2));
  return hexStr(x);
}

function sustavyCalc(): HTMLElement {
  let base: Base = '10';
  const out = h('div', { class: 'calc-result' });
  const steps = h('div', { class: 'calc-subsection' });
  const fig = h('div', { class: 'sch-panel calc-figure' });
  const input = h('input', {
    id: 'sus-in', type: 'text', inputmode: 'text', autocomplete: 'off', spellcheck: 'false', value: '181', class: 'field-input',
  });
  const unit = h('span', { class: 'field-unit' }, SUB[base]);
  const hint = h('p', { class: 'field-hint' }, HINT[base]);

  const update = () => {
    const x = parse(input.value, base);
    input.classList.toggle('is-invalid', typeof x === 'string' && input.value.trim() !== '');
    if (typeof x === 'string') {
      out.replaceChildren(errorMsg(x));
      steps.replaceChildren();
      fig.replaceChildren();
      fig.hidden = true;
      return;
    }
    const rows: HTMLElement[] = [];
    if (x < 0n) {
      const width = [8, 16, 32, 64].find((w) => -x <= 1n << BigInt(w - 1)) ?? 64;
      const pattern = (1n << BigInt(width)) + x;
      rows.push(
        result(`Dvojkový doplnok (${width} bitov)`, grp(pattern.toString(2).padStart(width, '0')), true),
        result('Šestnástkovo', `${hexStr(pattern).padStart(width / 4, '0')} (0x${hexStr(pattern).padStart(width / 4, '0')})`),
        result('Absolútna hodnota dvojkovo', grp((-x).toString(2))),
        result(`Rozsah ${width}-bitového čísla so znamienkom`, `−${dec(1n << BigInt(width - 1))} až ${dec((1n << BigInt(width - 1)) - 1n)}`),
      );
    } else {
      const bits = x === 0n ? 1 : x.toString(2).length;
      const bcd = x.toString().split('').map((d) => Number(d).toString(2).padStart(4, '0')).join(' ');
      const word = [8, 16, 32, 64].find((w) => bits <= w) ?? 64;
      rows.push(
        result('Desiatková', dec(x), base !== '10'),
        result('Dvojková', grp(x.toString(2)), base !== '2'),
        result('Šestnástková', `${hexStr(x)} (0x${hexStr(x)})`, base === '2'),
        result('Osmičková', x.toString(8)),
        result('Kód BCD 8421', bcd),
        result('Najmenší počet bitov', `${bits} (stačí ${word}-bitová premenná)`),
        result('Počet bajtov', String(Math.ceil(bits / 8))),
      );
      if (x <= 255n) rows.push(result('Ten istý bajt so znamienkom', x >= 128n ? `−${256n - x}` : x.toString()));
    }
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [v('$N = Σ $a_{$i} · $z^{$i}'), v('$K = 2^{$n}'), v('$N_{max} = 2^{$n} − 1')]),
      ),
    );

    // Postup prevodu.
    const abs = x < 0n ? -x : x;
    const blocks: (HTMLElement | null)[] = [];
    if (base === '2' || base === '16') {
      const z = base === '2' ? 2n : 16n;
      const digits = abs.toString(Number(z)).toUpperCase().split('');
      const k = digits.length;
      const terms = digits
        .map((d, i) => [BigInt(parseInt(d, Number(z))), BigInt(k - 1 - i)] as const)
        .filter(([a]) => a !== 0n);
      if (k <= 16) {
        const sym = base === '2' ? (terms.map(([, i]) => `${z}^{${i}}`).join(' + ') || '0') : (terms.map(([a, i]) => `${a} · ${z}^{${i}}`).join(' + ') || '0');
        blocks.push(
          h('h3', null, base === '2' ? 'Postup – rozvoj podľa mocnín dvoch' : 'Postup – rozvoj podľa mocnín šestnástich'),
          h('p', { class: 'fx' }, v(sym)),
          h('p', { class: 'calc-note' }, `= ${terms.map(([a, i]) => dec(a * z ** i)).join(' + ') || '0'} = ${dec(abs)}`),
        );
      }
    }
    if (abs > 0n) {
      const div: [bigint, bigint, bigint][] = [];
      for (let q = abs; q > 0n; q /= 2n) div.push([q, q / 2n, q % 2n]);
      const shown = div.slice(0, 24);
      blocks.push(
        h('h3', null, 'Postup – delenie dvoma'),
        h('p', { class: 'calc-note' }, 'Zvyšky čítaj zdola nahor: prvý zvyšok je najnižší bit (LSB), posledný najvyšší (MSB).'),
        h('div', { class: 'table-wrap' },
          h('table', { class: 'data-table' },
            h('thead', null, h('tr', null, ['Delenec', 'Podiel', 'Zvyšok'].map((c) => h('th', { scope: 'col' }, c)))),
            h('tbody', null, shown.map(([q, p, r]) => h('tr', null, h('td', null, `${dec(q)} : 2`), h('td', null, dec(p)), h('td', null, h('strong', null, r.toString()))))),
          ),
        ),
        div.length > shown.length ? h('p', { class: 'calc-note' }, `Zobrazených je prvých ${shown.length} z ${div.length} krokov.`) : null,
        h('p', null, `Výsledok: ${dec(abs)} = `, h('strong', null, grp(abs.toString(2))), '₂'),
      );
    }
    steps.replaceChildren(...blocks.filter((b): b is HTMLElement => b !== null));
    steps.hidden = blocks.length === 0;
    const small = abs >= 1n && abs <= 1023n;
    fig.replaceChildren(...(small ? [divisionFigure(Number(abs))] : []));
    fig.hidden = !small;
  };

  const seg = segmented<Base>('sus-base', 'Sústava zadaného čísla', [['10', 'desiatková'], ['2', 'dvojková'], ['16', 'šestnástková']], base, (b) => {
    const old = parse(input.value, base);
    base = b;
    if (typeof old !== 'string' && (old >= 0n || b === '10')) input.value = format(old, b);
    unit.textContent = SUB[b];
    hint.textContent = HINT[b];
    update();
  });
  input.addEventListener('input', update);
  update();

  return h('div', { class: 'calc-stack' },
    h('div', { class: 'calc' },
      h('div', { class: 'calc-inputs' },
        seg,
        h('div', { class: 'field' },
          h('label', { for: 'sus-in' }, 'Číslo'),
          h('div', { class: 'field-box' }, input, unit),
          hint,
        ),
        steps,
      ),
      h('div', { class: 'calc-outputs' }, out, fig),
    ),
  );
}

/** Kalkulačky k tejto kapitole učiva 3. ročníka. */
export const CALCS: readonly CalculatorInfo[] = [
  {
    id: 'sustavy',
    title: 'Prevod číselných sústav',
    short: 'Desiatková, dvojková a šestnástková sústava, kód BCD, počet bitov a postup delenia dvoma.',
    render: sustavyCalc,
  },
];
