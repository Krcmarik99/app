import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, fmtSci, formatSI } from '../../../lib/units';
import { e12, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { logAxis, niceScale, parallelLcFigure, phasorDiagram } from '../../../ui/fig-ac';
import { choice } from '../util';

const ID = 'paralelna-rezonancia';
const TWO_PI = 2 * Math.PI;

const f0Of = (L: number, C: number) => 1 / (TWO_PI * Math.sqrt(L * C));

/** Impedancia reálnej cievky (R + jωL) paralelne s kondenzátorom C. */
function tankImpedance(f: number, L: number, C: number, R: number): number {
  const w = TWO_PI * f;
  return Math.hypot(R, w * L) / Math.hypot(1 - w * w * L * C, w * R * C);
}

function impedanceExplorer(): HTMLElement {
  return explorer({
    title: 'Impedancia paralelného rezonančného obvodu',
    params: [
      { key: 'L', label: 'Indukčnosť `$L`', unit: 'H', min: 1e-4, max: 1e-2, value: 1e-3, log: true },
      { key: 'C', label: 'Kapacita `$C`', unit: 'F', min: 1e-9, max: 1e-7, value: 1e-8, log: true },
      { key: 'R', label: 'Odpor vinutia `$R`', unit: 'Ω', min: 0.5, max: 100, value: 5, log: true },
    ],
    draw: ({ L, C, R }) => {
      const f0 = f0Of(L, C);
      const Q = Math.sqrt(L / C) / R;
      const Rd = L / (R * C);
      const peak = Math.max(...[0.98, 0.995, 1, 1.005, 1.02].map((k) => tankImpedance(f0 * k, L, C, R)), Rd);
      const kilo = peak >= 1000;
      const k = kilo ? 1e-3 : 1;
      const scale = niceScale(peak * k * 1.08);
      const fs: number[] = [];
      for (let i = 0; i <= 480; i++) fs.push(10 ** (3 + (3 * i) / 480));
      for (let t = -6; t <= 6; t += 0.1) fs.push(f0 * (1 + t / (2 * Q)));
      const points = fs
        .filter((f) => f >= 1e3 && f <= 1e6)
        .sort((a, b) => a - b)
        .map((f): [number, number] => [Math.log10(f), tankImpedance(f, L, C, R) * k]);
      const chart = lineChart({
        ariaLabel: `Impedancia paralelného obvodu v závislosti od frekvencie, rezonancia pri ${formatSI(f0, 'Hz')}`,
        width: 460,
        height: 250,
        x: logAxis(3, 6, 'Hz', 'f (logaritmicky)'),
        y: { min: 0, max: scale.max, ticks: scale.ticks, format: (v) => fmt(v, 3), label: kilo ? 'Z [kΩ]' : 'Z [Ω]' },
        series: [{ points, className: 'copper' }],
        hlines: [{ y: 0.707 * Rd * k, label: '0,707 · Rd' }],
        vlines: [{ x: Math.log10(f0), label: 'f₀' }],
      });
      return {
        chart,
        readouts: [
          ['Rezonančná frekvencia `$f_{0}`', formatSI(f0, 'Hz', 4)],
          ['Činiteľ akosti `$Q`', fmt(Q, 3)],
          ['Rezonančný odpor `$R_{d}`', formatSI(Rd, 'Ω', 3)],
          ['Šírka pásma `$B`', formatSI(f0 / Q, 'Hz', 3)],
        ],
        note: Q >= 3
          ? `Pri rezonancii má obvod impedanciu ${formatSI(Rd, 'Ω', 3)}, hoci samotná cievka má odpor len ${formatSI(R, 'Ω', 3)}. Prúdy v cievke a kondenzátore sú asi ${fmt(Q, 2)}-krát väčšie ako prúd zo zdroja.`
          : 'Pri veľkom odpore vinutia je činiteľ akosti malý a rezonancia je sotva viditeľná.',
      };
    },
  });
}

const tankPhasors = () => phasorDiagram([
  { x: 7, y: 0, label: 'U', cls: 'ink' },
  { x: 0, y: 5, label: 'I_C', cls: 'good' },
  { x: 1.4, y: -5, label: 'I_L', cls: 'copper' },
  { x: 1.4, y: 0, label: 'I', cls: 'trace' },
], 'Fázorový diagram paralelného obvodu pri rezonancii: prúdy cievky a kondenzátora sú veľké, ich súčet I je malý a vo fáze s napätím');

const generators: Generator[] = [
  (rng) => {
    const L = e12(rng, [1e-5, 1e-4, 1e-3]);
    const C = e12(rng, [1e-10, 1e-9, 1e-8]);
    const f0 = f0Of(L, C);
    return numeric(ID, `Paralelný rezonančný obvod tvorí cievka ${q(L, 'H')} s malým odporom vinutia a kondenzátor ${q(C, 'F')}. Na akej frekvencii nastane rezonancia?`, f0, 'Hz', [
      'Pri malom odpore vinutia (veľkom činiteli akosti) platí rovnaký Thomsonov vzťah ako pri sériovom obvode: `$f_{0} = @f{1}{2π@s{$L · $C}}`.',
      `\`$f_{0} = @f{1}{2π · @s{${fmtSci(L)} · ${fmtSci(C)}}}\` = ${res(f0, 'Hz')}`,
    ]);
  },
  (rng) => {
    const L = e12(rng, [1e-4, 1e-3]);
    const C = e12(rng, [1e-9, 1e-8]);
    const Z0 = Math.sqrt(L / C);
    const R = Number((Z0 / pick(rng, [15, 20, 30, 50, 80, 100])).toPrecision(2));
    const Rd = L / (R * C);
    return numeric(ID, `Cievka s indukčnosťou ${q(L, 'H')} a odporom vinutia ${q(R, 'Ω')} je zapojená paralelne s kondenzátorom ${q(C, 'F')}. Aký je rezonančný odpor obvodu?`, Rd, 'Ω', [
      'Rezonančný (dynamický) odpor paralelného obvodu je `$R_{d} = @f{$L}{$R · $C}`.',
      `\`$R_{d} = @f{${fmtSci(L)}}{${n(R)} · ${fmtSci(C)}}\` = ${res(Rd, 'Ω')}`,
      `Kontrola: \`$Q = @f{1}{$R}@s{@f{$L}{$C}}\` = ${n(Z0 / R, 3)}, \`$R_{d} = $Q^{2} · $R\` = ${q((Z0 / R) ** 2 * R, 'Ω')}.`,
    ]);
  },
  (rng) => {
    const L = e12(rng, [1e-4, 1e-3]);
    const C = e12(rng, [1e-9, 1e-8]);
    const Z0 = Math.sqrt(L / C);
    const R = Number((Z0 / pick(rng, [12, 20, 35, 50, 75, 120])).toPrecision(2));
    const Q = Z0 / R;
    return numeric(ID, `Paralelný rezonančný obvod tvorí cievka ${q(L, 'H')} s odporom vinutia ${q(R, 'Ω')} a kondenzátor ${q(C, 'F')}. Aký je jeho činiteľ akosti?`, Q, '', [
      '`$Q = @f{$X_{L0}}{$R} = @f{1}{$R} · @s{@f{$L}{$C}}`',
      `\`@s{@f{$L}{$C}} = @s{@f{${fmtSci(L)}}{${fmtSci(C)}}}\` = ${n(Z0, 4)} Ω`,
      `\`$Q = @f{${n(Z0, 4)}}{${n(R)}}\` = **${n(Q, 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const U = pick(rng, [1, 2, 5, 10]);
    const Rd = pick(rng, [5e3, 10e3, 20e3, 47e3, 100e3]);
    const Q = pick(rng, [20, 25, 40, 50, 60, 80]);
    const I = U / Rd;
    const IC = Q * I;
    return numeric(ID, `Paralelný rezonančný obvod s rezonančným odporom ${q(Rd, 'Ω')} a činiteľom akosti ${n(Q)} je pripojený na napätie ${q(U, 'V')} s rezonančnou frekvenciou. Aký prúd tečie kondenzátorom?`, IC, 'A', [
      `Zo zdroja tečie len \`$I = @f{$U}{$R_{d}} = @f{${n(U)}}{${n(Rd)}}\` = ${q(I, 'A')}.`,
      'Pri rezonancii prúdov je prúd v kondenzátore (aj v cievke) `$Q`-krát väčší ako prúd zo zdroja.',
      `\`$I_{C} = $Q · $I\` = ${n(Q)} · ${q(I, 'A')} = ${res(IC, 'A')}`,
    ]);
  },
  (rng) => {
    const f0 = pick(rng, [10.7e6, 455e3, 100e3, 50e3, 20e3]);
    const Q = pick(rng, [20, 40, 50, 80, 100]);
    const B = f0 / Q;
    return numeric(ID, `Paralelný obvod s rezonančnou frekvenciou ${q(f0, 'Hz')} má činiteľ akosti ${n(Q)}. Aká je jeho šírka pásma?`, B, 'Hz', [
      '`$B = @f{$f_{0}}{$Q}`',
      `\`$B = @f{${n(f0)}}{${n(Q)}}\` = ${res(B, 'Hz')}`,
    ]);
  },
  (rng) => {
    const kind = pick(rng, ['Z', 'I'] as const);
    return kind === 'Z'
      ? choice(ID, 'Aká je impedancia paralelného rezonančného obvodu pri rezonančnej frekvencii?',
        ['najväčšia – rovná sa rezonančnému odporu `$R_{d}`', 'najmenšia – rovná sa odporu vinutia `$R`', 'nulová', 'rovná sa reaktancii cievky'],
        'Pri paralelnej rezonancii sa prúdy cievky a kondenzátora takmer vyrušia, zo zdroja tečie malý prúd, a preto je impedancia najväčšia: `$R_{d} = @f{$L}{$R$C}`.', rng)
      : choice(ID, 'Čo platí pre prúd odoberaný zo zdroja pri paralelnej rezonancii?',
        ['je najmenší a vo fáze s napätím', 'je najväčší a vo fáze s napätím', 'predbieha napätie o 90°', 'zaostáva za napätím o 90°'],
        'Impedancia je pri paralelnej rezonancii najväčšia a obvod sa správa ako odpor `$R_{d}`. Prúd zo zdroja je preto najmenší a vo fáze s napätím.', rng);
  },
  (rng) => {
    const app = pick(rng, [0, 1] as const);
    return app === 0
      ? choice(ID, 'Paralelný obvod LC je zapojený do série s vedením. Načo slúži?',
        ['ako odlaďovač – zadrží signál s rezonančnou frekvenciou, ostatné prepustí', 'skratuje rezonančnú frekvenciu k zemi', 'zvýši napätie siete', 'kompenzuje účinník'],
        'Pri rezonancii má paralelný obvod veľkú impedanciu, a preto signál s touto frekvenciou neprejde. Ostatné frekvencie prejdú, lebo pre ne má obvod malú impedanciu (zádrž, odlaďovač).', rng)
      : choice(ID, 'Prečo sa paralelný obvod LC používa v oscilátoroch?',
        ['energia sa v ňom prelieva medzi poľom kondenzátora a cievky s rezonančnou frekvenciou', 'jeho impedancia je pri rezonancii nulová', 'premieňa striedavý prúd na jednosmerný', 'nepotrebuje žiadny zdroj energie'],
        'Nabitý kondenzátor sa vybíja cez cievku, energia prejde do magnetického poľa a späť – obvod kmitá s frekvenciou `$f_{0}`. Zosilňovač v oscilátore len dopĺňa energiu stratenú v odpore.', rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'ac',
    title: 'Paralelný rezonančný obvod',
    summary: 'Rezonancia prúdov: rezonančný odpor, činiteľ akosti, porovnanie so sériovým obvodom a použitie.',
    minutes: 13,
    blocks: [
      { t: 'p', text: 'V paralelnom rezonančnom obvode sú cievka a kondenzátor zapojené vedľa seba. Majú spoločné **napätie** a prúd zo zdroja sa rozdelí do dvoch vetiev. Skutočná cievka má odpor vinutia `$R`, preto ju kreslíme ako sériové spojenie `$L` a `$R`.' },
      { t: 'figure', fig: parallelLcFigure, caption: 'Paralelný rezonančný obvod: reálna cievka (indukčnosť `$L` s odporom vinutia `$R`) paralelne s kondenzátorom `$C`.' },
      { t: 'h', text: 'Rezonancia prúdov' },
      { t: 'p', text: 'Prúd cievky `$I_{L}` zaostáva za napätím takmer o 90°, prúd kondenzátora `$I_{C}` napätie o 90° predbieha. Pri rezonančnej frekvencii sú tieto prúdy rovnako veľké a navzájom sa takmer vyrušia. Zo zdroja tečie len malý prúd `$I`, ktorý kryje straty v odpore vinutia. Vo vnútri obvodu však krúži prúd `$Q`-krát väčší – hovoríme o **rezonancii prúdov**.' },
      { t: 'figure', fig: tankPhasors, caption: 'Fázorový diagram pri rezonancii: prúdy `$I_{C}` a `$I_{L}` sú veľké a takmer opačné, výsledný prúd `$I` je malý a vo fáze s napätím `$U`.' },
      {
        t: 'formula',
        tex: ['$f_{0} ≈ @f{1}{2π@s{$L · $C}}', '$Q = @f{2π$f_{0}$L}{$R} = @f{1}{$R} · @s{@f{$L}{$C}}', '$R_{d} = @f{$L}{$R · $C} = $Q^{2} · $R'],
        legend: [
          ['$f_{0}', 'rezonančná frekvencia (presne platí pre `$Q` ≫ 1)', 'Hz'],
          ['$Q', 'činiteľ akosti', '–'],
          ['$R_{d}', 'rezonančný (dynamický) odpor – impedancia pri rezonancii', 'Ω'],
          ['$R', 'odpor vinutia cievky', 'Ω'],
        ],
      },
      { t: 'note', kind: 'tip', text: 'Presný vzťah pre reálnu cievku je `$f_{0} = @f{1}{2π} · @s{@f{1}{$L$C} − @f{$R^{2}}{$L^{2}}}`. Pri činiteli akosti nad 10 sa od Thomsonovho vzťahu líši menej ako o 0,5 %, preto v praxi stačí ten jednoduchší.' },
      { t: 'p', text: 'Impedancia paralelného obvodu je pri rezonancii **najväčšia** a čisto činná – rovná sa rezonančnému odporu `$R_{d}`. Ten býva desiatky až stovky kiloohmov, hoci samotné vinutie má len niekoľko ohmov. Mimo rezonancie impedancia klesá: pod rezonanciou prevláda prúd cievky (obvod má induktívny charakter), nad rezonanciou prúd kondenzátora (kapacitný charakter).' },
      { t: 'explore', build: impedanceExplorer, caption: 'Zmenši odpor vinutia: vrchol impedancie stúpne a zúži sa. `$L` a `$C` posúvajú rezonančnú frekvenciu.' },
      {
        t: 'example',
        title: 'Paralelný obvod s reálnou cievkou',
        given: ['`$L` = 1 mH, `$R` = 5 Ω', '`$C` = 10 nF', '`$U` = 2 V'],
        steps: [
          '`$f_{0} = @f{1}{2π@s{10^{−3} · 10^{−8}}} = @f{1}{2π · 3,162 · 10^{−6}}` = 50,3 kHz',
          '`@s{@f{$L}{$C}} = @s{@f{10^{−3}}{10^{−8}}}` = 316,2 Ω, `$Q = @f{316,2}{5}` = 63,2',
          '`$R_{d} = @f{$L}{$R$C} = @f{10^{−3}}{5 · 10^{−8}}` = 20 000 Ω = 20 kΩ',
          '`$B = @f{$f_{0}}{$Q} = @f{50 300}{63,2}` = 796 Hz',
          'Zo zdroja tečie `$I = @f{2}{20 000}` = 0,1 mA, kondenzátorom `$I_{C} ≈ $Q · $I` = 6,3 mA.',
        ],
        result: '`$f_{0}` ≈ 50,3 kHz, `$Q` ≈ 63, `$R_{d}` = 20 kΩ, `$B` ≈ 0,8 kHz',
      },
      { t: 'h', text: 'Porovnanie sériovej a paralelnej rezonancie' },
      {
        t: 'table',
        head: ['', 'Sériový obvod', 'Paralelný obvod'],
        rows: [
          ['spoločná veličina', 'prúd', 'napätie'],
          ['názov', 'rezonancia napätí', 'rezonancia prúdov'],
          ['impedancia pri `$f_{0}`', 'najmenšia, `$Z = $R`', 'najväčšia, `$Z = $R_{d}`'],
          ['prúd zo zdroja', 'najväčší', 'najmenší'],
          ['`$Q`-krát väčšie sú', 'napätia na `$L` a `$C`', 'prúdy v `$L` a `$C`'],
          ['pod `$f_{0}` je charakter', 'kapacitný', 'induktívny'],
          ['nad `$f_{0}` je charakter', 'induktívny', 'kapacitný'],
        ],
      },
      {
        t: 'example',
        title: 'Kondenzátor pre paralelný obvod oscilátora',
        given: ['`$L` = 100 µH', '`$f_{0}` = 455 kHz'],
        steps: [
          '`$C = @f{1}{(2π$f_{0})^{2} · $L}`',
          '`2π$f_{0}` = 2π · 455 000 = 2,859 · 10⁶ rad/s',
          '`$C = @f{1}{(2,859 · 10^{6})^{2} · 10^{−4}} = @f{1}{8,173 · 10^{8}}` = 1,22 · 10⁻⁹ F',
        ],
        result: '`$C` ≈ 1,22 nF (najbližšia hodnota z rady E12 je 1,2 nF)',
      },
      { t: 'h', text: 'Použitie' },
      {
        t: 'list',
        items: [
          '**Oscilátory** – paralelný obvod LC určuje frekvenciu kmitov (pozri lekciu o oscilátoroch).',
          '**Selektívne zosilňovače** – obvod LC ako záťaž tranzistora zosilní len úzke pásmo okolo `$f_{0}`, napr. medzifrekvenčný zosilňovač 10,7 MHz v rádiu FM.',
          '**Odlaďovač (zádrž)** – paralelný obvod v sérii s vedením nepustí jednu frekvenciu, napr. rušivý signál alebo signál hromadného diaľkového ovládania.',
          '**Kompenzovaný motor** – motor s kondenzátorom, ktorý presne kompenzuje jeho jalový výkon, je paralelný obvod v rezonancii pri 50 Hz: zo siete tečie len činný prúd.',
        ],
      },
      { t: 'note', kind: 'remember', text: 'Paralelná rezonancia: impedancia **najväčšia** (`$R_{d} = @f{$L}{$R$C}`), prúd zo zdroja **najmenší**, prúdy v cievke a kondenzátore sú `$Q`-krát väčšie ako prúd zo zdroja.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Prečo sa paralelnej rezonancii hovorí rezonancia prúdov?',
      options: ['prúdy v cievke a kondenzátore sú `$Q`-krát väčšie ako prúd zo zdroja', 'prúd zo zdroja je najväčší', 'všetky prúdy sú vo fáze', 'prúd v cievke je nulový'],
      explanation: 'Prúdy `$I_{L}` a `$I_{C}` sú takmer opačné a navzájom sa vyrušia. Zo zdroja tečie len malý prúd, vo vnútri obvodu však krúži prúd `$Q`-krát väčší.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmení rezonančný odpor paralelného obvodu, keď sa odpor vinutia cievky zmenší na polovicu?',
      options: ['zväčší sa dvakrát', 'zmenší sa na polovicu', 'nezmení sa', 'zväčší sa štyrikrát'],
      explanation: '`$R_{d} = @f{$L}{$R · $C}` – odpor vinutia je v menovateli, preto polovičný odpor znamená dvojnásobný rezonančný odpor.',
    },
    {
      lessonId: ID,
      prompt: 'Aký charakter má paralelný rezonančný obvod pri frekvencii vyššej, ako je rezonančná?',
      options: ['kapacitný', 'induktívny', 'čisto odporový', 'obvod sa správa ako skrat iba pri jednosmernom prúde, inak nemá charakter'],
      explanation: 'S rastúcou frekvenciou rastie prúd kondenzátora `$I_{C} = $U · 2π$f$C` a klesá prúd cievky. Nad rezonanciou prevláda prúd kondenzátora, obvod je kapacitný – opačne ako sériový obvod.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá veličina je spoločná pre všetky prvky paralelného rezonančného obvodu?',
      options: ['napätie', 'prúd', 'reaktancia', 'výkon'],
      explanation: 'Prvky zapojené paralelne sú pripojené na rovnaké dva uzly, preto majú spoločné napätie. Pri sériovom obvode je spoločný prúd.',
    },
    {
      lessonId: ID,
      prompt: 'Činiteľ akosti paralelného obvodu je 50 a prúd zo zdroja pri rezonancii 0,2 mA. Aký prúd tečie cievkou?',
      options: ['približne 10 mA', '0,2 mA', '0,004 mA', '50 mA'],
      explanation: 'Pri rezonancii prúdov je prúd cievky aj kondenzátora približne `$Q`-krát väčší ako prúd zo zdroja: 50 · 0,2 mA = 10 mA.',
    },
    {
      lessonId: ID,
      prompt: 'Čím sa líši rezonančná krivka paralelného obvodu od sériového, keď ju kreslíme ako impedanciu?',
      options: ['paralelný obvod má pri `$f_{0}` maximum impedancie, sériový minimum', 'oba majú pri `$f_{0}` minimum impedancie', 'paralelný obvod nemá rezonančnú frekvenciu', 'sériový obvod má pri `$f_{0}` nekonečnú impedanciu'],
      explanation: 'Sériový obvod má pri rezonancii impedanciu `$R` (minimum), paralelný `$R_{d}` (maximum). Preto sa sériový obvod používa na prepustenie jednej frekvencie a paralelný na jej zadržanie alebo ako selektívna záťaž.',
    },
  ],
  generators,
};

export default mod;
