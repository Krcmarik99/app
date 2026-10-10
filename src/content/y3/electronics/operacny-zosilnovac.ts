import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import {
  annotatedChart, comparatorFigure, followerFigure, invertingFigure, nonInvertingFigure, opampSymbolFigure, summingFigure,
} from '../../../ui/fig-electronics';
import { choice } from '../util';

const ID = 'operacny-zosilnovac';

/** Napätie so znamienkom „−“ (U+2212) alebo „+“. */
const sv = (x: number, sig = 3) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${n(Math.abs(x), sig)} V`;

const USAT = 13;

function opampExplorer(): HTMLElement {
  return explorer({
    title: 'Zosilňovač s operačným zosilňovačom a saturácia',
    params: [
      { key: 'ratio', label: 'Pomer `@f{$R_{2}}{$R_{1}}`', unit: '', min: 0.5, max: 20, value: 4.7, log: true, format: (v) => fmt(v, 3) },
      { key: 'u1', label: 'Amplitúda vstupu `$U_{1m}`', unit: 'V', min: 0.1, max: 5, value: 1, log: true, format: (v) => `${fmt(v, 3)} V` },
    ],
    choices: [{ key: 'kind', label: 'Zapojenie', options: [['inv', 'invertujúci'], ['non', 'neinvertujúci']], value: 'inv' }],
    draw: ({ ratio, u1 }, { kind }) => {
      const Au = kind === 'inv' ? -ratio : 1 + ratio;
      const w = 2 * Math.PI;
      const uin = (ms: number) => u1 * Math.sin(w * ms);
      const uout = (ms: number) => Math.max(-USAT, Math.min(USAT, Au * uin(ms)));
      const ideal = Math.abs(Au) * u1;
      const clipped = ideal > USAT;
      const chart = annotatedChart({
        ariaLabel: `${kind === 'inv' ? 'Invertujúci' : 'Neinvertujúci'} zosilňovač so zosilnením ${fmt(Au, 3)}: vstupné a výstupné napätie`,
        width: 460,
        height: 260,
        x: { min: 0, max: 2, ticks: [0, 0.5, 1, 1.5, 2], format: (v) => fmt(v, 2), label: 't [ms]' },
        y: { min: -16, max: 16, ticks: [-15, -10, -5, 0, 5, 10, 15], format: (v) => (v < 0 ? `−${-v}` : `${v}`), label: 'u [V]' },
        series: [
          { points: sample(uin, 0, 2, 200), className: 'thin' },
          { points: sample(uout, 0, 2, 400), className: 'copper' },
        ],
        hlines: [{ y: USAT, label: '' }, { y: -USAT, label: '' }],
        legend: [{ label: 'u1 – vstup', className: 'thin' }, { label: 'u2 – výstup', className: 'copper' }],
      }, [
        { x: 1.98, y: USAT + 0.8, text: '+Usat', anchor: 'end', cls: 'el-copper' },
        { x: 1.98, y: -USAT - 2.2, text: '−Usat', anchor: 'end', cls: 'el-copper' },
      ]);
      return {
        chart,
        readouts: [
          ['Zosilnenie `$A_{u}`', fmt(Au, 3).replace('-', '−')],
          ['Amplitúda výstupu podľa vzorca', `${fmt(ideal, 3)} V`],
          ['Skutočná amplitúda', `${fmt(Math.min(ideal, USAT), 3)} V`],
          ['Orezanie', clipped ? 'áno' : 'nie'],
        ],
        note: clipped
          ? `Výstup by mal mať amplitúdu ${fmt(ideal, 3)} V, ale nemôže prekročiť saturačné napätie ±13 V (napájanie ±15 V). Vrcholy sú orezané – signál je skreslený.`
          : kind === 'inv'
            ? 'Invertujúci zosilňovač otáča fázu o 180°: kladná polvlna vstupu dáva zápornú polvlnu výstupu.'
            : 'Neinvertujúci zosilňovač zachová fázu, jeho zosilnenie je vždy aspoň 1.',
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    let R1 = 10e3;
    let R2 = 47e3;
    let U1 = 0.5;
    for (let i = 0; i < 40; i++) {
      R1 = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3, 22e3]);
      R2 = pick(rng, [10e3, 22e3, 33e3, 47e3, 68e3, 100e3]);
      U1 = pick(rng, [0.1, 0.2, 0.25, 0.3, 0.5, 0.8, 1, 1.5]);
      if ((R2 / R1) * U1 <= 12 && R2 > R1) break;
    }
    const U2 = (R2 / R1) * U1;
    return numeric(ID, `Invertujúci zosilňovač má \`$R_{1}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = ${q(R2, 'Ω')}. Na vstup privedieš jednosmerné napätie ${q(U1, 'V')}. Aká je veľkosť výstupného napätia? (Výstup je záporný, napájanie ±15 V.)`, U2, 'V', [
      `\`$A_{u} = −@f{$R_{2}}{$R_{1}} = −@f{${n(R2)}}{${n(R1)}}\` = −${n(R2 / R1, 4)}`,
      `\`$U_{2} = $A_{u} · $U_{1}\` = −${n(R2 / R1, 4)} · ${n(U1)} = −${n(U2, 4)} V, veľkosť **${q(U2, 'V')}**`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3]);
    const R2 = pick(rng, [4.7e3, 10e3, 22e3, 33e3, 47e3, 100e3]);
    const Au = 1 + R2 / R1;
    return numeric(ID, `Neinvertujúci zosilňovač má v spätnej väzbe \`$R_{2}\` = ${q(R2, 'Ω')} a z invertujúceho vstupu na zem \`$R_{1}\` = ${q(R1, 'Ω')}. Aké je jeho napäťové zosilnenie?`, Au, '', [
      `\`$A_{u} = 1 + @f{$R_{2}}{$R_{1}} = 1 + @f{${n(R2)}}{${n(R1)}}\` = **${n(Au, 4)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const inv = rng() < 0.5;
    const A = pick(rng, inv ? [2, 3, 4.7, 5, 10, 22, 47] : [2, 3, 5, 11, 21, 48]);
    const R1 = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3]);
    const R2 = inv ? A * R1 : (A - 1) * R1;
    return numeric(ID, inv
      ? `Navrhni invertujúci zosilňovač so zosilnením \`$A_{u}\` = −${n(A)}. Vstupný rezistor je \`$R_{1}\` = ${q(R1, 'Ω')}. Aký odpor musí mať rezistor \`$R_{2}\` v spätnej väzbe?`
      : `Navrhni neinvertujúci zosilňovač so zosilnením \`$A_{u}\` = ${n(A)}. Rezistor z invertujúceho vstupu na zem je \`$R_{1}\` = ${q(R1, 'Ω')}. Aký odpor musí mať rezistor \`$R_{2}\` v spätnej väzbe?`, R2, 'Ω', inv
      ? [
        'Z `$A_{u} = −@f{$R_{2}}{$R_{1}}` vyjadríš `$R_{2} = |$A_{u}| · $R_{1}`.',
        `\`$R_{2}\` = ${n(A)} · ${n(R1)} = ${res(R2, 'Ω')}`,
      ]
      : [
        'Z `$A_{u} = 1 + @f{$R_{2}}{$R_{1}}` vyjadríš `$R_{2} = ($A_{u} − 1) · $R_{1}`.',
        `\`$R_{2}\` = (${n(A)} − 1) · ${n(R1)} = ${res(R2, 'Ω')}`,
      ]);
  },
  (rng) => {
    let Ra = 10e3;
    let Rb = 10e3;
    let R2 = 10e3;
    let Ua = 1;
    let Ub = 0.5;
    let U2 = 0;
    for (let i = 0; i < 40; i++) {
      Ra = pick(rng, [10e3, 20e3, 47e3]);
      Rb = pick(rng, [10e3, 20e3, 47e3]);
      R2 = pick(rng, [10e3, 20e3, 47e3, 100e3]);
      Ua = pick(rng, [0.2, 0.5, 1, 1.5, 2]);
      Ub = pick(rng, [0.3, 0.5, 0.8, 1, 2.5]);
      U2 = R2 * (Ua / Ra + Ub / Rb);
      if (U2 <= 12) break;
    }
    return numeric(ID, `Sčítací zosilňovač má vstupné rezistory \`$R_{a}\` = ${q(Ra, 'Ω')}, \`$R_{b}\` = ${q(Rb, 'Ω')} a v spätnej väzbe \`$R_{2}\` = ${q(R2, 'Ω')}. Na vstupy privedieš \`$U_{a}\` = ${q(Ua, 'V')} a \`$U_{b}\` = ${q(Ub, 'V')}. Aká je veľkosť výstupného napätia?`, U2, 'V', [
      '`$U_{2} = −$R_{2} · (@f{$U_{a}}{$R_{a}} + @f{$U_{b}}{$R_{b}})`',
      `\`$U_{2}\` = −${n(R2)} · (${n(Ua)}/${n(Ra)} + ${n(Ub)}/${n(Rb)}) = −${n(U2, 4)} V, veľkosť **${q(U2, 'V')}**`,
    ]);
  },
  (rng) => {
    const [R1, R2] = pick(rng, [[10e3, 10e3], [10e3, 22e3], [10e3, 47e3], [10e3, 100e3], [22e3, 47e3], [4.7e3, 47e3]] as const);
    const k = R2 / R1;
    const Ua = pick(rng, [0.2, 0.5, 1, 1.2, 2]);
    const Ub = Ua + pick(rng, [0.1, 0.2, 0.3, 0.5, 1]);
    const U2 = k * (Ub - Ua);
    return numeric(ID, `Rozdielový zosilňovač má \`$R_{1}\` = \`$R_{3}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = \`$R_{4}\` = ${q(R2, 'Ω')}. Na invertujúci vstup privedieš \`$U_{a}\` = ${q(Ua, 'V')}, na neinvertujúci \`$U_{b}\` = ${q(Ub, 'V')}. Aké je výstupné napätie?`, U2, 'V', [
      '`$U_{2} = @f{$R_{2}}{$R_{1}} · ($U_{b} − $U_{a})`',
      `\`$U_{2}\` = ${n(k, 3)} · (${n(Ub, 3)} − ${n(Ua)}) = ${res(U2, 'V')}`,
    ]);
  },
  (rng) => {
    const [R1, R2] = pick(rng, [[1e3, 2.2e3], [1e3, 4.7e3], [1e3, 10e3], [4.7e3, 47e3], [10e3, 47e3], [10e3, 100e3], [10e3, 220e3], [4.7e3, 100e3]] as const);
    const k = R2 / R1;
    const U1 = pick(rng, [0.2, 0.5, 1, 2]);
    const ideal = -k * U1;
    const sat = '≈ −13 V – výstup je v saturácii';
    const options: [string, string, string, string] = Math.abs(ideal) > USAT
      ? [sat, sv(ideal), sv(-ideal), '0 V']
      : [sv(ideal), sv(-ideal), sat, sv(-(1 + k) * U1)];
    return choice(ID, `Invertujúci zosilňovač s \`$R_{1}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = ${q(R2, 'Ω')} je napájaný napätím ±15 V (saturačné napätie asi ±13 V). Na vstupe je jednosmerné napätie ${q(U1, 'V')}. Aké napätie bude na výstupe?`,
      options,
      Math.abs(ideal) > USAT
        ? `Podľa vzorca by výstup mal byť \`−@f{$R_{2}}{$R_{1}} · $U_{1}\` = ${sv(ideal)}, ale výstup operačného zosilňovača nemôže prekročiť saturačné napätie. Zostane asi na −13 V.`
        : `\`$U_{2} = −@f{$R_{2}}{$R_{1}} · $U_{1}\` = −${n(k, 3)} · ${n(U1)} = ${sv(ideal)}. Hodnota je menšia ako saturačné napätie, zosilňovač pracuje lineárne.`,
      rng);
  },
  (rng) => {
    const up = pick(rng, [0.5, 1.2, 2, 2.5, 3.3, 4]);
    const um = pick(rng, [0.8, 1.5, 2.2, 2.7, 3, 3.6].filter((x) => Math.abs(x - up) > 0.15));
    const pos = up > um;
    const plus = 'kladné saturačné napätie, asi +13 V';
    const minus = 'záporné saturačné napätie, asi −13 V';
    return choice(ID, `Operačný zosilňovač bez spätnej väzby pracuje ako komparátor, napájanie je ±15 V. Na neinvertujúcom vstupe (+) je ${q(up, 'V')}, na invertujúcom (−) ${q(um, 'V')}. Aké napätie je na výstupe?`,
      [pos ? plus : minus, pos ? minus : plus, '0 V', sv(up - um, 2)],
      `Bez spätnej väzby stačí nepatrný rozdiel napätí a výstup sa dostane do saturácie. Kladnejší je ${pos ? 'neinvertujúci' : 'invertujúci'} vstup, preto je výstup ${pos ? 'v kladnej' : 'v zápornej'} saturácii.`,
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'electronics',
    title: 'Operačný zosilňovač',
    summary: 'Ideálny operačný zosilňovač, záporná spätná väzba, invertujúci a neinvertujúci zosilňovač, sledovač, sumátor, rozdielový zosilňovač a komparátor.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Operačný zosilňovač (OZ) je integrovaný jednosmerne viazaný zosilňovač s **rozdielovým vstupom** a veľmi veľkým zosilnením (napríklad μA741, LM358, TL071). Sám o sebe by bol nepoužiteľne citlivý – jeho vlastnosti v zapojení určujú vonkajšie rezistory v **spätnej väzbe**. Preto sa z jednej súčiastky dá postaviť zosilňovač, sčítačka, komparátor, filter aj oscilátor.' },
      { t: 'figure', fig: opampSymbolFigure, caption: 'Značka operačného zosilňovača: invertujúci vstup (−), neinvertujúci vstup (+), výstup a symetrické napájanie ±`$U_{CC}` (napríklad ±15 V). Napájacie vývody sa v schémach často nekreslia. Výstupné napätie je `$U_{2} = $A_{0} · $U_{d}`, kde `$U_{d} = $U_{+} − $U_{−}` je rozdielové napätie a `$A_{0}` zosilnenie naprázdno.' },
      {
        t: 'table',
        head: ['Vlastnosť', 'Ideálny OZ', 'Skutočný OZ'],
        rows: [
          ['zosilnenie naprázdno `$A_{0}`', '∞', '10⁵ až 10⁶ (100 až 120 dB)'],
          ['vstupný odpor', '∞', 'MΩ, so vstupmi FET až TΩ'],
          ['výstupný odpor', '0', 'desiatky Ω'],
          ['prúd do vstupov', '0', 'nA až pA'],
          ['výstupné napätie', 'ľubovoľné', 'najviac asi ±(`$U_{CC}` − 1,5 V) – saturácia'],
        ],
      },
      { t: 'h', text: 'Záporná spätná väzba' },
      { t: 'p', text: 'Pri zápornej spätnej väzbe sa časť výstupného napätia privádza späť na **invertujúci** vstup. Keď výstup stúpne priveľmi, spätná väzba zmenší rozdielové napätie a výstup sa vráti. Pretože `$A_{0}` je obrovské, na výstupné napätie niekoľko voltov stačí rozdielové napätie len niekoľko mikrovoltov – prakticky nula.' },
      { t: 'note', kind: 'remember', text: 'Dve pravidlá pre OZ so zápornou spätnou väzbou (pokiaľ nie je v saturácii): **1.** napätie medzi vstupmi je nulové, `$U_{+} = $U_{−}` (virtuálny skrat); **2.** do vstupov netečie prúd. Z nich sa odvodia vzorce všetkých zapojení.' },
      { t: 'h', text: 'Invertujúci zosilňovač' },
      { t: 'figure', fig: invertingFigure, caption: 'Invertujúci zosilňovač: neinvertujúci vstup je na zemi, preto je aj invertujúci vstup prakticky na nulovom potenciáli (virtuálna nula).' },
      { t: 'p', text: 'Na invertujúcom vstupe je 0 V, takže rezistorom `$R_{1}` tečie prúd `$I = @f{$U_{1}}{$R_{1}}`. Do vstupu netečie, celý pokračuje cez `$R_{2}` a vytvorí na ňom napätie `$R_{2} · $I` – výstup je preto `$U_{2} = −$R_{2} · $I`. Vstupný odpor zapojenia je `$R_{1}`.' },
      { t: 'formula', tex: ['$A_{u} = @f{$U_{2}}{$U_{1}} = −@f{$R_{2}}{$R_{1}}', '$R_{vst} = $R_{1}'], legend: [['$A_{u}', 'napäťové zosilnenie; znamienko mínus = otočenie fázy o 180°', '–'], ['$R_{vst}', 'vstupný odpor zapojenia', 'Ω']] },
      {
        t: 'example',
        title: 'Invertujúci zosilňovač',
        given: ['`$R_{1}` = 10 kΩ', '`$R_{2}` = 47 kΩ', '`$U_{1}` = 0,5 V'],
        steps: [
          '`$A_{u} = −@f{47}{10}` = −4,7',
          '`$U_{2} = $A_{u} · $U_{1}` = −4,7 · 0,5 = −2,35 V',
          'Prúd rezistormi: `$I = @f{0,5 V}{10 kΩ}` = 50 µA, na `$R_{2}` je 47 kΩ · 50 µA = 2,35 V',
        ],
        result: '`$A_{u}` = −4,7, `$U_{2}` = −2,35 V',
      },
      { t: 'h', text: 'Neinvertujúci zosilňovač a sledovač' },
      { t: 'figure', fig: nonInvertingFigure, caption: 'Neinvertujúci zosilňovač: signál ide priamo na neinvertujúci vstup, delič `$R_{2}`, `$R_{1}` vracia časť výstupu na invertujúci vstup.' },
      { t: 'formula', tex: '$A_{u} = 1 + @f{$R_{2}}{$R_{1}}', legend: [['$A_{u}', 'zosilnenie – kladné (fáza sa nemení), vždy aspoň 1', '–']] },
      { t: 'figure', fig: followerFigure, caption: 'Napäťový sledovač (`$R_{2}` = 0, `$R_{1}` = ∞): `$A_{u}` = 1. Má obrovský vstupný a malý výstupný odpor – oddelí citlivý zdroj signálu od záťaže (impedančný prevodník).' },
      { t: 'explore', build: opampExplorer, caption: 'Zväčšuj pomer `$R_{2}/$R_{1}` alebo amplitúdu vstupu: kým výstup nedosiahne saturačné napätie, je presnou zväčšenou kópiou vstupu. Potom sa vrcholy orežú.' },
      { t: 'h', text: 'Sčítací a rozdielový zosilňovač' },
      { t: 'figure', fig: summingFigure, caption: 'Sčítací (sumačný) zosilňovač: prúdy zo vstupov sa v uzle na invertujúcom vstupe sčítajú a spolu tečú cez `$R_{2}`.' },
      {
        t: 'formula',
        tex: ['$U_{2} = −$R_{2} · (@f{$U_{a}}{$R_{a}} + @f{$U_{b}}{$R_{b}})', '$U_{2} = @f{$R_{2}}{$R_{1}} · ($U_{b} − $U_{a})'],
        legend: [['$U_{a}, $U_{b}', 'vstupné napätia', 'V'], ['$R_{a}, $R_{b}', 'vstupné rezistory sčítacieho zosilňovača', 'Ω'], ['$R_{1}, $R_{2}', 'rezistory rozdielového zosilňovača (`$R_{3} = $R_{1}`, `$R_{4} = $R_{2}`)', 'Ω']],
      },
      { t: 'p', text: 'Pri rovnakých rezistoroch sčítací zosilňovač dáva `$U_{2} = −($U_{a} + $U_{b})` – používa sa napríklad v mixážnom pulte. **Rozdielový zosilňovač** má dva rezistory na invertujúcom vstupe ako invertujúci zosilňovač a ďalšie dva ako delič na neinvertujúcom vstupe; zosilňuje len rozdiel napätí a potláča napätie spoločné obom vstupom (napríklad rušenie na meracom vedení).' },
      {
        t: 'example',
        title: 'Sčítací zosilňovač s rôznymi váhami',
        given: ['`$R_{a}` = 10 kΩ, `$U_{a}` = 0,5 V', '`$R_{b}` = 20 kΩ, `$U_{b}` = 1,2 V', '`$R_{2}` = 20 kΩ'],
        steps: [
          'Vstup a má váhu `@f{$R_{2}}{$R_{a}}` = 2, vstup b váhu `@f{$R_{2}}{$R_{b}}` = 1.',
          '`$U_{2}` = −(2 · 0,5 + 1 · 1,2) = −(1 + 1,2) = −2,2 V',
        ],
        result: '`$U_{2}` = −2,2 V',
      },
      { t: 'h', text: 'Komparátor a saturácia' },
      { t: 'figure', fig: comparatorFigure, caption: 'Komparátor: OZ bez spätnej väzby porovnáva vstupné napätie `$U_{1}` s referenčným `$U_{ref}`.' },
      { t: 'p', text: 'Bez spätnej väzby zosilní OZ aj nepatrný rozdiel napätí `$A_{0}`-krát, a tak je výstup vždy v **saturácii**: ak je `$U_{+} > $U_{−}`, výstup je na kladnom saturačnom napätí, ak `$U_{+} < $U_{−}`, na zápornom. Komparátor tak rozhodne, či je napätie väčšie alebo menšie ako referencia – napríklad v súmrakovom spínači alebo v termostate.' },
      { t: 'note', kind: 'warn', text: 'Výstup OZ **nemôže prekročiť napájacie napätie**. Bežné OZ dosiahnu asi o 1 až 2 V menej, typy rail-to-rail takmer celé napájacie napätie. Ak výpočet dá napríklad −20 V pri napájaní ±15 V, výstup zostane v saturácii asi na −13 V a signál sa skreslí.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aký vstupný odpor a zosilnenie naprázdno má ideálny operačný zosilňovač?',
      options: ['nekonečný vstupný odpor aj nekonečné zosilnenie', 'nulový vstupný odpor a nekonečné zosilnenie', 'nekonečný vstupný odpor a zosilnenie 1', 'nulový vstupný odpor a nulové zosilnenie'],
      explanation: 'Ideálny OZ nezaťažuje zdroj signálu (do vstupov netečie prúd) a má nekonečné zosilnenie naprázdno. Výstupný odpor je nulový.',
    },
    {
      lessonId: ID,
      prompt: 'Invertujúci zosilňovač má `$R_{1}` = 2,2 kΩ a `$R_{2}` = 22 kΩ. Aké je jeho zosilnenie?',
      options: ['−10', '11', '10', '−11'],
      explanation: '`$A_{u} = −@f{$R_{2}}{$R_{1}} = −@f{22}{2,2}` = −10. Hodnota 11 by platila pre neinvertujúce zapojenie (1 + 10).',
    },
    {
      lessonId: ID,
      prompt: 'Neinvertujúci zosilňovač má `$R_{1}` = 10 kΩ a `$R_{2}` = 47 kΩ. Aké je jeho zosilnenie?',
      options: ['5,7', '4,7', '−4,7', '0,21'],
      explanation: '`$A_{u} = 1 + @f{47}{10}` = 5,7. Neinvertujúci zosilňovač má zosilnenie vždy aspoň 1 a nemení fázu.',
    },
    {
      lessonId: ID,
      prompt: 'Na čo sa používa napäťový sledovač so zosilnením 1?',
      options: ['na oddelenie zdroja s veľkým vnútorným odporom od záťaže', 'na zväčšenie napätia na dvojnásobok', 'na otočenie fázy o 180°', 'na usmernenie striedavého napätia'],
      explanation: 'Sledovač má obrovský vstupný a malý výstupný odpor. Zdroj signálu nezaťaží a záťaž môže napájať väčším prúdom – je to impedančný prevodník.',
    },
    {
      lessonId: ID,
      prompt: 'Čo platí pre napätie medzi vstupmi OZ so zápornou spätnou väzbou, ktorý nie je v saturácii?',
      options: ['je prakticky nulové (virtuálny skrat)', 'rovná sa výstupnému napätiu', 'rovná sa napájaciemu napätiu', 'je vždy 0,7 V'],
      explanation: 'Výstup je `$A_{0}`-násobkom rozdielového napätia. Pri obrovskom `$A_{0}` stačia mikrovolty – spätná väzba udržiava vstupy na rovnakom potenciáli.',
    },
    {
      lessonId: ID,
      prompt: 'Operačný zosilňovač napájaný ±12 V má podľa výpočtu dať na výstupe +18 V. Čo sa stane?',
      options: ['výstup sa obmedzí na kladné saturačné napätie, asi +10,5 V', 'na výstupe bude +18 V', 'výstup sa prepne na −18 V', 'zosilňovač sa zničí'],
      explanation: 'Výstupné napätie nemôže prekročiť napájacie napätie. Bežný OZ dosiahne asi o 1 až 2 V menej ako napájanie a vrcholy signálu sa orežú.',
    },
    {
      lessonId: ID,
      prompt: 'Čím sa líši komparátor od zosilňovača s operačným zosilňovačom?',
      options: ['nemá spätnú väzbu, výstup je vždy v kladnej alebo zápornej saturácii', 'má zápornú spätnú väzbu cez rezistor', 'má zosilnenie presne 1', 'na vstupe má vždy kondenzátor'],
      explanation: 'Bez spätnej väzby sa využíva celé zosilnenie naprázdno – výstup sa preklopí do saturácie podľa toho, ktorý vstup je kladnejší.',
    },
  ],
  generators,
};

export default mod;
