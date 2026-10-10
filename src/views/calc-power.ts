import { frag, h } from '../lib/dom';
import { fmt } from '../lib/units';
import { faultLoopFigure, scopeScreen } from '../ui/fig-power';
import { errorMsg, field, ok, result, segmented, si, v, type CalculatorInfo } from './calc-kit';

/** Kalkulačky ku kapitole Elektroenergetika a bezpečnosť a k lekcii o osciloskope. */

// ---------------------------------------------------------------- ochrana samočinným odpojením

type Device = 'B' | 'C' | 'D' | 'F';
const MULT: Record<'B' | 'C' | 'D', number> = { B: 5, C: 10, D: 20 };

function disconnectionCalc(): HTMLElement {
  let device: Device = 'B';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' }, faultLoopFigure());

  const update = () => {
    fIn.el.style.display = device === 'F' ? 'none' : '';
    fIa.el.style.display = device === 'F' ? '' : 'none';
    const U0 = fU0.read();
    const In = fIn.read();
    const zEmpty = fZs.input.value.trim() === '';
    const Zs = zEmpty ? NaN : fZs.read();
    if (!ok(U0)) {
      out.replaceChildren(errorMsg('Zadaj kladné napätie fázového vodiča proti zemi U0, v sieti 230/400 V je to 230 V.'));
      return;
    }
    if (device !== 'F' && !ok(In)) {
      out.replaceChildren(errorMsg('Zadaj menovitý prúd ističa, napríklad 16 (A).'));
      return;
    }
    const Ia = device === 'F' ? fIa.read() : MULT[device] * In;
    if (!ok(Ia)) {
      out.replaceChildren(errorMsg('Zadaj vypínací prúd Ia – prúd, pri ktorom poistka vypne v predpísanom čase (odčítaš ho z jej vypínacej charakteristiky).'));
      return;
    }
    if (!zEmpty && !ok(Zs)) {
      out.replaceChildren(errorMsg('Impedancia slučky musí byť kladné číslo, napríklad 0,85 – alebo nechaj políčko prázdne.'));
      return;
    }
    const Zmax = U0 / Ia;
    const rows: HTMLElement[] = [
      result(['Vypínací prúd ', v('$I_{a}')], device === 'F' ? si(Ia, 'A') : `${si(Ia, 'A')} (${MULT[device]} · In)`),
      result(['Najväčšia impedancia slučky ', v('$Z_{s,max} = @f{$U_{0}}{$I_{a}}')], si(Zmax, 'Ω'), true),
    ];
    let verdict: HTMLElement | null = null;
    if (!zEmpty) {
      const Ik = U0 / Zs;
      const pass = Zs <= Zmax;
      rows.push(
        result(['Poruchový prúd ', v('$I_{k} = @f{$U_{0}}{$Z_{s}}')], si(Ik, 'A')),
        result(['Kontrola ', v('$Z_{s} · $I_{a}')], `${fmt(Zs * Ia, 4)} V ${pass ? '≤' : '>'} ${fmt(U0, 4)} V`),
        result('Ochrana samočinným odpojením', pass ? 'vyhovuje' : 'nevyhovuje', true),
      );
      verdict = pass
        ? h('p', { class: 'calc-note' }, `Poruchový prúd ${si(Ik, 'A', 3)} je aspoň ${si(Ia, 'A', 3)}, preto ${device === 'F' ? 'poistka vypne' : 'istič vypne elektromagnetickou spúšťou'} v predpísanom čase.`)
        : h('p', { class: 'calc-error' }, `Poruchový prúd ${si(Ik, 'A', 3)} je menší ako ${si(Ia, 'A', 3)} – ochrana by nevypla dosť rýchlo. Zmenši impedanciu slučky (väčší prierez, kratšie vedenie), použi istiaci prvok s menším vypínacím prúdom (charakteristika B, menší menovitý prúd) alebo doplň prúdový chránič.`);
    }
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      verdict,
      h('p', { class: 'muted' }, 'Najdlhší čas odpojenia v sieti TN pri 230 V: 0,4 s pre koncové obvody do 32 A, 5 s pre distribučné obvody.'),
      h('div', { class: 'used-formulas' },
        h('p', { class: 'eyebrow' }, 'Použité vzťahy'),
        h('div', { class: 'formula-row' }, [v('$Z_{s} · $I_{a} ≤ $U_{0}'), v('$I_{a} = $k · $I_{n}'), v('$I_{k} = @f{$U_{0}}{$Z_{s}}')]),
      ),
    ));
  };

  const fU0 = field('so-u0', ['Napätie proti zemi ', v('$U_{0}')], 'V', '230', update);
  const fIn = field('so-in', ['Menovitý prúd ističa ', v('$I_{n}')], 'A', '16', update);
  const fIa = field('so-ia', ['Vypínací prúd poistky ', v('$I_{a}')], 'A', '80', update, 'Prúd, pri ktorom poistka vypne v predpísanom čase (0,4 s alebo 5 s) – z jej charakteristiky.');
  const fZs = field('so-zs', ['Nameraná impedancia slučky ', v('$Z_{s}')], 'Ω', '1,2', update, 'Nepovinné – nechaj prázdne, ak chceš len najväčšiu dovolenú hodnotu.');
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented<Device>('so-kind', 'Istiaci prvok', [['B', 'Istič B'], ['C', 'Istič C'], ['D', 'Istič D'], ['F', 'Poistka']], device, (d) => { device = d; update(); }),
      h('div', { class: 'field-grid' }, fU0.el, fIn.el, fIa.el, fZs.el),
      h('p', { class: 'calc-note' }, 'Istič B vypne okamžite pri 5 · In, C pri 10 · In, D pri 20 · In.'),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

// ---------------------------------------------------------------- odčítanie z osciloskopu

function scopeCalc(): HTMLElement {
  let probe: '1' | '10' = '1';
  const out = h('div', { class: 'calc-result' });
  const fig = h('div', { class: 'sch-panel calc-figure' });
  const opt = (f: { input: HTMLInputElement; read: () => number }) => (f.input.value.trim() === '' ? NaN : f.read());

  const update = () => {
    const kv = fV.read();
    const kt = fT.read();
    const y = fY.read();
    const x = fX.read();
    const dx = opt(fDx);
    const p = Number(probe);
    if (!ok(kv) || !ok(kt)) {
      out.replaceChildren(errorMsg('Zadaj nastavenie osciloskopu: V/dielik (napr. 2 alebo 500m) a čas/dielik (napr. 1m = 1 ms, 50u = 50 µs).'));
      fig.replaceChildren();
      return;
    }
    if (!ok(y) || !ok(x)) {
      out.replaceChildren(errorMsg('Zadaj výšku vrcholu nad stredom a dĺžku periódy v dielikoch, napríklad 2,6 a 4.'));
      fig.replaceChildren();
      return;
    }
    if (fDx.input.value.trim() !== '' && !(dx >= 0)) {
      out.replaceChildren(errorMsg('Posun druhého kanála zadaj v dielikoch ako kladné číslo, alebo políčko nechaj prázdne.'));
      return;
    }
    const Um = y * kv * p;
    const T = x * kt;
    const rows: HTMLElement[] = [
      result(['Amplitúda ', v('$U_{m}')], si(Um, 'V'), true),
      result(['Špička – špička ', v('$U_{pp} = 2 · $U_{m}')], si(2 * Um, 'V')),
      result(['Efektívna hodnota ', v('$U = @f{$U_{m}}{@s{2}}'), ' (sínus)'], si(Um / Math.SQRT2, 'V')),
      result(['Perióda ', v('$T')], si(T, 's')),
      result(['Frekvencia ', v('$f = @f{1}{$T}')], si(1 / T, 'Hz'), true),
    ];
    if (Number.isFinite(dx)) {
      rows.push(result(['Fázový posun ', v('$φ = @f{Δ$x}{$x} · 360°')], `${fmt((dx / x) * 360, 4)}°`));
    }
    const notes: HTMLElement[] = [];
    if (y > 4) notes.push(h('p', { class: 'calc-note' }, 'Vrchol je vyššie ako 4 dieliky – signál by presahoval obrazovku. Zväčši V/dielik.'));
    if (x > 10) notes.push(h('p', { class: 'calc-note' }, 'Perióda je dlhšia ako 10 dielikov – na obrazovke nie je celá. Zväčši čas/dielik.'));
    if (p === 10) notes.push(h('p', { class: 'muted' }, 'So sondou 10:1 je napätie na obrazovke desatinou skutočného – výsledok je už vynásobený desiatimi.'));
    out.replaceChildren(frag(
      h('dl', { class: 'results' }, rows),
      notes,
      h('div', { class: 'used-formulas' },
        h('p', { class: 'eyebrow' }, 'Použité vzťahy'),
        h('div', { class: 'formula-row' }, [v('$U_{m} = $y · $k_{y} · $p'), v('$T = $x · $k_{x}'), v('$f = @f{1}{$T}')]),
      ),
    ));
    fig.replaceChildren(scopeScreen({
      voltsPerDiv: kv,
      timePerDiv: kt,
      amplitudeDiv: Math.min(y, 4.3),
      periodDiv: x,
      probe: p,
      ...(Number.isFinite(dx) ? { second: { amplitudeDiv: Math.min(y, 4.3) * 0.7, phaseDiv: dx } } : {}),
    }));
  };

  const fV = field('osc-vdiv', ['Vertikálne vychyľovanie ', v('$k_{y}')], 'V', '2', update, 'V/dielik, napr. 500m = 0,5 V/dielik.');
  const fT = field('osc-tdiv', ['Časová základňa ', v('$k_{x}')], 's', '0,5m', update, 's/dielik, napr. 0,5m = 0,5 ms/dielik.');
  const fY = field('osc-y', ['Vrchol nad stredom ', v('$y')], 'dielik', '3', update);
  const fX = field('osc-x', ['Dĺžka periódy ', v('$x')], 'dielik', '4', update);
  const fDx = field('osc-dx', ['Posun 2. kanála ', v('Δ$x')], 'dielik', '', update, 'Nepovinné – vzdialenosť prechodov nulou oboch kanálov.');
  update();

  return h('div', { class: 'calc' },
    h('div', { class: 'calc-inputs' },
      segmented<'1' | '10'>('osc-probe', 'Sonda', [['1', 'Sonda 1:1'], ['10', 'Sonda 10:1']], probe, (x) => { probe = x; update(); }),
      h('div', { class: 'field-grid' }, fV.el, fT.el, fY.el, fX.el, fDx.el),
    ),
    h('div', { class: 'calc-outputs' }, out, fig),
  );
}

/** Kalkulačky k tejto kapitole učiva 3. ročníka. */
export const CALCS: readonly CalculatorInfo[] = [
  { id: 'samocinne-odpojenie', title: 'Ochrana samočinným odpojením', short: 'Najväčšia impedancia slučky pre istič alebo poistku, poruchový prúd a posúdenie.', render: disconnectionCalc },
  { id: 'osciloskop', title: 'Odčítanie z osciloskopu', short: 'Amplitúda, efektívna hodnota, perióda, frekvencia a fázový posun z dielikov.', render: scopeCalc },
];
