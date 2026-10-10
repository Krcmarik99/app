import type { MeasModule } from './types';
import { int, pick } from '../../lib/random';
import { fmt } from '../../lib/units';
import { n, numeric, q, type Generator } from '../../practice/helpers';
import { lineChart, sample } from '../../ui/chart';
import { explorer } from '../../ui/explorer';
import { aronFigure, wattmeterFigure } from '../../ui/fig-power';
import { choice, clean, rad } from '../y3/util';

/*
 * Lekcia – meranie činného, jalového a zdanlivého výkonu, trojfázového výkonu a energie.
 * Značenie ako v ostatných lekciách kapitoly: MR = merací rozsah, α = výchylka v dielikoch, K = konštanta.
 */

const ID = 'meranie-vykonu';

/** Údaje dvoch wattmetrov v Aronovom zapojení pri súmernej záťaži v závislosti od fázového posunu. */
function aronExplorer(): HTMLElement {
  return explorer({
    title: 'Aronovo zapojenie pri súmernej záťaži',
    params: [{ key: 'phi', label: 'Fázový posun záťaže `$φ`', unit: '°', min: 0, max: 90, value: 37, format: (v) => `${fmt(v, 3)}°` }],
    draw: ({ phi }) => {
      const UI = 400 * 10;
      const p1 = (d: number) => (UI * Math.cos(rad(30 - d))) / 1000;
      const p2 = (d: number) => (UI * Math.cos(rad(30 + d))) / 1000;
      const P1 = p1(phi);
      const P2 = p2(phi);
      const chart = lineChart({
        ariaLabel: `Údaje wattmetrov W1 a W2 v Aronovom zapojení, fázový posun ${fmt(phi, 3)}°`,
        width: 460,
        height: 250,
        x: { min: 0, max: 90, ticks: [0, 15, 30, 45, 60, 75, 90], format: (v) => `${v}°`, label: 'φ' },
        y: { min: -3, max: 7.5, ticks: [-2, 0, 2, 4, 6], format: (v) => fmt(v), label: 'P [kW]' },
        series: [
          { points: sample(p1, 0, 90, 90), className: 'thin' },
          { points: sample(p2, 0, 90, 90), className: 'green thin' },
          { points: sample((d) => p1(d) + p2(d), 0, 90, 90), className: 'copper' },
        ],
        vlines: [{ x: 60, label: 'cos φ = 0,5' }],
        markers: [{ x: phi, y: P2, label: `P₂ = ${fmt(P2, 3)} kW` }],
        legend: [{ label: 'P₁', className: 'thin' }, { label: 'P₂', className: 'green' }, { label: 'P = P₁ + P₂', className: 'copper' }],
      });
      return {
        chart,
        readouts: [
          ['`cos $φ`', fmt(Math.cos(rad(phi)), 3)],
          ['Wattmeter W1 `$P_{1}`', `${fmt(P1 * 1000, 4)} W`],
          ['Wattmeter W2 `$P_{2}`', `${fmt(P2 * 1000, 4)} W`],
          ['Činný výkon `$P = $P_{1} + $P_{2}`', `${fmt((P1 + P2) * 1000, 4)} W`],
        ],
        note: phi > 60
          ? 'Pri `cos $φ` < 0,5 sa wattmeter W2 vychýli opačne. Prepóluj jeho napäťovú cievku, odčítaj kladný údaj a od údaja W1 ho **odpočítaj**.'
          : 'Združené napätie 400 V, prúd 10 A. Pri `cos $φ` = 1 ukazujú oba wattmetre rovnako, pri `cos $φ` = 0,5 ukazuje W2 nulu.',
      };
    },
  });
}

/** Wattmetre: napäťové a prúdové rozsahy, stupnica. */
const MRU = [60, 120, 150, 240, 300, 600];
const MRI = [0.5, 1, 2.5, 5, 10];
const DIVS = [100, 120, 150];

const generators: Generator[] = [
  // Konštanta wattmetra.
  (rng) => {
    const U = pick(rng, MRU);
    const I = pick(rng, MRI);
    const a = pick(rng, DIVS);
    const cn = rng() < 0.25 ? 0.2 : 1;
    const K = clean((U * I * cn) / a);
    return numeric(ID, `Wattmeter má napäťový rozsah ${n(U)} V, prúdový rozsah ${n(I)} A, stupnicu so ${a} dielikmi a menovitý účinník \`cos $φ_{n}\` = ${n(cn)}. Aká je jeho konštanta?`, K, 'W/dielik', [
      `\`$K_{W} = @f{MR_{U} · MR_{I} · cos $φ_{n}}{$α_{max}} = @f{${n(U)} · ${n(I)} · ${n(cn)}}{${a}}\` = **${n(K, 4)} W/dielik**`,
      cn < 1 ? 'Wattmeter s malým menovitým účinníkom (0,2) sa používa na meranie pri malom účinníku, napr. strát naprázdno transformátora.' : 'Bežné wattmetre majú `cos $φ_{n}` = 1.',
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  // Výkon z výchylky.
  (rng) => {
    const U = pick(rng, [120, 150, 240, 300, 600]);
    const I = pick(rng, [1, 2.5, 5, 10]);
    const a = pick(rng, DIVS);
    const alpha = int(rng, Math.round(a * 0.25), a - 2);
    const K = clean((U * I) / a);
    const P = clean(alpha * K);
    return numeric(ID, `Wattmeter s rozsahmi ${n(U)} V a ${n(I)} A (\`cos $φ_{n}\` = 1) má stupnicu so ${a} dielikmi. Ručička ukazuje \`$α\` = ${alpha} dielikov. Aký činný výkon odoberá spotrebič?`, P, 'W', [
      `\`$K_{W} = @f{${n(U)} · ${n(I)}}{${a}}\` = ${n(K, 4)} W/dielik`,
      `\`$P = $α · $K_{W}\` = ${alpha} · ${n(K, 4)} = **${q(P, 'W', 4)}**`,
    ]);
  },
  // Aronovo zapojenie.
  (rng) => {
    const I = pick(rng, [2, 4, 5, 8, 10, 12, 16]);
    const c = pick(rng, [0.3, 0.35, 0.4, 0.45, 0.6, 0.7, 0.8, 0.85, 0.9]);
    const phi = Math.acos(c);
    const UI = 400 * I;
    const P1 = Math.round(UI * Math.cos(rad(30) - phi));
    const P2 = Math.round(UI * Math.cos(rad(30) + phi));
    const P = P1 + P2;
    const neg = P2 < 0;
    return numeric(ID, neg
      ? `Výkon trojfázového motora v trojvodičovej sieti 400 V meriaš Aronovým zapojením. Wattmeter W1 ukazuje ${n(P1)} W. Wattmeter W2 sa vychýlil naopak – po prepólovaní jeho napäťovej cievky ukazuje ${n(-P2)} W. Aký činný výkon odoberá motor?`
      : `Výkon trojfázového spotrebiča v trojvodičovej sieti 400 V meriaš Aronovým zapojením. Wattmeter W1 ukazuje ${n(P1)} W a wattmeter W2 ukazuje ${n(P2)} W. Aký činný výkon odoberá spotrebič?`,
    P, 'W', [
      neg
        ? `Údaj prepólovaného wattmetra sa odčíta: \`$P = $P_{1} − $P_{2}'\` = ${n(P1)} − ${n(-P2)} = **${q(P, 'W', 4)}**`
        : `\`$P = $P_{1} + $P_{2}\` = ${n(P1)} + ${n(P2)} = **${q(P, 'W', 4)}**`,
      neg ? 'Opačná výchylka jedného wattmetra znamená, že `cos $φ` < 0,5.' : 'Oba wattmetre ukazujú kladne, preto `cos $φ` ≥ 0,5.',
    ]);
  },
  // Výkon z elektromera.
  (rng) => {
    const electronic = rng() < 0.6;
    const C = electronic ? pick(rng, [500, 800, 1000, 1600, 2000]) : pick(rng, [75, 120, 150, 300, 600]);
    const t = pick(rng, [30, 60, 90, 120, 180]);
    const Ptarget = pick(rng, [300, 600, 900, 1200, 1500, 2000, 2400, 3000]);
    const count = Math.max(2, Math.round((Ptarget * C * t) / 3.6e6));
    const P = (3.6e6 * count) / (C * t);
    const unit = electronic ? 'imp/kWh' : 'ot/kWh';
    const what = electronic ? `blikla LED elektromera ${count}-krát` : `sa kotúč elektromera otočil ${count}-krát`;
    return numeric(ID, `Elektromer má konštantu \`$C\` = ${n(C)} ${unit}. Za ${t} s ${what}. Aký priemerný výkon odoberajú pripojené spotrebiče?`, P, 'W', [
      `Spotrebovaná energia: \`$W = @f{$n}{$C} = @f{${count}}{${n(C)}}\` = ${n(count / C, 4)} kWh`,
      `\`$P = @f{$W}{$t} = @f{3 600 · $n}{$C · $t} = @f{3 600 · ${count}}{${n(C)} · ${t}}\` = **${q(P, 'W')}**`,
    ]);
  },
  // Účinník z P, U, I.
  (rng) => {
    const U = 230;
    const I = pick(rng, [1.5, 2.4, 3.2, 4.5, 6.8, 8.5]);
    const c = pick(rng, [0.55, 0.62, 0.7, 0.78, 0.84, 0.9, 0.96]);
    const P = Math.round(U * I * c);
    const S = U * I;
    const cf = P / S;
    return numeric(ID, `Pri meraní spotrebiča na sieti 230 V ukazuje ampérmeter ${n(I)} A a wattmeter ${n(P)} W. Aký je účinník spotrebiča?`, cf, '', [
      `Zdanlivý výkon (V-A metóda): \`$S = $U · $I\` = 230 · ${n(I)} = ${n(S, 4)} VA`,
      `\`cos $φ = @f{$P}{$S} = @f{${n(P)}}{${n(S, 4)}}\` = **${n(cf, 3)}**`,
      `Jalový výkon: \`$Q = @s{$S^{2} − $P^{2}}\` = ${n(Math.sqrt(S * S - P * P), 3)} var.`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  // Trojfázový výkon jedným wattmetrom.
  (rng) => {
    const P1 = pick(rng, [420, 650, 800, 1250, 1840, 2500]);
    return numeric(ID, `Súmerný trojfázový spotrebič zapojený do hviezdy so stredným vodičom meriaš jedným wattmetrom: prúdová cievka je vo vodiči L1, napäťová medzi L1 a N. Wattmeter ukazuje ${n(P1)} W. Aký je celkový činný výkon spotrebiča?`, 3 * P1, 'W', [
      'Pri súmernej záťaži odoberajú všetky tri fázy rovnaký výkon.',
      `\`$P = 3 · $P_{1}\` = 3 · ${n(P1)} = **${q(3 * P1, 'W', 4)}**`,
    ]);
  },
  // Pojmy.
  (rng) => {
    const v = pick(rng, [
      {
        prompt: 'Wattmeter s rozsahmi 300 V a 5 A je v obvode s napätím 230 V. Ručička ukazuje len tretinu stupnice, ale ampérmeter v obvode ukazuje 7 A. Čo platí?',
        options: ['prúdová cievka je preťažená, aj keď je výchylka malá', 'wattmeter je v poriadku, výchylka je pod koncom stupnice', 'preťažená je napäťová cievka', 'wattmeter ukazuje zdanlivý výkon'] as [string, string, string, string],
        why: 'Výchylka je úmerná `$U · $I · cos $φ`. Pri malom účinníku môže byť malá, hoci prúd prekračuje prúdový rozsah 5 A. Preto sa prúd a napätie vždy kontrolujú ampérmetrom a voltmetrom.',
      },
      {
        prompt: 'Ako zmeriaš činný výkon v trojvodičovej sústave bez stredného vodiča pri nesúmernej záťaži?',
        options: ['dvoma wattmetrami v Aronovom zapojení', 'jedným wattmetrom a výsledok vynásobíš tromi', 'tromi wattmetrami s napäťovými cievkami proti strednému vodiču', 'voltmetrom a ampérmetrom'] as [string, string, string, string],
        why: 'Aronovo zapojenie dáva `$P = $P_{1} + $P_{2}` pri súmernej aj nesúmernej záťaži, ak sústava nemá stredný vodič. Jeden wattmeter stačí len pri súmernej záťaži so stredným vodičom.',
      },
      {
        prompt: 'V Aronovom zapojení sa wattmeter W2 vychýlil opačným smerom. Čo z toho vyplýva?',
        options: ['účinník záťaže je menší ako 0,5; údaj W2 po prepólovaní odčítaš', 'wattmeter W2 je chybný', 'záťaž má kapacitný charakter a účinník je 1', 'treba vymeniť poradie fáz L1 a L2'] as [string, string, string, string],
        why: 'Pri súmernej záťaži je `$P_{2} = $U · $I · cos(30° + $φ)`, čo je záporné pre `$φ` > 60°, t. j. `cos $φ` < 0,5. Prepóluje sa napäťová cievka a výsledok je `$P = $P_{1} − $P_{2}\'`.',
      },
      {
        prompt: 'Ako sa zapája prúdová a napäťová cievka wattmetra?',
        options: ['prúdová do série so spotrebičom, napäťová paralelne k nemu', 'obe do série', 'obe paralelne', 'prúdová paralelne, napäťová do série'] as [string, string, string, string],
        why: 'Prúdová cievka (málo závitov hrubého drôtu) meria prúd ako ampérmeter, napäťová (veľa závitov s predradným odporom) napätie ako voltmeter.',
      },
    ]);
    return choice(ID, v.prompt, v.options, v.why, rng);
  },
];

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Meranie výkonu a energie',
    summary: 'Wattmeter a jeho konštanta, zdanlivý a jalový výkon, účinník, trojfázový výkon jedným, tromi a dvoma wattmetrami v Aronovom zapojení a elektromer.',
    minutes: 13,
    blocks: [
      { t: 'p', text: 'Činný výkon v striedavom obvode `$P = $U · $I · cos $φ` nezistíš len z údajov voltmetra a ampérmetra – ich súčin je zdanlivý výkon. Činný výkon sa meria priamo **wattmetrom**, energia **elektromerom**.' },
      { t: 'h', text: 'Wattmeter' },
      { t: 'p', text: 'Najpoužívanejší je **elektrodynamický** wattmeter (bez železa, presný, laboratórny) a **ferodynamický** wattmeter (cievky na železnom jadre, väčší moment, rozvádzačový). Má dve cievky: **prúdovú** – málo závitov hrubého drôtu, zapája sa **do série** so spotrebičom ako ampérmeter – a **napäťovú** – veľa závitov tenkého drôtu s predradným odporom, zapája sa **paralelne** ako voltmeter. Moment, ktorý vychyľuje ručičku, je úmerný súčinu okamžitých hodnôt prúdu a napätia, a teda priemernej hodnote `$U · $I · cos $φ` – činnému výkonu. Wattmeter meria v jednosmernom aj striedavom obvode.' },
      { t: 'figure', fig: wattmeterFigure, caption: 'Zapojenie wattmetra: prúdová cievka v sérii so záťažou `$Z`, napäťová cievka paralelne. Ampérmeter a voltmeter strážia, aby sa neprekročili rozsahy cievok.' },
      { t: 'note', kind: 'remember', text: 'Začiatky vinutí sú na wattmetri označené **hviezdičkou** (*). Obe svorky s hviezdičkou sa pripájajú na stranu **zdroja**. Ak sa ručička vychýli opačne, prepóluj **jednu** z cievok (obvykle napäťovú) – nie obe naraz.' },
      { t: 'h', text: 'Konštanta wattmetra' },
      {
        t: 'formula',
        tex: ['$K_{W} = @f{MR_{U} · MR_{I} · cos $φ_{n}}{$α_{max}}', '$P = $α · $K_{W}'],
        legend: [
          ['MR_{U}', 'napäťový rozsah', 'V'],
          ['MR_{I}', 'prúdový rozsah', 'A'],
          ['cos $φ_{n}', 'menovitý účinník wattmetra – bežne 1, wattmetre pre malý účinník 0,1 alebo 0,2', '–'],
          ['$α_{max}', 'počet dielikov stupnice', 'dielik'],
          ['$K_{W}', 'konštanta wattmetra', 'W/dielik'],
        ],
      },
      {
        t: 'example',
        title: 'Odčítanie údaja wattmetra',
        given: ['`MR_{U}` = 300 V, `MR_{I}` = 5 A, `cos $φ_{n}` = 1', '`$α_{max}` = 150 dielikov', 'výchylka `$α` = 87 dielikov'],
        steps: [
          '`$K_{W} = @f{300 · 5 · 1}{150}` = 10 W/dielik',
          '`$P = $α · $K_{W}` = 87 · 10 = 870 W',
        ],
        result: '`$P` = 870 W',
      },
      { t: 'note', kind: 'warn', text: 'Wattmeter môže byť **preťažený aj pri malej výchylke**. Výchylka závisí od `$U · $I · cos $φ`: pri malom účinníku môže prúd prekročiť prúdový rozsah, kým ručička ukazuje len malú časť stupnice. Podobne pri malom prúde nemusíš spozorovať, že napätie prekračuje napäťový rozsah. Preto do obvodu vždy zapoj aj **ampérmeter a voltmeter**.' },
      { t: 'h', text: 'Zdanlivý a jalový výkon, účinník' },
      { t: 'p', text: '**Zdanlivý výkon** zmeriaš **V-A metódou** – voltmetrom a ampérmetrom: `$S = $U · $I`. Spolu s údajom wattmetra z neho vypočítaš **účinník** `cos $φ = @f{$P}{$S}` a **jalový výkon** `$Q = @s{$S^{2} − $P^{2}}`. Jalový výkon sa dá merať aj priamo **varmetrom** – wattmetrom, ktorého napäťová cievka dostáva napätie posunuté o 90°.' },
      {
        t: 'example',
        title: 'Účinník motora',
        given: ['`$U` = 230 V (voltmeter)', '`$I` = 4,2 A (ampérmeter)', '`$P` = 780 W (wattmeter)'],
        steps: [
          '`$S = $U · $I` = 230 · 4,2 = 966 VA',
          '`cos $φ = @f{$P}{$S} = @f{780}{966}` = 0,807',
          '`$Q = @s{966^{2} − 780^{2}}` = 570 var',
        ],
        result: '`cos $φ` = 0,81, `$Q` = 570 var',
      },
      { t: 'h', text: 'Trojfázový výkon' },
      {
        t: 'list',
        items: [
          '**Súmerná záťaž so stredným vodičom** – stačí **jeden wattmeter** (prúdová cievka vo fáze, napäťová medzi fázou a N): `$P = 3 · $P_{1}`.',
          '**Nesúmerná záťaž, štvorvodičová sústava** – **tri wattmetre**, každý v jednej fáze: `$P = $P_{1} + $P_{2} + $P_{3}`.',
          '**Trojvodičová sústava** (bez stredného vodiča), súmerná aj nesúmerná záťaž – **dva wattmetre v Aronovom zapojení**: `$P = $P_{1} + $P_{2}`.',
        ],
      },
      { t: 'figure', fig: aronFigure, caption: 'Aronovo zapojenie: prúdové cievky sú vo vodičoch L1 a L2, napäťové cievky sú pripojené proti tretiemu vodiču L3.' },
      {
        t: 'formula',
        tex: ['$P = $P_{1} + $P_{2}', '$P_{1} = $U · $I · cos(30° − $φ)', '$P_{2} = $U · $I · cos(30° + $φ)'],
        legend: [
          ['$U', 'združené napätie', 'V'],
          ['$I', 'prúd vo vodiči (súmerná záťaž)', 'A'],
        ],
      },
      { t: 'explore', build: aronExplorer, caption: 'Pri `cos $φ` = 1 ukazujú oba wattmetre rovnako, pri 0,5 ukazuje W2 nulu a pri menšom účinníku sa vychýli opačne.' },
      {
        t: 'example',
        title: 'Aronovo zapojenie pri malom účinníku',
        given: ['združené napätie 400 V, prúd 5 A', 'W1 ukazuje 1 609 W', 'W2 sa vychýlil opačne; po prepólovaní napäťovej cievky ukazuje 224 W'],
        steps: [
          'Údaj prepólovaného wattmetra je záporný: `$P_{2}` = −224 W',
          '`$P = $P_{1} + $P_{2}` = 1 609 − 224 = 1 385 W',
          'Kontrola: `cos $φ = @f{$P}{@s{3} · $U · $I} = @f{1 385}{1,732 · 400 · 5}` = 0,40 (menej ako 0,5)',
        ],
        result: '`$P` = 1 385 W',
      },
      { t: 'h', text: 'Elektromer' },
      { t: 'p', text: '**Elektromer** meria činnú energiu `$W = $P · $t` v kilowatthodinách. Starší **indukčný** elektromer má otáčajúci sa hliníkový kotúč a jeho konštanta sa udáva v **otáčkach na kWh** (ot/kWh). Dnešný **elektronický** elektromer vyšle za každú dávku energie impulz a blikne LED – konštanta je v **impulzoch na kWh** (imp/kWh). Spočítaním impulzov za známy čas zistíš okamžitý odber, a tak môžeš elektromerom aj overiť údaj wattmetra.' },
      {
        t: 'formula',
        tex: ['$W = @f{$n}{$C}', '$P = @f{3 600 · $n}{$C · $t}'],
        legend: [
          ['$n', 'počet impulzov (otáčok)', '–'],
          ['$C', 'konštanta elektromera', 'imp/kWh'],
          ['$t', 'čas merania', 's'],
          ['$P', 'priemerný výkon', 'kW'],
        ],
      },
      {
        t: 'example',
        title: 'Výkon z blikania elektromera',
        given: ['`$C` = 1 000 imp/kWh', '20 impulzov za `$t` = 60 s'],
        steps: [
          '`$W = @f{20}{1 000}` = 0,02 kWh',
          '`$P = @f{3 600 · 20}{1 000 · 60}` = 1,2 kW',
        ],
        result: 'spotrebiče odoberajú približne 1,2 kW',
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aký výkon meria wattmeter?',
      options: ['činný výkon', 'zdanlivý výkon', 'jalový výkon', 'okamžitý výkon v danom okamihu'],
      explanation: 'Výchylka wattmetra je úmerná priemeru súčinu okamžitých hodnôt `$u · $i`, teda `$U · $I · cos $φ` – činnému výkonu.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zapája prúdová cievka wattmetra?',
      options: ['do série so spotrebičom', 'paralelne k spotrebiču', 'medzi fázový a ochranný vodič', 'na výstup meracieho transformátora napätia'],
      explanation: 'Prúdová cievka má malý odpor a zapája sa ako ampérmeter, napäťová cievka paralelne ako voltmeter.',
    },
    {
      lessonId: ID,
      prompt: 'Wattmeter má rozsahy 150 V a 5 A, `cos $φ_{n}` = 1 a stupnicu so 150 dielikmi. Aká je jeho konštanta?',
      options: ['5 W/dielik', '1 W/dielik', '750 W/dielik', '0,2 W/dielik'],
      explanation: '`$K_{W} = @f{150 · 5 · 1}{150}` = 5 W/dielik.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo môže byť wattmeter preťažený, hoci jeho ručička ukazuje len malú výchylku?',
      options: [
        'výchylka závisí aj od účinníka, a tak pri malom cos φ môže prúd prekročiť rozsah prúdovej cievky',
        'pri malej výchylke má wattmeter väčšiu spotrebu',
        'napäťová cievka sa pri malej výchylke skratuje',
        'wattmeter sa nemôže preťažiť',
      ],
      explanation: 'Výchylka je úmerná `$U · $I · cos $φ`. Preto treba prúd a napätie strážiť ampérmetrom a voltmetrom.',
    },
    {
      lessonId: ID,
      prompt: 'Kedy sa v Aronovom zapojení pri súmernej záťaži jeden wattmeter vychýli opačne?',
      options: ['keď je účinník menší ako 0,5', 'keď je účinník väčší ako 0,5', 'keď je záťaž čisto odporová', 'keď v sieti chýba stredný vodič'],
      explanation: '`$P_{2} = $U · $I · cos(30° + $φ)` je záporné pre `$φ` > 60°, t. j. pri `cos $φ` < 0,5. Jeho údaj sa po prepólovaní odčíta.',
    },
    {
      lessonId: ID,
      prompt: 'Koľko wattmetrov potrebuješ na meranie výkonu nesúmerného spotrebiča v štvorvodičovej sieti (L1, L2, L3, N)?',
      options: ['tri', 'jeden', 'dva v Aronovom zapojení', 'štyri'],
      explanation: 'V každej fáze je iný výkon, preto `$P = $P_{1} + $P_{2} + $P_{3}`. Aronovo zapojenie platí len pre trojvodičovú sústavu bez stredného vodiča.',
    },
    {
      lessonId: ID,
      prompt: 'Čo označuje hviezdička (*) pri svorkách wattmetra?',
      options: ['začiatky vinutí prúdovej a napäťovej cievky – pripájajú sa na stranu zdroja', 'svorku pre ochranný vodič', 'svorku najväčšieho rozsahu', 'skúšobné napätie izolácie'],
      explanation: 'Ak sú začiatky oboch cievok na strane zdroja, ručička sa pri odbere výkonu vychyľuje správnym smerom.',
    },
    {
      lessonId: ID,
      prompt: 'Elektromer s konštantou 2 000 imp/kWh vyslal za 1 minútu 50 impulzov. Aký je odoberaný výkon?',
      options: ['1,5 kW', '25 W', '3 kW', '0,75 kW'],
      explanation: '`$P = @f{3 600 · 50}{2 000 · 60}` = 1,5 kW.',
    },
  ],
  generators,
};

export default mod;
