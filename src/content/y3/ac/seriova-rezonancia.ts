import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, fmtSci, formatSI } from '../../../lib/units';
import { e12, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { logAxis, niceScale, phasorDiagram, reactanceChart } from '../../../ui/fig-ac';
import { rlcFigure } from '../../../ui/figures';
import { choice } from '../util';

const ID = 'seriova-rezonancia';
const TWO_PI = 2 * Math.PI;

const f0Of = (L: number, C: number) => 1 / (TWO_PI * Math.sqrt(L * C));

/** Body rezonančnej krivky: rovnomerne v logaritme frekvencie a husto okolo f0, aby sa nestratil vrchol. */
function curvePoints(fn: (f: number) => number, e0: number, e1: number, f0: number, Q: number): [number, number][] {
  const fs: number[] = [];
  for (let i = 0; i <= 480; i++) fs.push(10 ** (e0 + ((e1 - e0) * i) / 480));
  for (let t = -6; t <= 6; t += 0.1) fs.push(f0 * (1 + t / (2 * Q)));
  return fs
    .filter((f) => f > 0 && Math.log10(f) >= e0 && Math.log10(f) <= e1)
    .sort((a, b) => a - b)
    .map((f) => [Math.log10(f), fn(f)]);
}

/** Rezonančná krivka I(f) sériového obvodu RLC pri napätí zdroja 1 V. */
function resonanceExplorer(): HTMLElement {
  const U = 1;
  return explorer({
    title: 'Rezonančná krivka sériového obvodu RLC',
    params: [
      { key: 'L', label: 'Indukčnosť `$L`', unit: 'H', min: 1e-3, max: 0.1, value: 0.01, log: true },
      { key: 'C', label: 'Kapacita `$C`', unit: 'F', min: 1e-8, max: 1e-5, value: 1e-6, log: true },
      { key: 'R', label: 'Odpor `$R`', unit: 'Ω', min: 1, max: 1000, value: 10, log: true },
    ],
    draw: ({ L, C, R }) => {
      const f0 = f0Of(L, C);
      const Z0 = Math.sqrt(L / C);
      const Q = Z0 / R;
      const I0 = U / R;
      const inAmps = I0 >= 1;
      const k = inAmps ? 1 : 1000;
      const scale = niceScale(I0 * k * 1.08);
      const current = (f: number) => (U / Math.hypot(R, TWO_PI * f * L - 1 / (TWO_PI * f * C))) * k;
      const chart = lineChart({
        ariaLabel: `Prúd sériového obvodu v závislosti od frekvencie, rezonancia pri ${formatSI(f0, 'Hz')}`,
        width: 460,
        height: 250,
        x: logAxis(2, 5, 'Hz', 'f (logaritmicky)'),
        y: { min: 0, max: scale.max, ticks: scale.ticks, format: (v) => fmt(v, 3), label: inAmps ? 'I [A]' : 'I [mA]' },
        series: [{ points: curvePoints(current, 2, 5, f0, Q) }],
        hlines: [{ y: 0.707 * I0 * k, label: '0,707 · I₀' }],
        vlines: f0 >= 100 && f0 <= 1e5 ? [{ x: Math.log10(f0), label: 'f₀' }] : [],
      });
      return {
        chart,
        readouts: [
          ['Rezonančná frekvencia `$f_{0}`', formatSI(f0, 'Hz', 4)],
          ['Činiteľ akosti `$Q`', fmt(Q, 3)],
          ['Šírka pásma `$B`', formatSI(f0 / Q, 'Hz', 3)],
          ['Prúd pri rezonancii `$I_{0}`', formatSI(I0, 'A', 3)],
          ['Napätie na cievke `$U_{L0}`', formatSI(Q * U, 'V', 3)],
        ],
        note: Q > 5
          ? `Zdroj má napätie 1 V, ale na cievke aj na kondenzátore je pri rezonancii ${fmt(Q, 3)} V – ${fmt(Q, 3)}-krát viac. Zmenši odpor a krivka bude užšia a vyššia.`
          : Q < 0.5
            ? 'Pri veľkom odpore je činiteľ akosti malý: krivka je plochá a obvod frekvencie takmer nerozlišuje.'
            : 'Zdroj má napätie 1 V. Skús zmenšiť odpor `$R` – krivka sa zúži a vrchol stúpne.',
      };
    },
  });
}

const atResonance = () => phasorDiagram([
  { x: 7, y: 0, label: 'U_R', cls: 'ink' },
  { x: 3.6, y: 0, label: 'I', cls: 'trace' },
  { x: 0, y: 5, label: 'U_L', cls: 'copper' },
  { x: 0, y: -5, label: 'U_C', cls: 'good' },
], 'Fázorový diagram pri rezonancii: napätia na cievke a kondenzátore sú rovnako veľké a opačné, U = U_R');

const aboveResonance = () => phasorDiagram([
  { x: 7, y: 0, label: 'U_R', cls: 'ink' },
  { x: 3.6, y: 0, label: 'I', cls: 'trace' },
  { x: 0, y: 6.5, label: 'U_L', cls: 'copper' },
  { x: 0, y: -2.5, label: 'U_C', cls: 'good' },
  { x: 7, y: 4, label: 'U', cls: 'ink' },
  { x: 7, y: 4, label: '', cls: 'copper', from: [7, 0], dashed: true },
], 'Fázorový diagram nad rezonanciou: prevláda napätie na cievke a prúd zaostáva za napätím U');

const generators: Generator[] = [
  (rng) => {
    const L = e12(rng, [1e-4, 1e-3, 1e-2]);
    const C = e12(rng, [1e-9, 1e-8, 1e-7]);
    const f0 = f0Of(L, C);
    return numeric(ID, `Sériový obvod má cievku s indukčnosťou ${q(L, 'H')} a kondenzátor s kapacitou ${q(C, 'F')}. Na akej frekvencii nastane rezonancia?`, f0, 'Hz', [
      '`$f_{0} = @f{1}{2π@s{$L · $C}}` (Thomsonov vzťah)',
      `\`$L · $C\` = ${fmtSci(L)} · ${fmtSci(C)} = ${fmtSci(L * C)} s²`,
      `\`$f_{0} = @f{1}{2π · @s{${fmtSci(L * C)}}}\` = ${res(f0, 'Hz')}`,
    ]);
  },
  (rng) => {
    const L = e12(rng, [1e-5, 1e-4]);
    const f0 = pick(rng, [455e3, 535e3, 800e3, 1e6, 1.2e6, 1.6e6]);
    const C = 1 / (TWO_PI * f0) ** 2 / L;
    return numeric(ID, `Ladený obvod rádiového prijímača má cievku ${q(L, 'H')}. Akú kapacitu musí mať kondenzátor, aby bol obvod naladený na ${q(f0, 'Hz')}?`, C, 'F', [
      'Z Thomsonovho vzťahu vyjadríme kapacitu: `$C = @f{1}{(2π$f_{0})^{2} · $L}`',
      `\`$ω_{0} = 2π$f_{0}\` = ${fmtSci(TWO_PI * f0, 4)} rad/s`,
      `\`$C = @f{1}{(${fmtSci(TWO_PI * f0, 4)})^{2} · ${fmtSci(L)}}\` = ${res(C, 'F')}`,
    ]);
  },
  (rng) => {
    const L = e12(rng, [1e-3, 1e-2]);
    const C = e12(rng, [1e-8, 1e-7]);
    const Z0 = Math.sqrt(L / C);
    const R = Number((Z0 / pick(rng, [4, 6, 10, 15, 25, 40])).toPrecision(2));
    const Q = Z0 / R;
    return numeric(ID, `Sériový rezonančný obvod tvorí cievka ${q(L, 'H')}, kondenzátor ${q(C, 'F')} a celkový odpor ${q(R, 'Ω')}. Aký je činiteľ akosti obvodu?`, Q, '', [
      'Pri rezonancii sa reaktancia cievky rovná charakteristickej impedancii `$Z_{0} = @s{@f{$L}{$C}}`.',
      `\`$Z_{0} = @s{@f{${fmtSci(L)}}{${fmtSci(C)}}}\` = ${n(Z0, 4)} Ω`,
      `\`$Q = @f{$Z_{0}}{$R} = @f{${n(Z0, 4)}}{${n(R)}}\` = **${n(Q, 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const f0 = pick(rng, [1e3, 2.5e3, 5e3, 10e3, 50e3, 100e3, 455e3]);
    const Q = pick(rng, [5, 8, 10, 20, 25, 40, 50, 80]);
    const B = f0 / Q;
    return numeric(ID, `Rezonančná frekvencia sériového obvodu je ${q(f0, 'Hz')} a jeho činiteľ akosti ${n(Q)}. Aká je šírka pásma?`, B, 'Hz', [
      'Šírka pásma je rozdiel frekvencií, pri ktorých prúd klesne na 0,707-násobok prúdu pri rezonancii: `$B = $f_{2} − $f_{1} = @f{$f_{0}}{$Q}`.',
      `\`$B = @f{${n(f0)}}{${n(Q)}}\` = ${res(B, 'Hz')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [0.5, 1, 2, 5, 10, 12]);
    const Q = pick(rng, [8, 10, 15, 20, 30, 50]);
    const UL = U * Q;
    return numeric(ID, `Sériový obvod RLC s činiteľom akosti ${n(Q)} je pripojený na zdroj ${q(U, 'V')} s rezonančnou frekvenciou. Aké napätie je na kondenzátore?`, UL, 'V', [
      'Pri rezonancii je napätie na cievke aj na kondenzátore `$Q`-krát väčšie ako napätie zdroja (napäťová rezonancia).',
      `\`$U_{C0} = $Q · $U\` = ${n(Q)} · ${n(U)} = ${res(UL, 'V')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [5, 10, 12, 24, 50]);
    const R = pick(rng, [4.7, 10, 22, 47, 100]);
    const L = e12(rng, [1e-3, 1e-2]);
    return numeric(ID, `Sériový obvod s odporom ${q(R, 'Ω')} a cievkou ${q(L, 'H')} je pripojený na zdroj ${q(U, 'V')}, ktorého frekvencia sa rovná rezonančnej frekvencii obvodu. Aký prúd tečie obvodom?`, U / R, 'A', [
      'Pri rezonancii sa reaktancie cievky a kondenzátora navzájom vyrušia, impedancia je najmenšia a rovná sa odporu: `$Z_{0} = $R`.',
      `\`$I_{0} = @f{$U}{$R} = @f{${n(U)}}{${n(R)}}\` = ${res(U / R, 'A')}`,
    ]);
  },
  (rng) => {
    const below = rng() < 0.5;
    return choice(ID,
      `Sériový obvod RLC je napájaný napätím s frekvenciou ${below ? 'nižšou' : 'vyššou'}, ako je jeho rezonančná frekvencia. Aký má obvod charakter?`,
      below
        ? ['kapacitný – prúd predbieha napätie', 'induktívny – prúd zaostáva za napätím', 'čisto odporový – prúd je vo fáze s napätím', 'obvodom netečie žiadny prúd']
        : ['induktívny – prúd zaostáva za napätím', 'kapacitný – prúd predbieha napätie', 'čisto odporový – prúd je vo fáze s napätím', 'obvodom netečie žiadny prúd'],
      below
        ? 'Pod rezonanciou je `$X_{C} > $X_{L}` (reaktancia kondenzátora s klesajúcou frekvenciou rastie), preto prevláda kapacitná zložka a prúd predbieha napätie.'
        : 'Nad rezonanciou je `$X_{L} > $X_{C}` (reaktancia cievky s frekvenciou rastie), preto prevláda induktívna zložka a prúd zaostáva za napätím.',
      rng);
  },
  (rng) => {
    const what = pick(rng, ['R', 'C'] as const);
    return what === 'R'
      ? choice(ID, 'Ako sa zmení rezonančná krivka sériového obvodu, keď zväčšíš odpor `$R` (L a C ostanú rovnaké)?',
        ['rezonančná frekvencia ostane, krivka bude nižšia a širšia', 'rezonančná frekvencia stúpne', 'krivka bude vyššia a užšia', 'rezonančná frekvencia klesne a krivka sa zúži'],
        'Odpor neovplyvňuje `$f_{0} = @f{1}{2π@s{$L$C}}`. Prúd pri rezonancii `$I_{0} = @f{$U}{$R}` klesne a činiteľ akosti `$Q = @f{$Z_{0}}{$R}` sa zmenší, preto sa šírka pásma `$B = @f{$f_{0}}{$Q}` zväčší.', rng)
      : choice(ID, 'Ako sa zmení rezonančná frekvencia, keď kapacitu kondenzátora zväčšíš štyrikrát?',
        ['klesne na polovicu', 'klesne na štvrtinu', 'stúpne dvakrát', 'nezmení sa'],
        'Kapacita je pod odmocninou: `$f_{0} = @f{1}{2π@s{$L$C}}`. Štvornásobná kapacita znamená dvojnásobnú odmocninu, preto frekvencia klesne na polovicu.', rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'ac',
    title: 'Sériový rezonančný obvod',
    summary: 'Rezonancia napätí: Thomsonov vzťah, činiteľ akosti, šírka pásma a rezonančná krivka.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Sériový obvod RLC poznáš z lekcie Obvody RLC. Teraz sa pozrieme, čo sa v ňom deje, keď meníme **frekvenciu** napätia zdroja. Reaktancia cievky `$X_{L} = 2π$f$L` s frekvenciou rastie, reaktancia kondenzátora `$X_{C} = @f{1}{2π$f$C}` klesá – pri jednej frekvencii sú rovnako veľké. Vtedy nastane **rezonancia**.' },
      { t: 'figure', fig: rlcFigure, caption: 'Sériový rezonančný obvod: rezistor `$R` (často len odpor vinutia cievky), cievka `$L` a kondenzátor `$C` sú v sérii, všetkými tečie rovnaký prúd `$I`.' },
      { t: 'figure', fig: () => reactanceChart(0.01, 1e-6, 10, { fMin: 100, fMax: 1e5 }), caption: 'Reaktancie a impedancia pre `$L` = 10 mH, `$C` = 1 µF a `$R` = 10 Ω (obe osi logaritmické). Kde sa priamky `$X_{L}` a `$X_{C}` pretnú, je rezonancia – impedancia `$Z` tam klesne až na odpor `$R`.' },
      { t: 'h', text: 'Rezonančná frekvencia' },
      { t: 'p', text: 'Z podmienky rezonancie `$X_{L} = $X_{C}` dostaneme **Thomsonov vzťah**:' },
      {
        t: 'formula',
        tex: ['2π$f_{0}$L = @f{1}{2π$f_{0}$C}', '$f_{0} = @f{1}{2π@s{$L · $C}}'],
        legend: [['$f_{0}', 'rezonančná frekvencia', 'Hz'], ['$L', 'indukčnosť', 'H'], ['$C', 'kapacita', 'F']],
      },
      { t: 'p', text: 'Pri rezonancii sa napätia na cievke a na kondenzátore navzájom vyrušia (sú v protifáze). Obvod sa navonok správa ako **čistý odpor**: impedancia je najmenšia, `$Z_{0} = $R`, prúd je najväčší, `$I_{0} = @f{$U}{$R}`, a je vo fáze s napätím zdroja.' },
      {
        t: 'table',
        head: ['Frekvencia', 'Reaktancie', 'Impedancia', 'Charakter obvodu'],
        rows: [
          ['`$f < $f_{0}`', '`$X_{C} > $X_{L}`', '`$Z > $R`', 'kapacitný – prúd predbieha napätie'],
          ['`$f = $f_{0}`', '`$X_{L} = $X_{C}`', '`$Z = $R` (minimum)', 'odporový – prúd vo fáze s napätím'],
          ['`$f > $f_{0}`', '`$X_{L} > $X_{C}`', '`$Z > $R`', 'induktívny – prúd zaostáva za napätím'],
        ],
      },
      { t: 'figure', fig: atResonance, caption: 'Pri rezonancii sú fázory `$U_{L}` a `$U_{C}` rovnako dlhé a opačné, napätie zdroja `$U` sa rovná napätiu na rezistore `$U_{R}`.' },
      { t: 'figure', fig: aboveResonance, caption: 'Nad rezonanciou je `$U_{L} > $U_{C}`. Ich rozdiel (čiarkovane) spolu s `$U_{R}` dáva napätie zdroja `$U`, za ktorým prúd `$I` zaostáva.' },
      { t: 'h', text: 'Činiteľ akosti a napäťová rezonancia' },
      { t: 'p', text: 'Ako „ostro“ obvod reaguje na frekvenciu, udáva **činiteľ akosti** `$Q`. Je to pomer reaktancie pri rezonancii a odporu. Reaktancia cievky pri rezonancii sa rovná **charakteristickej impedancii** `$Z_{0}` (niekedy `$ρ`) obvodu.' },
      {
        t: 'formula',
        tex: ['$Z_{0} = 2π$f_{0}$L = @s{@f{$L}{$C}}', '$Q = @f{$Z_{0}}{$R} = @f{$U_{L0}}{$U} = @f{$U_{C0}}{$U}'],
        legend: [['$Z_{0}', 'charakteristická impedancia', 'Ω'], ['$Q', 'činiteľ akosti (bezrozmerný)', '–'], ['$U_{L0}', 'napätie na cievke pri rezonancii', 'V']],
      },
      { t: 'p', text: 'Napätie na cievke aj na kondenzátore je pri rezonancii `$Q`-krát **väčšie** ako napätie zdroja. Sériovej rezonancii sa preto hovorí **rezonancia napätí**.' },
      { t: 'note', kind: 'warn', text: 'Pri vysokom činiteli akosti môže byť napätie na kondenzátore nebezpečne veľké: zdroj 12 V a `$Q` = 50 dajú na kondenzátore 600 V. Kondenzátory v rezonančných obvodoch musia mať dostatočné menovité napätie a obvod sa nesmie dotýkať ani pri malom napätí zdroja.' },
      { t: 'h', text: 'Rezonančná krivka a šírka pásma' },
      { t: 'p', text: 'Závislosť prúdu od frekvencie je **rezonančná krivka**. Frekvencie `$f_{1}` a `$f_{2}`, pri ktorých prúd klesne na `@f{1}{@s{2}}` ≈ 0,707-násobok maxima (výkon na polovicu, pokles o 3 dB), ohraničujú **šírku pásma** `$B`. Čím väčší činiteľ akosti, tým užšie pásmo – obvod lepšie vyberá jednu frekvenciu (je **selektívnejší**).' },
      { t: 'formula', tex: ['$B = $f_{2} − $f_{1} = @f{$f_{0}}{$Q} = @f{$R}{2π$L}'], legend: [['$B', 'šírka pásma', 'Hz'], ['$f_{1}, $f_{2}', 'medzné frekvencie (pokles prúdu na 0,707 · I₀)', 'Hz']] },
      { t: 'explore', build: resonanceExplorer, caption: 'Hýb posuvníkmi: `$L` a `$C` posúvajú rezonančnú frekvenciu, odpor `$R` mení výšku a šírku krivky.' },
      {
        t: 'example',
        title: 'Rezonančná frekvencia, akosť a šírka pásma',
        given: ['`$L` = 10 mH', '`$C` = 1 µF', '`$R` = 10 Ω', '`$U` = 2 V'],
        steps: [
          '`$f_{0} = @f{1}{2π@s{0,01 · 10^{−6}}} = @f{1}{2π · 10^{−4}}` = 1 591,5 Hz',
          '`$Z_{0} = @s{@f{0,01}{10^{−6}}}` = 100 Ω, preto `$Q = @f{100}{10}` = 10',
          '`$B = @f{$f_{0}}{$Q} = @f{1 591,5}{10}` = 159 Hz – pásmo siaha približne od 1 514 Hz do 1 673 Hz',
          '`$I_{0} = @f{$U}{$R} = @f{2}{10}` = 0,2 A, `$U_{L0} = $U_{C0} = $Q · $U` = 10 · 2 = 20 V',
        ],
        result: '`$f_{0}` ≈ 1,59 kHz, `$Q` = 10, `$B` ≈ 159 Hz, na cievke aj kondenzátore 20 V',
      },
      {
        t: 'example',
        title: 'Naladenie vstupného obvodu prijímača',
        given: ['`$L` = 250 µH', '`$f_{0}` = 1 MHz'],
        steps: [
          'Z Thomsonovho vzťahu: `$C = @f{1}{(2π$f_{0})^{2} · $L}`',
          '`$C = @f{1}{(2π · 10^{6})^{2} · 250 · 10^{−6}} = @f{1}{3,948 · 10^{13} · 2,5 · 10^{−4}}` = 1,01 · 10⁻¹⁰ F',
        ],
        result: '`$C` ≈ 101 pF (otočný kondenzátor sa nastaví na túto kapacitu)',
      },
      { t: 'h', text: 'Kde sa sériová rezonancia využíva' },
      {
        t: 'list',
        items: [
          '**Ladené obvody** prijímačov – vyberú jednu stanicu, ostatné frekvencie potlačia.',
          '**Filtre** – sériový obvod LC zapojený priečne skratuje jednu frekvenciu (odsávací filter harmonických vo výkonovej elektronike).',
          '**Rezonančné meniče** a bezdrôtové nabíjanie – energia sa prenáša pri rezonančnej frekvencii s malými stratami.',
          'Nežiaduca rezonancia: kompenzačné kondenzátory spolu s indukčnosťou siete môžu rezonovať s vyššími harmonickými a preťažiť sa. Preto sa k nim zapájajú hradiace tlmivky.',
        ],
      },
      { t: 'note', kind: 'remember', text: 'Sériová rezonancia: `$X_{L} = $X_{C}`, impedancia **najmenšia** (`$Z = $R`), prúd **najväčší**, napätia na `$L` a `$C` sú `$Q`-krát väčšie ako napätie zdroja.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aká je impedancia sériového obvodu RLC pri rezonancii?',
      options: ['najmenšia, rovná sa odporu `$R`', 'najväčšia, teoreticky nekonečná', 'rovná sa súčtu `$R + $X_{L} + $X_{C}`', 'rovná sa nule'],
      explanation: 'Reaktancie cievky a kondenzátora sa pri rezonancii vyrušia, ostane len odpor `$R`. Preto tečie najväčší prúd `$I_{0} = @f{$U}{$R}`.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa sériovej rezonancii hovorí rezonancia napätí?',
      options: ['napätia na cievke a kondenzátore sú `$Q`-krát väčšie ako napätie zdroja', 'napätie zdroja sa pri nej zväčší', 'napätie na rezistore je nulové', 'všetky napätia sú vo fáze'],
      explanation: 'Pri rezonancii je `$U_{L0} = $U_{C0} = $Q · $U`. Navzájom sa vyrušia, preto ich zdroj „nevidí“, ale na samotných súčiastkach môže byť veľké napätie.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmení rezonančná frekvencia, keď sa indukčnosť aj kapacita zväčšia dvakrát?',
      options: ['klesne na polovicu', 'klesne na štvrtinu', 'nezmení sa', 'stúpne dvakrát'],
      explanation: 'Súčin `$L · $C` sa zväčší štyrikrát, jeho odmocnina dvakrát. Frekvencia `$f_{0} = @f{1}{2π@s{$L$C}}` preto klesne na polovicu.',
    },
    {
      lessonId: ID,
      prompt: 'Čo určuje šírku pásma sériového rezonančného obvodu?',
      options: ['činiteľ akosti – `$B = @f{$f_{0}}{$Q}`', 'iba napätie zdroja', 'iba kapacita kondenzátora', 'šírka pásma je vždy 3 dB'],
      explanation: 'Šírka pásma je `$B = @f{$f_{0}}{$Q} = @f{$R}{2π$L}`. Väčší odpor znamená menší činiteľ akosti a širšie pásmo. 3 dB je pokles, ktorým sa pásmo definuje, nie jeho šírka.',
    },
    {
      lessonId: ID,
      prompt: 'Aký fázový posun je medzi prúdom a napätím zdroja pri rezonancii?',
      options: ['nulový – prúd je vo fáze s napätím', '90°, prúd predbieha', '90°, prúd zaostáva', '180°'],
      explanation: 'Obvod sa pri rezonancii správa ako čistý odpor, preto `cos $φ` = 1 a fázový posun je nulový.',
    },
    {
      lessonId: ID,
      prompt: 'Pri ktorej frekvencii klesne prúd sériového obvodu na 0,707-násobok prúdu pri rezonancii?',
      options: ['pri medzných frekvenciách `$f_{1}` a `$f_{2}`, ktoré ohraničujú šírku pásma', 'pri frekvencii `2$f_{0}`', 'pri frekvencii `@f{$f_{0}}{2}`', 'pri nulovej frekvencii'],
      explanation: 'Pokles prúdu na `@f{1}{@s{2}}` znamená pokles výkonu na polovicu (−3 dB). Tieto dve frekvencie – jedna pod a jedna nad rezonanciou – ohraničujú šírku pásma `$B = $f_{2} − $f_{1}`.',
    },
    {
      lessonId: ID,
      prompt: 'Činiteľ akosti obvodu je 25 a napätie zdroja 4 V. Aké napätie je pri rezonancii na cievke?',
      options: ['100 V', '4 V', '0,16 V', '29 V'],
      explanation: '`$U_{L0} = $Q · $U` = 25 · 4 = 100 V. Napätie na cievke je pri rezonancii `$Q`-krát väčšie ako napätie zdroja.',
    },
  ],
  generators,
};

export default mod;
