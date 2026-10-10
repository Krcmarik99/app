import type { MeasModule } from './types';
import { int, pick, shuffle } from '../../lib/random';
import { fmt, formatSI } from '../../lib/units';
import { n, numeric, q, type Generator } from '../../practice/helpers';
import { lineChart, sample } from '../../ui/chart';
import { explorer, logLabel, logTicks } from '../../ui/explorer';
import { bridgeFigure } from '../../ui/fig-power';
import { choice, clean } from '../y3/util';

/*
 * Lekcia – mostíkové (nulové) metódy merania odporu a nevyvážený mostík ako snímač.
 * Značenie podľa obrázka: R1 (= Rx) hore vľavo, R2 hore vpravo, R3 dole vľavo, R4 dole vpravo,
 * zdroj U0 medzi uzlami A (hore) a C (dole), nulový indikátor medzi uzlami B (vľavo) a D (vpravo).
 */

const ID = 'mostikove-metody';

/** Napätie medzi uzlami B a D (merané od dolného uzla C). */
const bridgeU = (U0: number, R1: number, R2: number, R3: number, R4: number) => U0 * (R3 / (R1 + R3) - R4 / (R2 + R4));

/** Výstupné napätie nevyváženého mostíka v závislosti od Rx. */
function bridgeExplorer(): HTMLElement {
  const R4 = 1000;
  return explorer({
    title: 'Výstupné napätie mostíka',
    params: [
      { key: 'U0', label: 'Napájacie napätie `$U_{0}`', unit: 'V', min: 1, max: 12, value: 6 },
      { key: 'R2', label: 'Porovnávací odpor `$R_{2}`', unit: 'Ω', min: 100, max: 10000, value: 1000, log: true },
      { key: 'k', label: 'Pomer ramien `@f{$R_{3}}{$R_{4}}`', unit: '', min: 0.1, max: 10, value: 1, log: true, format: (v) => fmt(v, 3) },
    ],
    draw: ({ U0, R2, k }) => {
      const R3 = k * R4;
      const Rb = (R2 * R3) / R4;
      const u = (x: number) => bridgeU(U0, 10 ** x, R2, R3, R4);
      // Zmena výstupného napätia pri zmene Rx o 1 % okolo rovnováhy.
      const dU = Math.abs(bridgeU(U0, Rb * 1.01, R2, R3, R4));
      const chart = lineChart({
        ariaLabel: `Výstupné napätie mostíka v závislosti od Rx, rovnováha pri ${formatSI(Rb, 'Ω', 3)}`,
        width: 460,
        height: 250,
        x: { min: 1, max: 6, ticks: logTicks(1, 6), format: (v) => logLabel(v, 'Ω'), label: 'Rₓ (log)' },
        y: { min: -12, max: 12, ticks: [-12, -6, 0, 6, 12], format: (v) => fmt(v), label: 'U (B–D) [V]' },
        series: [{ points: sample(u, 1, 6, 200), className: 'copper' }],
        vlines: Rb >= 10 && Rb <= 1e6 ? [{ x: Math.log10(Rb), label: 'rovnováha' }] : [],
      });
      return {
        chart,
        readouts: [
          ['Rovnováha pri `$R_{x} = $R_{2} · @f{$R_{3}}{$R_{4}}`', formatSI(Rb, 'Ω', 3)],
          ['Zmena `$U` pri zmene `$R_{x}` o 1 %', formatSI(dU, 'V', 3)],
          ['`$R_{3}` (pri `$R_{4}` = 1 kΩ)', formatSI(R3, 'Ω', 3)],
        ],
        note: 'Pri rovnováhe je výstupné napätie nulové pri akomkoľvek `$U_{0}`. Mimo rovnováhy je napätie úmerné `$U_{0}`. Citlivosť je najväčšia, keď majú všetky ramená blízke odpory (`$R_{2}` ≈ `$R_{4}`).',
      };
    },
  });
}

const RATIOS: [number, number][] = [[10, 1000], [100, 1000], [1000, 1000], [1000, 100], [1000, 10]];

const generators: Generator[] = [
  // Rx z vyváženého mostíka.
  (rng) => {
    const [R3, R4] = pick(rng, RATIOS);
    const R2 = int(rng, 1000, 9999);
    const Rx = clean((R2 * R3) / R4);
    return numeric(ID, `Wheatstoneov mostík je vyvážený (nulový indikátor ukazuje nulu). Porovnávací dekádový odpor je \`$R_{2}\` = ${n(R2, 5)} Ω, pomerové ramená \`$R_{3}\` = ${n(R3)} Ω a \`$R_{4}\` = ${n(R4)} Ω. Aký je meraný odpor \`$R_{x}\` = \`$R_{1}\`?`, Rx, 'Ω', [
      'Podmienka rovnováhy: `$R_{1} · $R_{4} = $R_{2} · $R_{3}`.',
      `\`$R_{x} = $R_{2} · @f{$R_{3}}{$R_{4}} = ${n(R2, 5)} · @f{${n(R3)}}{${n(R4)}}\` = **${q(Rx, 'Ω', 4)}**`,
    ], { tolerance: 0.005, figure: () => bridgeFigure({ r1: '(Rx)', r2: `${n(R2, 5)} Ω`, r3: `${n(R3)} Ω`, r4: `${n(R4)} Ω` }) });
  },
  // Porovnávací odpor potrebný na vyváženie.
  (rng) => {
    const Rx = pick(rng, [47, 82, 150, 220, 330, 470, 680, 1000, 1500, 2200, 4700, 6800]);
    const [R3, R4] = pick(rng, RATIOS.filter(([a, b]) => (Rx * b) / a >= 100 && (Rx * b) / a <= 10000));
    const R2 = clean((Rx * R4) / R3);
    return numeric(ID, `V ramene \`$R_{1}\` Wheatstoneovho mostíka je rezistor \`$R_{x}\` = ${q(Rx, 'Ω')}. Pomerové ramená sú \`$R_{3}\` = ${n(R3)} Ω a \`$R_{4}\` = ${n(R4)} Ω. Na akú hodnotu treba nastaviť porovnávací odpor \`$R_{2}\`, aby bol mostík vyvážený?`, R2, 'Ω', [
      'Z podmienky rovnováhy `$R_{1} · $R_{4} = $R_{2} · $R_{3}` vyjadríme `$R_{2}`.',
      `\`$R_{2} = $R_{x} · @f{$R_{4}}{$R_{3}} = ${n(Rx)} · @f{${n(R4)}}{${n(R3)}}\` = **${q(R2, 'Ω', 4)}**`,
    ], { tolerance: 0.005 });
  },
  // Výstupné napätie nevyváženého mostíka.
  (rng) => {
    const R = pick(rng, [100, 120, 350, 1000]);
    const x = pick(rng, [0.02, 0.05, 0.1, 0.15, 0.2, -0.05, -0.1, -0.15]);
    const R1 = clean(R * (1 + x));
    const U0 = pick(rng, [2, 5, 10, 12]);
    const VB = (U0 * R) / (R1 + R);
    const VD = U0 / 2;
    const U = Math.abs(VB - VD);
    return numeric(ID, `Mostík napájaný napätím \`$U_{0}\` = ${n(U0)} V má odpory \`$R_{2}\` = \`$R_{3}\` = \`$R_{4}\` = ${n(R)} Ω. Snímač v ramene \`$R_{1}\` má práve odpor ${n(R1, 4)} Ω. Aké veľké napätie ukáže voltmeter medzi uzlami B a D?`, U, 'V', [
      `Ľavá vetva (delič \`$R_{1}\`, \`$R_{3}\`): \`$U_{B} = $U_{0} · @f{$R_{3}}{$R_{1} + $R_{3}} = ${n(U0)} · @f{${n(R)}}{${n(R1, 4)} + ${n(R)}}\` = ${n(VB, 5)} V`,
      `Pravá vetva (\`$R_{2}\` = \`$R_{4}\`): \`$U_{D} = @f{$U_{0}}{2}\` = ${n(VD, 4)} V`,
      `\`|$U_{BD}| = |$U_{B} − $U_{D}|\` = |${n(VB, 5)} − ${n(VD, 4)}| = **${q(U, 'V')}**`,
      `Približne: \`$U ≈ $U_{0} · @f{Δ$R}{4 · $R}\` = ${q((U0 * Math.abs(R1 - R)) / (4 * R), 'V')} – presné len pri malej zmene odporu.`,
    ], { tolerance: 0.01, figure: () => bridgeFigure({ r1: `${n(R1, 4)} Ω`, r2: `${n(R)} Ω`, r3: `${n(R)} Ω`, r4: `${n(R)} Ω` }) });
  },
  // Tenzometer – približné výstupné napätie (výber).
  (rng) => {
    const R = pick(rng, [120, 350]);
    const pct = pick(rng, [0.1, 0.2, 0.25, 0.4, 0.5]);
    const dR = clean((R * pct) / 100);
    const U0 = pick(rng, [2.5, 5, 10]);
    const U = (U0 * dR) / (4 * R);
    const opts = [U, 4 * U, U / 4, 2 * U].map((v) => q(v, 'V')) as [string, string, string, string];
    return choice(ID, `Tenzometer s odporom ${n(R)} Ω je v jednom ramene mostíka so štyrmi rovnakými odpormi napájaného napätím ${n(U0)} V. Pri zaťažení sa jeho odpor zmení o ${n(dR, 3)} Ω. Aké približne napätie bude na výstupe mostíka?`, opts,
      `Pri malej zmene odporu v jednom ramene: \`$U ≈ $U_{0} · @f{Δ$R}{4 · $R} = ${n(U0)} · @f{${n(dR, 3)}}{4 · ${n(R)}}\` = ${q(U, 'V')}. Výstupné napätie je veľmi malé, preto sa zosilňuje meracím zosilňovačom.`,
      rng);
  },
  // Citlivosť a vlastnosti mostíka (výber).
  (rng) => {
    const v = pick(rng, [
      {
        prompt: 'Ako sa zmení výsledok merania vyváženým Wheatstoneovým mostíkom, keď zdvojnásobíš napätie zdroja?',
        options: ['nezmení sa – podmienka rovnováhy nezávisí od napätia', 'nameraný odpor bude dvojnásobný', 'nameraný odpor bude polovičný', 'mostík sa nedá vyvážiť'],
        why: 'V podmienke `$R_{1} · $R_{4} = $R_{2} · $R_{3}` napätie nevystupuje. Väčšie napätie len zväčší citlivosť – výchylku indikátora pri malej nerovnováhe.',
      },
      {
        prompt: 'Ako sa zmení výstupné napätie nevyváženého mostíka, keď zdvojnásobíš napájacie napätie?',
        options: ['zdvojnásobí sa', 'nezmení sa', 'zmenší sa na polovicu', 'zväčší sa štvornásobne'],
        why: 'Obe vetvy sú deliče napätia `$U_{0}`, preto je ich rozdiel úmerný `$U_{0}`: `$U_{BD} = $U_{0} · (@f{$R_{3}}{$R_{1} + $R_{3}} − @f{$R_{4}}{$R_{2} + $R_{4}})`.',
      },
      {
        prompt: 'Od čoho najviac závisí presnosť merania vyváženým Wheatstoneovým mostíkom?',
        options: ['od presnosti porovnávacích odporov a citlivosti nulového indikátora', 'od presnosti napätia zdroja', 'od triedy presnosti voltmetra', 'od vnútorného odporu zdroja'],
        why: 'Výsledok sa počíta len z odporov `$R_{2}`, `$R_{3}`, `$R_{4}`. Nulový indikátor musí byť citlivý, aby sa dala presne nájsť rovnováha, ale nemusí byť presný.',
      },
      {
        prompt: 'Prečo sa veľmi malé odpory (zlomky ohmu) nemerajú Wheatstoneovým mostíkom?',
        options: ['výsledok skreslia odpory prívodov a prechodové odpory svoriek', 'mostík by sa preťažil', 'nulový indikátor nereaguje na malé prúdy', 'pri malých odporoch neplatí Ohmov zákon'],
        why: 'Odpory prívodov a kontaktov sú rádovo 0,01 Ω a pripočítajú sa k meranému odporu. Thomsonov mostík ich vplyv vylúči štvorsvorkovým pripojením.',
      },
    ]);
    return choice(ID, v.prompt, v.options as [string, string, string, string], v.why, rng);
  },
  // Voľba metódy.
  (rng) => {
    const v = pick(rng, [
      { what: 'odpor prúdovej spojky (asi 0,002 Ω)', a: 'Thomsonov (dvojitý) mostík' },
      { what: 'rezistor s odporom približne 4,7 kΩ s presnosťou 0,1 %', a: 'Wheatstoneov mostík' },
      { what: 'indukčnosť cievky a jej odpor', a: 'Maxwellov–Wienov mostík' },
      { what: 'kapacitu a stratový činiteľ kondenzátora pre vysoké napätie', a: 'Scheringov mostík' },
    ]);
    const all = ['Thomsonov (dvojitý) mostík', 'Wheatstoneov mostík', 'Maxwellov–Wienov mostík', 'Scheringov mostík'];
    const rest = shuffle(rng, all.filter((x) => x !== v.a));
    return choice(ID, `Ktorý mostík je najvhodnejší na meranie: ${v.what}?`, [v.a, rest[0], rest[1], rest[2]],
      'Wheatstoneov mostík meria stredné odpory (asi 1 Ω až 1 MΩ), Thomsonov mostík malé odpory, Maxwellov–Wienov mostík indukčnosť a Scheringov mostík kapacitu a stratový činiteľ, aj pri vysokom napätí.',
      rng);
  },
];

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Mostíkové metódy merania',
    summary: 'Wheatstoneov mostík a podmienka rovnováhy, Thomsonov mostík na malé odpory, nevyvážený mostík ako snímač a striedavé mostíky na meranie indukčnosti a kapacity.',
    minutes: 12,
    blocks: [
      { t: 'p', text: 'Mostíkové metódy sú **porovnávacie (nulové) metódy**: neznámy odpor sa porovná so známymi presnými odpormi a merací prístroj slúži len ako **nulový indikátor** (NI) – zisťuje, či ním netečie prúd. Keďže sa neodčítava výchylka, presnosť nezávisí od triedy presnosti prístroja a môže byť veľmi vysoká (0,01 až 0,1 %).' },
      { t: 'h', text: 'Wheatstoneov mostík' },
      { t: 'figure', fig: () => bridgeFigure({ r1: '(Rx)' }), caption: 'Wheatstoneov mostík: ľavú vetvu tvoria `$R_{1}` (meraný odpor `$R_{x}`) a `$R_{3}`, pravú vetvu `$R_{2}` a `$R_{4}`. Zdroj `$U_{0}` je medzi uzlami A a C, nulový indikátor NI medzi uzlami B a D.' },
      { t: 'p', text: 'Obe vetvy sú deliče napätia. Mostík je **vyvážený**, keď sú uzly B a D na rovnakom potenciáli – nulovým indikátorom netečie prúd. Vtedy je na `$R_{1}` rovnaké napätie ako na `$R_{2}` a na `$R_{3}` rovnaké ako na `$R_{4}`; z toho vyplýva **podmienka rovnováhy** – súčiny protiľahlých ramien sa rovnajú:' },
      {
        t: 'formula',
        tex: ['$R_{1} · $R_{4} = $R_{2} · $R_{3}', '$R_{x} = $R_{1} = $R_{2} · @f{$R_{3}}{$R_{4}}'],
        legend: [
          ['$R_{x}', 'meraný odpor v ramene 1', 'Ω'],
          ['$R_{2}', 'porovnávací (dekádový) odpor – nastavuje sa pri vyvažovaní', 'Ω'],
          ['@f{$R_{3}}{$R_{4}}', 'pomer ramien – prepína sa po dekádach (0,01; 0,1; 1; 10; 100)', '–'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Odvodenie: pri rovnováhe tečie `$R_{1}` aj `$R_{3}` rovnaký prúd `$I_{1}` a `$R_{2}` aj `$R_{4}` prúd `$I_{2}`. Z rovnosti napätí `$R_{1} · $I_{1} = $R_{2} · $I_{2}` a `$R_{3} · $I_{1} = $R_{4} · $I_{2}` po vydelení dostaneš `@f{$R_{1}}{$R_{3}} = @f{$R_{2}}{$R_{4}}`.' },
      { t: 'p', text: 'Výsledok **nezávisí od napätia zdroja** ani od presnosti indikátora – len od presnosti porovnávacích odporov a od **citlivosti** indikátora. Väčšie napätie zdroja zvyšuje citlivosť, ale odpory sa nesmú prehrievať. Wheatstoneov mostík je vhodný na **stredné odpory** asi od 1 Ω do 1 MΩ. Pri malých odporoch výsledok skresľujú odpory prívodov a prechodové odpory svoriek, pri veľkých odporoch zvodové prúdy izolácie a malá citlivosť.' },
      {
        t: 'example',
        title: 'Meranie odporu vyváženým mostíkom',
        given: ['`$R_{2}` = 4 735 Ω (dekádový odpor po vyvážení)', '`$R_{3}` = 100 Ω, `$R_{4}` = 1 000 Ω'],
        steps: [
          '`$R_{x} = $R_{2} · @f{$R_{3}}{$R_{4}} = 4 735 · @f{100}{1 000}`',
          '`$R_{x}` = 473,5 Ω',
        ],
        result: '`$R_{x}` = 473,5 Ω',
      },
      { t: 'h', text: 'Thomsonov (dvojitý) mostík' },
      { t: 'p', text: 'Na **malé odpory** (menej ako asi 1 Ω, až po mikroohmy) – vinutia, bočníky, spojky, prípojnice – sa používa **Thomsonov mostík**. Meraný odpor a porovnávací normál sú zapojené za sebou a napájané väčším prúdom. Oba majú **štyri svorky**: prúdovými svorkami sa privádza prúd, z napäťových svoriek sa odoberá napätie. Druhá dvojica pomerových odporov (preto „dvojitý“ mostík) vylúči vplyv odporu spojky medzi oboma odpormi, takže sa neuplatnia ani odpory prívodov, ani prechodové odpory svoriek.' },
      { t: 'h', text: 'Nevyvážený mostík ako snímač' },
      {
        t: 'formula',
        tex: ['$U_{BD} = $U_{0} · (@f{$R_{3}}{$R_{1} + $R_{3}} − @f{$R_{4}}{$R_{2} + $R_{4}})', '$U ≈ $U_{0} · @f{Δ$R}{4 · $R}'],
        legend: [
          ['$U_{BD}', 'napätie medzi uzlami B a D (výstup mostíka)', 'V'],
          ['Δ$R', 'malá zmena odporu snímača v jednom ramene; ostatné ramená majú odpor `$R`', 'Ω'],
        ],
      },
      { t: 'p', text: 'V priemyselných snímačoch sa mostík nevyvažuje. Snímač – **tenzometer** (odpor sa mení s deformáciou), **termistor** alebo platinový snímač **Pt100** (odpor sa mení s teplotou) – je v jednom ramene a z **výstupného napätia** sa usudzuje na zmenu odporu, a tým na silu, tlak či teplotu. Pri malých zmenách je výstupné napätie úmerné zmene odporu. Keď sú snímače vo dvoch alebo vo všetkých štyroch ramenách (polovičný a plný mostík), citlivosť stúpne dva- až štyrikrát a vplyv teploty sa vykompenzuje.' },
      { t: 'explore', build: bridgeExplorer, caption: 'Výstupné napätie prechádza nulou pri rovnováhe. Zmeň napätie, porovnávací odpor a pomer ramien a sleduj, kde je rovnováha a aký strmý je priebeh okolo nej.' },
      {
        t: 'example',
        title: 'Snímač Pt100 v mostíku',
        given: ['Pt100 pri 50 °C: `$R_{1}` = 119,25 Ω', '`$R_{2}` = `$R_{3}` = `$R_{4}` = 100 Ω', '`$U_{0}` = 5 V'],
        steps: [
          '`$U_{B} = 5 · @f{100}{119,25 + 100}` = 2,2805 V, `$U_{D} = 5 · @f{100}{100 + 100}` = 2,5 V',
          '`|$U_{BD}|` = 2,5 − 2,2805 = 0,2195 V = 219,5 mV',
          'Približný vzťah dáva `5 · @f{19,25}{4 · 100}` = 240,6 mV – pri zmene odporu o 19 % už výstup nie je lineárny.',
        ],
        result: '`|$U_{BD}|` ≈ 220 mV',
      },
      {
        t: 'example',
        title: 'Tenzometer v mostíku',
        given: ['tenzometer `$R` = 120 Ω, zmena `Δ$R` = 0,24 Ω (0,2 %)', '`$U_{0}` = 5 V, ostatné ramená 120 Ω'],
        steps: ['`$U ≈ $U_{0} · @f{Δ$R}{4 · $R} = 5 · @f{0,24}{4 · 120}` = 0,0025 V'],
        result: '`$U` ≈ 2,5 mV – signál treba zosilniť meracím zosilňovačom',
      },
      { t: 'h', text: 'Striedavé mostíky' },
      { t: 'p', text: 'Na meranie **indukčnosti** a **kapacity** sa mostík napája striedavým napätím (často 1 kHz) a namiesto odporov má v ramenách impedancie. Podmienka rovnováhy `$Z_{1} · $Z_{4} = $Z_{2} · $Z_{3}` musí platiť pre veľkosť aj pre fázu, preto treba vyvažovať **dvoma** prvkami. Ako nulový indikátor slúžia slúchadlá, striedavý nulový indikátor alebo osciloskop. Dnešné RLC merače vyhodnocujú mostík alebo meranie impedancie automaticky.' },
      {
        t: 'table',
        head: ['Mostík', 'Meria', 'Poznámka'],
        rows: [
          ['Wheatstoneov', 'stredné odpory (1 Ω až 1 MΩ)', 'jednosmerné napájanie, podmienka `$R_{1} · $R_{4} = $R_{2} · $R_{3}`'],
          ['Thomsonov', 'malé odpory (pod 1 Ω)', 'štvorsvorkové pripojenie, vylúči odpory prívodov'],
          ['Maxwellov–Wienov', 'indukčnosť a odpor cievky', 'indukčnosť sa porovnáva s kondenzátorom'],
          ['Wienov', 'kapacitu (aj frekvenciu)', 'porovnanie s normálovým kondenzátorom'],
          ['Scheringov', 'kapacitu a stratový činiteľ `tg $δ`', 'aj pri vysokom napätí – skúšanie izolácie'],
        ],
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Kedy je Wheatstoneov mostík vyvážený?',
      options: ['keď nulovým indikátorom netečie prúd, lebo uzly B a D majú rovnaký potenciál', 'keď všetky štyri odpory majú rovnakú hodnotu', 'keď zdrojom netečie prúd', 'keď je napätie zdroja nulové'],
      explanation: 'Pri rovnováhe platí `$R_{1} · $R_{4} = $R_{2} · $R_{3}`. Odpory nemusia byť rovnaké – stačí, aby sa rovnali súčiny protiľahlých ramien.',
    },
    {
      lessonId: ID,
      prompt: 'Aká je podmienka rovnováhy Wheatstoneovho mostíka podľa obrázka v lekcii?',
      options: ['`$R_{1} · $R_{4} = $R_{2} · $R_{3}`', '`$R_{1} · $R_{2} = $R_{3} · $R_{4}`', '`$R_{1} + $R_{4} = $R_{2} + $R_{3}`', '`$R_{1} · $R_{3} = $R_{2} · $R_{4}`'],
      explanation: 'Súčiny **protiľahlých** ramien sa rovnajú. `$R_{1}` (hore vľavo) je protiľahlé k `$R_{4}` (dole vpravo).',
    },
    {
      lessonId: ID,
      prompt: 'Mostík je vyvážený pri `$R_{2}` = 2 500 Ω, `$R_{3}` = 10 Ω a `$R_{4}` = 1 000 Ω. Aký je meraný odpor?',
      options: ['25 Ω', '250 kΩ', '2 500 Ω', '4 Ω'],
      explanation: '`$R_{x} = $R_{2} · @f{$R_{3}}{$R_{4}} = 2 500 · @f{10}{1 000}` = 25 Ω.',
    },
    {
      lessonId: ID,
      prompt: 'Na meranie akých odporov sa používa Thomsonov (dvojitý) mostík?',
      options: ['malých odporov, menších ako asi 1 Ω', 'veľkých izolačných odporov', 'stredných odporov od 1 kΩ do 1 MΩ', 'odporov polovodičových súčiastok v priepustnom smere'],
      explanation: 'Thomsonov mostík so štvorsvorkovým pripojením vylúči odpory prívodov a prechodové odpory svoriek, ktoré by pri malých odporoch spôsobili veľkú chybu.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo presnosť vyváženého mostíka nezávisí od napätia zdroja?',
      options: ['podmienka rovnováhy obsahuje len odpory ramien', 'zdroj mostíka je vždy stabilizovaný', 'nulový indikátor meria napätie zdroja', 'napätie sa pri vyvažovaní automaticky koriguje'],
      explanation: 'V rovnici `$R_{1} · $R_{4} = $R_{2} · $R_{3}` napätie nevystupuje. Zmena napätia ovplyvní len citlivosť.',
    },
    {
      lessonId: ID,
      prompt: 'Čo sa využíva pri meraní nevyváženým mostíkom so snímačom (napr. tenzometrom)?',
      options: ['výstupné napätie medzi uzlami B a D, ktoré závisí od zmeny odporu snímača', 'čas potrebný na vyváženie', 'prúd odoberaný zo zdroja', 'nulová výchylka indikátora'],
      explanation: 'Nevyvážený mostík sa nevyvažuje – z výstupného napätia `$U ≈ $U_{0} · @f{Δ$R}{4 · $R}` sa usudzuje na zmenu odporu, a tým na meranú veličinu.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo treba striedavý mostík vyvažovať dvoma prvkami?',
      options: ['rovnováha musí nastať pre veľkosť aj pre fázu impedancií', 'lebo má dva zdroje', 'aby sa skrátil čas merania', 'striedavý mostík sa vyvažuje jediným prvkom'],
      explanation: 'Impedancie sú komplexné čísla – rovnica `$Z_{1} · $Z_{4} = $Z_{2} · $Z_{3}` predstavuje dve podmienky (reálnu a imaginárnu časť, resp. veľkosť a fázu).',
    },
  ],
  generators,
};

export default mod;
