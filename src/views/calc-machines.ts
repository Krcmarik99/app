import { h } from '../lib/dom';
import { fmt, formatSI } from '../lib/units';
import { transformerCircuitFigure } from '../ui/fig-machines';
import { errorMsg, field, ok, result, segmented, si, v, type CalculatorInfo, type Field } from './calc-kit';

/** Kalkulačky ku kapitole Elektrické stroje: transformátor a asynchrónny motor. */

const SQRT3 = Math.sqrt(3);
const blank = (f: Field) => f.input.value.trim() === '';
const formulas = (...src: string[]) => h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Použité vzorce'),
  h('div', { class: 'formula-row' }, src.map((x) => v(x))));

// ---------------------------------------------------------------- transformátor

function transformerCalc(): HTMLElement {
  let mode: 'turns' | 'ratio' = 'turns';
  let load: 'z' | 'i' | 's' = 'z';
  let sys: '1' | '3' = '1';
  const out = h('div', { class: 'calc-result' });
  const out2 = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });

  const update = () => {
    fN1.el.style.display = mode === 'turns' ? '' : 'none';
    fN2.el.style.display = mode === 'turns' ? '' : 'none';
    fP.el.style.display = mode === 'ratio' ? '' : 'none';
    fZ.el.style.display = load === 'z' ? '' : 'none';
    fI2.el.style.display = load === 'i' ? '' : 'none';
    fS.el.style.display = load === 's' ? '' : 'none';
    updateMain();
    updatePlate();
  };

  const updateMain = () => {
    const U1 = fU1.read();
    const N1 = fN1.read();
    const N2 = fN2.read();
    let p = fP.read();
    if (!ok(U1)) {
      out.replaceChildren(errorMsg('Zadaj kladné primárne napätie U₁.'));
      fig.replaceChildren(transformerCircuitFigure());
      return;
    }
    if (mode === 'turns') {
      if (!ok(N1) || !ok(N2)) {
        out.replaceChildren(errorMsg('Zadaj kladné počty závitov primárneho aj sekundárneho vinutia.'));
        fig.replaceChildren(transformerCircuitFigure());
        return;
      }
      p = N1 / N2;
    } else if (!ok(p)) {
      out.replaceChildren(errorMsg('Zadaj kladný prevod p = U₁ / U₂ (napríklad 9,58 pre 230 V / 24 V).'));
      fig.replaceChildren(transformerCircuitFigure());
      return;
    }
    const U2 = U1 / p;
    const rows: HTMLElement[] = [
      result(['Prevod ', v('$p')], `${fmt(p, 4)} (${p > 1.001 ? 'znižovací' : p < 0.999 ? 'zvyšovací' : 'oddeľovací 1 : 1'})`),
      result(['Sekundárne napätie ', v('$U_{2}')], si(U2, 'V'), true),
    ];
    let I2 = NaN;
    if (load === 'z') {
      const Z = fZ.read();
      if (ok(Z)) I2 = U2 / Z;
    } else if (load === 'i') {
      I2 = fI2.read();
    } else {
      const S = fS.read();
      if (ok(S)) I2 = S / U2;
    }
    const notes: HTMLElement[] = [];
    let i1Text: string | undefined;
    let i2Text: string | undefined;
    let zText: string | undefined;
    if (ok(I2)) {
      const I1 = I2 / p;
      const Z2 = U2 / I2;
      const Z1 = p * p * Z2;
      rows.push(
        result(['Sekundárny prúd ', v('$I_{2}')], si(I2, 'A')),
        result(['Primárny prúd ', v('$I_{1}')], si(I1, 'A'), true),
        result(['Zdanlivý výkon ', v('$S = $U_{2} · $I_{2}')], si(U2 * I2, 'VA')),
        result(['Impedancia záťaže ', v('$Z_{2}')], si(Z2, 'Ω')),
        result(['Záťaž prepočítaná na primár ', v('$Z_{1} = $p^{2} · $Z_{2}')], si(Z1, 'Ω')),
      );
      i1Text = formatSI(I1, 'A', 3);
      i2Text = formatSI(I2, 'A', 3);
      zText = formatSI(Z2, 'Ω', 3);
    } else {
      notes.push(h('p', { class: 'calc-note' }, 'Zadaj záťaž (odpor, prúd alebo výkon) – vypočítajú sa aj prúdy a impedančný prevod.'));
    }
    if (mode === 'turns') rows.push(result('Závitov na volt', `${fmt(N1 / U1, 3)} z/V`));
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      ...notes,
      h('p', { class: 'calc-note' }, 'Počíta sa s ideálnym transformátorom (bez strát a úbytkov napätia). Skutočné sekundárne napätie pri zaťažení je o niekoľko percent menšie.'),
      formulas('$p = @f{$N_{1}}{$N_{2}} = @f{$U_{1}}{$U_{2}} = @f{$I_{2}}{$I_{1}}', '$Z_{1} = $p^{2} · $Z_{2}'),
    );
    fig.replaceChildren(transformerCircuitFigure({
      u1: formatSI(U1, 'V', 3), u2: formatSI(U2, 'V', 3), i1: i1Text, i2: i2Text, z: zText, p: fmt(p, 4),
    }));
  };

  const updatePlate = () => {
    const Sn = fSn.read();
    const Un = fUn.read();
    const uk = blank(fUk) ? NaN : fUk.read();
    if (!ok(Sn) || !ok(Un)) {
      out2.replaceChildren(errorMsg('Zadaj menovitý výkon a napätie strany, pre ktorú počítaš prúd.'));
      return;
    }
    const In = sys === '3' ? Sn / (SQRT3 * Un) : Sn / Un;
    const rows: HTMLElement[] = [result(['Menovitý prúd ', v('$I_{n}')], si(In, 'A'), true)];
    const extra: HTMLElement[] = [];
    if (!blank(fUk)) {
      if (!(uk > 0 && uk < 50)) {
        extra.push(errorMsg('Napätie nakrátko zadaj v percentách, bežne 4 až 10 %.'));
      } else {
        rows.push(result(['Ustálený skratový prúd ', v('$I_{k}')], si((In * 100) / uk, 'A'), true));
        rows.push(result(['Napätie nakrátko ', v('$U_{k}')], si((Un * uk) / 100, 'V')));
      }
    }
    out2.replaceChildren(
      h('dl', { class: 'results' }, rows),
      ...extra,
      formulas(sys === '3' ? '$I_{n} = @f{$S_{n}}{@s{3} · $U_{n}}' : '$I_{n} = @f{$S_{n}}{$U_{n}}', '$I_{k} = $I_{n} · @f{100}{$u_{k}}'),
    );
  };

  const fU1 = field('tr-u1', ['Primárne napätie ', v('$U_{1}')], 'V', '230', update);
  const fN1 = field('tr-n1', ['Závity primáru ', v('$N_{1}')], '', '1150', update);
  const fN2 = field('tr-n2', ['Závity sekundáru ', v('$N_{2}')], '', '120', update);
  const fP = field('tr-p', ['Prevod ', v('$p = @f{$U_{1}}{$U_{2}}')], '', '9,583', update);
  const fZ = field('tr-z', ['Odpor (impedancia) záťaže ', v('$Z_{2}')], 'Ω', '12', update);
  const fI2 = field('tr-i2', ['Sekundárny prúd ', v('$I_{2}')], 'A', '2', update);
  const fS = field('tr-s', ['Výkon záťaže ', v('$S')], 'VA', '48', update);
  const fSn = field('tr-sn', ['Menovitý výkon ', v('$S_{n}')], 'VA', '250k', update, '250k = 250 kVA');
  const fUn = field('tr-un', ['Menovité napätie strany ', v('$U_{n}')], 'V', '400', update, 'Pri trojfázovom združené (medzi fázami)');
  const fUk = field('tr-uk', ['Napätie nakrátko ', v('$u_{k}')], '%', '4', update, 'Nepovinné – vypočíta sa skratový prúd');
  const modeSel = segmented('tr-mode', 'Zadávam', [['turns', 'Počty závitov'], ['ratio', 'Prevod']], mode, (m) => { mode = m; update(); });
  const loadSel = segmented('tr-load', 'Záťaž', [['z', 'Odpor záťaže'], ['i', 'Prúd I₂'], ['s', 'Výkon S']], load, (l) => { load = l; update(); });
  const sysSel = segmented('tr-sys', 'Sústava', [['1', 'Jednofázový'], ['3', 'Trojfázový']], sys, (x) => { sys = x; update(); });
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      modeSel,
      h('div', { class: 'field-grid' }, fU1.el, fN1.el, fN2.el, fP.el),
      loadSel,
      h('div', { class: 'field-grid' }, fZ.el, fI2.el, fS.el),
      h('div', { class: 'calc-subsection' },
        h('h3', null, 'Menovitý a skratový prúd zo štítku'),
        sysSel,
        h('div', { class: 'field-grid' }, fSn.el, fUn.el, fUk.el),
      ),
    ),
    h('div', { class: 'calc-outputs' },
      out,
      fig,
      h('div', { class: 'calc-subsection' }, h('h3', null, 'Menovitý prúd'), out2),
    ),
  );
}

// ---------------------------------------------------------------- asynchrónny motor

function asyncCalc(): HTMLElement {
  const out = h('div', { class: 'calc-result' });

  const update = () => {
    const f = fF.read();
    const poles = fPoles.read();
    const n = fN.read();
    const P = fP.read();
    if (!ok(f) || !ok(poles) || !Number.isInteger(poles) || poles % 2 !== 0) {
      out.replaceChildren(errorMsg('Zadaj kladnú frekvenciu a počet pólov ako párne celé číslo (2, 4, 6, 8 …).'));
      return;
    }
    const p = poles / 2;
    const ns = (60 * f) / p;
    const rows: HTMLElement[] = [result(['Synchrónne otáčky ', v('$n_{s}')], `${fmt(ns, 4)} ot/min`, true)];
    const notes: HTMLElement[] = [];
    const used = ['$n_{s} = @f{60 · $f}{$p}'];
    if (!ok(n)) {
      notes.push(errorMsg('Zadaj kladné otáčky rotora – vypočíta sa sklz a moment.'));
    } else if (n >= ns) {
      notes.push(errorMsg(`Otáčky ${fmt(n, 4)} ot/min nie sú menšie ako synchrónne (${fmt(ns, 4)} ot/min). Motor sa vždy otáča pomalšie ako pole – skontroluj počet pólov a frekvenciu. (Nad synchrónnymi otáčkami by stroj pracoval ako generátor.)`));
    } else {
      const s = (ns - n) / ns;
      rows.push(
        result(['Sklz ', v('$s')], `${fmt(s * 100, 3)} %`, true),
        result(['Frekvencia v rotore ', v('$f_{2} = $s · $f')], si(s * f, 'Hz')),
        result(['Uhlová rýchlosť ', v('$ω')], `${fmt((2 * Math.PI * n) / 60, 4)} rad/s`),
      );
      used.push('$s = @f{$n_{s} − $n}{$n_{s}}');
      if (s > 0.1) notes.push(h('p', { class: 'calc-note' }, `Sklz ${fmt(s * 100, 3)} % je na menovitý chod nezvyčajne veľký (bežne 2 až 6 %). Motor je preťažený, alebo nesedí počet pólov.`));
      if (ok(P)) {
        rows.push(result(['Moment na hriadeli ', v('$M')], `${fmt((P * 60) / (2 * Math.PI * n), 4)} N·m`, true));
        used.push('$M = @f{$P}{$ω} = 9 550 · @f{$P}{$n}');
      }
    }
    const U = blank(fU) ? NaN : fU.read();
    const I = blank(fI) ? NaN : fI.read();
    const c = blank(fCos) ? NaN : fCos.read();
    if (ok(U) && ok(I) && ok(c)) {
      if (c > 1) {
        notes.push(errorMsg('Účinník cos φ nemôže byť väčší ako 1.'));
      } else {
        const S = SQRT3 * U * I;
        const P1 = S * c;
        rows.push(
          result(['Príkon ', v('$P_{1}')], si(P1, 'W'), true),
          result(['Zdanlivý výkon ', v('$S')], si(S, 'VA')),
          result(['Jalový výkon ', v('$Q')], si(S * Math.sqrt(1 - c * c), 'var')),
        );
        used.push('$P_{1} = @s{3} · $U · $I · cos $φ');
        if (ok(P)) {
          const eta = P / P1;
          if (eta >= 1) {
            notes.push(errorMsg(`Príkon ${si(P1, 'W')} vychádza menší ako výkon na hriadeli ${si(P, 'W')} – účinnosť by bola nad 100 %. Skontroluj napätie, prúd a účinník (U je združené napätie, napr. 400 V).`));
          } else {
            rows.push(result(['Účinnosť ', v('$η = @f{$P}{$P_{1}}')], `${fmt(eta * 100, 3)} %`, true), result(['Straty ', v('Δ$P')], si(P1 - P, 'W')));
            if (eta < 0.5) notes.push(h('p', { class: 'calc-note' }, 'Účinnosť pod 50 % je pri menovitom chode nereálna – skontroluj zadané hodnoty.'));
          }
        }
      }
    } else if (!blank(fU) || !blank(fI) || !blank(fCos)) {
      notes.push(h('p', { class: 'calc-note' }, 'Na výpočet príkonu a účinnosti zadaj napätie, prúd aj účinník.'));
    }
    out.replaceChildren(h('dl', { class: 'results' }, rows), ...notes, formulas(...used));
  };

  const fF = field('asm-f', ['Frekvencia ', v('$f')], 'Hz', '50', update);
  const fPoles = field('asm-poles', ['Počet pólov 2', v('$p')], '', '4', update, '4 póly = 2 pólové dvojice');
  const fN = field('asm-n', ['Otáčky ', v('$n')], 'ot/min', '1450', update);
  const fP = field('asm-p', ['Výkon na hriadeli ', v('$P')], 'W', '7,5k', update, 'Zo štítka, 7,5k = 7,5 kW');
  const fU = field('asm-u', ['Združené napätie ', v('$U')], 'V', '400', update);
  const fI = field('asm-i', ['Prúd ', v('$I')], 'A', '15', update);
  const fCos = field('asm-cos', ['Účinník cos ', v('$φ')], '', '0,84', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      h('div', { class: 'field-grid' }, fF.el, fPoles.el, fN.el, fP.el),
      h('div', { class: 'calc-subsection' },
        h('h3', null, 'Príkon a účinnosť (nepovinné)'),
        h('div', { class: 'field-grid' }, fU.el, fI.el, fCos.el),
      ),
    ),
    h('div', { class: 'calc-outputs' }, out),
  );
}

/** Kalkulačky k tejto kapitole učiva 3. ročníka. */
export const CALCS: readonly CalculatorInfo[] = [
  { id: 'transformator', title: 'Transformátor', short: 'Prevod, sekundárne napätie, prúdy a impedančný prevod; menovitý a skratový prúd zo štítku.', render: transformerCalc },
  { id: 'asynchronny', title: 'Asynchrónny motor', short: 'Synchrónne otáčky, sklz, moment, príkon a účinnosť zo štítkových údajov.', render: asyncCalc },
];
