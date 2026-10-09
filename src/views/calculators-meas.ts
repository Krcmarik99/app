import { frag, h, type Child } from '../lib/dom';
import { fmt, formatSI } from '../lib/units';
import { analogScale, lcdDisplay, vaMethodFigure } from '../ui/meas-figures';
import { errorMsg, field, ok, result, segmented, si, v, type CalculatorInfo, type Field } from './calc-kit';

/** Kalkulačky ku kapitole Elektrotechnické merania. */

type Quantity = 'V' | 'A';
const QUANTITY_OPTIONS: [Quantity, string][] = [['V', 'Napätie (V)'], ['A', 'Prúd (A)']];

const pct = (x: number, sig = 3) => `${fmt(x, sig)} %`;
const panel = (...children: Child[]) => h('div', { class: 'sch-panel calc-figure' }, children);

// ---------------------------------------------------------------- chyba meracieho prístroja

function amPanel(unit: Quantity): HTMLElement {
  const out = h('div', { class: 'calc-result' });
  const fig = h('div');
  const update = () => {
    const tp = fTp.read();
    const mr = fMr.read();
    const xn = fXn.read();
    const divs = fDiv.read();
    if (!ok(tp) || !ok(mr) || !ok(xn)) {
      out.replaceChildren(errorMsg('Zadaj triedu presnosti, merací rozsah a nameranú hodnotu ako kladné čísla.'));
      fig.replaceChildren();
      return;
    }
    if (xn > mr) {
      out.replaceChildren(errorMsg('Nameraná hodnota je väčšia ako merací rozsah – prístroj by bol preťažený. Prepni na väčší rozsah.'));
      fig.replaceChildren();
      return;
    }
    const dx = (tp * mr) / 100;
    const delta = (dx / xn) * 100;
    const share = (xn / mr) * 100;
    const rows: HTMLElement[] = [
      result(['Najväčšia absolútna chyba ', v('Δ$X_{max}')], `±${si(dx, unit)}`, true),
      result(['Skutočná hodnota ', v('$X_{S}')], `${si(xn - dx, unit)} až ${si(xn + dx, unit)}`),
      result(['Relatívna chyba ', v('$δ')], `±${pct(delta)}`, true),
      result('Údaj v percentách rozsahu', pct(share)),
    ];
    if (ok(divs) && Number.isInteger(divs)) {
      const k = mr / divs;
      rows.push(
        result(['Konštanta ', v('$K')], `${formatSI(k, unit, 4)}/dielik`),
        result(['Výchylka ', v('$α')], `${fmt(xn / k, 4)} dielika`),
      );
      fig.replaceChildren(panel(analogScale({ divisions: divs, alpha: xn / k, symbol: unit, range: `MR = ${formatSI(mr, unit, 4)}`, accuracyClass: fmt(tp) })));
    } else {
      fig.replaceChildren();
    }
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      share < 100 / 3
        ? h('p', { class: 'calc-note' }, 'Údaj je menší ako tretina rozsahu, relatívna chyba je veľká. Ak to prístroj umožňuje, prepni na menší rozsah tak, aby bola výchylka čo najbližšie ku koncu stupnice.')
        : null,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [v('Δ$X_{max} = @f{TP · MR}{100}'), v('$X_{S} = $X_{N} ± Δ$X_{max}'), v('$δ = @f{Δ$X_{max}}{$X_{N}} · 100 %')]),
      ),
    ));
  };
  const fTp = field(`amp-tp-${unit}`, 'Trieda presnosti TP', '%', '1,5', update, 'Číslo z číselníka: 0,1 – 0,2 – 0,5 – 1 – 1,5 – 2,5 – 5.');
  const fMr = field(`amp-mr-${unit}`, 'Merací rozsah MR', unit, unit === 'V' ? '30' : '1', update);
  const fXn = field(`amp-xn-${unit}`, ['Nameraná hodnota ', v('$X_{N}')], unit, unit === 'V' ? '24' : '0,6', update);
  const fDiv = field(`amp-div-${unit}`, 'Počet dielikov stupnice (voliteľne)', '', '150', update);
  update();
  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' }, h('div', { class: 'field-grid' }, fTp.el, fMr.el, fXn.el, fDiv.el)),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

/** Údaj displeja s toľkými desatinnými miestami, koľko dovoľuje rozlíšenie rozsahu. */
function displayText(xm: number, range: number, counts: number): string {
  const resolution = range / counts;
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(resolution) + 1e-9)));
  return xm.toFixed(decimals);
}

function dmPanel(unit: Quantity): HTMLElement {
  let mode: 'fs' | 'digit' = 'fs';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div');
  const additive = h('div', { class: 'field-grid' });

  const update = () => {
    const xn = fXn.read();
    const xm = fXm.read();
    const dm = fDm.read();
    if (!ok(xn) || !ok(xm) || !(dm >= 0)) {
      out.replaceChildren(errorMsg('Zadaj rozsah, nameranú hodnotu a chybu z údaja (rdg) ako kladné čísla.'));
      fig.replaceChildren();
      return;
    }
    if (xm > xn) {
      out.replaceChildren(errorMsg('Nameraná hodnota je väčšia ako merací rozsah. Prístroj by ukázal preťaženie – prepni na väčší rozsah.'));
      fig.replaceChildren();
      return;
    }
    let da: number;
    const nmax = fN.read();
    if (mode === 'fs') {
      da = fFs.read();
      if (!(da >= 0)) {
        out.replaceChildren(errorMsg('Zadaj chybu z rozsahu (FS) v percentách.'));
        return;
      }
    } else {
      const d = fD.read();
      if (!(d >= 0) || !ok(nmax)) {
        out.replaceChildren(errorMsg('Zadaj počet digitov a maximálny počet indikovaných jednotiek (napr. 2 000).'));
        return;
      }
      da = (d / nmax) * 100;
    }
    const absM = (dm / 100) * xm;
    const absA = (da / 100) * xn;
    const total = absM + absA;
    const rel = dm + (da * xn) / xm;
    const rows: HTMLElement[] = [
      result(['Multiplikatívna chyba ', v('Δ_{m}')], `±${si(absM, unit)}`),
      result(['Aditívna chyba ', v('Δ_{a}')], `±${si(absA, unit)}`),
    ];
    if (mode === 'digit') rows.push(result(['Aditívna chyba v % z rozsahu ', v('$δ_{a}')], pct(da)));
    rows.push(
      result(['Celková absolútna chyba ', v('Δ_{ČMP}')], `±${si(total, unit)}`, true),
      result(['Celková relatívna chyba ', v('$δ_{ČMP}')], `±${pct(rel)}`, true),
      result('Skutočná hodnota', `${si(xm - total, unit)} až ${si(xm + total, unit)}`),
    );
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [
          v('Δ_{ČMP} = ±(Δ_{m} + Δ_{a})'),
          v('$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}})'),
          mode === 'digit' ? v('$δ_{a} = @f{$d}{$N_{max}} · 100 %') : null,
        ]),
      ),
    );
    const counts = ok(nmax) ? nmax : 2000;
    fig.replaceChildren(panel(lcdDisplay(displayText(xm, xn, counts), unit)));
  };

  const fXn = field(`cmp-xn-${unit}`, ['Merací rozsah ', v('$X_{N}')], unit, unit === 'V' ? '200' : '2', update);
  const fXm = field(`cmp-xm-${unit}`, ['Nameraná hodnota ', v('$X_{m}')], unit, unit === 'V' ? '100' : '0,6', update);
  const fDm = field(`cmp-dm-${unit}`, ['Chyba z údaja (rdg) ', v('$δ_{m}')], '%', unit === 'V' ? '0,9' : '1,5', update);
  const fFs = field(`cmp-fs-${unit}`, ['Chyba z rozsahu (FS) ', v('$δ_{a}')], '%', '0,1', update);
  const fD = field(`cmp-d-${unit}`, ['Počet digitov ', v('$d')], '', '7', update);
  const fN = field(`cmp-n-${unit}`, ['Max. počet indikovaných jednotiek ', v('$N_{max}')], '', '2000', update, '3½-miestny displej: 2 000, displej do 4 999: 5 000.');
  const renderAdditive = () => {
    additive.replaceChildren(...(mode === 'fs' ? [fFs.el, fN.el] : [fD.el, fN.el]));
  };
  renderAdditive();
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'field-grid' }, fXn.el, fXm.el, fDm.el),
      h('div', { class: 'calc-subsection' },
        h('h3', null, 'Aditívna zložka'),
        segmented(`cmp-mode-${unit}`, 'Ako je zadaná aditívna chyba', [['fs', 'v % z rozsahu (FS)'], ['digit', 'v digitoch']], mode, (m) => {
          mode = m;
          renderAdditive();
          update();
        }),
        additive,
      ),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

function errorCalc(): HTMLElement {
  let kind: 'amp' | 'cmp' = 'amp';
  let unit: Quantity = 'V';
  const body = h('div');
  const render = () => body.replaceChildren(kind === 'amp' ? amPanel(unit) : dmPanel(unit));
  render();
  return h('div', { class: 'calc-stack' },
    h('div', { class: 'seg-row' },
      segmented('err-kind', 'Druh prístroja', [['amp', 'Analógový (AMP)'], ['cmp', 'Číslicový (ČMP)']], kind, (k) => { kind = k; render(); }),
      segmented('err-unit', 'Meraná veličina', QUANTITY_OPTIONS, unit, (u) => { unit = u; render(); }),
    ),
    body,
  );
}

// ---------------------------------------------------------------- Ohmova metóda

function vaCalc(): HTMLElement {
  let kind: 'AV' | 'VA' = 'AV';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div');

  const update = () => {
    const ra = fRa.read();
    const rv = fRv.read();
    const u = fU.read();
    const i = fI.read();
    fig.replaceChildren(panel(vaMethodFigure(kind)));
    if (!(ra >= 0) || !ok(rv) || !ok(u) || !ok(i)) {
      out.replaceChildren(errorMsg('Zadaj vnútorné odpory prístrojov a namerané napätie a prúd ako kladné čísla.'));
      return;
    }
    const apparent = u / i;
    let rx: number;
    let err: number;
    if (kind === 'AV') {
      const iv = u / rv;
      if (iv >= i) {
        out.replaceChildren(errorMsg('Prúd voltmetra U/RV je väčší ako nameraný prúd – takéto hodnoty nemôžu nastať. Skontroluj U, I a RV.'));
        return;
      }
      rx = u / (i - iv);
      err = -(rx / (rx + rv)) * 100;
    } else {
      rx = apparent - ra;
      if (!(rx > 0)) {
        out.replaceChildren(errorMsg('Po odčítaní RA vyšiel odpor nulový alebo záporný. Skontroluj U, I a RA.'));
        return;
      }
      err = (ra / rx) * 100;
    }
    const rk = Math.sqrt(ra * rv);
    const best: 'AV' | 'VA' = rx < rk ? 'AV' : 'VA';
    const other = kind === 'AV' ? (ra / rx) * 100 : -(rx / (rx + rv)) * 100;
    out.replaceChildren(
      h('dl', { class: 'results' },
        result(['Odpor bez korekcie ', v("$R' = @f{$U}{$I}")], si(apparent, 'Ω')),
        result(['Skutočný odpor po korekcii ', v('$R_{x}')], si(rx, 'Ω'), true),
        result(`Metodická chyba zapojenia ${kind}`, `${err > 0 ? '+' : '−'}${pct(Math.abs(err))}`),
        result(['Kritická hodnota ', v('$R_{krit} = @s{$R_{A} · $R_{V}}')], ra > 0 ? si(rk, 'Ω') : '0 Ω'),
        result('Vhodné zapojenie', best === 'AV' ? 'AV (Rx < Rkrit)' : 'VA (Rx > Rkrit)', true),
      ),
      best !== kind
        ? h('p', { class: 'calc-error' }, `Pre tento odpor je vhodnejšie zapojenie ${best}. Jeho metodická chyba by bola ${other > 0 ? '+' : '−'}${pct(Math.abs(other))} namiesto ${err > 0 ? '+' : '−'}${pct(Math.abs(err))}.`)
        : h('p', { class: 'calc-note' }, `Zvolené zapojenie je pre tento odpor správne. Druhé zapojenie by malo chybu ${other > 0 ? '+' : '−'}${pct(Math.abs(other))}.`),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Korekcia'),
        kind === 'AV' ? v('$R_{x} = @f{$U}{$I − @f{$U}{$R_{V}}}') : v('$R_{x} = @f{$U}{$I} − $R_{A}'),
      ),
    );
  };

  const fRa = field('va-ra', ['Vnútorný odpor ampérmetra ', v('$R_{A}')], 'Ω', '0,5', update);
  const fRv = field('va-rv', ['Vnútorný odpor voltmetra ', v('$R_{V}')], 'Ω', '20k', update, 'Pri údaji v Ω/V: RV = RiV · MR.');
  const fU = field('va-u', ['Napätie na voltmetri ', v('$U')], 'V', '1', update);
  const fI = field('va-i', ['Prúd na ampérmetri ', v('$I')], 'A', '100,05m', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented('va-kind', 'Zapojenie', [['AV', 'AV – ampérmeter pred voltmetrom'], ['VA', 'VA – voltmeter pred ampérmetrom']], kind, (k) => { kind = k; update(); }),
      h('div', { class: 'field-grid' }, fRa.el, fRv.el, fU.el, fI.el),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- konštanta a spotreba prístroja

function instrumentCalc(): HTMLElement {
  const outScale = h('div', { class: 'calc-result' });
  const figScale = h('div');
  const outV = h('div', { class: 'calc-result' });
  const outA = h('div', { class: 'calc-result' });

  const updateScale = () => {
    const mr = fMr.read();
    const divs = fDiv.read();
    const alpha = fAlpha.read();
    if (!ok(mr) || !ok(divs) || !Number.isInteger(divs) || !(alpha >= 0) || alpha > divs) {
      outScale.replaceChildren(errorMsg('Zadaj rozsah, celý počet dielikov stupnice a výchylku od 0 po počet dielikov.'));
      figScale.replaceChildren();
      return;
    }
    const k = mr / divs;
    outScale.replaceChildren(
      h('dl', { class: 'results' },
        result(['Konštanta ', v('$K = @f{MR}{$α_{max}}')], `${formatSI(k, 'V', 4)}/dielik`),
        result(['Nameraná hodnota ', v('NH = $α · $K')], si(alpha * k, 'V'), true),
        result(['Citlivosť ', v('$C = @f{1}{$K}')], `${fmt(1 / k, 4)} dielika/V`),
      ),
    );
    figScale.replaceChildren(panel(analogScale({ divisions: divs, alpha, symbol: 'V', range: `MR = ${formatSI(mr, 'V', 4)}` })));
  };

  const updateV = () => {
    const riv = fRiv.read();
    const mr = fVmr.read();
    const u = fVu.read();
    if (!ok(riv) || !ok(mr) || !(u >= 0)) {
      outV.replaceChildren(errorMsg('Zadaj vnútorný odpor v Ω/V, rozsah a napätie.'));
      return;
    }
    const rv = riv * mr;
    outV.replaceChildren(frag(
      h('dl', { class: 'results' },
        result(['Vnútorný odpor ', v('$R_{V} = $R_{iV} · MR')], si(rv, 'Ω'), true),
        result(['Spotreba pri napätí ', v('$U')], si((u * u) / rv, 'W')),
        result('Spotreba pri plnej výchylke', si((mr * mr) / rv, 'W')),
        result(['Prúd voltmetra ', v('$I_{V} = @f{$U}{$R_{V}}')], si(u / rv, 'A')),
      ),
      u > mr ? h('p', { class: 'calc-error' }, 'Napätie je väčšie ako rozsah – voltmeter by bol preťažený.') : null,
    ));
  };

  const updateA = () => {
    const ra = fRa.read();
    const mr = fAmr.read();
    const i = fAi.read();
    if (!(ra >= 0) || !ok(mr) || !(i >= 0)) {
      outA.replaceChildren(errorMsg('Zadaj vnútorný odpor ampérmetra, rozsah a prúd.'));
      return;
    }
    outA.replaceChildren(frag(
      h('dl', { class: 'results' },
        result(['Úbytok pri plnej výchylke ', v('Δ$U_{A} = $R_{A} · MR')], si(ra * mr, 'V'), true),
        result(['Úbytok pri prúde ', v('$I')], si(ra * i, 'V')),
        result(['Spotreba ', v('$P_{A} = $I^{2} · $R_{A}')], si(i * i * ra, 'W')),
      ),
      i > mr ? h('p', { class: 'calc-error' }, 'Prúd je väčší ako rozsah – ampérmeter by bol preťažený.') : null,
    ));
  };

  const fMr = field('pr-mr', 'Merací rozsah MR', 'V', '30', updateScale);
  const fDiv = field('pr-div', ['Počet dielikov ', v('$α_{max}')], '', '75', updateScale);
  const fAlpha = field('pr-alpha', ['Výchylka ', v('$α')], '', '48', updateScale);
  const fRiv = field('pr-riv', ['Vnútorný odpor na volt ', v('$R_{iV}')], 'Ω/V', '1k', updateV);
  const fVmr = field('pr-vmr', 'Rozsah voltmetra MR', 'V', '30', updateV);
  const fVu = field('pr-vu', ['Merané napätie ', v('$U')], 'V', '24', updateV);
  const fRa = field('pr-ra', ['Vnútorný odpor ampérmetra ', v('$R_{A}')], 'Ω', '0,05', updateA);
  const fAmr = field('pr-amr', 'Rozsah ampérmetra MR', 'A', '2', updateA);
  const fAi = field('pr-ai', ['Meraný prúd ', v('$I')], 'A', '1,5', updateA);
  updateScale();
  updateV();
  updateA();

  const section = (title: string, fields: Field[], out: HTMLElement, fig?: HTMLElement) =>
    h('section', { class: 'calc-subsection' },
      h('h3', null, title),
      h('div', { class: 'calc' },
        h('div', { class: 'calc-inputs' }, h('div', { class: 'field-grid' }, fields.map((f) => f.el))),
        h('div', { class: 'calc-outputs calc-outputs-static' }, out, fig ?? null),
      ),
    );

  return h('div', { class: 'calc-stack' },
    section('Stupnica analógového prístroja', [fMr, fDiv, fAlpha], outScale, figScale),
    section('Vlastná spotreba voltmetra', [fRiv, fVmr, fVu], outV),
    section('Vlastná spotreba ampérmetra', [fRa, fAmr, fAi], outA),
  );
}

export const MEAS_CALCULATORS: readonly CalculatorInfo[] = [
  { id: 'chyba', title: 'Chyba meracieho prístroja', short: 'Absolútna a relatívna chyba analógového aj číslicového prístroja.', render: errorCalc },
  { id: 'va', title: 'Ohmova metóda (AV a VA)', short: 'Korekcia nameraného odporu, metodická chyba a kritický odpor.', render: vaCalc },
  { id: 'pristroj', title: 'Konštanta a spotreba prístroja', short: 'Konštanta stupnice, nameraná hodnota, citlivosť a vlastná spotreba.', render: instrumentCalc },
];
