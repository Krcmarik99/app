import { h } from '../lib/dom';
import { fmt, formatSI } from '../lib/units';
import { lineChart, sample } from '../ui/chart';
import { filterFigure, logAxis } from '../ui/fig-ac';
import { errorMsg, field, ok, result, segmented, si, v, type CalculatorInfo } from './calc-kit';

/** Kalkulačky ku kapitole Striedavý prúd (3. ročník): filtre a trojfázový výkon s kompenzáciou. */

const TWO_PI = 2 * Math.PI;
const SQRT3 = Math.sqrt(3);
const signed = (x: number, sig = 3) => (x < 0 ? `−${fmt(-x, sig)}` : fmt(x, sig));

// ---------------------------------------------------------------- filter RC / RL

function filterCalc(): HTMLElement {
  let type: 'rc' | 'rl' = 'rc';
  let kind: 'lp' | 'hp' = 'lp';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });

  const update = () => {
    const R = fR.read();
    const X = type === 'rc' ? fC.read() : fL.read();
    const f = fF.read();
    const U1 = fU.input.value.trim() === '' ? NaN : fU.read();
    fC.el.style.display = type === 'rc' ? '' : 'none';
    fL.el.style.display = type === 'rl' ? '' : 'none';
    if (!ok(R) || !ok(X) || !ok(f)) {
      out.replaceChildren(errorMsg(`Zadaj kladný odpor, ${type === 'rc' ? 'kapacitu' : 'indukčnosť'} a frekvenciu signálu.`));
      fig.replaceChildren(filterFigure(kind, type));
      return;
    }
    const fm = type === 'rc' ? 1 / (TWO_PI * R * X) : R / (TWO_PI * X);
    const ratio = kind === 'lp' ? f / fm : fm / f;
    const A = 1 / Math.sqrt(1 + ratio * ratio);
    const dB = 20 * Math.log10(A);
    const phi = (Math.atan(ratio) * 180) / Math.PI * (kind === 'lp' ? -1 : 1);
    const reactance = type === 'rc' ? 1 / (TWO_PI * f * X) : TWO_PI * f * X;
    const rows: HTMLElement[] = [
      result(['Medzná frekvencia ', v('$f_{m}')], si(fm, 'Hz'), true),
      result(['Prenos ', v('@f{$U_{2}}{$U_{1}}'), ' pri ', v('$f')], fmt(A, 3), true),
      result('Prenos v decibeloch', `${signed(dB)} dB`),
      result(['Fázový posun výstupu ', v('$φ')], `${signed(phi)}° (${kind === 'lp' ? 'výstup zaostáva' : 'výstup predbieha'})`),
      result([type === 'rc' ? 'Reaktancia kondenzátora ' : 'Reaktancia cievky ', v(type === 'rc' ? '$X_{C}' : '$X_{L}'), ' pri ', v('$f')], si(reactance, 'Ω')),
    ];
    if (ok(U1)) rows.push(result(['Výstupné napätie naprázdno ', v('$U_{2}')], si(U1 * A, 'V')));
    const pass = kind === 'lp' ? f < fm : f > fm;
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      h('p', { class: 'calc-note' }, Math.abs(ratio - 1) < 0.02
        ? 'Signál je na medznej frekvencii: −3 dB a fázový posun 45°.'
        : pass ? 'Signál je v priepustnom pásme filtra.' : 'Signál je v nepriepustnom pásme – filter ho zoslabuje.'),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [
          v(type === 'rc' ? '$f_{m} = @f{1}{2π$R$C}' : '$f_{m} = @f{$R}{2π$L}'),
          v(kind === 'lp' ? '@f{$U_{2}}{$U_{1}} = @f{1}{@s{1 + (@f{$f}{$f_{m}})^{2}}}' : '@f{$U_{2}}{$U_{1}} = @f{1}{@s{1 + (@f{$f_{m}}{$f})^{2}}}'),
        ]),
      ),
    );
    // Graf na šiestich dekádach okolo medznej frekvencie.
    const e0 = Math.floor(Math.log10(Math.min(fm, f)) - 1.5);
    const e1 = Math.ceil(Math.log10(Math.max(fm, f)) + 1.5);
    const gain = (e: number) => {
      const r = kind === 'lp' ? 10 ** e / fm : fm / 10 ** e;
      return 20 * Math.log10(1 / Math.sqrt(1 + r * r));
    };
    const chart = lineChart({
      ariaLabel: `Frekvenčná charakteristika filtra s medznou frekvenciou ${formatSI(fm, 'Hz')}`,
      width: 440,
      height: 240,
      x: logAxis(e0, e1, 'Hz', 'f'),
      y: { min: -60, max: 5, ticks: [-60, -40, -20, 0], format: (t) => signed(t), label: 'A [dB]' },
      series: [{ points: sample(gain, e0, e1, 200), className: kind === 'lp' ? '' : 'copper' }],
      hlines: [{ y: -3, label: '−3 dB' }],
      vlines: [{ x: Math.log10(fm), label: 'fₘ' }],
      markers: [{ x: Math.log10(f), y: Math.max(-60, dB), label: `${signed(dB)} dB`, above: true }],
    });
    fig.replaceChildren(filterFigure(kind, type), chart);
  };

  const fR = field('flt-r', ['Odpor ', v('$R')], 'Ω', '1k', update);
  const fC = field('flt-c', ['Kapacita ', v('$C')], 'F', '100n', update);
  const fL = field('flt-l', ['Indukčnosť ', v('$L')], 'H', '10m', update);
  const fF = field('flt-f', ['Frekvencia signálu ', v('$f')], 'Hz', '10k', update);
  const fU = field('flt-u', ['Vstupné napätie ', v('$U_{1}')], 'V', '', update, 'Nepovinné – vypočíta sa výstupné napätie');
  const typeSel = segmented('flt-type', 'Prvky filtra', [['rc', 'RC'], ['rl', 'RL']], type, (val) => {
    type = val;
    update();
  });
  const kindSel = segmented('flt-kind', 'Druh filtra', [['lp', 'Dolná priepusť'], ['hp', 'Horná priepusť']], kind, (val) => {
    kind = val;
    update();
  });
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, typeSel, kindSel, h('div', { class: 'field-grid' }, fR.el, fC.el, fL.el, fF.el, fU.el)),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- výkon a kompenzácia

function powerCalc(): HTMLElement {
  let system: '1' | '3' = '3';
  const out = h('div', { class: 'calc-result' });

  const update = () => {
    const U = fU.read();
    const I = fI.read();
    const c1 = fCos.read();
    const f = fF.read();
    const c2raw = fCos2.input.value.trim();
    const c2 = c2raw === '' ? NaN : fCos2.read();
    if (!ok(U) || !ok(I) || !ok(f) || !(c1 > 0 && c1 <= 1)) {
      out.replaceChildren(errorMsg('Zadaj kladné napätie, prúd a frekvenciu a účinník od 0 do 1 (napr. 0,8).'));
      return;
    }
    const k = system === '3' ? SQRT3 : 1;
    const S = k * U * I;
    const P = S * c1;
    const Q = S * Math.sqrt(1 - c1 * c1);
    const rows: HTMLElement[] = [
      result(['Činný výkon ', v('$P')], si(P, 'W'), true),
      result(['Jalový výkon ', v('$Q')], si(Q, 'var')),
      result(['Zdanlivý výkon ', v('$S')], si(S, 'VA')),
      result(['Fázový posun ', v('$φ')], `${fmt((Math.acos(c1) * 180) / Math.PI, 3)}°`),
    ];
    const notes: HTMLElement[] = [];
    if (c2raw !== '') {
      if (!(c2 > 0 && c2 <= 1)) {
        notes.push(errorMsg('Požadovaný účinník musí byť od 0 do 1.'));
      } else if (c2 <= c1) {
        notes.push(h('p', { class: 'calc-note' }, 'Požadovaný účinník je rovnaký alebo horší ako súčasný – kompenzácia nie je potrebná.'));
      } else {
        const w = TWO_PI * f;
        const Qc = P * (Math.tan(Math.acos(c1)) - Math.tan(Math.acos(c2)));
        const I2 = P / (k * U * c2);
        rows.push(result(['Jalový výkon kondenzátorov ', v('$Q_{C}')], si(Qc, 'var'), true));
        if (system === '1') {
          rows.push(result(['Kapacita kondenzátora ', v('$C')], si(Qc / (w * U * U), 'F'), true));
        } else {
          rows.push(
            result(['Kapacita do trojuholníka (na fázu) ', v('$C_{Δ}')], si(Qc / (3 * w * U * U), 'F'), true),
            result(['Kapacita do hviezdy (na fázu) ', v('$C_{Y}')], si(Qc / (w * U * U), 'F')),
          );
        }
        rows.push(result(['Prúd po kompenzácii ', v('$I_{2}')], `${si(I2, 'A')} (o ${fmt((1 - I2 / I) * 100, 3)} % menej)`));
      }
    }
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      ...notes,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, system === '3'
          ? [v('$P = @s{3} · $U · $I · cos $φ'), v('$Q_{C} = $P · (tg $φ_{1} − tg $φ_{2})'), v('$C_{Δ} = @f{$Q_{C}}{3 · $ω · $U^{2}}')]
          : [v('$P = $U · $I · cos $φ'), v('$Q_{C} = $P · (tg $φ_{1} − tg $φ_{2})'), v('$C = @f{$Q_{C}}{$ω · $U^{2}}')]),
      ),
    );
  };

  const fU = field('pw-u', ['Napätie ', v('$U')], 'V', '400', update, 'Pri trojfázovej sústave združené (medzi fázami)');
  const fI = field('pw-i', ['Prúd ', v('$I')], 'A', '16', update);
  const fCos = field('pw-cos', ['Účinník cos ', v('$φ')], '', '0,75', update);
  const fF = field('pw-f', ['Frekvencia ', v('$f')], 'Hz', '50', update);
  const fCos2 = field('pw-cos2', ['Požadovaný účinník cos ', v('$φ_{2}')], '', '0,95', update, 'Prázdne = bez kompenzácie');
  const sysSel = segmented('pw-sys', 'Sústava', [['3', 'Trojfázová'], ['1', 'Jednofázová']], system, (val) => {
    system = val;
    update();
  });
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, sysSel, h('div', { class: 'field-grid' }, fU.el, fI.el, fCos.el, fF.el, fCos2.el)),
    h('div', { class: 'calc-outputs' }, out),
  );
}

/** Kalkulačky k tejto kapitole učiva 3. ročníka. */
export const CALCS: readonly CalculatorInfo[] = [
  { id: 'filter', title: 'Filter RC a RL', short: 'Medzná frekvencia, prenos v dB a fázový posun dolnej a hornej priepusti.', render: filterCalc },
  { id: 'kompenzacia', title: 'Výkon a kompenzácia účinníka', short: 'Činný, jalový a zdanlivý výkon 1f aj 3f a kondenzátory na zlepšenie účinníka.', render: powerCalc },
];

