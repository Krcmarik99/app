import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, fmtSci, formatSI } from '../../../lib/units';
import { e12, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { filterFigure, logAxis } from '../../../ui/fig-ac';
import { choice, deg } from '../util';

const ID = 'filtre';
const TWO_PI = 2 * Math.PI;

/** Prenos dolnej a hornej priepusti prvého rádu pri medznej frekvencii fm. */
const lpGain = (f: number, fm: number) => 1 / Math.sqrt(1 + (f / fm) ** 2);
const hpGain = (f: number, fm: number) => 1 / Math.sqrt(1 + (fm / f) ** 2);
const dB = (a: number) => 20 * Math.log10(a);

/** Signál s minusom pre text (−16,1 dB). */
const signed = (x: number, sig = 3) => (x < 0 ? `−${fmt(-x, sig)}` : fmt(x, sig));

/** Amplitúdová frekvenčná charakteristika (Bodeho diagram) dolnej a hornej priepusti s rovnakou fm. */
function bodeChart(): SVGSVGElement {
  const fm = 1000;
  return lineChart({
    ariaLabel: 'Amplitúdové frekvenčné charakteristiky dolnej a hornej priepusti RC s medznou frekvenciou 1 kHz',
    width: 460,
    height: 260,
    x: logAxis(1, 5, 'Hz', 'f (logaritmicky)'),
    y: { min: -40, max: 5, ticks: [-40, -30, -20, -10, 0], format: (v) => signed(v), label: 'A [dB]' },
    hlines: [{ y: -3, label: '−3 dB' }],
    series: [
      { points: sample((e) => dB(lpGain(10 ** e, fm)), 1, 5, 160) },
      { points: sample((e) => dB(hpGain(10 ** e, fm)), 1, 5, 160), className: 'copper' },
    ],
    vlines: [{ x: 3, label: 'fₘ' }],
    legend: [{ label: 'dolná priepusť', className: '' }, { label: 'horná priepusť', className: 'copper' }],
  });
}

function bodeExplorer(): HTMLElement {
  return explorer({
    title: 'Frekvenčná charakteristika filtra RC',
    choices: [{ key: 'kind', label: 'Druh filtra', options: [['lp', 'Dolná priepusť'], ['hp', 'Horná priepusť']], value: 'lp' }],
    params: [
      { key: 'R', label: 'Odpor `$R`', unit: 'Ω', min: 100, max: 100e3, value: 1000, log: true },
      { key: 'C', label: 'Kapacita `$C`', unit: 'F', min: 1e-9, max: 1e-6, value: 100e-9, log: true },
      { key: 'f', label: 'Frekvencia signálu `$f`', unit: 'Hz', min: 10, max: 1e6, value: 10e3, log: true },
    ],
    draw: ({ R, C, f }, { kind }) => {
      const fm = 1 / (TWO_PI * R * C);
      const gain = kind === 'lp' ? lpGain : hpGain;
      const a = gain(f, fm);
      const phi = kind === 'lp' ? -deg(Math.atan(f / fm)) : deg(Math.atan(fm / f));
      const chart = lineChart({
        ariaLabel: `Frekvenčná charakteristika ${kind === 'lp' ? 'dolnej' : 'hornej'} priepusti s medznou frekvenciou ${formatSI(fm, 'Hz')}`,
        width: 460,
        height: 250,
        x: logAxis(1, 6, 'Hz', 'f (logaritmicky)'),
        y: { min: -60, max: 5, ticks: [-60, -40, -20, 0], format: (v) => signed(v), label: 'A [dB]' },
        hlines: [{ y: -3, label: '−3 dB' }],
        series: [{ points: sample((e) => dB(gain(10 ** e, fm)), 1, 6, 200), className: kind === 'lp' ? '' : 'copper' }],
        vlines: fm >= 10 && fm <= 1e6 ? [{ x: Math.log10(fm), label: 'fₘ' }] : [],
        markers: [{ x: Math.log10(f), y: dB(a), label: `${signed(dB(a))} dB`, above: true }],
      });
      return {
        chart,
        readouts: [
          ['Medzná frekvencia `$f_{m}`', formatSI(fm, 'Hz', 4)],
          ['Prenos `@f{$U_{2}}{$U_{1}}`', fmt(a, 3)],
          ['Prenos v decibeloch', `${signed(dB(a))} dB`],
          ['Fázový posun `$φ`', `${signed(phi)}°`],
        ],
        note: Math.abs(f / fm - 1) < 0.05
          ? 'Signál je práve na medznej frekvencii: výstupné napätie je 0,707-násobok vstupného (−3 dB) a fázový posun 45°.'
          : (kind === 'lp') === (f < fm)
            ? 'Signál je v priepustnom pásme – prejde takmer bez zoslabenia.'
            : 'Signál je v nepriepustnom pásme. Ďaleko od medznej frekvencie klesá prenos o 20 dB pri každom desaťnásobku frekvencie.',
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const R = e12(rng, [100, 1000, 10000]);
    const C = e12(rng, [1e-9, 1e-8, 1e-7]);
    const fm = 1 / (TWO_PI * R * C);
    const kind = pick(rng, ['dolnej', 'hornej']);
    return numeric(ID, `Aká je medzná frekvencia ${kind} priepusti RC s rezistorom ${q(R, 'Ω')} a kondenzátorom ${q(C, 'F')}?`, fm, 'Hz', [
      'Pre dolnú aj hornú priepusť RC platí rovnaký vzťah: `$f_{m} = @f{1}{2π · $R · $C}`.',
      `\`$f_{m} = @f{1}{2π · ${n(R)} · ${fmtSci(C)}}\` = ${res(fm, 'Hz')}`,
    ]);
  },
  (rng) => {
    const R = e12(rng, [1, 10, 100]);
    const L = e12(rng, [1e-4, 1e-3, 1e-2]);
    const fm = R / (TWO_PI * L);
    return numeric(ID, `Dolnú priepusť tvorí cievka ${q(L, 'H')} zapojená pozdĺžne a rezistor ${q(R, 'Ω')} zapojený priečne. Aká je medzná frekvencia?`, fm, 'Hz', [
      'Pri medznej frekvencii sa reaktancia cievky rovná odporu: `2π$f_{m}$L = $R`, preto `$f_{m} = @f{$R}{2π · $L}`.',
      `\`$f_{m} = @f{${n(R)}}{2π · ${fmtSci(L)}}\` = ${res(fm, 'Hz')}`,
    ], { figure: () => filterFigure('lp', 'rl') });
  },
  (rng) => {
    const R = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3, 22e3]);
    const fm = pick(rng, [100, 300, 1e3, 3.4e3, 15e3, 20e3]);
    const C = 1 / (TWO_PI * R * fm);
    return numeric(ID, `Navrhni kondenzátor pre dolnú priepusť RC s medznou frekvenciou ${q(fm, 'Hz')}, ak má rezistor odpor ${q(R, 'Ω')}.`, C, 'F', [
      '`$f_{m} = @f{1}{2π$R$C}` ⇒ `$C = @f{1}{2π · $R · $f_{m}}`',
      `\`$C = @f{1}{2π · ${n(R)} · ${n(fm)}}\` = ${res(C, 'F')}`,
    ]);
  },
  (rng) => {
    const fm = pick(rng, [200, 500, 1e3, 1.6e3, 3e3]);
    const k = pick(rng, [2, 3, 5, 10, 20]);
    const f = fm * k;
    const U1 = pick(rng, [1, 2, 5, 10]);
    const U2 = U1 * lpGain(f, fm);
    return numeric(ID, `Na vstup dolnej priepusti RC s medznou frekvenciou ${q(fm, 'Hz')} privedieš sínusové napätie ${q(U1, 'V')} s frekvenciou ${q(f, 'Hz')}. Aké napätie bude na výstupe naprázdno?`, U2, 'V', [
      '`$U_{2} = $U_{1} · @f{1}{@s{1 + (@f{$f}{$f_{m}})^{2}}}`',
      `\`@f{$f}{$f_{m}}\` = ${n(k)}, \`@s{1 + ${n(k)}^{2}}\` = ${n(Math.sqrt(1 + k * k), 4)}`,
      `\`$U_{2} = @f{${n(U1)}}{${n(Math.sqrt(1 + k * k), 4)}}\` = ${res(U2, 'V')}`,
    ], { figure: () => filterFigure('lp') });
  },
  (rng) => {
    const U1 = pick(rng, [1, 2, 5, 10]);
    const ratio = pick(rng, [0.5, 0.25, 0.2, 0.1, 0.05, 0.02, 0.01]);
    const U2 = U1 * ratio;
    const att = -dB(ratio);
    return numeric(ID, `Filter zoslabí signál z ${q(U1, 'V')} na ${q(U2, 'V')}. O koľko decibelov je výstupné napätie menšie ako vstupné?`, att, 'dB', [
      '`$A = 20 · log @f{$U_{2}}{$U_{1}}`',
      `\`$A = 20 · log @f{${n(U2)}}{${n(U1)}}\` = 20 · log ${n(ratio)} = ${signed(-att)} dB`,
      `Napätie je menšie o **${n(att, 3)} dB** (útlm ${n(att, 3)} dB).`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const U1 = pick(rng, [1, 2, 5, 10, 12]);
    const att = pick(rng, [6, 10, 12, 20, 26, 40]);
    const U2 = U1 * 10 ** (-att / 20);
    return numeric(ID, `Vstupné napätie filtra je ${q(U1, 'V')} a filter ho na danej frekvencii zoslabí o ${att} dB. Aké je výstupné napätie?`, U2, 'V', [
      '`$U_{2} = $U_{1} · 10^{@f{$A}{20}}`, kde `$A` je prenos v decibeloch (pri zoslabení záporný).',
      `\`$U_{2} = ${n(U1)} · 10^{@f{−${att}}{20}}\` = ${n(U1)} · ${n(10 ** (-att / 20), 3)} = ${res(U2, 'V')}`,
    ]);
  },
  (rng) => {
    const kind = pick(rng, ['lp', 'hp'] as const);
    const type = pick(rng, ['rc', 'rl'] as const);
    const isLp = kind === 'lp';
    return {
      ...choice(ID, 'O aký filter ide na obrázku? (`$U_{1}` je vstup, `$U_{2}` výstup.)',
        isLp
          ? ['dolná priepusť – prepúšťa nízke frekvencie', 'horná priepusť – prepúšťa vysoké frekvencie', 'pásmová priepusť', 'pásmová zádrž']
          : ['horná priepusť – prepúšťa vysoké frekvencie', 'dolná priepusť – prepúšťa nízke frekvencie', 'pásmová priepusť', 'pásmová zádrž'],
        type === 'rc'
          ? (isLp
            ? 'Kondenzátor je priečne: pri vysokých frekvenciách má malú reaktanciu a výstup skratuje. Nízke frekvencie prejdú.'
            : 'Kondenzátor je pozdĺžne: nízke frekvencie (aj jednosmerné napätie) nepustí, vysoké prejdú.')
          : (isLp
            ? 'Cievka je pozdĺžne: jej reaktancia s frekvenciou rastie, preto vysoké frekvencie zadrží a nízke prejdú.'
            : 'Cievka je priečne: pri nízkych frekvenciách má malú reaktanciu a výstup skratuje, vysoké frekvencie prejdú.'),
        rng),
      figure: () => filterFigure(kind, type),
    };
  },
  (rng) => choice(ID, 'Aký je prenos a fázový posun filtra RC prvého rádu pri medznej frekvencii?',
    ['0,707 (−3 dB) a 45°', '0,5 (−6 dB) a 90°', '1 (0 dB) a 0°', '0,1 (−20 dB) a 45°'],
    'Pri medznej frekvencii sa reaktancia kondenzátora rovná odporu. Napätie sa rozdelí v pomere `@f{1}{@s{2}}` = 0,707, čo je −3 dB, a fázový posun je 45° (pri dolnej priepusti výstup zaostáva, pri hornej predbieha).',
    rng),
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'ac',
    title: 'Filtre RC a RL a decibely',
    summary: 'Dolná a horná priepusť, medzná frekvencia, prenos v decibeloch a frekvenčná charakteristika.',
    minutes: 13,
    blocks: [
      { t: 'p', text: '**Filter** prepúšťa signály niektorých frekvencií a iné zoslabuje. Najjednoduchší pasívny filter je delič napätia, v ktorom je jeden rezistor nahradený kondenzátorom alebo cievkou. Ich reaktancia závisí od frekvencie, preto aj pomer deliča – a teda výstupné napätie – závisí od frekvencie.' },
      { t: 'figure', fig: () => filterFigure('lp'), caption: 'Dolná priepusť RC: pri nízkej frekvencii má kondenzátor veľkú reaktanciu a `$U_{2} ≈ $U_{1}`, pri vysokej frekvencii výstup skratuje.' },
      { t: 'figure', fig: () => filterFigure('hp'), caption: 'Horná priepusť RC: kondenzátor je pozdĺžne, nízke frekvencie a jednosmerné napätie nepustí.' },
      { t: 'h', text: 'Prenos a decibely' },
      { t: 'p', text: 'Vlastnosť filtra opisuje **napäťový prenos** `$A = @f{$U_{2}}{$U_{1}}` (pomer výstupného a vstupného napätia naprázdno). V elektronike sa prenos udáva v **decibeloch** – logaritmická miera zmení násobenie na sčítanie a na jednom grafe sa zmestia veľmi malé aj veľké pomery.' },
      {
        t: 'formula',
        tex: ['$A_{dB} = 20 · log @f{$U_{2}}{$U_{1}}', '$A_{dB} = 10 · log @f{$P_{2}}{$P_{1}}'],
        legend: [['$A_{dB}', 'prenos (zosilnenie) v decibeloch; záporný = zoslabenie (útlm)', 'dB'], ['$U_{1}, $U_{2}', 'vstupné a výstupné napätie', 'V']],
      },
      {
        t: 'table',
        head: ['`@f{$U_{2}}{$U_{1}}`', 'Prenos', 'Kedy sa s ním stretneš'],
        rows: [
          ['10', '+20 dB', 'zosilňovač zosilní napätie desaťkrát'],
          ['2', '+6 dB', 'dvojnásobné napätie'],
          ['1', '0 dB', 'signál prejde bez zmeny'],
          ['0,707', '−3 dB', 'medzná frekvencia, polovičný výkon'],
          ['0,5', '−6 dB', 'polovičné napätie'],
          ['0,1', '−20 dB', 'filter 1. rádu dekádu nad medznou frekvenciou'],
          ['0,01', '−40 dB', 'dve dekády nad medznou frekvenciou'],
        ],
      },
      { t: 'note', kind: 'tip', text: 'Decibely reťazených obvodov sa sčítajú: filter s útlmom 20 dB a zosilňovač so zosilnením 26 dB majú spolu +6 dB, čo je dvojnásobok napätia.' },
      { t: 'h', text: 'Medzná frekvencia' },
      { t: 'p', text: 'Hranicu medzi priepustným a nepriepustným pásmom tvorí **medzná frekvencia** `$f_{m}`. Pri nej sa reaktancia rovná odporu, výstupné napätie je 0,707-násobok vstupného (−3 dB) a fázový posun 45°.' },
      {
        t: 'formula',
        tex: ['RC: $f_{m} = @f{1}{2π · $R · $C}', 'RL: $f_{m} = @f{$R}{2π · $L}'],
        legend: [['$f_{m}', 'medzná frekvencia (pokles o 3 dB)', 'Hz']],
      },
      {
        t: 'formula',
        tex: ['dolná priepusť: @f{$U_{2}}{$U_{1}} = @f{1}{@s{1 + (@f{$f}{$f_{m}})^{2}}}', 'horná priepusť: @f{$U_{2}}{$U_{1}} = @f{1}{@s{1 + (@f{$f_{m}}{$f})^{2}}}'],
      },
      { t: 'figure', fig: bodeChart, caption: 'Amplitúdové charakteristiky pre `$f_{m}` = 1 kHz. Ďaleko od medznej frekvencie klesá prenos o 20 dB na dekádu (desaťnásobok frekvencie), teda asi o 6 dB na oktávu (dvojnásobok).' },
      { t: 'p', text: 'Takýto graf s logaritmickou osou frekvencie a prenosom v decibeloch sa volá **Bodeho diagram**. Charakteristiku filtra prvého rádu nahradíme dvoma priamkami (asymptotami): vodorovnou na 0 dB a šikmou so sklonom 20 dB/dek, ktoré sa stretnú pri medznej frekvencii. Skutočná krivka je tam o 3 dB nižšie.' },
      { t: 'explore', build: bodeExplorer, caption: 'Prepni druh filtra a hýb `$R` a `$C` – medzná frekvencia sa posúva. Posuvník frekvencie signálu ukáže, ako veľmi filter signál zoslabí.' },
      {
        t: 'example',
        title: 'Dolná priepusť RC',
        given: ['`$R` = 1 kΩ', '`$C` = 100 nF', '`$f` = 10 kHz'],
        steps: [
          '`$f_{m} = @f{1}{2π · 1 000 · 100 · 10^{−9}} = @f{1}{6,283 · 10^{−4}}` = 1 591,5 Hz',
          '`@f{$f}{$f_{m}} = @f{10 000}{1 591,5}` = 6,283',
          '`@f{$U_{2}}{$U_{1}} = @f{1}{@s{1 + 6,283^{2}}} = @f{1}{6,362}` = 0,157',
          '`$A_{dB}` = 20 · log 0,157 = −16,1 dB',
        ],
        result: '`$f_{m}` ≈ 1,59 kHz, signál 10 kHz zoslabí na 15,7 % (−16,1 dB)',
      },
      {
        t: 'example',
        title: 'Vyhladenie PWM z Arduina',
        given: ['PWM 490 Hz', 'žiadané `$f_{m}` = 10 Hz', '`$R` = 10 kΩ'],
        steps: [
          '`$C = @f{1}{2π · $R · $f_{m}} = @f{1}{2π · 10 000 · 10}` = 1,59 µF → zvolíme 1,5 µF',
          'Skutočná `$f_{m} = @f{1}{2π · 10 000 · 1,5 · 10^{−6}}` = 10,6 Hz',
          'Zložka 490 Hz: `@f{490}{10,6}` = 46, prenos ≈ `@f{1}{46}` = 0,022 → útlm 33 dB',
        ],
        result: 'Z obdĺžnikového PWM ostane takmer jednosmerné napätie úmerné striede.',
      },
      { t: 'h', text: 'Pásmové filtre a filtre vyšších rádov' },
      {
        t: 'list',
        items: [
          '**Pásmová priepusť** prepúšťa len pásmo okolo strednej frekvencie – vznikne spojením hornej a dolnej priepusti alebo sériovým rezonančným obvodom.',
          '**Pásmová zádrž** (odlaďovač) potlačí len jedno pásmo, napr. rušenie 50 Hz – paralelný rezonančný obvod v sérii s vedením.',
          'Filter **druhého rádu** (napr. LC) má strmosť 40 dB/dek, tretieho 60 dB/dek. **Aktívne filtre** s operačným zosilňovačom nepotrebujú cievky a výstup môžu zaťažiť.',
        ],
      },
      { t: 'h', text: 'Použitie' },
      {
        t: 'list',
        items: [
          '**Reproduktorové výhybky** – výškový reproduktor dostane signál cez hornú priepusť, hlbokotónový cez dolnú.',
          '**Odrušovacie filtre** v sieťových prívodoch spotrebičov nepustia vysokofrekvenčné rušenie do siete.',
          '**Väzbový kondenzátor** medzi stupňami zosilňovača je horná priepusť – oddelí jednosmerné napätie, striedavý signál prepustí.',
          '**Filtrácia PWM** a vstupy prevodníkov A/D (antialiasingový filter).',
        ],
      },
      { t: 'note', kind: 'remember', text: 'Pri medznej frekvencii `$X = $R`, prenos 0,707 = −3 dB, fázový posun 45°. RC: `$f_{m} = @f{1}{2π$R$C}`, RL: `$f_{m} = @f{$R}{2π$L}`. Filter 1. rádu: 20 dB na dekádu.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Koľko decibelov zodpovedá poklesu napätia na polovicu?',
      options: ['približne −6 dB', '−3 dB', '−50 dB', '−20 dB'],
      explanation: '20 · log 0,5 = −6,02 dB. Pokles o 3 dB zodpovedá pomeru napätí 0,707 (polovičnému výkonu).',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmení medzná frekvencia filtra RC, keď zväčšíš kapacitu desaťkrát?',
      options: ['klesne na desatinu', 'stúpne desaťkrát', 'klesne na tretinu (odmocnina z 10)', 'nezmení sa'],
      explanation: '`$f_{m} = @f{1}{2π$R$C}` – kapacita je v menovateli bez odmocniny (na rozdiel od rezonančného obvodu), preto desaťnásobná kapacita znamená desatinovú medznú frekvenciu.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorý filter prepustí jednosmerné napätie?',
      options: ['dolná priepusť', 'horná priepusť RC', 'horná priepusť RL', 'žiadny filter s kondenzátorom ani cievkou'],
      explanation: 'Jednosmerné napätie má frekvenciu 0 Hz, teda leží v priepustnom pásme dolnej priepusti. Horná priepusť RC ho nepustí cez pozdĺžny kondenzátor, horná priepusť RL ho skratuje priečnou cievkou.',
    },
    {
      lessonId: ID,
      prompt: 'O koľko klesne prenos dolnej priepusti prvého rádu, keď sa frekvencia (vysoko nad medznou) zväčší desaťkrát?',
      options: ['o 20 dB', 'o 3 dB', 'o 6 dB', 'o 40 dB'],
      explanation: 'Nad medznou frekvenciou je prenos približne `@f{$f_{m}}{$f}` – desaťnásobná frekvencia znamená desatinový prenos, čo je −20 dB. Strmosť filtra prvého rádu je 20 dB na dekádu.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je vzťah pre medznú frekvenciu filtra RL?',
      options: ['`$f_{m} = @f{$R}{2π$L}`', '`$f_{m} = @f{1}{2π$R$L}`', '`$f_{m} = @f{1}{2π@s{$R$L}}`', '`$f_{m} = 2π$R$L`'],
      explanation: 'Pri medznej frekvencii sa reaktancia cievky rovná odporu: `2π$f_{m}$L = $R`, z toho `$f_{m} = @f{$R}{2π$L}`.',
    },
    {
      lessonId: ID,
      prompt: 'Zosilňovač má zosilnenie +20 dB a za ním je filter s útlmom 6 dB. Aký je celkový prenos?',
      options: ['+14 dB (asi päťnásobok napätia)', '−120 dB', '+26 dB', '+3,3 dB'],
      explanation: 'Prenosy v decibeloch sa pri reťazení sčítajú: 20 − 6 = 14 dB. Napäťovo je to 10 · 0,5 = 5-násobok.',
    },
  ],
  generators,
};

export default mod;
