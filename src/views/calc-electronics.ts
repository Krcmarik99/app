import { h } from '../lib/dom';
import { E12, E24, nearestStandard } from '../lib/electro';
import { fmt, formatSI } from '../lib/units';
import { monostableFigure, ne555Figure, regulatorFigure, timer555Chart, zenerStabFigure } from '../ui/fig-electronics';
import { errorMsg, field, ok, result, segmented, si, v, type CalculatorInfo } from './calc-kit';

/** Kalkulačky ku kapitole Elektronika (3. ročník): časovač 555 a stabilizátory napätia. */

/** Odporúčané zaťaženie rezistora podľa výkonu (s rezervou). */
function resistorRating(P: number): string {
  if (P <= 0.125) return '0,25 W';
  if (P <= 0.3) return '0,6 W';
  if (P <= 0.5) return '1 W';
  if (P <= 1) return '2 W';
  return 'výkonový rezistor (5 W a viac)';
}

// ---------------------------------------------------------------- časovač 555

function timer555Calc(): HTMLElement {
  let mode: 'astable' | 'mono' = 'astable';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });

  const update = () => {
    fR1.el.style.display = mode === 'astable' ? '' : 'none';
    fR2.el.style.display = mode === 'astable' ? '' : 'none';
    fC.el.style.display = mode === 'astable' ? '' : 'none';
    fRm.el.style.display = mode === 'mono' ? '' : 'none';
    fCm.el.style.display = mode === 'mono' ? '' : 'none';
    if (mode === 'mono') {
      const R = fRm.read();
      const C = fCm.read();
      if (!ok(R) || !ok(C)) {
        out.replaceChildren(errorMsg('Zadaj kladný odpor R a kapacitu C, napríklad 100k a 10µ.'));
        fig.replaceChildren(monostableFigure());
        return;
      }
      const t = 1.1 * R * C;
      out.replaceChildren(
        h('dl', { class: 'results' },
          result(['Dĺžka impulzu ', v('$t')], si(t, 's'), true),
          result(['Časová konštanta ', v('$τ = $R · $C')], si(R * C, 's')),
        ),
        h('p', { class: 'calc-note' }, 'Impulz začne, keď spúšťací vstup 2 klesne pod ⅓ napájacieho napätia, a skončí, keď napätie kondenzátora dosiahne ⅔. Od napájacieho napätia nezávisí.'),
        h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťah'), v('$t = 1,1 · $R · $C')),
      );
      fig.replaceChildren(monostableFigure());
      return;
    }
    const R1 = fR1.read();
    const R2 = fR2.read();
    const C = fC.read();
    if (!ok(R1) || !ok(R2) || !ok(C)) {
      out.replaceChildren(errorMsg('Zadaj kladné hodnoty R1, R2 aj C, napríklad 10k, 47k a 10µ.'));
      fig.replaceChildren(ne555Figure());
      return;
    }
    const t1 = 0.693 * (R1 + R2) * C;
    const t2 = 0.693 * R2 * C;
    const T = t1 + t2;
    const notes: string[] = [];
    if (R1 < 1000) notes.push('R1 voľ aspoň 1 kΩ – pri vybíjaní tečie z napájania cez R1 do vývodu 7 prúd, ktorý by inak bol priveľký.');
    if (1 / T > 300e3) notes.push('Na takej vysokej frekvencii už 555 nepracuje spoľahlivo (bežne do stoviek kHz).');
    if (R1 > 5 * R2) notes.push('R1 je oveľa väčší ako R2 – výstup je takmer stále v stave H.');
    out.replaceChildren(
      h('dl', { class: 'results' },
        result(['Frekvencia ', v('$f')], si(1 / T, 'Hz'), true),
        result(['Perióda ', v('$T')], si(T, 's')),
        result([v('$t_{1}'), ' – výstup H (nabíjanie)'], si(t1, 's')),
        result([v('$t_{2}'), ' – výstup L (vybíjanie)'], si(t2, 's')),
        result(['Striedavosť ', v('$D')], `${fmt((t1 / T) * 100, 3)} %`),
      ),
      ...notes.map((nt) => h('p', { class: 'calc-note' }, nt)),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [
          v('$t_{1} = 0,693 · ($R_{1} + $R_{2}) · $C'),
          v('$t_{2} = 0,693 · $R_{2} · $C'),
          v('$f ≈ @f{1,44}{($R_{1} + 2$R_{2}) · $C}'),
        ]),
      ),
    );
    fig.replaceChildren(
      timer555Chart(R1, R2, C, { width: 440 }),
      ne555Figure({ r1: formatSI(R1, 'Ω', 3), r2: formatSI(R2, 'Ω', 3), c: formatSI(C, 'F', 3) }),
    );
  };

  const fR1 = field('c555-r1', ['Rezistor ', v('$R_{1}')], 'Ω', '10k', update);
  const fR2 = field('c555-r2', ['Rezistor ', v('$R_{2}')], 'Ω', '47k', update);
  const fC = field('c555-c', ['Kapacita ', v('$C')], 'F', '10µ', update, 'Napríklad 10µ = 10 µF, 100n = 100 nF.');
  const fRm = field('c555-rm', ['Rezistor ', v('$R')], 'Ω', '100k', update);
  const fCm = field('c555-cm', ['Kapacita ', v('$C')], 'F', '10µ', update);
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented('c555-mode', 'Zapojenie', [['astable', 'Astabilný'], ['mono', 'Monostabilný']], mode, (m) => { mode = m; update(); }),
      h('div', { class: 'field-grid' }, fR1.el, fR2.el, fC.el, fRm.el, fCm.el),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- stabilizátor

function stabilizerCalc(): HTMLElement {
  let mode: 'zener' | 'lm317' = 'zener';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });
  const zenerBox = h('div', { class: 'field-grid' });
  const lmBox = h('div', null);

  const updateZener = () => {
    const U1min = fU1min.read();
    const U1max = fU1max.read();
    const Uz = fUz.read();
    const IL = fIL.read();
    const IZmin = fIZ.read();
    fig.replaceChildren(zenerStabFigure());
    if (!ok(U1min) || !ok(U1max) || !ok(Uz) || !ok(IZmin) || !(IL >= 0)) {
      out.replaceChildren(errorMsg('Zadaj vstupné napätia, Zenerovo napätie, prúd záťaže (môže byť 0) a najmenší prúd diódy.'));
      return;
    }
    if (U1max < U1min) {
      out.replaceChildren(errorMsg('Najväčšie vstupné napätie nesmie byť menšie ako najmenšie.'));
      return;
    }
    if (U1min <= Uz) {
      out.replaceChildren(errorMsg(`Najmenšie vstupné napätie musí byť väčšie ako Zenerovo napätie ${si(Uz, 'V', 3)} – ideálne aspoň o 2 až 3 V.`));
      return;
    }
    const R = (U1min - Uz) / (IZmin + IL);
    const Rstd = nearestStandard(R, E12, 'down');
    const Imax = (U1max - Uz) / Rstd;
    const IZfull = (U1min - Uz) / Rstd - IL;
    const PZ = Uz * Imax;
    const PR = (U1max - Uz) * Imax;
    const zRating = PZ <= 0.35 ? '0,5 W' : PZ <= 0.9 ? '1,3 W' : 'viac ako 1,3 W – zváž integrovaný stabilizátor';
    out.replaceChildren(
      h('dl', { class: 'results' },
        result(['Vypočítaný odpor ', v('$R')], si(R, 'Ω')),
        result('Rezistor z rady E12 (nižší)', si(Rstd, 'Ω', 3), true),
        result(['Prúd diódy pri ', v('$U_{1 min}'), ' a plnej záťaži'], si(IZfull, 'A', 3)),
        result(['Prúd diódy bez záťaže pri ', v('$U_{1 max}')], si(Imax, 'A', 3)),
        result(['Výkon na Zenerovej dióde ', v('$P_{Z}')], si(PZ, 'W', 3), true),
        result('Odporúčaná Zenerova dióda', zRating),
        result(['Výkon na rezistore ', v('$P_{R}')], si(PR, 'W', 3)),
        result('Odporúčané zaťaženie rezistora', resistorRating(PR)),
      ),
      h('p', { class: 'calc-note' }, 'Rezistor je navrhnutý pre najmenšie vstupné napätie a najväčší prúd záťaže, výkony sú pre najhorší prípad – najväčšie vstupné napätie a odpojenú záťaž.'),
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [
          v('$R = @f{$U_{1 min} − $U_{Z}}{$I_{Z min} + $I_{L}}'),
          v('$P_{Z} = $U_{Z} · @f{$U_{1 max} − $U_{Z}}{$R}'),
        ]),
      ),
    );
    fig.replaceChildren(zenerStabFigure({ r: formatSI(Rstd, 'Ω', 3), uz: formatSI(Uz, 'V', 3), rl: IL > 0 ? formatSI(Uz / IL, 'Ω', 3) : undefined }));
  };

  const updateLm = () => {
    const R1 = fR1.read();
    const R2 = fR2.read();
    if (!ok(R1) || !ok(R2)) {
      out.replaceChildren(errorMsg('Zadaj kladné odpory R1 a R2, napríklad 240 a 720.'));
      fig.replaceChildren(regulatorFigure('lm317'));
      return;
    }
    const U2 = 1.25 * (1 + R2 / R1);
    const rows: HTMLElement[] = [
      result(['Výstupné napätie ', v('$U_{2}')], si(U2, 'V'), true),
      result(['Prúd deličom ', v('@f{1,25 V}{$R_{1}}')], si(1.25 / R1, 'A', 3)),
    ];
    const notes: HTMLElement[] = [];
    if (U2 > 37) notes.push(h('p', { class: 'calc-note' }, 'LM317 dá najviac asi 37 V – zmenši R2.'));
    if (R1 > 1000) notes.push(h('p', { class: 'calc-note' }, 'Pri veľkom R1 tečie deličom malý prúd; LM317 potrebuje na výstupe aspoň asi 5 až 10 mA, preto sa volí R1 = 120 až 240 Ω.'));
    const U1 = fU1.input.value.trim() === '' ? NaN : fU1.read();
    const I = fI.input.value.trim() === '' ? NaN : fI.read();
    if (ok(U1) && ok(I)) {
      if (U1 < U2 + 3) {
        notes.push(h('p', { class: 'calc-note' }, `Vstupné napätie ${si(U1, 'V', 3)} je primalé – na stabilizátore má zostať aspoň asi 3 V, teda vstup aspoň ${si(U2 + 3, 'V', 3)}.`));
      } else {
        const P = (U1 - U2) * I;
        rows.push(
          result(['Stratový výkon ', v('$P')], si(P, 'W', 3)),
          result(['Účinnosť ', v('$η')], `${fmt((U2 / U1) * 100, 3)} %`),
        );
        if (P > 1) notes.push(h('p', { class: 'calc-note' }, 'Stratový výkon je nad 1 W – stabilizátor potrebuje chladič.'));
      }
    }
    const target = fT.input.value.trim() === '' ? NaN : fT.read();
    if (ok(target)) {
      if (target <= 1.25) {
        notes.push(h('p', { class: 'calc-note' }, 'Požadované napätie musí byť väčšie ako referenčné 1,25 V.'));
      } else {
        const ideal = R1 * (target / 1.25 - 1);
        const std = nearestStandard(ideal, E24, 'nearest');
        rows.push(
          result(['Potrebný ', v('$R_{2}'), ` pre ${si(target, 'V', 3)}`], si(ideal, 'Ω')),
          result(['Najbližší z rady E24'], `${si(std, 'Ω', 3)} → ${si(1.25 * (1 + std / R1), 'V', 3)}`),
        );
      }
    }
    out.replaceChildren(
      h('dl', { class: 'results' }, rows),
      ...notes,
      h('div', { class: 'used-formulas' }, h('p', { class: 'eyebrow' }, 'Vzťahy'),
        h('div', { class: 'formula-row' }, [v('$U_{2} = 1,25 · (1 + @f{$R_{2}}{$R_{1}})'), v('$P = ($U_{1} − $U_{2}) · $I')]),
      ),
    );
    fig.replaceChildren(regulatorFigure('lm317', { r1: formatSI(R1, 'Ω', 3), r2: formatSI(R2, 'Ω', 3) }));
  };

  const update = () => {
    zenerBox.style.display = mode === 'zener' ? '' : 'none';
    lmBox.style.display = mode === 'lm317' ? '' : 'none';
    if (mode === 'zener') updateZener();
    else updateLm();
  };

  const fU1min = field('stab-u1min', ['Najmenšie vstupné ', v('$U_{1 min}')], 'V', '10', update);
  const fU1max = field('stab-u1max', ['Najväčšie vstupné ', v('$U_{1 max}')], 'V', '14', update);
  const fUz = field('stab-uz', ['Zenerovo napätie ', v('$U_{Z}')], 'V', '5,6', update);
  const fIL = field('stab-il', ['Najväčší prúd záťaže ', v('$I_{L}')], 'A', '20m', update, '20m = 20 mA');
  const fIZ = field('stab-iz', ['Najmenší prúd diódy ', v('$I_{Z min}')], 'A', '5m', update, 'Zvyčajne 5 až 10 mA.');
  zenerBox.append(fU1min.el, fU1max.el, fUz.el, fIL.el, fIZ.el);

  const fR1 = field('stab-r1', ['Rezistor ', v('$R_{1}'), ' (OUT – ADJ)'], 'Ω', '240', update);
  const fR2 = field('stab-r2', ['Rezistor ', v('$R_{2}'), ' (ADJ – zem)'], 'Ω', '720', update);
  const fU1 = field('stab-u1', ['Vstupné napätie ', v('$U_{1}'), ' (voliteľne)'], 'V', '12', update);
  const fI = field('stab-i', ['Prúd záťaže ', v('$I'), ' (voliteľne)'], 'A', '0,5', update);
  const fT = field('stab-target', ['Požadované ', v('$U_{2}'), ' (voliteľne)'], 'V', '', update, 'Dopočíta R2 k zadanému R1.');
  lmBox.append(
    h('div', { class: 'field-grid' }, fR1.el, fR2.el, fU1.el, fI.el),
    h('div', { class: 'calc-subsection' },
      h('h3', null, 'Návrh deliča'),
      h('p', { class: 'calc-note' }, 'K zvolenému ', v('$R_{1}'), ' nájde ', v('$R_{2}'), ' pre požadované výstupné napätie.'),
      fT.el,
    ),
  );
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented('stab-mode', 'Typ stabilizátora', [['zener', 'Zenerova dióda'], ['lm317', 'LM317']], mode, (m) => { mode = m; update(); }),
      zenerBox,
      lmBox,
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

/** Kalkulačky k tejto kapitole učiva 3. ročníka. */
export const CALCS: readonly CalculatorInfo[] = [
  { id: 'casovac-555', title: 'Časovač 555', short: 'Astabilný generátor (frekvencia, časy, striedavosť s grafom) aj monostabilný časovač.', render: timer555Calc },
  { id: 'stabilizator', title: 'Stabilizátor napätia', short: 'Návrh parametrického stabilizátora so Zenerovou diódou a výstup LM317.', render: stabilizerCalc },
];
