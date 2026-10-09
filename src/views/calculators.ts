import {
  bandNames, bandRoles, colorsForBand, decodeBands, encodeBands, type BandRole, type ColorId,
} from '../lib/colorcode';
import { frag, h, type Child } from '../lib/dom';
import {
  E12, E24, chargingVoltage, dividerOutput, nearestStandard, reciprocalSum, resonanceFrequency,
  resistanceAtTemperature, seriesRlc, seriesSum, solveOhm, wireResistance, type OhmKey,
} from '../lib/electro';
import { formula, rich } from '../lib/formula';
import { fmt, formatSI, parseQuantity, siParts, scaleExp, superscript } from '../lib/units';
import { lineChart, sample } from '../ui/chart';
import {
  dividerFigure, impedanceTriangle, ledFigure, parallelFigure, resistorBands, seriesFigure,
} from '../ui/figures';
import { backLink, pageHead } from './common';

export interface CalculatorInfo {
  id: string;
  title: string;
  short: string;
  render: () => HTMLElement;
}

// ---------------------------------------------------------------- spoločné prvky

interface Field {
  el: HTMLElement;
  input: HTMLInputElement;
  read: () => number;
}

function field(id: string, label: Child, unit: string, value: string, onInput: () => void, hint?: string): Field {
  const input = h('input', {
    id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value, class: 'field-input',
  });
  const read = () => parseQuantity(input.value, unit);
  input.addEventListener('input', () => {
    const v = read();
    input.classList.toggle('is-invalid', input.value.trim() !== '' && Number.isNaN(v));
    onInput();
  });
  const el = h('div', { class: 'field' },
    h('label', { for: id }, label),
    h('div', { class: 'field-box' }, input, unit ? h('span', { class: 'field-unit' }, unit) : null),
    hint ? h('p', { class: 'field-hint' }, hint) : null,
  );
  return { el, input, read };
}

function v(sym: string): HTMLElement {
  const span = h('span', { class: 'fx' });
  span.append(formula(sym));
  return span;
}

function result(label: Child, value: string, emphasis = false): HTMLElement {
  return h('div', { class: `result ${emphasis ? 'result-main' : ''}` },
    h('dt', null, label),
    h('dd', null, value),
  );
}

function segmented<T extends string>(name: string, label: string, options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  return h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label },
    options.map(([val, text]) => h('label', { class: 'seg-item' },
      h('input', { type: 'radio', name, id: `${name}-${val}`, value: val, checked: val === value, onChange: () => onChange(val) }),
      h('span', null, text),
    )),
  );
}

function calcLayout(inputs: Child, outputs: HTMLElement, figure?: HTMLElement | null): HTMLElement {
  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, inputs),
    h('div', { class: 'calc-outputs' },
      outputs,
      figure ? h('div', { class: 'sch-panel calc-figure' }, figure) : null,
    ),
  );
}

const ok = (x: number) => Number.isFinite(x) && x > 0;
const si = (x: number, unit: string, sig = 4) => formatSI(x, unit, sig);
const errorMsg = (text: string) => h('p', { class: 'calc-error' }, text);

/** Krátky zápis s predponou do políčka: 0,02553 → „25,53m“. */
function compact(x: number): string {
  const { scaled, prefix } = siParts(x, 4);
  return `${fmt(scaled, 4)}${prefix}`;
}

// ---------------------------------------------------------------- Ohmov zákon

const OHM_FORMULAS: Record<string, string[]> = {
  'I,U': ['$R = @f{$U}{$I}', '$P = $U · $I'],
  'R,U': ['$I = @f{$U}{$R}', '$P = @f{$U^{2}}{$R}'],
  'P,U': ['$I = @f{$P}{$U}', '$R = @f{$U^{2}}{$P}'],
  'I,R': ['$U = $R · $I', '$P = $R · $I^{2}'],
  'I,P': ['$U = @f{$P}{$I}', '$R = @f{$P}{$I^{2}}'],
  'P,R': ['$U = @s{$P · $R}', '$I = @s{@f{$P}{$R}}'],
};

function ohmCalc(): HTMLElement {
  const units: Record<OhmKey, string> = { U: 'V', I: 'A', R: 'Ω', P: 'W' };
  const labels: Record<OhmKey, string> = { U: 'Napätie', I: 'Prúd', R: 'Odpor', P: 'Výkon' };
  const keys: OhmKey[] = ['U', 'I', 'R', 'P'];
  let given: OhmKey[] = ['U', 'R'];
  const fields = {} as Record<OhmKey, Field>;
  const badges = {} as Record<OhmKey, HTMLElement>;
  const out = h('div', { class: 'calc-result' });

  const update = (edited?: OhmKey) => {
    if (edited) {
      const val = fields[edited].read();
      given = given.filter((k) => k !== edited);
      if (fields[edited].input.value.trim() !== '' && !Number.isNaN(val)) given = [edited, ...given].slice(0, 2);
    }
    keys.forEach((k) => {
      const isGiven = given.includes(k);
      fields[k].el.classList.toggle('is-computed', !isGiven);
      badges[k].textContent = isGiven ? 'zadané' : 'vypočítané';
    });
    if (given.length < 2) {
      keys.filter((k) => !given.includes(k) && k !== edited).forEach((k) => { fields[k].input.value = ''; });
      out.replaceChildren(h('p', { class: 'muted' }, 'Zadaj ľubovoľné dve veličiny – zvyšné dve sa dopočítajú.'));
      return;
    }
    const [a, b] = given;
    const av = fields[a].read();
    const bv = fields[b].read();
    if (!ok(av) || !ok(bv)) {
      out.replaceChildren(errorMsg('Hodnoty musia byť kladné čísla, napríklad 12, 4,7k alebo 25m.'));
      return;
    }
    const res = solveOhm(a, av, b, bv)!;
    keys.filter((k) => !given.includes(k)).forEach((k) => {
      fields[k].input.value = compact(res[k]);
    });
    const pair = [...given].sort().join(',');
    out.replaceChildren(
      h('dl', { class: 'results' }, keys.map((k) => result([labels[k], ' ', v(`$${k}`)], si(res[k], units[k]), !given.includes(k)))),
      h('div', { class: 'used-formulas' },
        h('p', { class: 'eyebrow' }, 'Použité vzťahy'),
        h('div', { class: 'formula-row' }, (OHM_FORMULAS[pair] ?? []).map((f) => v(f))),
      ),
    );
  };

  const initial: Record<OhmKey, string> = { U: '12', I: '', R: '470', P: '' };
  keys.forEach((k) => {
    badges[k] = h('span', { class: 'field-badge' });
    fields[k] = field(`ohm-${k}`, [labels[k], ' ', v(`$${k}`), badges[k]], units[k], initial[k], () => update(k));
  });
  update();

  return calcLayout(
    [
      h('p', { class: 'calc-note' }, 'Vyplň dve políčka. Predpony píš priamo k číslu: 4k7 = 4,7 kΩ, 25m = 25 mA, 2M2 = 2,2 MΩ.'),
      h('div', { class: 'field-grid' }, keys.map((k) => fields[k].el)),
    ],
    out,
  );
}

// ---------------------------------------------------------------- Spájanie súčiastok

function combineCalc(): HTMLElement {
  let mode: 'series' | 'parallel' = 'parallel';
  let kind: 'R' | 'C' = 'R';
  const values = ['1k', '2k2', '4k7'];
  const list = h('div', { class: 'value-list' });
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });

  const unit = () => (kind === 'R' ? 'Ω' : 'F');
  const sym = () => (kind === 'R' ? 'R' : 'C');

  const update = () => {
    const nums = values.map((x) => parseQuantity(x, unit()));
    const valid = nums.every(ok);
    const labeled = values.map((x, i) => ({ label: `${sym()}_${i + 1}`, value: ok(nums[i]) ? formatSI(nums[i], unit(), 3) : x }));
    const figKind = kind === 'R' ? 'resistor' : 'capacitor';
    fig.replaceChildren(mode === 'series' ? seriesFigure(labeled, { kind: figKind }) : parallelFigure(labeled, { kind: figKind, branchCurrents: false }));
    if (!valid) {
      out.replaceChildren(errorMsg('Každá hodnota musí byť kladné číslo, napríklad 220, 4k7 alebo 100n.'));
      return;
    }
    const summing = (mode === 'series') === (kind === 'R');
    const total = summing ? seriesSum(nums) : reciprocalSum(nums);
    const s = sym();
    const terms = nums.map((_, i) => `$${s}_{${i + 1}}`);
    const tex = summing ? `$${s} = ${terms.join(' + ')}` : `@f{1}{$${s}} = ${terms.map((t) => `@f{1}{${t}}`).join(' + ')}`;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const note = summing
      ? `Výsledok je väčší ako najväčšia hodnota (${formatSI(max, unit(), 3)}).`
      : `Výsledok je menší ako najmenšia hodnota (${formatSI(min, unit(), 3)}).`;
    out.replaceChildren(
      h('dl', { class: 'results' }, result([kind === 'R' ? 'Výsledný odpor ' : 'Výsledná kapacita ', v(`$${s}`)], si(total, unit()), true)),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťah'), v(tex)),
      h('p', { class: 'muted' }, note),
    );
  };

  const renderList = () => {
    list.replaceChildren(...values.map((val, i) => {
      const id = `comb-${i}`;
      const input = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: val, class: 'field-input' });
      input.addEventListener('input', () => {
        values[i] = input.value;
        input.classList.toggle('is-invalid', !ok(parseQuantity(input.value, unit())));
        update();
      });
      return h('div', { class: 'value-row' },
        h('label', { for: id, class: 'value-label' }, v(`$${sym()}_{${i + 1}}`)),
        h('div', { class: 'field-box' }, input, h('span', { class: 'field-unit' }, unit())),
        values.length > 2
          ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Odobrať ${sym()}${i + 1}`, onClick: () => { values.splice(i, 1); renderList(); update(); } }, '×')
          : null,
      );
    }));
  };

  const addBtn = h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onClick: () => {
    if (values.length < 6) {
      values.push(kind === 'R' ? '1k' : '10µ');
      renderList();
      update();
    }
  } }, '+ Pridať súčiastku');

  renderList();
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'seg-row' },
        segmented('comb-kind', 'Súčiastky', [['R', 'Rezistory'], ['C', 'Kondenzátory']], kind, (k) => {
          kind = k;
          values.splice(0, values.length, ...(k === 'R' ? ['1k', '2k2', '4k7'] : ['10µ', '22µ', '47µ']));
          renderList();
          update();
        }),
        segmented('comb-mode', 'Zapojenie', [['series', 'Sériovo'], ['parallel', 'Paralelne']], mode, (m) => { mode = m; update(); }),
      ),
      list,
      addBtn,
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- Delič napätia

function dividerCalc(): HTMLElement {
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });
  const design = h('div', { class: 'calc-result' });

  const update = () => {
    const U = fU.read();
    const R1 = fR1.read();
    const R2 = fR2.read();
    if (!ok(U) || !ok(R1) || !ok(R2)) {
      out.replaceChildren(errorMsg('Zadaj kladné hodnoty napätia aj oboch odporov.'));
    } else {
      const U2 = dividerOutput(U, R1, R2);
      const I = U / (R1 + R2);
      out.replaceChildren(
        h('dl', { class: 'results' },
          result(['Výstupné napätie ', v('$U_{2}')], si(U2, 'V'), true),
          result(['Napätie na ', v('$R_{1}')], si(U - U2, 'V')),
          result(['Prúd deličom ', v('$I')], si(I, 'A')),
          result(['Výkon na ', v('$R_{1}'), ' / ', v('$R_{2}')], `${si(I * I * R1, 'W', 3)} / ${si(I * I * R2, 'W', 3)}`),
        ),
        h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťah'), v('$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}')),
      );
      fig.replaceChildren(dividerFigure({
        r1: { label: 'R_1', value: formatSI(R1, 'Ω', 3) },
        r2: { label: 'R_2', value: formatSI(R2, 'Ω', 3) },
        source: { label: 'U', value: formatSI(U, 'V', 3) },
      }));
    }
    const target = fT.read();
    if (!ok(U) || !ok(R1) || !ok(target) || target >= U) {
      design.replaceChildren(h('p', { class: 'muted' }, 'Zadaj požadované výstupné napätie menšie ako vstupné.'));
      return;
    }
    const ideal = (R1 * target) / (U - target);
    const std = nearestStandard(ideal, E24, 'nearest');
    design.replaceChildren(
      h('dl', { class: 'results' },
        result(['Ideálny ', v('$R_{2}')], si(ideal, 'Ω')),
        result(['Najbližší z rady E24'], si(std, 'Ω', 3), true),
        result(['Výstup s ním'], si(dividerOutput(U, R1, std), 'V')),
      ),
    );
  };

  const fU = field('div-u', ['Vstupné napätie ', v('$U')], 'V', '12', update);
  const fR1 = field('div-r1', ['Odpor ', v('$R_{1}')], 'Ω', '10k', update);
  const fR2 = field('div-r2', ['Odpor ', v('$R_{2}')], 'Ω', '4k7', update);
  const fT = field('div-t', ['Požadované ', v('$U_{2}')], 'V', '3,3', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'field-grid' }, fU.el, fR1.el, fR2.el),
      h('div', { class: 'calc-subsection' },
        h('h3', null, 'Návrh deliča'),
        h('p', { class: 'calc-note' }, 'K zvolenému ', v('$R_{1}'), ' nájde ', v('$R_{2}'), ' pre požadované výstupné napätie.'),
        fT.el,
        design,
      ),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- Farebný kód

const ROLE_LABEL: Record<BandRole, string> = { digit: 'Číslica', multiplier: 'Násobiteľ', tolerance: 'Tolerancia' };

function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1d1d1f' : '#ffffff';
}

function colorCodeCalc(): HTMLElement {
  let count: 4 | 5 = 4;
  let ids: ColorId[] = ['yellow', 'violet', 'red', 'gold'];
  const art = h('div', { class: 'resistor-stage' });
  const pickers = h('div', { class: 'band-pickers' });
  const out = h('div', { class: 'calc-result' });
  const reverseMsg = h('p', { class: 'muted', 'aria-live': 'polite' });

  const update = () => {
    art.replaceChildren(resistorBands(ids));
    const d = decodeBands(ids);
    if (!d) {
      out.replaceChildren(errorMsg('Táto kombinácia farieb nie je platná.'));
      return;
    }
    const lo = d.ohms * (1 - d.tolerance / 100);
    const hi = d.ohms * (1 + d.tolerance / 100);
    const inE12 = Math.abs(nearestStandard(d.ohms, E12) - d.ohms) < d.ohms * 1e-6;
    const inE24 = Math.abs(nearestStandard(d.ohms, E24) - d.ohms) < d.ohms * 1e-6;
    out.replaceChildren(
      h('p', { class: 'big-value' }, formatSI(d.ohms, 'Ω', 4), h('span', { class: 'big-tol' }, ` ±${fmt(d.tolerance)} %`)),
      h('dl', { class: 'results' },
        result('Prúžky', bandNames(ids)),
        result('Rozsah hodnôt', `${formatSI(lo, 'Ω', 4)} až ${formatSI(hi, 'Ω', 4)}`),
        result('Rada', inE12 ? 'E12 (aj E24)' : inE24 ? 'E24' : 'mimo radu E12/E24'),
      ),
    );
  };

  const renderPickers = () => {
    const roles = bandRoles(count);
    pickers.replaceChildren(...roles.map((role, i) => {
      const title = ROLE_LABEL[role];
      const swatches = colorsForBand(role, i).map((c) => {
        const caption = role === 'digit' ? String(c.digit) : role === 'multiplier' ? `10${superscript(c.exp!)}` : `${fmt(c.tolerance!)}%`;
        const btn = h('button', {
          type: 'button',
          class: 'swatch-btn',
          style: { background: c.hex, color: textOn(c.hex) },
          'aria-pressed': String(ids[i] === c.id),
          'aria-label': `${c.name}, ${role === 'digit' ? `číslica ${c.digit}` : role === 'multiplier' ? `násobiteľ 10 na ${c.exp}` : `tolerancia ${fmt(c.tolerance!)} %`}`,
          title: c.name,
        }, caption);
        btn.addEventListener('click', () => {
          ids[i] = c.id;
          renderPickers();
          update();
        });
        return btn;
      });
      return h('div', { class: 'band-picker', role: 'group', 'aria-label': `${i + 1}. prúžok – ${title}` },
        h('p', { class: 'band-title' }, h('span', { class: 'band-no' }, `${i + 1}.`), title),
        h('div', { class: 'swatches' }, swatches),
      );
    }));
  };

  const fValue = field('cc-value', 'Hodnota odporu', 'Ω', '4k7', () => { reverseMsg.textContent = ''; });
  const applyValue = () => {
    const val = fValue.read();
    const tol = decodeBands(ids)?.tolerance ?? (count === 4 ? 5 : 1);
    const enc = ok(val) ? encodeBands(val, count, tol) : null;
    if (!enc) {
      reverseMsg.textContent = 'Túto hodnotu nejde zakódovať. Zadaj odpor od 0,1 Ω do stoviek MΩ.';
      return;
    }
    ids = enc.ids;
    renderPickers();
    update();
    reverseMsg.textContent = Math.abs(enc.ohms - val) > val * 1e-9
      ? `Hodnota bola zaokrúhlená na ${formatSI(enc.ohms, 'Ω', 4)} (${count === 4 ? '2' : '3'} platné číslice).`
      : `Prúžky pre ${formatSI(enc.ohms, 'Ω', 4)} sú nastavené.`;
  };

  renderPickers();
  update();

  return h('div', { class: 'calc calc-wide' },
    h('div', { class: 'calc-inputs' },
      segmented('cc-count', 'Počet prúžkov', [['4', '4 prúžky'], ['5', '5 prúžkov']], String(count) as '4' | '5', (c) => {
        const val = decodeBands(ids)?.ohms ?? 4700;
        count = c === '4' ? 4 : 5;
        ids = encodeBands(val, count, count === 4 ? 5 : 1)?.ids ?? (count === 4 ? ['yellow', 'violet', 'red', 'gold'] : ['yellow', 'violet', 'black', 'brown', 'brown']);
        renderPickers();
        update();
      }),
      pickers,
      h('div', { class: 'calc-subsection' },
        h('h3', null, 'Z hodnoty na farby'),
        h('div', { class: 'inline-form' }, fValue.el, h('button', { type: 'button', class: 'btn btn-secondary', onClick: applyValue }, 'Nastaviť prúžky')),
        reverseMsg,
      ),
    ),
    h('div', { class: 'calc-outputs' }, h('div', { class: 'resistor-panel' }, art), out),
  );
}

// ---------------------------------------------------------------- RC a RL

function transientCalc(): HTMLElement {
  let mode: 'RC' | 'RL' = 'RC';
  const out = h('div', { class: 'calc-result' });
  const chart = h('div', { class: 'chart-panel' });
  const compField = h('div');
  let fComp: Field;

  const update = () => {
    const R = fR.read();
    const X = fComp.read();
    const U = fU.read();
    const t = fT.read();
    if (!ok(R) || !ok(X) || !ok(U)) {
      out.replaceChildren(errorMsg('Zadaj kladné hodnoty odporu, súčiastky a napätia.'));
      chart.replaceChildren();
      return;
    }
    const tau = mode === 'RC' ? R * X : X / R;
    const end = 5 * tau;
    const { exp, prefix } = siParts(end, 3);
    const tUnit = `${prefix}s`;
    const toUnit = (sec: number) => scaleExp(sec, exp);
    const rows: HTMLElement[] = [
      result(['Časová konštanta ', v('$τ')], si(tau, 's'), true),
      result(['Prakticky ustálené za ', v('5$τ')], si(end, 's')),
    ];
    if (mode === 'RC') rows.push(result(['Nabíjací prúd na začiatku'], si(U / R, 'A')));
    else rows.push(result(['Ustálený prúd ', v('$U/$R')], si(U / R, 'A')));
    if (Number.isFinite(t) && t >= 0) {
      const frac = 1 - Math.exp(-t / tau);
      rows.push(mode === 'RC'
        ? result(['Napätie ', v('$u_{C}'), ` v čase ${si(t, 's', 3)}`], `${si(chargingVoltage(U, t, tau), 'V')} (${fmt(frac * 100, 3)} %)`)
        : result(['Prúd ', v('$i'), ` v čase ${si(t, 's', 3)}`], `${si((U / R) * frac, 'A')} (${fmt(frac * 100, 3)} %)`));
    }
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, mode === 'RC'
          ? [v('$τ = $R · $C'), v('$u_{C} = $U · (1 − e^{−$t/$τ})')]
          : [v('$τ = @f{$L}{$R}'), v('$i = @f{$U}{$R} · (1 − e^{−$t/$τ})')]),
      ),
    );
    const yMax = mode === 'RC' ? U : U / R;
    const { exp: yExp, prefix: yPrefix } = siParts(yMax, 3);
    const yUnit = `${yPrefix}${mode === 'RC' ? 'V' : 'A'}`;
    const yScaled = scaleExp(yMax, yExp);
    chart.replaceChildren(lineChart({
      ariaLabel: mode === 'RC' ? 'Priebeh napätia na kondenzátore pri nabíjaní' : 'Priebeh prúdu cievkou po zapnutí',
      x: { min: 0, max: toUnit(end), ticks: [0, 1, 2, 3, 4, 5].map((k) => toUnit(k * tau)), format: (val) => fmt(val, 3), label: `t [${tUnit}]` },
      y: { min: 0, max: yScaled * 1.08, ticks: [0, 0.25, 0.5, 0.75, 1].map((k) => k * yScaled), format: (val) => fmt(val, 3), label: `${mode === 'RC' ? 'napätie' : 'prúd'} [${yUnit}]` },
      series: [{ points: sample((x) => yScaled * (1 - Math.exp(-x / toUnit(tau))), 0, toUnit(end)) }],
      markers: [{ x: toUnit(tau), y: yScaled * (1 - Math.exp(-1)), label: '63,2 % po τ' }],
    }));
  };

  const fR = field('tr-r', ['Odpor ', v('$R')], 'Ω', '10k', update);
  const fU = field('tr-u', ['Napätie zdroja ', v('$U')], 'V', '12', update);
  const fT = field('tr-t', ['Čas ', v('$t'), ' (voliteľne)'], 's', '0,5', update);
  const setComp = () => {
    fComp = mode === 'RC'
      ? field('tr-c', ['Kapacita ', v('$C')], 'F', '100µ', update)
      : field('tr-l', ['Indukčnosť ', v('$L')], 'H', '470m', update);
    compField.replaceChildren(fComp.el);
    if (mode === 'RL') {
      fR.input.value = '100';
      fT.input.value = '5m';
    } else {
      fR.input.value = '10k';
      fT.input.value = '0,5';
    }
  };
  setComp();
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented('tr-mode', 'Obvod', [['RC', 'Kondenzátor (RC)'], ['RL', 'Cievka (RL)']], mode, (m) => { mode = m; setComp(); update(); }),
      h('div', { class: 'field-grid' }, fR.el, compField, fU.el, fT.el),
    ),
    h('div', { class: 'calc-outputs' }, out, chart),
  );
}

// ---------------------------------------------------------------- Striedavý obvod RLC

function rlcCalc(): HTMLElement {
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });
  const optional = (f: Field) => (f.input.value.trim() === '' ? 0 : f.read());

  const update = () => {
    const R = fR.read();
    const L = optional(fL);
    const C = optional(fC);
    const f = fF.read();
    const U = fU.read();
    if (!(R >= 0) || !ok(f) || !ok(U) || !(L >= 0) || !(C >= 0) || (R === 0 && L === 0 && C === 0)) {
      out.replaceChildren(errorMsg('Zadaj odpor, frekvenciu a napätie. Indukčnosť alebo kapacitu môžeš nechať prázdnu.'));
      fig.replaceChildren();
      return;
    }
    const r = seriesRlc(R, L, C, f);
    const I = U / r.Z;
    const sin = r.Z === 0 ? 0 : r.X / r.Z;
    const character = Math.abs(r.X) < 1e-9 * Math.max(1, r.Z) ? 'odporový (rezonancia)' : r.X > 0 ? 'induktívny' : 'kapacitný';
    const rows: HTMLElement[] = [
      result(['Impedancia ', v('$Z')], si(r.Z, 'Ω'), true),
      result(['Prúd ', v('$I')], si(I, 'A'), true),
    ];
    if (L > 0) rows.push(result(['Reaktancia cievky ', v('$X_{L}')], si(r.XL, 'Ω')));
    if (C > 0) rows.push(result(['Reaktancia kondenzátora ', v('$X_{C}')], si(r.XC, 'Ω')));
    rows.push(
      result(['Fázový posun ', v('$φ')], `${fmt(r.phi, 3)}° (${character})`),
      result(['Účinník cos ', v('$φ')], fmt(r.cosPhi, 3)),
      result(['Činný výkon ', v('$P')], si(U * I * r.cosPhi, 'W')),
      result(['Jalový výkon ', v('$Q')], si(Math.abs(U * I * sin), 'var')),
      result(['Zdanlivý výkon ', v('$S')], si(U * I, 'VA')),
    );
    if (L > 0 && C > 0) rows.push(result(['Rezonančná frekvencia ', v('$f_{0}')], si(resonanceFrequency(L, C), 'Hz')));
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [v('$Z = @s{$R^{2} + ($X_{L} − $X_{C})^{2}}'), v('$I = @f{$U}{$Z}')]),
      ),
    );
    fig.replaceChildren(impedanceTriangle(R, r.X, { r: 'R', x: 'X', z: 'Z' }, { r: formatSI(R, 'Ω', 3), x: formatSI(r.X, 'Ω', 3), z: formatSI(r.Z, 'Ω', 3) }));
  };

  const fR = field('rlc-r', ['Odpor ', v('$R')], 'Ω', '40', update);
  const fL = field('rlc-l', ['Indukčnosť ', v('$L')], 'H', '100m', update, 'Prázdne = bez cievky');
  const fC = field('rlc-c', ['Kapacita ', v('$C')], 'F', '47µ', update, 'Prázdne = bez kondenzátora');
  const fF = field('rlc-f', ['Frekvencia ', v('$f')], 'Hz', '50', update);
  const fU = field('rlc-u', ['Napätie ', v('$U'), ' (efektívne)'], 'V', '230', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, h('div', { class: 'field-grid' }, fR.el, fL.el, fC.el, fF.el, fU.el)),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- LED

const LED_COLORS: [string, string, number][] = [
  ['red', 'červená', 2.0],
  ['yellow', 'žltá', 2.1],
  ['green', 'zelená', 2.2],
  ['blue', 'modrá', 3.2],
  ['white', 'biela', 3.2],
];

function ledCalc(): HTMLElement {
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });

  const update = () => {
    const U = fU.read();
    const UF = fUF.read();
    const I = fI.read();
    if (!ok(U) || !ok(UF) || !ok(I)) {
      out.replaceChildren(errorMsg('Zadaj kladné hodnoty napätia zdroja, napätia LED a prúdu.'));
      return;
    }
    if (UF >= U) {
      out.replaceChildren(errorMsg('Napätie zdroja musí byť väčšie ako napätie LED, inak LED nebude svietiť.'));
      return;
    }
    const R = (U - UF) / I;
    const Rstd = nearestStandard(R, E12, 'up');
    const Ireal = (U - UF) / Rstd;
    const P = (U - UF) * Ireal;
    const rating = P <= 0.125 ? '0,25 W' : P <= 0.3 ? '0,6 W' : P <= 0.5 ? '1 W' : 'výkonový rezistor (2 W a viac)';
    out.replaceChildren(
      h('dl', { class: 'results' },
        result(['Vypočítaný odpor ', v('$R')], si(R, 'Ω')),
        result('Rezistor z rady E12', si(Rstd, 'Ω', 3), true),
        result(['Skutočný prúd LED ', v('$I_{F}')], si(Ireal, 'A', 3)),
        result(['Výkon na rezistore ', v('$P')], si(P, 'W', 3)),
        result('Odporúčané zaťaženie', rating),
      ),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťah'), v('$R = @f{$U − $U_{F}}{$I_{F}}')),
    );
    fig.replaceChildren(ledFigure({ r: { label: 'R', value: formatSI(Rstd, 'Ω', 3) }, source: { label: 'U', value: formatSI(U, 'V', 3) } }));
  };

  const select = h('select', { id: 'led-color', class: 'field-input' },
    LED_COLORS.map(([id, name, uf]) => h('option', { value: id }, `${name} (≈ ${fmt(uf)} V)`)),
  );
  select.addEventListener('change', () => {
    const c = LED_COLORS.find(([id]) => id === select.value);
    if (c) fUF.input.value = fmt(c[2]);
    update();
  });
  const fU = field('led-u', ['Napätie zdroja ', v('$U')], 'V', '5', update);
  const fUF = field('led-uf', ['Napätie LED ', v('$U_{F}')], 'V', '2', update, 'Presnú hodnotu nájdeš v katalógovom liste.');
  const fI = field('led-i', ['Prúd LED ', v('$I_{F}')], 'A', '15m', update, 'Bežné LED: 5 až 20 mA (15m = 15 mA).');
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'field-grid' },
        fU.el,
        h('div', { class: 'field' }, h('label', { for: 'led-color' }, 'Farba LED'), h('div', { class: 'field-box' }, select)),
        fUF.el,
        fI.el,
      ),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- Odpor vodiča

const MATERIALS: [string, string, number, number][] = [
  ['cu', 'meď', 0.0178, 0.0039],
  ['al', 'hliník', 0.0286, 0.004],
  ['fe', 'železo', 0.1, 0.005],
  ['const', 'konštantán', 0.5, 0.00001],
  ['nicr', 'chrómnikel', 1.1, 0.0001],
];

function wireCalc(): HTMLElement {
  const out = h('div', { class: 'calc-result' });
  const select = h('select', { id: 'wire-mat', class: 'field-input' }, MATERIALS.map(([id, name, rho]) => h('option', { value: id }, `${name} (ρ = ${fmt(rho)})`)));
  const twoWire = h('input', { type: 'checkbox', id: 'wire-two', checked: true });

  const update = () => {
    const mat = MATERIALS.find(([id]) => id === select.value)!;
    const l = fL.read();
    const S = fS.read();
    const temp = fTemp.read();
    const I = fI.read();
    if (!ok(l) || !ok(S) || !Number.isFinite(temp)) {
      out.replaceChildren(errorMsg('Zadaj dĺžku, prierez a teplotu.'));
      return;
    }
    const length = twoWire.checked ? 2 * l : l;
    const R20 = wireResistance(mat[2], length, S);
    const R = resistanceAtTemperature(R20, mat[3], temp);
    const rows: HTMLElement[] = [
      result(['Odpor pri 20 °C ', v('$R_{20}')], si(R20, 'Ω')),
      result(['Odpor pri ', fmt(temp), ' °C'], si(R, 'Ω'), true),
    ];
    if (ok(I)) {
      const dU = R * I;
      rows.push(
        result(['Úbytok napätia ', v('Δ$U')], `${si(dU, 'V')} (${fmt((dU / 230) * 100, 3)} % z 230 V)`),
        result(['Stratový výkon ', v('$P')], si(dU * I, 'W')),
      );
    }
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [v('$R = $ρ · @f{$l}{$S}'), v('$R_{$ϑ} = $R_{20} · [1 + $α($ϑ − 20)]')]),
      ),
      twoWire.checked ? h('p', { class: 'muted' }, `Počíta sa s dĺžkou vodiča ${fmt(length)} m (tam aj späť).`) : null,
    ));
  };

  select.addEventListener('change', update);
  twoWire.addEventListener('change', update);
  const fL = field('wire-l', ['Dĺžka vedenia ', v('$l')], 'm', '25', update);
  const fS = field('wire-s', ['Prierez žily ', v('$S')], 'mm²', '1,5', update);
  const fTemp = field('wire-t', ['Teplota ', v('$ϑ')], '°C', '20', update);
  const fI = field('wire-i', ['Prúd ', v('$I'), ' (voliteľne)'], 'A', '10', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'field-grid' },
        h('div', { class: 'field' }, h('label', { for: 'wire-mat' }, 'Materiál (Ω·mm²/m)'), h('div', { class: 'field-box' }, select)),
        fL.el, fS.el, fTemp.el, fI.el,
      ),
      h('label', { class: 'check', for: 'wire-two' }, twoWire, 'Dvojvodičové vedenie (prúd tečie tam aj späť)'),
    ),
    h('div', { class: 'calc-outputs' }, out),
  );
}

// ---------------------------------------------------------------- zoznam

export const CALCULATORS: readonly CalculatorInfo[] = [
  { id: 'ohm', title: 'Ohmov zákon a výkon', short: 'Z dvoch veličín dopočíta U, I, R aj P.', render: ohmCalc },
  { id: 'spajanie', title: 'Sériové a paralelné spojenie', short: 'Výsledný odpor rezistorov alebo kapacita kondenzátorov.', render: combineCalc },
  { id: 'delic', title: 'Delič napätia', short: 'Výstupné napätie a návrh rezistora z rady E24.', render: dividerCalc },
  { id: 'farby', title: 'Farebný kód rezistorov', short: 'Prúžky na hodnotu a hodnota na prúžky.', render: colorCodeCalc },
  { id: 'rc', title: 'Časová konštanta RC a RL', short: 'Nabíjanie kondenzátora a nábeh prúdu cievkou s grafom.', render: transientCalc },
  { id: 'rlc', title: 'Striedavý obvod RLC', short: 'Reaktancie, impedancia, výkony a rezonancia.', render: rlcCalc },
  { id: 'led', title: 'Predradný rezistor pre LED', short: 'Odpor, hodnota z rady E12 a zaťaženie rezistora.', render: ledCalc },
  { id: 'vodic', title: 'Odpor a úbytok na vedení', short: 'Odpor kábla podľa materiálu, prierezu a teploty.', render: wireCalc },
];

export function calculatorsView(): HTMLElement {
  return h('div', { class: 'view view-calcs' },
    pageHead('Nástroje', 'Kalkulačky', 'Hodnoty môžeš písať s predponami: 4k7, 2,2µ, 15m. Výsledky sa prepočítavajú hneď pri písaní.'),
    h('ul', { class: 'calc-grid' },
      CALCULATORS.map((c, i) => h('li', null,
        h('a', { href: `#kalk-${c.id}`, class: 'calc-card' },
          h('span', { class: 'calc-card-no' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'calc-card-title' }, c.title),
          h('span', { class: 'calc-card-text' }, c.short),
        ),
      )),
    ),
  );
}

export function calculatorView(id: string): HTMLElement {
  const calc = CALCULATORS.find((c) => c.id === id);
  if (!calc) {
    return h('div', { class: 'view' }, backLink('#kalkulacky', 'Kalkulačky'), pageHead(null, 'Kalkulačka sa nenašla'));
  }
  return h('div', { class: 'view view-calc' },
    backLink('#kalkulacky', 'Kalkulačky'),
    pageHead('Kalkulačka', calc.title, rich(calc.short)),
    calc.render(),
  );
}
