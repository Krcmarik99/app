import { frag, h, type Child } from '../lib/dom';
import { fmt, fmtSci, scaleExp, siParts } from '../lib/units';
import { analogScale, lcdDisplay, vaMethodFigure } from '../ui/meas-figures';
import { errorMsg, field, ok, result, segmented, si as siPrefixed, v, type CalculatorInfo, type Field } from './calc-kit';

/** Kalkulačky ku kapitole Elektrotechnické merania. */

type Quantity = 'V' | 'A';
const QUANTITY_OPTIONS: [Quantity, string][] = [['V', 'Napätie (V)'], ['A', 'Prúd (A)']];

const MINUS = '−';
const NBSP = '\u00a0';
/** Predpísaný rad tried presnosti analógových prístrojov (ELM3, kap. 2.1). */
const TP_SERIES = [0.1, 0.2, 0.5, 1, 1.5, 2.5, 5];
/** Väčšiu stupnicu už nekreslíme (skutočné prístroje majú 30 až 150 dielikov). */
const MAX_DIVISIONS = 1000;

/** Percentá; veľmi malé hodnoty vo vedeckom zápise (1,2 · 10⁻⁶ %). */
const pct = (x: number, sig = 3) => `${fmtSci(x, sig)} %`;
const panel = (...children: Child[]) => h('div', { class: 'sch-panel calc-figure' }, children);

/**
 * Hodnota s predponou SI (4,7 kΩ). Mimo rozsahu predpôn p … T vedecký zápis (3 · 10⁻¹⁵ W),
 * aby sa extrémne vstupy nezobrazili ako „0 pΩ“ alebo dlhý rad číslic.
 */
function si(x: number, unit: string, sig = 4): string {
  const a = Math.abs(x);
  return a !== 0 && Number.isFinite(a) && (a < 1e-12 || a >= 1e15) ? `${fmtSci(x, sig)}${NBSP}${unit}` : siPrefixed(x, unit, sig);
}

/** Odstráni šum binárnej aritmetiky, napr. 0,15 − 0,15000000000000002 → 0. */
const tidy = (x: number, scale: number) => (Math.abs(x) <= Math.abs(scale) * 1e-9 ? 0 : x);
/** Hodnota s predponou, záporná so znakom „−“. */
const sv = (x: number, unit: string) => (x < 0 ? `${MINUS}${si(-x, unit)}` : si(x, unit));
/** Percentá so znamienkom: +5 %, −0,05 %, 0 %. */
function signedPct(x: number): string {
  const text = pct(Math.abs(x));
  return text.startsWith('0 ') ? text : `${x > 0 ? '+' : MINUS}${text}`;
}

/** 1 dielik, 2 dieliky, 5 dielikov, 2,5 dielika. */
function divisionsText(x: number): string {
  const r = Number(x.toPrecision(4));
  const num = fmt(r, 4);
  if (!Number.isInteger(r)) return `${num} dielika`;
  if (r === 1) return `${num} dielik`;
  return r >= 2 && r <= 4 ? `${num} dieliky` : `${num} dielikov`;
}

const validDivisions = (d: number) => ok(d) && Number.isInteger(d) && d <= MAX_DIVISIONS;

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
      result(['Maximálna absolútna chyba ', v('Δ$X_{max}')], `±${si(dx, unit)}`, true),
      result(['Skutočná hodnota ', v('$X_{S}')], `${sv(tidy(xn - dx, xn), unit)} až ${sv(xn + dx, unit)}`),
      result(['Relatívna chyba ', v('$δ')], `±${pct(delta)}`, true),
      result('Výchylka v percentách rozsahu', pct(share)),
    ];
    const notes: HTMLElement[] = [];
    if (!TP_SERIES.some((t) => Math.abs(t - tp) < 1e-9)) {
      notes.push(h('p', { class: 'calc-note' }, `Trieda presnosti ${fmt(tp)} nie je z predpísaného radu 0,1 – 0,2 – 0,5 – 1 – 1,5 – 2,5 – 5. Skontroluj číslo na číselníku.`));
    }
    if (delta >= 100) {
      notes.push(h('p', { class: 'calc-note' }, 'Maximálna absolútna chyba je aspoň taká veľká ako samotný údaj – na tomto rozsahu sa takáto hodnota zmysluplne odmerať nedá. Prepni na menší rozsah.'));
    } else if (share < 100 / 3) {
      notes.push(h('p', { class: 'calc-note' }, 'Údaj je menší ako tretina rozsahu, relatívna chyba je veľká. Ak to prístroj umožňuje, prepni na menší rozsah tak, aby bola výchylka čo najbližšie ku koncu stupnice.'));
    }
    const formulas = [v('Δ$X_{max} = @f{TP · MR}{100}'), v('$X_{S} = $X_{N} ± Δ$X_{max}'), v('$δ = @f{Δ$X_{max}}{$X_{N}} · 100 %')];
    fig.replaceChildren();
    if (fDiv.input.value.trim() !== '') {
      if (validDivisions(divs)) {
        const k = mr / divs;
        const alpha = (xn * divs) / mr;
        rows.push(
          result(['Konštanta ', v('$K')], `${si(k, unit)}/dielik`),
          result(['Výchylka ', v('$α')], divisionsText(alpha)),
        );
        formulas.push(v('$K = @f{MR}{$α_{max}}'), v('$α = @f{$X_{N}}{$K}'));
        fig.replaceChildren(panel(analogScale({ divisions: divs, alpha, symbol: unit, range: `MR = ${si(mr, unit)}`, accuracyClass: fmt(tp) })));
      } else {
        notes.push(errorMsg(`Počet dielikov stupnice musí byť celé číslo od 1 do ${fmt(MAX_DIVISIONS)} (alebo nechaj políčko prázdne).`));
      }
    }
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      notes,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'), h('div', { class: 'formula-row' }, formulas)),
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

interface DisplayReading {
  /** Text pre lcdDisplay, napr. „  5.0“, „123.4“. */
  text: string;
  /** Jednotka displeja s predponou podľa rozsahu: mV, V, mA, A. */
  unit: string;
  /** Údaj by presiahol najväčší údaj displeja (napr. 1 999). */
  overload: boolean;
  /** Údaj sa dá rozumne nakresliť (najviac 9 miest ako pri 8½-miestnom displeji). */
  drawable: boolean;
}

/** Údaj displeja ako pri skutočnom ČMP: jednotka podľa rozsahu, posledné miesto = 1 digit, zhasnuté úvodné miesta. */
function displayReading(xm: number, xn: number, counts: number, unit: Quantity): DisplayReading {
  const parts = siParts(xn, 3);
  const exp = Math.min(parts.exp, 0);
  const prefix = exp === parts.exp ? parts.prefix : '';
  const resolution = scaleExp(xn, exp) / counts;
  const decimals = Math.max(0, Math.min(5, Math.round(-Math.log10(resolution))));
  const text = scaleExp(xm, exp).toFixed(decimals);
  const places = String(Math.max(1, Math.ceil(counts) - 1)).length;
  const cells = text.replace('.', '').length;
  const blank = Math.max(0, places - cells);
  return {
    text: ' '.repeat(blank) + text,
    unit: prefix + unit,
    overload: Math.round((xm / xn) * counts) >= counts,
    drawable: xn >= 1e-12 && blank + cells <= 9,
  };
}

function dmPanel(unit: Quantity): HTMLElement {
  let mode: 'fs' | 'digit' = 'fs';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div');
  const additive = h('div', { class: 'field-grid' });

  const fail = (text: string) => {
    out.replaceChildren(errorMsg(text));
    fig.replaceChildren();
  };

  const update = () => {
    const xn = fXn.read();
    const xm = fXm.read();
    const dm = fDm.read();
    if (!ok(xn) || !ok(xm)) {
      fail('Zadaj merací rozsah a nameranú hodnotu ako kladné čísla.');
      return;
    }
    if (!(dm >= 0)) {
      fail('Zadaj chybu z údaja (rdg) v percentách – kladné číslo alebo 0.');
      return;
    }
    if (xm > xn) {
      fail('Nameraná hodnota je väčšia ako merací rozsah. Prístroj by ukázal preťaženie – prepni na väčší rozsah.');
      return;
    }
    const nmax = fN.read();
    const nmaxOk = ok(nmax) && Number.isInteger(nmax);
    let da: number;
    if (mode === 'fs') {
      da = fFs.read();
      if (!(da >= 0)) {
        fail('Zadaj chybu z rozsahu (FS) v percentách – kladné číslo alebo 0.');
        return;
      }
    } else {
      const d = fD.read();
      if (!(d >= 0) || !Number.isInteger(d) || !nmaxOk) {
        fail('Zadaj počet digitov (celé číslo, aj 0) a maximálny počet indikovaných jednotiek (celé kladné číslo, napr. 2 000).');
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
    if (mode === 'digit') {
      rows.push(
        result(['Hodnota 1 digitu ', v('@f{$X_{N}}{$N_{max}}')], si(xn / nmax, unit)),
        result(['Aditívna chyba v % z rozsahu ', v('$δ_{a}')], pct(da)),
      );
    }
    rows.push(
      result(['Celková absolútna chyba ', v('Δ_{ČMP}')], `±${si(total, unit)}`, true),
      result(['Celková relatívna chyba ', v('$δ_{ČMP}')], `±${pct(rel)}`, true),
      result('Skutočná hodnota', `${sv(tidy(xm - total, xm), unit)} až ${sv(xm + total, unit)}`),
    );
    const counts = nmaxOk ? nmax : 2000;
    const disp = displayReading(xm, xn, counts, unit);
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      rel >= 100
        ? h('p', { class: 'calc-note' }, 'Celková chyba je aspoň taká veľká ako samotný údaj – na tomto rozsahu sa takáto hodnota zmysluplne odmerať nedá. Prepni na menší rozsah.')
        : null,
      mode === 'fs' && !nmaxOk
        ? h('p', { class: 'calc-note' }, 'Max. počet indikovaných jednotiek musí byť celé kladné číslo – displej je nakreslený pre 2 000.')
        : null,
      disp.overload
        ? h('p', { class: 'calc-note' }, `Displej s ${fmt(counts)} indikovanými jednotkami zobrazí najviac ${fmt(counts - 1)}. Údaj na samom konci rozsahu by prístroj ukázal ako preťaženie – prepni na väčší rozsah.`)
        : null,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [
          v('Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m}'),
          v('Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N}'),
          mode === 'digit' ? v('$δ_{a} = @f{$d}{$N_{max}} · 100 %') : null,
          v('Δ_{ČMP} = ±(Δ_{m} + Δ_{a})'),
          v('$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}})'),
        ]),
      ),
    ));
    if (disp.drawable) fig.replaceChildren(panel(lcdDisplay(disp.text, disp.unit)));
    else fig.replaceChildren();
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
      h('p', { class: 'calc-note' }, 'Značenie podľa kapitoly o ČMP: ', v('$X_{N}'), ' je merací rozsah a ', v('$X_{m}'), ' nameraná hodnota (pri analógovom prístroji je ', v('$X_{N}'), ' nameraná hodnota a rozsah je MR).'),
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
      out.replaceChildren(errorMsg('Zadaj vnútorný odpor voltmetra, namerané napätie a prúd ako kladné čísla a vnútorný odpor ampérmetra ako kladné číslo alebo 0.'));
      return;
    }
    const apparent = u / i;
    let rx: number;
    if (kind === 'AV') {
      const iv = u / rv;
      if (iv >= i) {
        out.replaceChildren(errorMsg('Prúd voltmetra U/RV nie je menší ako nameraný prúd – takéto hodnoty v zapojení AV nemôžu nastať. Skontroluj U, I a RV.'));
        return;
      }
      rx = u / (i - iv);
    } else {
      rx = tidy(apparent - ra, apparent);
      if (!(rx > 0)) {
        out.replaceChildren(errorMsg('Po odčítaní RA vyšiel odpor nulový alebo záporný. Skontroluj U, I a RA.'));
        return;
      }
    }
    const errAV = -(rx / (rx + rv)) * 100;
    const errVA = (ra / rx) * 100;
    const err = kind === 'AV' ? errAV : errVA;
    const other = kind === 'AV' ? errVA : errAV;
    const otherKind = kind === 'AV' ? 'VA' : 'AV';
    const rk = Math.sqrt(ra * rv);
    const best: 'AV' | 'VA' = rx < rk ? 'AV' : 'VA';
    const bestErr = best === 'AV' ? errAV : errVA;
    const worseErr = best === 'AV' ? errVA : errAV;
    // Pri Rx ≈ Rkrit sú obe chyby takmer rovnaké a približné pravidlo nemusí presne sedieť.
    const nearCritical = Math.abs(rx - rk) <= 0.05 * rk || Math.abs(bestErr) > Math.abs(worseErr);
    let verdict: HTMLElement;
    if (nearCritical) {
      verdict = h('p', { class: 'calc-note' }, `Meraný odpor je blízko kritickej hodnoty – obe zapojenia vnášajú približne rovnakú metodickú chybu (AV: ${signedPct(errAV)}, VA: ${signedPct(errVA)}).`);
    } else if (best !== kind) {
      verdict = h('p', { class: 'calc-error' }, `Pre tento odpor je vhodnejšie zapojenie ${best}. Jeho metodická chyba by bola ${signedPct(other)} namiesto ${signedPct(err)}.`);
    } else {
      verdict = h('p', { class: 'calc-note' }, `Zvolené zapojenie je pre tento odpor vhodné. Zapojenie ${otherKind} by malo metodickú chybu ${signedPct(other)}.`);
    }
    out.replaceChildren(
      h('dl', { class: 'results' },
        result(['Odpor bez korekcie ', v("$R' = @f{$U}{$I}")], si(apparent, 'Ω')),
        result(['Skutočný odpor po korekcii ', v('$R_{x}')], si(rx, 'Ω'), true),
        result(`Metodická chyba zapojenia ${kind}`, signedPct(err)),
        result(['Kritická hodnota ', v('$R_{krit} = @s{$R_{A} · $R_{V}}')], si(rk, 'Ω')),
        result('Vhodné zapojenie', nearCritical ? 'AV aj VA (Rx ≈ Rkrit)' : best === 'AV' ? 'AV (Rx < Rkrit)' : 'VA (Rx > Rkrit)', true),
      ),
      verdict,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Korekcia a metodická chyba'),
        h('div', { class: 'formula-row' }, kind === 'AV'
          ? [v('$R_{x} = @f{$U}{$I − @f{$U}{$R_{V}}}'), v('$δ_{AV} = −@f{$R_{x}}{$R_{x} + $R_{V}}')]
          : [v('$R_{x} = @f{$U}{$I} − $R_{A}'), v('$δ_{VA} = @f{$R_{A}}{$R_{x}}')]),
      ),
    );
  };

  const fRa = field('va-ra', ['Vnútorný odpor ampérmetra ', v('$R_{A}')], 'Ω', '0,5', update);
  const fRv = field('va-rv', ['Vnútorný odpor voltmetra ', v('$R_{V}')], 'Ω', '20k', update, 'Pri údaji v Ω/V: RV = RiV · MR.');
  const fU = field('va-u', ['Napätie – údaj voltmetra ', v('$U')], 'V', '1', update);
  const fI = field('va-i', ['Prúd – údaj ampérmetra ', v('$I')], 'A', '100,05m', update);
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
    const fail = (text: string) => {
      outScale.replaceChildren(errorMsg(text));
      figScale.replaceChildren();
    };
    if (!ok(mr) || !validDivisions(divs) || !(alpha >= 0)) {
      fail(`Zadaj kladný merací rozsah, počet dielikov stupnice (celé číslo od 1 do ${fmt(MAX_DIVISIONS)}) a výchylku (0 alebo kladné číslo).`);
      return;
    }
    if (alpha > divs) {
      fail('Výchylka nemôže byť väčšia ako počet dielikov celej stupnice – ručička by bola za koncom stupnice.');
      return;
    }
    const k = mr / divs;
    outScale.replaceChildren(
      h('dl', { class: 'results' },
        result(['Konštanta ', v('$K = @f{MR}{$α_{max}}')], `${si(k, 'V')}/dielik`),
        result(['Nameraná hodnota ', v('NH = $α · $K')], si((alpha * mr) / divs, 'V'), true),
        result(['Citlivosť ', v('$C = @f{1}{$K}')], `${fmtSci(divs / mr, 4)} dielik/V`),
      ),
    );
    figScale.replaceChildren(panel(analogScale({ divisions: divs, alpha, symbol: 'V', range: `MR = ${si(mr, 'V')}` })));
  };

  const updateV = () => {
    const riv = fRiv.read();
    const mr = fVmr.read();
    const u = fVu.read();
    if (!ok(riv) || !ok(mr) || !(u >= 0)) {
      outV.replaceChildren(errorMsg('Zadaj vnútorný odpor v Ω/V a rozsah voltmetra ako kladné čísla a merané napätie ako 0 alebo kladné číslo.'));
      return;
    }
    const rv = riv * mr;
    outV.replaceChildren(frag(
      h('dl', { class: 'results' },
        result(['Vnútorný odpor ', v('$R_{V} = $R_{iV} · MR')], si(rv, 'Ω'), true),
        result('Vlastná spotreba (pri plnej výchylke)', si((mr * mr) / rv, 'W')),
        result(['Spotreba pri napätí ', v('$U'), ': ', v('$P_{V} = @f{$U^{2}}{$R_{V}}')], si((u * u) / rv, 'W')),
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
      outA.replaceChildren(errorMsg('Zadaj vnútorný odpor ampérmetra (0 alebo kladné číslo), kladný rozsah a meraný prúd (0 alebo kladné číslo).'));
      return;
    }
    outA.replaceChildren(frag(
      h('dl', { class: 'results' },
        result(['Úbytok pri plnej výchylke ', v('Δ$U_{A} = $R_{A} · MR')], si(ra * mr, 'V'), true),
        result('Vlastná spotreba (pri plnej výchylke)', si(mr * mr * ra, 'W')),
        result(['Úbytok pri prúde ', v('$I')], si(ra * i, 'V')),
        result(['Spotreba pri prúde ', v('$I'), ': ', v('$P_{A} = $I^{2} · $R_{A}')], si(i * i * ra, 'W')),
      ),
      i > mr ? h('p', { class: 'calc-error' }, 'Prúd je väčší ako rozsah – ampérmeter by bol preťažený.') : null,
    ));
  };

  const fMr = field('pr-mr', 'Merací rozsah MR', 'V', '30', updateScale);
  const fDiv = field('pr-div', ['Počet dielikov ', v('$α_{max}')], '', '75', updateScale);
  const fAlpha = field('pr-alpha', ['Výchylka ', v('$α')], '', '48', updateScale);
  const fRiv = field('pr-riv', ['Vnútorný odpor na 1 V ', v('$R_{iV}')], 'Ω/V', '1k', updateV);
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
  { id: 'va', title: 'Ohmova metóda (VA/AV)', short: 'Korekcia nameraného odporu, metodická chyba a kritická hodnota odporu.', render: vaCalc },
  { id: 'pristroj', title: 'Konštanta a spotreba prístroja', short: 'Konštanta stupnice, nameraná hodnota, citlivosť a vlastná spotreba.', render: instrumentCalc },
];
