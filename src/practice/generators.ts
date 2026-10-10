/**
 * Generátory číselných príkladov. Každé volanie vytvorí príklad s inými hodnotami
 * a s postupom riešenia. Hodnoty súčiastok sa berú z rady E12, aby boli realistické.
 */
import { MODULES } from '../content/all-modules';
import { bandNames, colorById, encodeBands } from '../lib/colorcode';
import { E12, nearestStandard } from '../lib/electro';
import { pick, shuffle, type Rng } from '../lib/random';
import { fmtFixed, fmtSci, superscript } from '../lib/units';
import {
  dividerFigure, impedanceTriangle, ledFigure, mixedFigure, nodeFigure, parallelFigure, rcFigure,
  resistorBands, seriesFigure,
} from '../ui/figures';
import { b, e12, hoursText, n, numeric, q, res, type Generator } from './helpers';
import type { ChoiceQuestion, FigureFn } from './types';

export type { Generator } from './helpers';

// ---------------------------------------------------------------- Základy

const CONVERSIONS: { m: number[]; from: string; to: string; factor: number }[] = [
  { m: [1.5, 2.2, 4.7, 6.8, 10, 22, 47], from: 'kΩ', to: 'Ω', factor: 1e3 },
  { m: [100, 220, 470, 680, 1500, 3300], from: 'Ω', to: 'kΩ', factor: 1e-3 },
  { m: [1.2, 2.2, 4.7, 10], from: 'MΩ', to: 'kΩ', factor: 1e3 },
  { m: [15, 20, 35, 150, 250, 500], from: 'mA', to: 'A', factor: 1e-3 },
  { m: [0.02, 0.035, 0.25, 0.5, 1.5], from: 'A', to: 'mA', factor: 1e3 },
  { m: [50, 120, 470, 800], from: 'µA', to: 'mA', factor: 1e-3 },
  { m: [0.4, 1.5, 22, 110], from: 'kV', to: 'V', factor: 1e3 },
  { m: [10, 47, 100, 470], from: 'nF', to: 'µF', factor: 1e-3 },
  { m: [0.1, 0.47, 2.2, 4.7], from: 'µF', to: 'nF', factor: 1e3 },
  { m: [100, 470, 2200], from: 'pF', to: 'nF', factor: 1e-3 },
];

const zaklady: Generator[] = [
  (rng) => {
    const I = pick(rng, [0.2, 0.25, 0.5, 0.8, 1.5, 2, 2.5]);
    const min = pick(rng, [1, 2, 5, 10]);
    const t = min * 60;
    const Q = I * t;
    return numeric('zaklady', `Vodičom prechádza stály prúd ${q(I, 'A')} počas ${min} min. Aký náboj prejde prierezom vodiča?`, Q, 'C', [
      `Preveď na základné jednotky: \`$I\` = ${b(I, 'A')}, \`$t\` = ${min} · 60 s = ${b(t, 's')}.`,
      `\`$Q = $I · $t\` = ${b(I, 'A')} · ${b(t, 's')} = **${q(Q, 'C')}**`,
    ]);
  },
  (rng) => {
    const Q = pick(rng, [6, 12, 18, 30, 45, 90]);
    const t = pick(rng, [3, 5, 6, 10, 15, 30]);
    const I = Q / t;
    return numeric('zaklady', `Prierezom vodiča prejde za ${t} s náboj ${Q} C. Aký veľký prúd tečie vodičom?`, I, 'A', [
      `\`$I = @f{$Q}{$t} = @f{${n(Q)} C}{${n(t)} s}\` = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const c = pick(rng, CONVERSIONS);
    const m = pick(rng, c.m);
    const ans = Number((m * c.factor).toPrecision(6));
    return numeric('zaklady', `Preveď ${n(m)} ${c.from} na ${c.to}.`, ans, c.to, [
      `1 ${c.from} = ${n(c.factor, 2)} ${c.to}`,
      `${n(m)} · ${n(c.factor, 2)} = **${n(ans, 6)} ${c.to}**`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },
];

// ---------------------------------------------------------------- Ohmov zákon

function singleResistor(R: number, U?: number): FigureFn {
  return () => seriesFigure([{ label: 'R', value: q(R, 'Ω') }], { source: { label: 'U', value: U === undefined ? undefined : q(U, 'V') } });
}

const ohm: Generator[] = [
  (rng) => {
    const U = pick(rng, [4.5, 5, 9, 12, 24]);
    const R = e12(rng, [100, 1000]);
    const I = U / R;
    return numeric('ohmov-zakon', `Rezistor s odporom ${q(R, 'Ω')} je pripojený na napätie ${q(U, 'V')}. Aký prúd ním tečie?`, I, 'A', [
      `Odpor v základných jednotkách: \`$R\` = ${b(R, 'Ω')}.`,
      `\`$I = @f{$U}{$R} = @f{${b(U, 'V')}}{${b(R, 'Ω')}}\` = ${res(I, 'A')}`,
    ], { figure: singleResistor(R, U) });
  },
  (rng) => {
    const R = e12(rng, [100, 1000]);
    const mA = R >= 1000 ? pick(rng, [1, 2, 2.5, 5]) : pick(rng, [10, 15, 20, 25, 40]);
    const I = mA / 1000;
    const U = R * I;
    return numeric('ohmov-zakon', `Rezistorom ${q(R, 'Ω')} tečie prúd ${q(I, 'A')}. Aké napätie je na rezistore?`, U, 'V', [
      `Prúd v ampéroch: \`$I\` = ${b(I, 'A')}.`,
      `\`$U = $R · $I\` = ${b(R, 'Ω')} · ${b(I, 'A')} = **${q(U, 'V')}**`,
    ], { figure: singleResistor(R) });
  },
  (rng) => {
    const U = pick(rng, [5, 9, 12, 24, 230]);
    const I = pick(rng, [10, 20, 25, 40, 50, 100]) / 1000;
    const R = U / I;
    return numeric('ohmov-zakon', `Spotrebič pripojený na napätie ${q(U, 'V')} odoberá prúd ${q(I, 'A')}. Aký má odpor?`, R, 'Ω', [
      `\`$R = @f{$U}{$I} = @f{${b(U, 'V')}}{${b(I, 'A')}}\` = ${res(R, 'Ω')}`,
    ]);
  },
  (rng) => {
    const R = pick(rng, [10, 15, 20, 30, 40, 60]);
    const U1 = pick(rng, [3, 6, 9, 12]);
    const U2 = pick(rng, [4.5, 15, 18, 24]);
    const I1 = U1 / R;
    const I2 = U2 / R;
    return numeric('ohmov-zakon', `Pri napätí ${q(U1, 'V')} tečie spotrebičom prúd ${q(I1, 'A')}. Aký prúd bude tiecť pri napätí ${q(U2, 'V')}, ak sa odpor nemení?`, I2, 'A', [
      `Odpor spotrebiča: \`$R = @f{$U_{1}}{$I_{1}} = @f{${b(U1, 'V')}}{${b(I1, 'A')}}\` = ${b(R, 'Ω')}.`,
      `\`$I_{2} = @f{$U_{2}}{$R} = @f{${b(U2, 'V')}}{${b(R, 'Ω')}}\` = ${res(I2, 'A')}`,
    ]);
  },
];

// ---------------------------------------------------------------- Odpor vodiča

const wire: Generator[] = [
  (rng) => {
    const mat = pick(rng, [{ name: 'medený', rho: 0.0178 }, { name: 'hliníkový', rho: 0.0286 }]);
    const l = pick(rng, [10, 20, 25, 50, 100, 150]);
    const S = pick(rng, [0.75, 1, 1.5, 2.5, 4, 6]);
    const R = (mat.rho * l) / S;
    return numeric('odpor-vodica', `Aký odpor má ${mat.name} vodič dlhý ${l} m s prierezom ${n(S)} mm²? (\`$ρ\` = ${n(mat.rho)} Ω·mm²/m)`, R, 'Ω', [
      `\`$R = $ρ · @f{$l}{$S} = ${n(mat.rho)} · @f{${n(l)}}{${n(S)}}\` = **${b(R, 'Ω', 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const len = pick(rng, [10, 15, 20, 25, 30, 50]);
    const S = pick(rng, [1, 1.5, 2.5]);
    const R = (0.0178 * 2 * len) / S;
    return numeric('odpor-vodica', `Predlžovací kábel je dlhý ${len} m a má medené žily s prierezom ${n(S)} mm². Aký odpor majú oba vodiče (tam a späť) spolu? (\`$ρ\` = 0,0178 Ω·mm²/m)`, R, 'Ω', [
      `Prúd tečie tam aj späť, takže \`$l\` = 2 · ${len} m = ${2 * len} m.`,
      `\`$R = 0,0178 · @f{${2 * len}}{${n(S)}}\` = **${b(R, 'Ω', 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const R20 = pick(rng, [5, 8, 12, 20, 40, 75]);
    const temp = pick(rng, [50, 60, 75, 80, 90, 100]);
    const k = 1 + 0.0039 * (temp - 20);
    const R = R20 * k;
    return numeric('odpor-vodica', `Medené vinutie má pri 20 °C odpor ${q(R20, 'Ω')}. Aký bude jeho odpor pri teplote ${temp} °C? (\`$α\` = 0,0039 K⁻¹)`, R, 'Ω', [
      `\`$R_{$ϑ} = $R_{20} · [1 + $α · ($ϑ − 20 °C)]\``,
      `\`$R_{$ϑ}\` = ${n(R20)} · [1 + 0,0039 · ${temp - 20}] = ${n(R20)} · ${n(k, 5)} = **${q(R, 'Ω')}**`,
    ]);
  },
  (rng) => {
    const R = pick(rng, [5, 10, 20, 50, 100]);
    const S = pick(rng, [0.1, 0.2, 0.5]);
    const l = (R * S) / 0.5;
    return numeric('odpor-vodica', `Z konštantánového drôtu s prierezom ${n(S)} mm² chceš navinúť rezistor ${q(R, 'Ω')}. Akú dĺžku drôtu potrebuješ? (\`$ρ\` = 0,5 Ω·mm²/m)`, l, 'm', [
      `Zo vzťahu \`$R = $ρ · @f{$l}{$S}\` vyjadríme \`$l = @f{$R · $S}{$ρ}\`.`,
      `\`$l = @f{${n(R)} · ${n(S)}}{0,5}\` = **${b(l, 'm', 3)}**`,
    ], { fixedUnit: true });
  },
];

// ---------------------------------------------------------------- Spájanie rezistorov

const combine: Generator[] = [
  (rng) => {
    const rs = [0, 1, 2].map(() => e12(rng, [100, 1000]));
    const R = rs.reduce((a, x) => a + x, 0);
    return numeric('spajanie-rezistorov', `Rezistory ${rs.map((r) => q(r, 'Ω')).join(', ')} sú zapojené sériovo. Aký je výsledný odpor?`, R, 'Ω', [
      'V sérii sa odpory sčítajú: `$R = $R_{1} + $R_{2} + $R_{3}`.',
      `\`$R\` = ${rs.map((r) => b(r, 'Ω')).join(' + ')} = **${q(R, 'Ω')}**`,
    ], { figure: () => seriesFigure(rs.map((r, i) => ({ label: `R_${i + 1}`, value: q(r, 'Ω') }))) });
  },
  (rng) => {
    const r1 = e12(rng, [100, 1000]);
    const r2 = e12(rng, [100, 1000]);
    const R = (r1 * r2) / (r1 + r2);
    return numeric('spajanie-rezistorov', `Rezistory ${q(r1, 'Ω')} a ${q(r2, 'Ω')} sú zapojené paralelne. Aký je výsledný odpor?`, R, 'Ω', [
      'Pre dva paralelné rezistory platí `$R = @f{$R_{1} · $R_{2}}{$R_{1} + $R_{2}}`.',
      `\`$R = @f{${n(r1)} · ${n(r2)}}{${n(r1)} + ${n(r2)}}\` Ω = **${q(R, 'Ω')}**`,
    ], { figure: () => parallelFigure([{ label: 'R_1', value: q(r1, 'Ω') }, { label: 'R_2', value: q(r2, 'Ω') }], { branchCurrents: false }) });
  },
  (rng) => {
    const rs = [0, 1, 2].map(() => e12(rng, [100, 1000]));
    const G = rs.reduce((a, r) => a + 1 / r, 0);
    const R = 1 / G;
    return numeric('spajanie-rezistorov', `Rezistory ${rs.map((r) => q(r, 'Ω')).join(', ')} sú zapojené paralelne. Aký je výsledný odpor?`, R, 'Ω', [
      '`@f{1}{$R} = @f{1}{$R_{1}} + @f{1}{$R_{2}} + @f{1}{$R_{3}}`',
      `\`@f{1}{$R} = ${rs.map((r) => `@f{1}{${n(r)}}`).join(' + ')}\` = ${b(G, 'S', 4)}`,
      `\`$R = @f{1}{${n(G, 4)}}\` = **${q(R, 'Ω')}**`,
    ], { figure: () => parallelFigure(rs.map((r, i) => ({ label: `R_${i + 1}`, value: q(r, 'Ω') })), { branchCurrents: false }) });
  },
  (rng) => {
    const [r1, r2, r3] = [0, 1, 2].map(() => e12(rng, [100, 1000]));
    const r23 = (r2 * r3) / (r2 + r3);
    const R = r1 + r23;
    return numeric('spajanie-rezistorov', `Rezistor \`$R_{1}\` = ${q(r1, 'Ω')} je v sérii s paralelnou kombináciou \`$R_{2}\` = ${q(r2, 'Ω')} a \`$R_{3}\` = ${q(r3, 'Ω')}. Aký je výsledný odpor?`, R, 'Ω', [
      `\`$R_{2}\` a \`$R_{3}\` sú paralelne: \`$R_{23} = @f{${n(r2)} · ${n(r3)}}{${n(r2)} + ${n(r3)}}\` = ${b(r23, 'Ω', 4)}`,
      `\`$R_{1}\` je s nimi v sérii: \`$R = $R_{1} + $R_{23}\` = ${n(r1)} + ${n(r23, 4)} = **${q(R, 'Ω')}**`,
    ], {
      figure: () => mixedFigure([
        { label: 'R_1', value: q(r1, 'Ω') }, { label: 'R_2', value: q(r2, 'Ω') }, { label: 'R_3', value: q(r3, 'Ω') },
      ]),
    });
  },
];

// ---------------------------------------------------------------- Kirchhoffove zákony

const kirchhoff: Generator[] = [
  (rng) => {
    const i1 = pick(rng, [120, 250, 300, 450]);
    const i2 = pick(rng, [80, 150, 200, 350]);
    const i3 = pick(rng, [50, 100, 180]);
    const i4 = i1 + i2 - i3;
    return numeric('kirchhoffove-zakony', `Do uzla vtekajú prúdy \`$I_{1}\` = ${i1} mA a \`$I_{2}\` = ${i2} mA. Vyteká z neho prúd \`$I_{3}\` = ${i3} mA. Aký veľký je prúd \`$I_{4}\`, ktorý z uzla tiež vyteká?`, i4 / 1000, 'A', [
      '1. Kirchhoffov zákon: `$I_{1} + $I_{2} = $I_{3} + $I_{4}`',
      `\`$I_{4} = $I_{1} + $I_{2} − $I_{3}\` = ${i1} + ${i2} − ${i3} = **${i4} mA**`,
    ], { figure: () => nodeFigure(['I_1', 'I_2', 'I_3', 'I_4'], [`${i1} mA`, `${i2} mA`, `${i3} mA`, '?']) });
  },
  (rng) => {
    const set = pick(rng, [
      { U: 9, u1: [2, 2.5, 3], u2: [1.5, 2, 3] },
      { U: 12, u1: [3, 4.5, 5], u2: [2, 3.3, 4] },
      { U: 24, u1: [6, 8, 10], u2: [5, 7.5, 9] },
    ]);
    const U1 = pick(rng, set.u1);
    const U2 = pick(rng, set.u2);
    const U3 = set.U - U1 - U2;
    return numeric('kirchhoffove-zakony', `Tri rezistory v sérii sú pripojené na zdroj ${set.U} V. Na prvom je napätie ${q(U1, 'V')}, na druhom ${q(U2, 'V')}. Aké napätie je na treťom rezistore?`, U3, 'V', [
      '2. Kirchhoffov zákon: `$U = $U_{1} + $U_{2} + $U_{3}`',
      `\`$U_{3} = $U − $U_{1} − $U_{2}\` = ${n(set.U)} − ${n(U1)} − ${n(U2)} = **${q(U3, 'V')}**`,
    ], { figure: () => seriesFigure([{ label: 'R_1' }, { label: 'R_2' }, { label: 'R_3' }], { voltages: true, source: { label: 'U', value: `${set.U} V` } }) });
  },
  (rng) => {
    const U = pick(rng, [5, 9, 12, 24]);
    const R1 = e12(rng, [1000, 10000]);
    const R2 = e12(rng, [1000, 10000]);
    const U2 = (U * R2) / (R1 + R2);
    return numeric('kirchhoffove-zakony', `Nezaťažený delič napätia tvoria rezistory \`$R_{1}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = ${q(R2, 'Ω')}. Na vstupe je ${q(U, 'V')}. Aké napätie je na výstupe (na rezistore \`$R_{2}\`)?`, U2, 'V', [
      `\`$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}} = ${n(U)} · @f{${n(R2)}}{${n(R1)} + ${n(R2)}}\` = **${q(U2, 'V')}**`,
    ], {
      figure: () => dividerFigure({
        r1: { label: 'R_1', value: q(R1, 'Ω') }, r2: { label: 'R_2', value: q(R2, 'Ω') }, source: { label: 'U', value: q(U, 'V') },
      }),
    });
  },
  (rng) => {
    const I = pick(rng, [0.1, 0.2, 0.5, 1]);
    const R1 = e12(rng, [100]);
    const R2 = e12(rng, [100]);
    const I1 = (I * R2) / (R1 + R2);
    return numeric('kirchhoffove-zakony', `Prúd ${q(I, 'A')} sa delí do dvoch paralelných vetiev s rezistormi \`$R_{1}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = ${q(R2, 'Ω')}. Aký prúd tečie rezistorom \`$R_{1}\`?`, I1, 'A', [
      `\`$I_{1} = $I · @f{$R_{2}}{$R_{1} + $R_{2}} = ${b(I, 'A')} · @f{${n(R2)}}{${n(R1)} + ${n(R2)}}\` = ${res(I1, 'A')}`,
    ], { figure: () => parallelFigure([{ label: 'R_1', value: q(R1, 'Ω') }, { label: 'R_2', value: q(R2, 'Ω') }]) });
  },
];

// ---------------------------------------------------------------- Reálny zdroj

const source: Generator[] = [
  (rng) => {
    const Ue = pick(rng, [1.5, 4.5, 9, 12]);
    const Ri = pick(rng, [0.2, 0.5, 1, 1.5, 2]);
    const Rz = pick(rng, [5, 10, 20, 30, 47]);
    const I = Ue / (Ri + Rz);
    const U = Rz * I;
    return numeric('zdroj', `Zdroj má elektromotorické napätie ${q(Ue, 'V')} a vnútorný odpor ${b(Ri, 'Ω')}. Pripojíme k nemu záťaž ${q(Rz, 'Ω')}. Aké bude svorkové napätie?`, U, 'V', [
      `\`$I = @f{$U_{e}}{$R_{i} + $R_{z}} = @f{${n(Ue)}}{${n(Ri)} + ${n(Rz)}}\` = ${b(I, 'A', 4)}`,
      `\`$U = $R_{z} · $I\` = ${n(Rz)} · ${n(I, 4)} = **${q(U, 'V')}**`,
    ]);
  },
  (rng) => {
    const Ue = pick(rng, [1.5, 4.5, 9, 12, 12.6]);
    const Ri = pick(rng, [0.01, 0.02, 0.05, 0.1, 0.3, 0.5]);
    const Ik = Ue / Ri;
    return numeric('zdroj', `Článok má napätie naprázdno ${q(Ue, 'V')} a vnútorný odpor ${b(Ri, 'Ω')}. Aký prúd by tiekol pri skrate?`, Ik, 'A', [
      `\`$I_{k} = @f{$U_{e}}{$R_{i}} = @f{${b(Ue, 'V')}}{${b(Ri, 'Ω')}}\` = **${q(Ik, 'A')}**`,
      'Pri skrate obmedzuje prúd len vnútorný odpor – preto sú skraty akumulátorov nebezpečné.',
    ]);
  },
  (rng) => {
    const Ue = pick(rng, [4.5, 9, 12]);
    const I = pick(rng, [0.2, 0.5, 1, 2]);
    const Ri = pick(rng, [0.2, 0.3, 0.5, 0.8]);
    const U = Ue - Ri * I;
    return numeric('zdroj', `Naprázdno ukazuje voltmeter na svorkách zdroja ${q(Ue, 'V')}. Pri odbere prúdu ${q(I, 'A')} klesne napätie na ${q(U, 'V', 4)}. Aký je vnútorný odpor zdroja?`, Ri, 'Ω', [
      `Úbytok napätia vo vnútri zdroja: ${n(Ue)} − ${n(U)} = ${n(Ue - U)} V`,
      `\`$R_{i} = @f{$U_{e} − $U}{$I} = @f{${n(Ue - U)}}{${n(I)}}\` = **${b(Ri, 'Ω', 3)}**`,
    ], { fixedUnit: true });
  },
];

// ---------------------------------------------------------------- Výkon a práca

const power: Generator[] = [
  (rng) => {
    const U = pick(rng, [12, 24, 230]);
    const I = pick(rng, U === 230 ? [0.2, 0.43, 1.5, 4.3, 6.5] : [0.5, 1.5, 2, 3.5]);
    const P = U * I;
    return numeric('vykon-a-praca', `Spotrebičom pripojeným na ${q(U, 'V')} tečie prúd ${q(I, 'A')}. Aký má príkon?`, P, 'W', [
      `\`$P = $U · $I\` = ${b(U, 'V')} · ${b(I, 'A')} = **${q(P, 'W')}**`,
    ]);
  },
  (rng) => {
    const app = pick(rng, [
      { name: 'Rýchlovarná kanvica', P: 2000 },
      { name: 'Žehlička', P: 2200 },
      { name: 'Mikrovlnná rúra', P: 900 },
      { name: 'Vysávač', P: 1600 },
      { name: 'Sušič vlasov', P: 1800 },
      { name: 'Nabíjačka notebooku', P: 65 },
      { name: 'LED žiarovka', P: 9 },
    ]);
    const I = app.P / 230;
    return numeric('vykon-a-praca', `${app.name} s príkonom ${q(app.P, 'W')} pracuje na sieťovom napätí 230 V. Aký prúd odoberá?`, I, 'A', [
      `\`$I = @f{$P}{$U} = @f{${n(app.P)} W}{230 V}\` = **${q(I, 'A')}**`,
    ]);
  },
  (rng) => {
    const dev = pick(rng, [
      { name: 'Televízor', P: 120 },
      { name: 'Počítač', P: 250 },
      { name: 'Herná konzola', P: 180 },
      { name: 'Ohrievač akvária', P: 100 },
      { name: 'Elektrický ohrievač', P: 1500 },
    ]);
    const h = pick(rng, [2, 3, 4, 6, 8]);
    const price = pick(rng, [0.16, 0.18, 0.21]);
    const W = (dev.P / 1000) * h * 30;
    const cost = W * price;
    return numeric('vykon-a-praca', `${dev.name} s príkonom ${q(dev.P, 'W')} beží ${hoursText(h)} denne. Koľko eur zaplatíš za 30 dní pri cene ${fmtFixed(price, 2)} €/kWh?`, cost, '€', [
      `\`$W = $P · $t\` = ${n(dev.P / 1000)} kW · ${h} h · 30 = ${n(W)} kWh`,
      `cena = ${n(W)} kWh · ${fmtFixed(price, 2)} €/kWh = **${fmtFixed(cost, 2)} €**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const R = pick(rng, [100, 150, 220, 330, 470]);
    const I = pick(rng, [10, 20, 25, 30, 50]) / 1000;
    const P = R * I * I;
    return numeric('vykon-a-praca', `Rezistorom ${q(R, 'Ω')} tečie prúd ${q(I, 'A')}. Aký výkon sa na ňom mení na teplo?`, P, 'W', [
      `\`$P = $R · $I^{2}\` = ${n(R)} · ${n(I)}² = ${res(P, 'W')}`,
      P > 0.25 ? 'Bežný rezistor 0,25 W by sa prehrial – treba typ na väčšie zaťaženie.' : 'Bežný rezistor 0,25 W tento výkon bez problémov znesie.',
    ]);
  },
  (rng) => {
    const P1 = pick(rng, [500, 1000, 1500, 2000, 4000]);
    const eta = pick(rng, [0.6, 0.75, 0.8, 0.85, 0.9]);
    const P2 = P1 * eta;
    return numeric('vykon-a-praca', `Motor odoberá zo siete príkon ${q(P1, 'W')} a na hriadeli odovzdáva výkon ${q(P2, 'W', 4)}. Aká je jeho účinnosť?`, eta * 100, '%', [
      `\`$η = @f{$P_{2}}{$P_{1}} · 100 %\` = ${n(P2)} / ${n(P1)} · 100 % = **${n(eta * 100)} %**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const P = pick(rng, [9, 60, 100, 1500, 2000]);
    const t = pick(rng, [0.5, 2, 5, 10]);
    const W = (P * t) / 1000;
    return numeric('vykon-a-praca', `Spotrebič s príkonom ${q(P, 'W')} je zapnutý ${hoursText(t)}. Koľko kilowatthodín spotrebuje?`, W, 'kWh', [
      `\`$W = $P · $t\` = ${n(P / 1000)} kW · ${n(t)} h = **${n(W)} kWh**`,
    ], { fixedUnit: true });
  },
];

// ---------------------------------------------------------------- Kondenzátor

const capacitor: Generator[] = [
  (rng) => {
    const C = pick(rng, [1, 2.2, 4.7, 10, 47, 100]) * 1e-6;
    const U = pick(rng, [5, 9, 12, 24, 50]);
    const Q = C * U;
    return numeric('kondenzator', `Kondenzátor s kapacitou ${q(C, 'F')} je nabitý na napätie ${q(U, 'V')}. Aký náboj je na jeho elektródach?`, Q, 'C', [
      `\`$Q = $C · $U\` = ${fmtSci(C)} F · ${n(U)} V = **${q(Q, 'C')}**`,
    ]);
  },
  (rng) => {
    const [c1, c2] = shuffle(rng, [1, 2.2, 4.7, 10, 22, 47]).slice(0, 2);
    const C = ((c1 * c2) / (c1 + c2)) * 1e-6;
    return numeric('kondenzator', `Kondenzátory ${n(c1)} µF a ${n(c2)} µF sú zapojené sériovo. Aká je výsledná kapacita?`, C, 'F', [
      'V sérii sa sčítajú prevrátené hodnoty kapacít. Pre dva kondenzátory: `$C = @f{$C_{1} · $C_{2}}{$C_{1} + $C_{2}}`.',
      `\`$C = @f{${n(c1)} · ${n(c2)}}{${n(c1)} + ${n(c2)}}\` µF = **${q(C, 'F')}**`,
    ], { figure: () => seriesFigure([{ label: 'C_1', value: `${n(c1)} µF` }, { label: 'C_2', value: `${n(c2)} µF` }], { kind: 'capacitor' }) });
  },
  (rng) => {
    const cs = shuffle(rng, [0.1, 0.22, 0.47, 1, 2.2, 4.7]).slice(0, 3);
    const C = cs.reduce((a, c) => a + c, 0) * 1e-6;
    return numeric('kondenzator', `Kondenzátory ${cs.map((c) => q(c * 1e-6, 'F')).join(', ')} sú zapojené paralelne. Aká je výsledná kapacita?`, C, 'F', [
      `Paralelné kapacity sa sčítajú: ${cs.map((c) => n(c)).join(' + ')} µF = **${q(C, 'F')}**`,
    ], { figure: () => parallelFigure(cs.map((c, i) => ({ label: `C_${i + 1}`, value: q(c * 1e-6, 'F') })), { kind: 'capacitor', branchCurrents: false }) });
  },
  (rng) => {
    const R = e12(rng, [1000, 10000]);
    const C = pick(rng, [1, 10, 22, 47, 100, 470]) * 1e-6;
    const tau = R * C;
    return numeric('kondenzator', `Kondenzátor ${q(C, 'F')} sa nabíja cez rezistor ${q(R, 'Ω')}. Aká je časová konštanta obvodu?`, tau, 's', [
      `\`$τ = $R · $C\` = ${b(R, 'Ω')} · ${fmtSci(C)} F = **${q(tau, 's')}**`,
      `Prakticky nabitý bude kondenzátor po \`5$τ\` = ${q(5 * tau, 's')}.`,
    ], { figure: rcFigure });
  },
  (rng) => {
    const C = pick(rng, [100, 470, 1000, 2200, 4700]) * 1e-6;
    const U = pick(rng, [12, 16, 25, 35, 50]);
    const W = 0.5 * C * U * U;
    return numeric('kondenzator', `Elektrolytický kondenzátor ${q(C, 'F')} je nabitý na ${q(U, 'V')}. Akú energiu uchováva?`, W, 'J', [
      `\`$W = @f{1}{2} · $C · $U^{2}\` = 0,5 · ${fmtSci(C)} · ${n(U)}² = ${res(W, 'J')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [5, 9, 12, 24]);
    const k = pick(rng, [1, 2, 3]);
    const factor = 1 - Math.exp(-k);
    const u = U * factor;
    return numeric('kondenzator', `Vybitý kondenzátor začneš nabíjať cez rezistor zo zdroja ${q(U, 'V')}. Aké napätie bude na kondenzátore po čase ${k === 1 ? 'τ' : `${k}τ`}?`, u, 'V', [
      `\`$u_{C} = $U · (1 − e^{−$t/$τ})\` = \`${n(U)} · (1 − e^{−${k}})\` = ${n(U)} · ${n(factor, 4)} = **${q(u, 'V')}**`,
    ]);
  },
];

// ---------------------------------------------------------------- Magnetické pole a cievka

const magnet: Generator[] = [
  (rng) => {
    const B = pick(rng, [0.2, 0.5, 0.8, 1.2]);
    const I = pick(rng, [2, 5, 10, 15]);
    const l = pick(rng, [0.1, 0.15, 0.2, 0.25]);
    const F = B * I * l;
    return numeric('magnetizmus-cievka', `Priamy vodič dlhý ${n(l * 100)} cm je kolmo na indukčné čiary magnetického poľa s indukciou ${n(B)} T. Tečie ním prúd ${n(I)} A. Aká sila naň pôsobí?`, F, 'N', [
      `Dĺžka v metroch: \`$l\` = ${n(l)} m.`,
      `\`$F = $B · $I · $l\` = ${n(B)} · ${n(I)} · ${n(l)} = **${b(F, 'N', 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const N = pick(rng, [50, 100, 200, 500]);
    const dPhi = pick(rng, [0.5, 1, 2, 5]) / 1000;
    const dt = pick(rng, [5, 10, 20, 50]) / 1000;
    const u = (N * dPhi) / dt;
    return numeric('magnetizmus-cievka', `Magnetický tok cievkou s ${N} závitmi sa za ${n(dt * 1000)} ms rovnomerne zmení o ${n(dPhi * 1000)} mWb. Aké veľké napätie sa v cievke indukuje?`, u, 'V', [
      `\`|$u_{i}| = $N · @f{Δ$Φ}{Δ$t} = ${N} · @f{${b(dPhi, 'Wb')}}{${b(dt, 's')}}\` = **${q(u, 'V')}**`,
    ]);
  },
  (rng) => {
    const L = pick(rng, [10, 50, 100, 220, 500]) / 1000;
    const I = pick(rng, [0.5, 1, 2, 3, 5]);
    const W = 0.5 * L * I * I;
    return numeric('magnetizmus-cievka', `Cievkou s indukčnosťou ${q(L, 'H')} tečie prúd ${q(I, 'A')}. Akú energiu má jej magnetické pole?`, W, 'J', [
      `\`$W = @f{1}{2} · $L · $I^{2}\` = 0,5 · ${b(L, 'H')} · ${n(I)}² = ${res(W, 'J')}`,
    ]);
  },
  (rng) => {
    const L = pick(rng, [10, 47, 100, 220, 470]) / 1000;
    const R = pick(rng, [10, 22, 47, 100]);
    const tau = L / R;
    return numeric('magnetizmus-cievka', `Cievka s indukčnosťou ${q(L, 'H')} je zapojená v sérii s rezistorom ${q(R, 'Ω')}. Aká je časová konštanta obvodu?`, tau, 's', [
      `\`$τ = @f{$L}{$R} = @f{${b(L, 'H')}}{${b(R, 'Ω')}}\` = ${res(tau, 's')}`,
    ]);
  },
  (rng) => {
    const L = pick(rng, [10, 50, 100, 200]) / 1000;
    const di = pick(rng, [0.5, 1, 2]);
    const dt = pick(rng, [1, 2, 5, 10]) / 1000;
    const u = (L * di) / dt;
    return numeric('magnetizmus-cievka', `Prúd cievkou s indukčnosťou ${q(L, 'H')} sa za ${n(dt * 1000)} ms rovnomerne zmení o ${q(di, 'A')}. Aké napätie sa na cievke indukuje?`, u, 'V', [
      `\`$u = $L · @f{Δ$i}{Δ$t} = ${b(L, 'H')} · @f{${b(di, 'A')}}{${b(dt, 's')}}\` = **${q(u, 'V')}**`,
    ]);
  },
];

// ---------------------------------------------------------------- Striedavý prúd

const ac: Generator[] = [
  (rng) => {
    const Tms = pick(rng, [0.5, 1, 2, 2.5, 5, 10, 20]);
    const T = Tms / 1000;
    const f = 1 / T;
    return numeric('striedavy-prud', `Perióda striedavého napätia je ${n(Tms)} ms. Aká je jeho frekvencia?`, f, 'Hz', [
      `\`$f = @f{1}{$T} = @f{1}{${b(T, 's')}}\` = **${q(f, 'Hz')}**`,
    ]);
  },
  (rng) => {
    const f = pick(rng, [50, 60, 100, 400, 1000, 2000]);
    const T = 1 / f;
    return numeric('striedavy-prud', `Aká je perióda striedavého napätia s frekvenciou ${q(f, 'Hz')}?`, T, 's', [
      `\`$T = @f{1}{$f} = @f{1}{${n(f)}}\` = ${res(T, 's')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [6, 12, 24, 230, 400]);
    const Um = U * Math.SQRT2;
    return numeric('striedavy-prud', `Efektívna hodnota sínusového napätia je ${q(U, 'V')}. Aká je jeho maximálna hodnota (amplitúda)?`, Um, 'V', [
      `\`$U_{m} = $U · @s{2}\` = ${n(U)} · 1,414 = **${q(Um, 'V')}**`,
    ]);
  },
  (rng) => {
    const Um = pick(rng, [10, 17, 100, 311, 325, 565]);
    const U = Um / Math.SQRT2;
    return numeric('striedavy-prud', `Osciloskop ukazuje sínusové napätie s amplitúdou ${q(Um, 'V')}. Akú hodnotu ukáže voltmeter (efektívnu)?`, U, 'V', [
      `\`$U = @f{$U_{m}}{@s{2}} = @f{${n(Um)}}{1,414}\` = **${q(U, 'V')}**`,
    ]);
  },
  (rng) => {
    const f = pick(rng, [50, 60, 100, 400, 1000]);
    const w = 2 * Math.PI * f;
    return numeric('striedavy-prud', `Aká je uhlová frekvencia striedavého prúdu s frekvenciou ${q(f, 'Hz')}?`, w, 'rad/s', [
      `\`$ω = 2π$f\` = 2 · 3,1416 · ${n(f)} = **${b(w, 'rad/s', 4)}**`,
    ], { fixedUnit: true });
  },
];

// ---------------------------------------------------------------- Obvody RLC

function rlPair(rng: Rng): [number, number] {
  return [pick(rng, [30, 40, 60, 80, 100]), pick(rng, [40, 60, 80, 100, 150])];
}

const rlc: Generator[] = [
  (rng) => {
    let f = 50;
    let L = 0.1;
    for (let i = 0; i < 12; i++) {
      f = pick(rng, [50, 100, 1000, 10000]);
      L = pick(rng, [1, 10, 47, 100, 470]) / 1000;
      const x = 2 * Math.PI * f * L;
      if (x >= 1 && x <= 50000) break;
    }
    const XL = 2 * Math.PI * f * L;
    return numeric('obvody-rlc', `Aká je induktívna reaktancia cievky ${q(L, 'H')} pri frekvencii ${q(f, 'Hz')}?`, XL, 'Ω', [
      `\`$X_{L} = 2π$f$L\` = 2π · ${n(f)} · ${b(L, 'H')} = **${q(XL, 'Ω')}**`,
    ]);
  },
  (rng) => {
    let f = 50;
    let C = 1e-6;
    for (let i = 0; i < 12; i++) {
      f = pick(rng, [50, 100, 1000, 10000]);
      C = pick(rng, [10e-9, 100e-9, 1e-6, 10e-6, 100e-6]);
      const x = 1 / (2 * Math.PI * f * C);
      if (x >= 1 && x <= 500000) break;
    }
    const XC = 1 / (2 * Math.PI * f * C);
    return numeric('obvody-rlc', `Aká je kapacitná reaktancia kondenzátora ${q(C, 'F')} pri frekvencii ${q(f, 'Hz')}?`, XC, 'Ω', [
      `\`$X_{C} = @f{1}{2π$f$C} = @f{1}{2π · ${n(f)} · ${fmtSci(C)}}\` = **${q(XC, 'Ω')}**`,
    ]);
  },
  (rng) => {
    const [R, X] = rlPair(rng);
    const Z = Math.hypot(R, X);
    return numeric('obvody-rlc', `Cievka má činný odpor ${q(R, 'Ω')} a induktívnu reaktanciu ${q(X, 'Ω')}. Aká je jej impedancia?`, Z, 'Ω', [
      `\`$Z = @s{$R^{2} + $X_{L}^{2}} = @s{${n(R)}^{2} + ${n(X)}^{2}}\` = **${q(Z, 'Ω')}**`,
    ], { figure: () => impedanceTriangle(R, X, { r: 'R', x: 'X_L', z: 'Z' }, { r: q(R, 'Ω'), x: q(X, 'Ω'), z: '?' }) });
  },
  (rng) => {
    const L = pick(rng, [1, 10, 47, 100]) / 1000;
    const C = pick(rng, [10e-9, 47e-9, 100e-9, 1e-6]);
    const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
    return numeric('obvody-rlc', `Aká je rezonančná frekvencia obvodu s cievkou ${q(L, 'H')} a kondenzátorom ${q(C, 'F')}?`, f0, 'Hz', [
      `\`$f_{0} = @f{1}{2π@s{$L$C}} = @f{1}{2π@s{${fmtSci(L)} · ${fmtSci(C)}}}\` = **${q(f0, 'Hz')}**`,
    ]);
  },
  (rng) => {
    const [R, X] = rlPair(rng);
    const U = pick(rng, [12, 24, 230]);
    const Z = Math.hypot(R, X);
    const I = U / Z;
    return numeric('obvody-rlc', `Na sériový obvod s odporom ${q(R, 'Ω')} a induktívnou reaktanciou ${q(X, 'Ω')} je pripojené striedavé napätie ${q(U, 'V')}. Aký prúd tečie obvodom?`, I, 'A', [
      `\`$Z = @s{${n(R)}^{2} + ${n(X)}^{2}}\` = ${b(Z, 'Ω', 4)}`,
      `\`$I = @f{$U}{$Z} = @f{${n(U)}}{${n(Z, 4)}}\` = **${q(I, 'A')}**`,
    ]);
  },
  (rng) => {
    const [R, X] = rlPair(rng);
    const Z = Math.hypot(R, X);
    const cos = R / Z;
    return numeric('obvody-rlc', `Sériový obvod RL má odpor ${q(R, 'Ω')} a reaktanciu ${q(X, 'Ω')}. Aký je jeho účinník cos φ?`, cos, '', [
      `\`$Z = @s{${n(R)}^{2} + ${n(X)}^{2}}\` = ${b(Z, 'Ω', 4)}`,
      `\`cos $φ = @f{$R}{$Z} = @f{${n(R)}}{${n(Z, 4)}}\` = **${n(cos, 3)}**`,
    ], { fixedUnit: true });
  },
];

// ---------------------------------------------------------------- Farebný kód

function randomResistor(rng: Rng): { ohms: number; digits: number; exp: number } {
  const digits = Math.round(pick(rng, E12) * 10);
  const exp = pick(rng, [0, 1, 2, 3, 4]);
  return { ohms: digits * 10 ** exp, digits, exp };
}

const colors: Generator[] = [
  (rng) => {
    const { ohms, digits, exp } = randomResistor(rng);
    const ids = encodeBands(ohms, 4, 5)!.ids;
    return numeric('farebny-kod', `Rezistor má prúžky: ${bandNames(ids)}. Aký má odpor?`, ohms, 'Ω', [
      `1. a 2. prúžok: ${colorById(ids[0]).name} = ${colorById(ids[0]).digit}, ${colorById(ids[1]).name} = ${colorById(ids[1]).digit} → ${digits}`,
      `3. prúžok (násobiteľ): ${colorById(ids[2]).name} = 10${superscript(exp)}`,
      `\`$R\` = ${digits} · ${n(10 ** exp, 6)} Ω = **${q(ohms, 'Ω')}**, ${colorById(ids[3]).name} = ±5 %`,
    ], { figure: () => resistorBands(ids), tolerance: 0.005 });
  },
  (rng): ChoiceQuestion => {
    const { ohms, digits, exp } = randomResistor(rng);
    const ids = encodeBands(ohms, 4, 5)!.ids;
    const correct = bandNames(ids);
    const d1 = Math.floor(digits / 10);
    const d2 = digits % 10;
    const variants: number[] = [ohms * 10, ohms / 10, d2 !== 0 && d1 !== d2 ? (d2 * 10 + d1) * 10 ** exp : ((d1 % 9) + 1) * 10 ** (exp + 1) + d2 * 10 ** exp];
    const options = [correct];
    for (const v of variants) {
      const enc = encodeBands(v, 4, 5);
      if (enc && !options.includes(bandNames(enc.ids))) options.push(bandNames(enc.ids));
    }
    while (options.length < 4) {
      const enc = encodeBands(randomResistor(rng).ohms, 4, 5);
      if (enc && !options.includes(bandNames(enc.ids))) options.push(bandNames(enc.ids));
    }
    const order = shuffle(rng, [0, 1, 2, 3]);
    return {
      kind: 'choice',
      lessonId: 'farebny-kod',
      prompt: `Ktoré prúžky má rezistor ${q(ohms, 'Ω')} s toleranciou ±5 %?`,
      options: order.map((i) => options[i]),
      correct: order.indexOf(0),
      explanation: `${q(ohms, 'Ω')} = ${digits} · 10${superscript(exp)} Ω → ${correct}.`,
    };
  },
  (rng) => {
    const R = e12(rng, [100, 1000]);
    const tol = pick(rng, [1, 2, 5, 10]);
    const max = rng() < 0.5;
    const delta = (R * tol) / 100;
    const limit = max ? R + delta : R - delta;
    return numeric('farebny-kod', `Rezistor má menovitú hodnotu ${q(R, 'Ω')} a toleranciu ±${tol} %. Aká je jeho ${max ? 'najväčšia' : 'najmenšia'} možná skutočná hodnota?`, limit, 'Ω', [
      `${tol} % z ${q(R, 'Ω')} je ${q(delta, 'Ω')}.`,
      `${q(R, 'Ω')} ${max ? '+' : '−'} ${q(delta, 'Ω')} = **${q(limit, 'Ω', 4)}**`,
    ], { tolerance: 0.005 });
  },
];

// ---------------------------------------------------------------- Dióda a LED

const diodes: Generator[] = [
  (rng) => {
    const U = pick(rng, [5, 9, 12]);
    const led = pick(rng, [
      { c: 'červenú', uf: 2.0 }, { c: 'žltú', uf: 2.1 }, { c: 'zelenú', uf: 2.2 }, { c: 'modrú', uf: 3.2 }, { c: 'bielu', uf: 3.2 },
    ]);
    const IF = pick(rng, [10, 15, 20]) / 1000;
    const R = (U - led.uf) / IF;
    return numeric('polovodice', `Chceš pripojiť ${led.c} LED (\`$U_{F}\` = ${n(led.uf)} V) na zdroj ${q(U, 'V')}. Prúd LED má byť ${n(IF * 1000)} mA. Aký odpor musí mať predradný rezistor?`, R, 'Ω', [
      `\`$R = @f{$U − $U_{F}}{$I_{F}} = @f{${n(U)} − ${n(led.uf)}}{${b(IF, 'A')}}\` = **${q(R, 'Ω')}**`,
      `V praxi vyberieš najbližšiu vyššiu hodnotu z rady E12: ${q(nearestStandard(R, E12, 'up'), 'Ω')}.`,
    ], { figure: () => ledFigure({ source: { label: 'U', value: q(U, 'V') } }) });
  },
  (rng) => {
    const U = pick(rng, [5, 9, 12]);
    const R = pick(rng, [220, 330, 470, 1000]);
    const I = (U - 0.7) / R;
    return numeric('polovodice', `Kremíková dióda (\`$U_{F}\` ≈ 0,7 V) je v priepustnom smere zapojená v sérii s rezistorom ${q(R, 'Ω')} na zdroj ${q(U, 'V')}. Aký prúd tečie obvodom?`, I, 'A', [
      `Na rezistore zostane napätie ${n(U)} − 0,7 = ${n(U - 0.7)} V.`,
      `\`$I = @f{${n(U - 0.7)} V}{${n(R)} Ω}\` = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [5, 9, 12, 24]);
    const UF = pick(rng, [2, 3.2]);
    const IF = pick(rng, [10, 20]) / 1000;
    const P = (U - UF) * IF;
    return numeric('polovodice', `LED s napätím ${n(UF)} V je cez predradný rezistor pripojená na ${q(U, 'V')} a tečie ňou ${n(IF * 1000)} mA. Aký výkon sa mení na teplo v rezistore?`, P, 'W', [
      `Napätie na rezistore: ${n(U)} − ${n(UF)} = ${n(U - UF)} V.`,
      `\`$P = $U_{R} · $I\` = ${n(U - UF)} V · ${b(IF, 'A')} = ${res(P, 'W')}`,
    ]);
  },
];

export const GENERATORS: Record<string, Generator[]> = {
  ...Object.fromEntries(MODULES.map((m) => [m.lesson.id, m.generators])),
  zaklady,
  'ohmov-zakon': ohm,
  'odpor-vodica': wire,
  'spajanie-rezistorov': combine,
  'kirchhoffove-zakony': kirchhoff,
  zdroj: source,
  'vykon-a-praca': power,
  kondenzator: capacitor,
  'magnetizmus-cievka': magnet,
  'striedavy-prud': ac,
  'obvody-rlc': rlc,
  'farebny-kod': colors,
  polovodice: diodes,
};
