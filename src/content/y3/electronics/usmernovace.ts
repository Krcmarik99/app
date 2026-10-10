import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { bridgeFigure, centerTapFigure, halfWaveFigure, rectifierChart } from '../../../ui/fig-electronics';
import { choice } from '../util';

const ID = 'usmernovace';

/** Výstupné napätie usmerňovača s filtračným kondenzátorom pri konštantnom prúde záťaže. */
function filterExplorer(): HTMLElement {
  return explorer({
    title: 'Usmerňovač s filtračným kondenzátorom',
    params: [
      { key: 'C', label: 'Kapacita `$C`', unit: 'F', min: 100e-6, max: 10e-3, value: 2200e-6, log: true, format: (v) => `${fmt(v * 1e6, 3)} µF` },
      { key: 'I', label: 'Prúd záťaže `$I`', unit: 'A', min: 0.05, max: 2, value: 0.5, log: true },
    ],
    choices: [{ key: 'kind', label: 'Zapojenie', options: [['full', 'mostíkový (dvojcestný)'], ['half', 'jednocestný']], value: 'full' }],
    draw: ({ C, I }, { kind }) => {
      const U = 12;
      const um = U * Math.SQRT2;
      const full = kind === 'full';
      const drop = full ? 1.4 : 0.7;
      const fz = full ? 100 : 50;
      const w = 2 * Math.PI * 50;
      const src = (ms: number) => {
        const u = um * Math.sin((w * ms) / 1000);
        return Math.max(0, (full ? Math.abs(u) : u) - drop);
      };
      // Simulácia: kondenzátor sa dobíja na napätie usmerňovača, inak ho záťaž vybíja konštantným prúdom.
      const dt = 0.01;
      let v = um - drop;
      const shown: [number, number][] = [];
      let max = -Infinity;
      let min = Infinity;
      let sum = 0;
      let count = 0;
      for (let k = 0; k <= 8000; k++) {
        const t = k * dt;
        v = Math.max(0, src(t), v - (I * dt) / 1000 / C);
        if (t >= 40) {
          if (k % 10 === 0) shown.push([t - 40, v]);
          max = Math.max(max, v);
          min = Math.min(min, v);
          sum += v;
          count += 1;
        }
      }
      const ripple = max - min;
      const approx = I / (fz * C);
      const chart = lineChart({
        ariaLabel: `Výstupné napätie ${full ? 'mostíkového' : 'jednocestného'} usmerňovača s kondenzátorom ${fmt(C * 1e6, 3)} µF pri prúde ${fmt(I, 3)} A`,
        width: 460,
        height: 250,
        x: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40], format: (val) => `${val}`, label: 't [ms]' },
        y: { min: 0, max: 20, ticks: [0, 5, 10, 15, 20], format: (val) => `${val}`, label: 'u [V]' },
        series: [
          { points: Array.from({ length: 401 }, (_, i) => [i / 10, src(40 + i / 10)] as [number, number]), className: 'dashed' },
          { points: shown, className: 'copper' },
        ],
        legend: [{ label: 'bez kondenzátora', className: 'dashed' }, { label: 'ud s kondenzátorom', className: 'copper' }],
      });
      return {
        chart,
        readouts: [
          ['`$U_{max}`', `${fmt(max, 3)} V`],
          ['`$U_{min}`', `${fmt(min, 3)} V`],
          ['Zvlnenie `Δ$U`', `${fmt(ripple, 3)} V`],
          ['Vzorec `@f{$I}{$f_{z} · $C}`', `${fmt(approx, 3)} V`],
          ['Stredná hodnota', `${fmt(sum / count, 3)} V`],
        ],
        note: approx > 0.4 * (um - drop)
          ? 'Kondenzátor je na tento prúd primalý. Zvlnenie je veľké a približný vzorec platí len pri malom zvlnení – skutočné zvlnenie je menšie, lebo kondenzátor sa začne dobíjať skôr, ako napätie klesne o celé `Δ$U`.'
          : `Sekundárne napätie 12 V, vrchol ${fmt(um, 3)} V, úbytok na diódach ${fmt(drop, 2)} V. Zvlnenie má frekvenciu ${fz} Hz – skús porovnať jednocestné a mostíkové zapojenie pri rovnakom C.`,
      };
    },
  });
}

const KIND_TEXT = { half: 'jednocestného', full: 'dvojcestného (mostíkového)' } as const;
const KIND_INS = { half: 'jednocestným', full: 'dvojcestným (mostíkovým)' } as const;

const generators: Generator[] = [
  (rng) => {
    const U = pick(rng, [6, 9, 12, 15, 18, 24, 230]);
    const Um = Math.SQRT2 * U;
    return numeric(ID, `Efektívna hodnota striedavého napätia je ${q(U, 'V')}. Aká je jeho vrcholová hodnota?`, Um, 'V', [
      '`$U_{m} = @s{2} · $U`',
      `\`$U_{m}\` = 1,414 · ${n(U)} = ${res(Um, 'V')}`,
    ]);
  },
  (rng) => {
    const kind = pick(rng, ['half', 'full'] as const);
    const U = pick(rng, [6, 9, 12, 15, 18, 24, 30]);
    const k = kind === 'half' ? 0.45 : 0.9;
    const Ud = k * U;
    return numeric(ID, `Transformátor dáva sekundárne napätie ${q(U, 'V')} (efektívna hodnota). Aká je stredná hodnota napätia na výstupe ${KIND_TEXT[kind]} usmerňovača bez filtra? Úbytky na diódach zanedbaj.`, Ud, 'V', [
      kind === 'half' ? '`$U_{d} = @f{$U_{m}}{π} ≈ 0,45 · $U`' : '`$U_{d} = @f{2 · $U_{m}}{π} ≈ 0,9 · $U`',
      `\`$U_{d}\` = ${n(k)} · ${n(U)} = ${res(Ud, 'V')}`,
    ]);
  },
  (rng) => {
    let kind: 'half' | 'full' = 'full';
    let I = 0.5;
    let C = 2200e-6;
    let dU = 0;
    for (let i = 0; i < 30; i++) {
      kind = pick(rng, ['half', 'full'] as const);
      I = pick(rng, [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5]);
      C = pick(rng, [470e-6, 1000e-6, 2200e-6, 3300e-6, 4700e-6, 10000e-6]);
      dU = I / ((kind === 'half' ? 50 : 100) * C);
      if (dU >= 0.2 && dU <= 5) break;
    }
    const fz = kind === 'half' ? 50 : 100;
    return numeric(ID, `Za ${KIND_INS[kind]} usmerňovačom zo siete 50 Hz je filtračný kondenzátor ${n(C * 1e6)} µF. Záťaž odoberá prúd ${q(I, 'A')}. Aké je približne zvlnenie výstupného napätia?`, dU, 'V', [
      `Frekvencia zvlnenia je \`$f_{z}\` = ${fz} Hz.`,
      `\`Δ$U ≈ @f{$I}{$f_{z} · $C} = @f{${n(I)}}{${fz} · ${n(C, 3)}}\` = ${res(dU, 'V')}`,
    ]);
  },
  (rng) => {
    const kind = pick(rng, ['half', 'full'] as const);
    const I = pick(rng, [0.1, 0.2, 0.25, 0.5, 1, 2]);
    const dU = pick(rng, [0.5, 1, 1.5, 2, 3]);
    const fz = kind === 'half' ? 50 : 100;
    const C = I / (fz * dU);
    return numeric(ID, `Navrhni filtračný kondenzátor za ${KIND_INS[kind]} usmerňovačom (sieť 50 Hz) pre prúd záťaže ${q(I, 'A')}, ak zvlnenie nemá prekročiť ${q(dU, 'V')}. Akú najmenšiu kapacitu v mikrofaradoch potrebuješ?`, C * 1e6, 'µF', [
      `Frekvencia zvlnenia je \`$f_{z}\` = ${fz} Hz.`,
      `\`$C = @f{$I}{$f_{z} · Δ$U} = @f{${n(I)}}{${fz} · ${n(dU)}}\` = ${n(C, 4)} F = **${n(C * 1e6, 4)} µF**`,
      'V praxi zvolíš najbližšiu vyššiu vyrábanú hodnotu.',
    ], { fixedUnit: true });
  },
  (rng) => {
    const U = pick(rng, [6, 9, 12, 15, 18, 24]);
    const Um = Math.SQRT2 * U;
    const U0 = Um - 1.4;
    return numeric(ID, `Mostíkový usmerňovač s filtračným kondenzátorom napája transformátor so sekundárnym napätím ${q(U, 'V')}. Na každej vodivej dióde je úbytok 0,7 V. Na aké napätie sa kondenzátor nabije naprázdno (bez záťaže)?`, U0, 'V', [
      `\`$U_{m} = @s{2} · $U\` = 1,414 · ${n(U)} = ${n(Um, 4)} V`,
      'V mostíku vedú naraz dve diódy, úbytok je 2 · 0,7 = 1,4 V.',
      `\`$U_{0} = $U_{m} − 1,4\` = ${n(Um, 4)} − 1,4 = ${res(U0, 'V')}`,
    ]);
  },
  (rng) => {
    const kind = pick(rng, ['half', 'center', 'bridge'] as const);
    const name = { half: 'jednocestného usmerňovača', center: 'dvojcestného usmerňovača so stredným vývodom transformátora', bridge: 'mostíkového (Graetzovho) usmerňovača' }[kind];
    const ok = kind === 'half' ? '50 Hz' : '100 Hz';
    const wrong = kind === 'half' ? ['100 Hz', '25 Hz'] : ['50 Hz', '200 Hz'];
    return choice(ID, `Aká je frekvencia zvlnenia napätia na výstupe ${name}, ktorý je napájaný zo siete 50 Hz?`,
      [ok, wrong[0], wrong[1], '0 Hz – za usmerňovačom je napätie dokonale jednosmerné'],
      kind === 'half'
        ? 'Jednocestný usmerňovač prepustí jednu polvlnu za periódu, teda 50 impulzov za sekundu – zvlnenie má 50 Hz.'
        : 'Dvojcestný usmerňovač využije obe polvlny, za periódu dá dva impulzy. Zvlnenie má preto 100 Hz a ľahšie sa filtruje.',
      rng);
  },
  (rng) => {
    const kind = pick(rng, ['bridge', 'half', 'center'] as const);
    const U = pick(rng, [9, 12, 15, 18, 24]);
    const Um = Math.SQRT2 * U;
    const v = (x: number) => `${n(x, 3)} V`;
    const correct = kind === 'bridge' ? Um : 2 * Um;
    const other = kind === 'bridge' ? 2 * Um : Um;
    const name = {
      bridge: `mostíkového usmerňovača so sekundárnym napätím ${q(U, 'V')}`,
      half: `jednocestného usmerňovača s filtračným kondenzátorom, ak má transformátor sekundárne napätie ${q(U, 'V')}`,
      center: `dvojcestného usmerňovača so stredným vývodom, ak má každá polovica sekundárneho vinutia ${q(U, 'V')}`,
    }[kind];
    return choice(ID, `Aké najväčšie záverné napätie je na diódach ${name}? (Úbytky zanedbaj.)`,
      [v(correct), v(other), v(U), v(Um / 2)],
      kind === 'bridge'
        ? `V mostíku sú v závernom smere vždy dve diódy paralelne k vinutiu, každá dostane vrcholové napätie \`$U_{m} = @s{2} · $U\` = ${v(Um)}.`
        : `Na nevodivej dióde sa sčíta napätie ${kind === 'half' ? 'nabitého kondenzátora' : 'druhej polovice vinutia'} a napätie vinutia v opačnej polvlne – spolu \`2 · $U_{m}\` = 2 · ${v(Um)} = ${v(2 * Um)}.`,
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'electronics',
    title: 'Usmerňovače a filtrácia',
    summary: 'Jednocestný, dvojcestný a mostíkový usmerňovač, stredná a vrcholová hodnota, filtračný kondenzátor a zvlnenie.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Elektronické zariadenia potrebujú jednosmerné napätie, sieť však dodáva striedavé 230 V, 50 Hz. Sieťový napájací zdroj ho upraví v niekoľkých krokoch: **transformátor** zníži napätie a galvanicky oddelí obvod od siete, **usmerňovač** z neho urobí pulzujúce jednosmerné napätie, **filter** ho vyhladí a **stabilizátor** udrží výstupné napätie stále. Usmerňovač je postavený z diód, ktoré poznáš z lekcie o dióde a LED.' },
      { t: 'h', text: 'Jednocestný usmerňovač' },
      { t: 'p', text: 'Najjednoduchší usmerňovač tvorí jedna dióda v sérii so záťažou. Počas kladnej polvlny je dióda v priepustnom smere a napätie sa dostane na záťaž. Počas zápornej polvlny je v závernom smere a prúd netečie. Z každej periódy sa tak využije len polovica.' },
      { t: 'figure', fig: halfWaveFigure, caption: 'Jednocestný usmerňovač: dióda `D` prepustí do záťaže `$R_{z}` len kladné polvlny sekundárneho napätia `$u`.' },
      { t: 'figure', fig: () => rectifierChart('half'), caption: 'Výstupné napätie `$u_{d}` jednocestného usmerňovača pri `$U` = 12 V (diódy považované za ideálne). Medzi impulzmi je napätie nulové, zvlnenie má frekvenciu 50 Hz.' },
      {
        t: 'formula',
        tex: ['$U_{m} = @s{2} · $U', '$U_{d} = @f{$U_{m}}{π} ≈ 0,45 · $U'],
        legend: [
          ['$U', 'efektívna hodnota striedavého (sekundárneho) napätia', 'V'],
          ['$U_{m}', 'vrcholová (maximálna) hodnota', 'V'],
          ['$U_{d}', 'stredná hodnota usmerneného napätia bez filtra', 'V'],
        ],
      },
      { t: 'p', text: 'Stredná hodnota je jednosmerná zložka – ukáže ju jednosmerný (magnetoelektrický) voltmeter. Jednocestný usmerňovač má veľké zvlnenie a zle využíva transformátor, preto sa používa len pri malých prúdoch.' },
      { t: 'h', text: 'Dvojcestné usmerňovače' },
      { t: 'p', text: 'Dvojcestný usmerňovač využije obe polvlny – zápornú „preklopí“ na kladnú. Stredná hodnota je preto dvojnásobná a zvlnenie má dvojnásobnú frekvenciu 100 Hz, čo sa ľahšie filtruje. Existujú dve zapojenia: so **stredným vývodom transformátora** (dve diódy) a **mostíkové, Graetzovo** (štyri diódy).' },
      { t: 'figure', fig: centerTapFigure, caption: 'Zapojenie so stredným vývodom: počas jednej polvlny vedie `$D_{1}`, počas druhej `$D_{2}`. Každá polovica sekundárneho vinutia musí dávať celé napätie `$U`, transformátor je teda väčší.' },
      { t: 'figure', fig: () => bridgeFigure(), caption: 'Mostíkový (Graetzov) usmerňovač: počas kladnej polvlny vedú `$D_{2}` a `$D_{3}`, počas zápornej `$D_{4}` a `$D_{1}`. Prúd tečie záťažou vždy rovnakým smerom. Mostík sa vyrába aj ako jedna súčiastka so štyrmi vývodmi (~, ~, +, −).' },
      { t: 'figure', fig: () => rectifierChart('full'), caption: 'Výstupné napätie dvojcestného usmerňovača pri `$U` = 12 V: obe polvlny idú do záťaže, stredná hodnota je dvojnásobná.' },
      { t: 'formula', tex: '$U_{d} = @f{2 · $U_{m}}{π} ≈ 0,9 · $U', legend: [['$U_{d}', 'stredná hodnota napätia za dvojcestným usmerňovačom bez filtra', 'V']] },
      {
        t: 'table',
        head: ['Zapojenie', 'Diódy', '`$U_{d}` bez filtra', 'Zvlnenie', 'Záverné napätie diódy'],
        rows: [
          ['jednocestné', '1', '`0,45 · $U`', '50 Hz', '`$U_{m}`, s kondenzátorom `2 · $U_{m}`'],
          ['so stredným vývodom', '2', '`0,9 · $U`', '100 Hz', '`2 · $U_{m}`'],
          ['mostíkové (Graetzovo)', '4', '`0,9 · $U`', '100 Hz', '`$U_{m}`'],
        ],
      },
      { t: 'p', text: 'V mostíku vedú naraz **dve diódy v sérii**, preto je na nich úbytok asi 2 · 0,7 = 1,4 V. Pri nízkych napätiach (5 V a menej) je to citeľná strata, vtedy sa používa zapojenie so stredným vývodom alebo Schottkyho diódy s menším úbytkom.' },
      {
        t: 'example',
        title: 'Mostíkový usmerňovač zo sekundárneho napätia 12 V',
        given: ['`$U` = 12 V (efektívna hodnota)', 'mostík, kremíkové diódy s úbytkom 0,7 V'],
        steps: [
          '`$U_{m} = @s{2} · $U` = 1,414 · 12 = 16,97 V',
          'Bez filtra a pri zanedbaní úbytkov: `$U_{d} = 0,9 · $U` = 0,9 · 12 = 10,8 V',
          'S filtračným kondenzátorom naprázdno: `$U_{0} = $U_{m} − 2 · 0,7` = 16,97 − 1,4 = 15,57 V',
          'Každá dióda musí v závernom smere vydržať aspoň `$U_{m}` ≈ 17 V – s rezervou vyhovie napríklad 1N4001 (50 V, 1 A).',
        ],
        result: '`$U_{m}` ≈ 17 V, `$U_{d}` = 10,8 V, naprázdno s kondenzátorom ≈ 15,6 V',
      },
      { t: 'h', text: 'Filtrácia kondenzátorom' },
      { t: 'p', text: 'Pulzujúce napätie vyhladí **filtračný kondenzátor** zapojený paralelne k záťaži (elektrolytický, stovky až tisíce µF). Pri vrchole polvlny sa nabije takmer na vrcholovú hodnotu. Keď napätie usmerňovača klesá, diódy sa zatvoria a záťaž napája kondenzátor – jeho napätie pomaly klesá, kým ho nedobije ďalšia polvlna. Výstupné napätie preto kolíše len o **zvlnenie** `Δ$U`.' },
      { t: 'figure', fig: () => bridgeFigure({ filter: true }), caption: 'Filtračný kondenzátor `$C` je pripojený paralelne k záťaži, kladným pólom na kladný výstup mostíka.' },
      { t: 'explore', build: filterExplorer, caption: 'Zväčši prúd záťaže a sleduj, ako rastie zvlnenie. Potom zväčši kapacitu alebo prepni na jednocestné zapojenie – pri ňom potrebuješ na rovnaké zvlnenie dvojnásobnú kapacitu.' },
      {
        t: 'formula',
        tex: ['$U_{0} ≈ $U_{m} − $U_{F}', 'Δ$U ≈ @f{$I}{$f_{z} · $C}', '$C ≈ @f{$I}{$f_{z} · Δ$U}'],
        legend: [
          ['$U_{0}', 'napätie na kondenzátore naprázdno', 'V'],
          ['$U_{F}', 'úbytok na vodivých diódach: 0,7 V (jednocestný), 1,4 V (mostík)', 'V'],
          ['Δ$U', 'zvlnenie – rozkmit výstupného napätia', 'V'],
          ['$I', 'prúd záťaže', 'A'],
          ['$f_{z}', 'frekvencia zvlnenia: 50 Hz jednocestný, 100 Hz dvojcestný', 'Hz'],
          ['$C', 'kapacita filtračného kondenzátora', 'F'],
        ],
      },
      {
        t: 'example',
        title: 'Návrh filtračného kondenzátora',
        given: ['mostíkový usmerňovač, `$f_{z}` = 100 Hz', 'prúd záťaže `$I` = 0,5 A', 'dovolené zvlnenie `Δ$U` = 2 V'],
        steps: [
          '`$C = @f{$I}{$f_{z} · Δ$U} = @f{0,5}{100 · 2}` = 0,0025 F = 2 500 µF',
          'Zvolíš najbližšiu vyššiu vyrábanú hodnotu 3 300 µF.',
          'Skutočné zvlnenie: `Δ$U = @f{0,5}{100 · 0,0033}` = 1,52 V',
          'Jednocestný usmerňovač (50 Hz) by na rovnaké zvlnenie potreboval dvojnásobnú kapacitu 5 000 µF.',
        ],
        result: '`$C` = 3 300 µF, zvlnenie asi 1,5 V',
      },
      { t: 'note', kind: 'warn', text: 'Elektrolytický kondenzátor má polaritu – pri prepólovaní sa zničí, môže aj vybuchnúť. Jeho menovité napätie volíš s rezervou nad `$U_{m}`. Pri jednocestnom zapojení s kondenzátorom dostane dióda v závernom smere až `2 · $U_{m}`.' },
      { t: 'note', kind: 'remember', text: 'Pri zaťažení je stredné napätie na kondenzátore asi `$U_{m} − $U_{F} − @f{Δ$U}{2}`. Zvlnenie rastie s prúdom a klesá s kapacitou; dvojcestný usmerňovač má pri rovnakom `$C` polovičné zvlnenie.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aká je stredná hodnota napätia za dvojcestným usmerňovačom bez filtra, ak je efektívne napätie transformátora 20 V? (Úbytky na diódach zanedbaj.)',
      options: ['18 V', '9 V', '28,3 V', '20 V'],
      explanation: '`$U_{d} = 0,9 · $U` = 0,9 · 20 = 18 V. Hodnota 9 V platí pre jednocestný usmerňovač a 28,3 V je vrcholová hodnota.',
    },
    {
      lessonId: ID,
      prompt: 'Koľko diód má mostíkový (Graetzov) usmerňovač a koľko z nich vedie naraz?',
      options: ['4 diódy, naraz vedú 2', '2 diódy, naraz vedie 1', '4 diódy, naraz vedú všetky 4', '1 dióda, vedie stále'],
      explanation: 'V každej polvlne vedie dvojica diód v sérii (napríklad D2 a D3), druhá dvojica je v závernom smere. Preto je úbytok asi 1,4 V.',
    },
    {
      lessonId: ID,
      prompt: 'Akú frekvenciu má zvlnenie na výstupe dvojcestného usmerňovača napájaného zo siete 50 Hz?',
      options: ['100 Hz', '50 Hz', '25 Hz', '0 Hz – napätie je dokonale jednosmerné'],
      explanation: 'Dvojcestný usmerňovač využije obe polvlny, za jednu periódu sú na výstupe dva impulzy – 100 za sekundu.',
    },
    {
      lessonId: ID,
      prompt: 'Na aké napätie sa naprázdno nabije filtračný kondenzátor za mostíkom, ak je sekundárne napätie 9 V?',
      options: ['asi 11,3 V', '9 V', '8,1 V', '12,7 V'],
      explanation: 'Kondenzátor sa nabije na vrcholovú hodnotu mínus úbytok na dvoch diódach: `@s{2}` · 9 − 1,4 = 12,73 − 1,4 ≈ 11,3 V. Hodnota 12,7 V by platila pre ideálne diódy, 8,1 V je stredná hodnota bez filtra.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmení zvlnenie, keď pri rovnakom prúde záťaže zdvojnásobíš kapacitu filtračného kondenzátora?',
      options: ['zmenší sa na polovicu', 'zdvojnásobí sa', 'nezmení sa', 'zmenší sa na štvrtinu'],
      explanation: 'Zvlnenie `Δ$U ≈ @f{$I}{$f_{z} · $C}` je nepriamo úmerné kapacite.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo napätie na filtračnom kondenzátore pri väčšom odbere prúdu klesá a viac kolíše?',
      options: ['kondenzátor sa medzi vrcholmi polvĺn viac vybije do záťaže', 'diódy prestanú úplne viesť', 'zvýši sa frekvencia siete', 'kondenzátor pri väčšom prúde stratí kapacitu'],
      explanation: 'Medzi vrcholmi napája záťaž iba kondenzátor. Čím väčší prúd odoberá, tým viac náboja stratí a tým viac jeho napätie klesne.',
    },
    {
      lessonId: ID,
      prompt: 'Aké záverné napätie musí vydržať dióda jednocestného usmerňovača s filtračným kondenzátorom?',
      options: ['približne `2 · $U_{m}`', '`$U_{m}`', 'efektívne napätie `$U`', '`0,45 · $U`'],
      explanation: 'V zápornej polvlne je na katóde napätie nabitého kondenzátora `+$U_{m}` a na anóde `−$U_{m}`. Dióda musí vydržať ich súčet.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zapája filtračný kondenzátor?',
      options: ['paralelne k záťaži, za usmerňovač', 'do série so záťažou', 'pred transformátor priamo do siete', 'paralelne k jednej z diód'],
      explanation: 'Kondenzátor je zásobník náboja na jednosmernej strane – pripája sa medzi kladný a záporný výstup usmerňovača, teda paralelne k záťaži.',
    },
  ],
  generators,
};

export default mod;
