import type { LessonModule } from '../../module';
import { int, pick } from '../../../lib/random';
import { fmt, formatSI } from '../../../lib/units';
import { b, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import {
  autotransformerFigure, instrumentTransformersFigure, threePhaseCoreFigure, windingConnectionsFigure,
} from '../../../ui/fig-machines';
import { choice } from '../util';

const ID = 'transformatory-specialne';
const SQ3 = Math.sqrt(3);
const round4 = (x: number) => Number(x.toPrecision(4));

/** Rozdelenie výkonu autotransformátora na časť prenesenú indukciou a časť prenesenú galvanicky. */
function autoExplorer(): HTMLElement {
  const U1 = 230;
  return explorer({
    title: 'Výkon prenášaný autotransformátorom',
    params: [
      { key: 'u2', label: 'Výstupné napätie `$U_{2}`', unit: 'V', min: 23, max: 230, value: 200 },
      { key: 's', label: 'Výkon spotrebiča `$S`', unit: 'VA', min: 200, max: 5000, value: 2000, log: true },
    ],
    draw: ({ u2, s }) => {
      const k = u2 / U1;
      const St = s * (1 - k);
      const Sg = s * k;
      const I1 = s / U1;
      const I2 = s / u2;
      const chart = lineChart({
        ariaLabel: `Pri pomere napätí ${fmt(k, 2)} prenáša jadro ${fmt((1 - k) * 100, 2)} % výkonu`,
        width: 460,
        height: 240,
        x: { min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], format: (v) => fmt(v), label: 'U₂ / U₁' },
        y: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], format: (v) => fmt(v), label: 'podiel z S [%]' },
        series: [
          { points: sample((x) => (1 - x) * 100, 0, 1, 2), className: 'copper' },
          { points: sample((x) => x * 100, 0, 1, 2), className: 'green' },
        ],
        markers: [
          { x: k, y: (1 - k) * 100, label: `St = ${fmt((1 - k) * 100, 2)} %`, above: k < 0.5 },
          { x: k, y: k * 100, label: `Sg = ${fmt(k * 100, 2)} %`, above: k >= 0.5 },
        ],
        legend: [{ label: 'St – indukciou (jadrom)', className: 'copper' }, { label: 'Sg – galvanicky', className: 'green' }],
      });
      return {
        chart,
        readouts: [
          ['`$I_{1}`', formatSI(I1, 'A', 3)],
          ['`$I_{2}`', formatSI(I2, 'A', 3)],
          ['spoločná časť `$I_{2} − $I_{1}`', formatSI(I2 - I1, 'A', 3)],
          ['typový výkon `$S_{t}`', formatSI(Math.max(St, 0), 'VA', 3)],
          ['galvanicky `$S_{g}`', formatSI(Sg, 'VA', 3)],
        ],
        note: k > 0.7
          ? 'Napätia sa líšia málo – jadro prenáša len malú časť výkonu, autotransformátor je oveľa menší a ľahší ako transformátor s dvoma vinutiami.'
          : 'Pri veľkom rozdiele napätí prenáša väčšinu výkonu jadro a úspora oproti bežnému transformátoru je malá. Galvanické spojenie so sieťou však ostáva.',
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const S = pick(rng, [100, 160, 250, 400, 630, 1000]);
    const UV = pick(rng, [22000, 22000, 6000]);
    const vn = rng() < 0.5;
    const U = vn ? UV : 400;
    const I = (S * 1000) / (SQ3 * U);
    return numeric(ID, `Trojfázový transformátor má menovitý výkon ${n(S)} kVA a napätia ${b(UV, 'V')} / 400 V. Aký je menovitý prúd vo vodičoch na strane ${vn ? 'vyššieho' : 'nižšieho'} napätia?`, I, 'A', [
      `\`$I_{n} = @f{$S_{n}}{@s{3} · $U_{n}} = @f{${n(S * 1000)}}{1,732 · ${n(U)}}\` = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const [I1n, I2n] = pick(rng, [[50, 5], [100, 5], [150, 5], [200, 5], [300, 5], [400, 5], [600, 5], [100, 1], [200, 1], [400, 1]] as [number, number][]);
    const IA = I2n === 5 ? int(rng, 10, 50) / 10 : int(rng, 20, 100) / 100;
    const pI = I1n / I2n;
    const I = pI * IA;
    return numeric(ID, `Ampérmeter pripojený cez merací transformátor prúdu ${n(I1n)}/${n(I2n)} A ukazuje ${b(IA, 'A')}. Aký prúd tečie vedením?`, I, 'A', [
      `\`$p_{I} = @f{$I_{1n}}{$I_{2n}} = @f{${n(I1n)}}{${n(I2n)}}\` = ${n(pI)}`,
      `\`$I_{1} = $p_{I} · $I_{A}\` = ${n(pI)} · ${n(IA)} = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const U1n = pick(rng, [22000, 6000, 10000, 35000, 110000]);
    const UV = int(rng, 90, 110);
    const pU = U1n / 100;
    const U = pU * UV;
    return numeric(ID, `Voltmeter pripojený cez merací transformátor napätia ${b(U1n, 'V')} / 100 V ukazuje ${q(UV, 'V')}. Aké je skutočné napätie?`, U, 'V', [
      `\`$p_{U} = @f{$U_{1n}}{$U_{2n}} = @f{${n(U1n)}}{100}\` = ${n(pU)}`,
      `\`$U_{1} = $p_{U} · $U_{V}\` = ${n(pU)} · ${n(UV)} = ${res(U, 'V')}`,
    ]);
  },
  (rng) => {
    const U2 = pick(rng, [150, 180, 190, 200, 210, 220]);
    const S = pick(rng, [500, 1000, 1500, 2000, 3000]);
    const k = U2 / 230;
    const v = pick(rng, ['t', 'g', 'i']);
    if (v === 't') {
      const St = S * (1 - k);
      return numeric(ID, `Autotransformátor 230 V / ${n(U2)} V napája spotrebič s výkonom ${q(S, 'VA')}. Aký výkon sa prenáša magnetickou indukciou (typový výkon)?`, St, 'VA', [
        `\`$S_{t} = $S · (1 − @f{$U_{2}}{$U_{1}}) = ${n(S)} · (1 − @f{${n(U2)}}{230})\` = ${res(St, 'VA')}`,
        'Na tento výkon sa dimenzuje jadro a vinutie – oveľa menší ako výkon spotrebiča.',
      ]);
    }
    if (v === 'g') {
      const Sg = S * k;
      return numeric(ID, `Autotransformátor 230 V / ${n(U2)} V napája spotrebič s výkonom ${q(S, 'VA')}. Aký výkon sa prenáša galvanicky (priamo vodivým spojením)?`, Sg, 'VA', [
        `\`$S_{g} = $S · @f{$U_{2}}{$U_{1}} = ${n(S)} · @f{${n(U2)}}{230}\` = ${res(Sg, 'VA')}`,
      ]);
    }
    const I1 = round4(S / 230);
    const I2 = round4(S / U2);
    return numeric(ID, `Autotransformátor 230 V / ${n(U2)} V napája spotrebič s výkonom ${q(S, 'VA')}. Aký prúd tečie spoločnou časťou vinutia?`, I2 - I1, 'A', [
      `\`$I_{1} = @f{$S}{$U_{1}} = @f{${n(S)}}{230}\` = ${n(I1)} A, \`$I_{2} = @f{$S}{$U_{2}} = @f{${n(S)}}{${n(U2)}}\` = ${n(I2)} A`,
      `\`$I_{s} = $I_{2} − $I_{1}\` = ${n(I2)} − ${n(I1)} = ${res(I2 - I1, 'A')}`,
    ], { tolerance: 0.03 });
  },
  (rng) => {
    const S = pick(rng, [100, 160, 250, 400, 630, 1000]);
    const uk = S >= 800 ? 6 : pick(rng, [4, 4, 6]);
    const In = round4((S * 1000) / (SQ3 * 400));
    const Ik = (In * 100) / uk;
    return numeric(ID, `Distribučný transformátor ${n(S)} kVA, 22 / 0,4 kV má napätie nakrátko ${n(uk)} %. Aký ustálený skratový prúd tečie pri trojfázovom skrate na svorkách NN?`, Ik, 'A', [
      `\`$I_{2n} = @f{$S_{n}}{@s{3} · $U_{2n}} = @f{${n(S * 1000)}}{1,732 · 400}\` = ${n(In)} A`,
      `\`$I_{k} = $I_{2n} · @f{100}{$u_{k}} = ${n(In)} · @f{100}{${n(uk)}}\` = ${res(Ik, 'A')}`,
    ]);
  },
  (rng) => {
    const [I1n, I2n] = pick(rng, [[100, 5], [200, 5], [300, 5], [50, 5]] as [number, number][]);
    const U1n = pick(rng, [6000, 22000]);
    const PW = pick(rng, [150, 240, 320, 400, 450]);
    const pI = I1n / I2n;
    const pU = U1n / 100;
    const P = pI * pU * PW;
    return numeric(ID, `Wattmeter je pripojený cez merací transformátor prúdu ${n(I1n)}/${n(I2n)} A a merací transformátor napätia ${b(U1n, 'V')} / 100 V. Ukazuje ${q(PW, 'W')}. Aký výkon skutočne prechádza meraným obvodom?`, P, 'W', [
      `\`$p_{I}\` = ${n(I1n)} / ${n(I2n)} = ${n(pI)}, \`$p_{U}\` = ${n(U1n)} / 100 = ${n(pU)}`,
      `\`$P = $p_{I} · $p_{U} · $P_{W}\` = ${n(pI)} · ${n(pU)} · ${n(PW)} = ${res(P, 'W')}`,
    ]);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Čo sa nesmie urobiť so sekundárom meracieho transformátora prúdu, keď primárom tečie prúd?',
        ['rozpojiť ho', 'skratovať ho', 'uzemniť jednu jeho svorku', 'pripojiť k nemu ampérmeter'],
        'Pri rozpojenom sekundári by celý primárny prúd magnetoval jadro – presýtilo by sa, prehrievalo a na sekundári by vzniklo nebezpečne vysoké napätie. Skrat sekundáru je pre MTP naopak bežný stav.'],
      ['Čo sa nesmie urobiť so sekundárom meracieho transformátora napätia?',
        ['skratovať ho', 'nechať ho naprázdno', 'pripojiť k nemu voltmeter', 'uzemniť jednu jeho svorku'],
        'MTN pracuje takmer naprázdno. Skrat sekundáru by spôsobil veľký prúd a zničenie transformátora, preto sa sekundár istí poistkami.'],
      ['Prečo sa autotransformátor nesmie použiť ako bezpečnostný zdroj napätia 24 V?',
        ['vstup a výstup sú galvanicky spojené, výstup nie je oddelený od siete', 'nedá sa ním dosiahnuť napätie pod 50 V', 'má príliš veľké straty', 'jeho výstupné napätie nie je striedavé'],
        'Autotransformátor má jedno spoločné vinutie. Výstup je vodivo spojený so sieťou a pri prerušení vinutia by sa na ňom objavilo plné sieťové napätie.'],
      ['Aké menovité sekundárne prúdy majú meracie transformátory prúdu?',
        ['5 A alebo 1 A', '100 A', '10 mA', '230 A'],
        'Sekundárne hodnoty sú normalizované: 5 A alebo 1 A pre MTP a 100 V pre MTN. Stačia potom prístroje s jedným rozsahom.'],
      ['Ako je zapojený primár meracieho transformátora prúdu?',
        ['do série s meraným vedením', 'paralelne medzi fázu a zem', 'paralelne k ampérmetru', 'medzi dve fázy'],
        'MTP meria prúd vedenia, preto ním tento prúd musí prechádzať – primár je v sérii (často len jeden prechádzajúci vodič).'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Čo znamená skupina spojenia Dyn1?',
        ['VN do trojuholníka, NN do hviezdy s vyvedeným uzlom, napätie NN je posunuté o 30°', 'VN do hviezdy, NN do trojuholníka, posun 1°', 'VN do trojuholníka, NN do hviezdy, jedna odbočka', 'oba do trojuholníka, prevod 1'],
        'Veľké písmeno platí pre VN, malé pre NN, n znamená vyvedený uzol. Hodinový uhol 1 je 1 · 30° = 30°.'],
      ['Prečo majú distribučné transformátory na strane NN zapojenie yn alebo zn?',
        ['sieť NN potrebuje stredný vodič pre fázové napätie 230 V', 'aby sa zväčšil skratový prúd', 'aby bolo možné použiť jednofázové jadro', 'aby transformátor nepotreboval chladenie'],
        'Sieť 230/400 V potrebuje vyvedený uzol hviezdy (stredný vodič). Trojuholník uzol nemá.'],
      ['Akú vonkajšiu charakteristiku má zvárací transformátor?',
        ['strmo klesajúcu – pri skrate elektródou je prúd obmedzený', 'tvrdú – napätie sa so zaťažením takmer nemení', 'stúpajúcu', 'presne rovnakú ako distribučný transformátor'],
        'Zvárací transformátor má veľký rozptyl. Napätie naprázdno je asi 50 až 80 V, pri dotyku elektródy klesne a prúd sa obmedzí, takže oblúk horí stabilne.'],
      ['Aká je výhoda toroidného transformátora?',
        ['malý rozptylový tok, menšia hmotnosť a tichý chod', 'nepotrebuje jadro', 'môže pracovať na jednosmernom napätí', 'má nulový nárazový prúd pri zapnutí'],
        'Prstencové jadro navinuté z pásky má takmer dokonalý magnetický obvod. Nevýhodou je veľký nárazový prúd pri zapnutí.'],
      ['Prečo trojfázový jadrový transformátor nepotrebuje spätný stĺp pre magnetický tok?',
        ['toky troch fáz sú posunuté o 120° a ich súčet je v každom okamihu nulový', 'magnetický tok sa uzatvára vzduchom', 'každá fáza má vlastné jadro', 'tok tečie len v jednom stĺpe'],
        'Rovnako ako sa v uzle hviezdy sčítajú prúdy symetrickej sústavy na nulu, sčítajú sa na nulu aj toky troch stĺpov.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'machines',
    title: 'Trojfázové a špeciálne transformátory',
    summary: 'Trojfázový transformátor a skupina spojenia, autotransformátor, meracie transformátory prúdu a napätia, oddeľovací, bezpečnostný a zvárací transformátor.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Okrem jednofázového transformátora sa v praxi stretneš s trojfázovými transformátormi v rozvodniach, s autotransformátormi, s meracími transformátormi a s transformátormi na osobitné účely – oddeľovacími, bezpečnostnými či zváracími.' },
      { t: 'h', text: 'Trojfázový transformátor' },
      { t: 'p', text: 'Trojfázovú sústavu by mohli transformovať tri jednofázové transformátory (používa sa to pri najväčších výkonoch). Bežnejší je **trojfázový jadrový transformátor** s tromi stĺpmi – na každom je primárne aj sekundárne vinutie jednej fázy. Toky troch fáz sú posunuté o 120° a ich súčet je v každom okamihu nulový, preto spätný stĺp nie je potrebný.' },
      { t: 'figure', fig: threePhaseCoreFigure, caption: 'Trojfázový transformátor v reze. Svorky vinutia vyššieho napätia sa označujú 1U, 1V, 1W, nižšieho napätia 2U, 2V, 2W a vyvedený uzol 2N (staršie označenie A, B, C a a, b, c).' },
      { t: 'h', text: 'Zapojenie vinutí a skupina spojenia' },
      {
        t: 'list',
        items: [
          '**Y, y** – hviezda: konce vinutí sú spojené v uzle; s vyvedeným uzlom (stredným vodičom) sa píše **YN, yn**.',
          '**D, d** – trojuholník: vinutia sú spojené za sebou do uzavretého obvodu.',
          '**Z, z** – lomená hviezda (cik-cak): každá fáza má dve polovice vinutia na dvoch rôznych stĺpoch. Používa sa na strane NN, lebo dobre znáša nesymetrické zaťaženie fáz.',
          'Veľké písmeno platí pre vinutie vyššieho napätia, malé pre vinutie nižšieho napätia.',
        ],
      },
      { t: 'figure', fig: windingConnectionsFigure, caption: 'Zapojenie vinutí do hviezdy (s vyvedeným uzlom N), do trojuholníka a do lomenej hviezdy.' },
      { t: 'p', text: 'Za písmenami nasleduje **hodinový uhol** – číslo, ktoré udáva, o koľko násobkov 30° sa napätie strany NN oneskoruje za zodpovedajúcim napätím strany VN (ako ručičky hodín: VN ukazuje na 12, NN na dané číslo). Napríklad **Dyn1** znamená: VN do trojuholníka, NN do hviezdy s vyvedeným uzlom, posun 30°. Distribučné transformátory 22/0,4 kV majú zvyčajne skupinu spojenia **Dyn** alebo **Yzn**, lebo strana NN musí mať vyvedený uzol pre sieť 230/400 V. Rovnaký hodinový uhol je jednou z podmienok paralelnej prevádzky transformátorov.' },
      {
        t: 'formula',
        tex: ['$S_{n} = @s{3} · $U_{n} · $I_{n}', '$I_{n} = @f{$S_{n}}{@s{3} · $U_{n}}'],
        legend: [['$U_{n}', 'menovité združené (sieťové) napätie danej strany', 'V'], ['$I_{n}', 'menovitý prúd vo vodičoch danej strany', 'A']],
      },
      {
        t: 'example',
        title: 'Prúdy distribučného transformátora',
        given: ['`$S_{n}` = 250 kVA', '22 kV / 0,4 kV', '`$u_{k}` = 4 %'],
        steps: [
          '`$I_{1n} = @f{250 000}{1,732 · 22 000}` = 6,56 A',
          '`$I_{2n} = @f{250 000}{1,732 · 400}` = 361 A',
          '`$I_{k} = $I_{2n} · @f{100}{$u_{k}} = 361 · @f{100}{4}` = 9 025 A ≈ 9 kA',
        ],
        result: '`$I_{1n}` ≈ 6,56 A, `$I_{2n}` ≈ 361 A, skratový prúd na strane NN ≈ 9 kA',
      },
      { t: 'h', text: 'Autotransformátor' },
      { t: 'p', text: 'Autotransformátor má **len jedno vinutie** s odbočkou – časť vinutia je spoločná pre primárny aj sekundárny obvod. Výkon sa na sekundár prenáša čiastočne **galvanicky** (priamo vodičmi) a len čiastočne magnetickou indukciou. Spoločnou časťou vinutia tečie iba rozdiel prúdov `$I_{2} − $I_{1}`, takže môže byť z tenšieho drôtu. Oproti transformátoru s dvoma vinutiami autotransformátor ušetrí meď aj železo a má menšie straty a rozmery – tým viac, čím menej sa líšia napätia. Pre zvyšovací autotransformátor platia vzťahy so zameneným `$U_{1}` a `$U_{2}`.' },
      { t: 'figure', fig: autotransformerFigure, caption: 'Znižovací autotransformátor. Keby sa vinutie prerušilo v spoločnej časti, objavilo by sa na výstupe plné vstupné napätie.' },
      {
        t: 'formula',
        tex: ['$S_{t} = $S · (1 − @f{$U_{2}}{$U_{1}})', '$S_{g} = $S · @f{$U_{2}}{$U_{1}}'],
        legend: [
          ['$S', 'prechodový výkon – výkon odovzdaný spotrebiču', 'VA'],
          ['$S_{t}', 'typový výkon prenášaný indukciou – určuje veľkosť jadra a vinutia', 'VA'],
          ['$S_{g}', 'výkon prenášaný galvanicky', 'VA'],
        ],
      },
      { t: 'explore', build: autoExplorer, caption: 'Čím bližšie je `$U_{2}` k `$U_{1}`, tým menšiu časť výkonu prenáša jadro a tým menší môže byť autotransformátor.' },
      {
        t: 'example',
        title: 'Autotransformátor 230 V / 200 V',
        given: ['`$U_{1}` = 230 V, `$U_{2}` = 200 V', '`$S` = 2 kVA'],
        steps: [
          '`$I_{1} = @f{2 000}{230}` = 8,70 A, `$I_{2} = @f{2 000}{200}` = 10 A',
          'spoločnou časťou tečie `$I_{2} − $I_{1}` = 10 − 8,70 = 1,30 A',
          '`$S_{t} = 2 000 · (1 − @f{200}{230})` = 261 VA, `$S_{g} = 2 000 · @f{200}{230}` = 1 739 VA',
        ],
        result: 'Jadro stačí dimenzovať na 261 VA namiesto 2 000 VA.',
      },
      { t: 'note', kind: 'warn', text: 'Autotransformátor **galvanicky spája** vstup s výstupom, preto sa **nesmie** použiť ako oddeľovací ani bezpečnostný transformátor (napríklad na získanie 24 V zo siete 230 V) – výstup je spojený so sieťou a pri prerušení vinutia by sa na ňom objavilo plné sieťové napätie. Používa sa na plynulú reguláciu napätia (regulačný autotransformátor s posuvným kontaktom), na spúšťanie veľkých motorov a na spojenie sietí 400 kV a 220 kV.' },
      { t: 'h', text: 'Meracie transformátory' },
      { t: 'p', text: 'Meracie transformátory zmenšia veľké prúdy a napätia na hodnoty vhodné pre meracie prístroje, elektromery a ochrany a **oddelia** ich od vysokého napätia. Sekundárne hodnoty sú normalizované, takže stačia prístroje s rozsahom 5 A (alebo 1 A) a 100 V. Skutočnú hodnotu dostaneš vynásobením údaja prístroja prevodom transformátora.' },
      { t: 'figure', fig: instrumentTransformersFigure, caption: 'Merací transformátor prúdu (MTP) je zapojený do série s vedením, merací transformátor napätia (MTN) paralelne medzi vodiče.' },
      {
        t: 'table',
        head: ['', 'Transformátor prúdu (MTP)', 'Transformátor napätia (MTN)'],
        rows: [
          ['zapojenie primáru', 'do série (niekoľko závitov alebo len prechádzajúci vodič)', 'paralelne medzi fázy alebo medzi fázu a zem'],
          ['menovitá sekundárna hodnota', '5 A alebo 1 A', '100 V (alebo 100/√3 V)'],
          ['prevádzkový stav', 'takmer nakrátko – ampérmeter má malý odpor', 'takmer naprázdno – voltmeter má veľký odpor'],
          ['skutočná hodnota', '`$I_{1} = $p_{I} · $I_{A}`', '`$U_{1} = $p_{U} · $U_{V}`'],
          ['nebezpečné je', '**rozpojiť sekundár**', '**skratovať sekundár**'],
        ],
      },
      { t: 'note', kind: 'warn', text: 'Sekundár meracieho transformátora prúdu sa **nikdy nesmie rozpojiť**, keď primárom tečie prúd. Chýbal by protipôsobiaci sekundárny prúd, celý primárny prúd by bol magnetizačný, jadro by sa presýtilo a na sekundárnych svorkách by sa indukovalo nebezpečne vysoké napätie (aj tisíce voltov). Pred odpojením prístroja sa svorky S1 – S2 najprv skratujú. Sekundár MTN sa naopak **nesmie skratovať** – istí sa poistkami. Jedna svorka sekundáru oboch transformátorov sa uzemňuje.' },
      {
        t: 'example',
        title: 'Odčítanie cez meracie transformátory',
        given: ['MTP 200/5 A, ampérmeter ukazuje 3,6 A', 'MTN 22 000/100 V, voltmeter ukazuje 98 V'],
        steps: [
          '`$p_{I} = @f{200}{5}` = 40, `$I_{1}` = 40 · 3,6 = 144 A',
          '`$p_{U} = @f{22 000}{100}` = 220, `$U_{1}` = 220 · 98 = 21 560 V',
        ],
        result: 'Vedením tečie 144 A pri napätí 21,56 kV.',
      },
      { t: 'h', text: 'Ďalšie špeciálne transformátory' },
      {
        t: 'list',
        items: [
          '**Oddeľovací transformátor** (zvyčajne 230 V / 230 V) galvanicky oddelí spotrebič od siete – ochrana elektrickým oddelením. Pripája sa k nemu spravidla len jeden spotrebič.',
          '**Bezpečnostný transformátor** napája obvody malého napätia **SELV** a **PELV** – výstupné napätie nepresiahne 50 V striedavých a vinutia sú od seba oddelené dvojitou alebo zosilnenou izoláciou (hračky, osvetlenie 12 V, ručné svietidlá).',
          '**Zvárací transformátor** má veľký rozptyl a **strmo klesajúcu** vonkajšiu charakteristiku: napätie naprázdno asi 50 až 80 V, pri skrate elektródou je prúd obmedzený a oblúk horí stabilne.',
          '**Toroidný transformátor** má jadro v tvare prstenca navinuté z pásky: malý rozptylový tok, menšia hmotnosť a tichý chod, ale veľký nárazový prúd pri zapnutí.',
        ],
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Prečo sa nesmie rozpojiť sekundárny obvod meracieho transformátora prúdu?',
      options: ['na sekundári by sa indukovalo nebezpečne vysoké napätie a jadro by sa prehrievalo', 'ampérmeter by ukazoval nulu, čo je pre prístroj škodlivé', 'vedením by prestal tiecť prúd a spotrebiče by sa vypli', 'transformátor by sa zmenil na autotransformátor'],
      explanation: 'Bez sekundárneho prúdu by celý primárny prúd magnetoval jadro. Jadro sa presýti, prehrieva a na otvorenom sekundári vzniknú napäťové špičky aj tisíce voltov.',
    },
    {
      lessonId: ID,
      prompt: 'Aké je menovité sekundárne napätie meracieho transformátora napätia?',
      options: ['100 V', '5 V', '230 V', '400 V'],
      explanation: 'Sekundárne napätie MTN je normalizované na 100 V (pri zapojení medzi fázu a zem 100/√3 V), prúd MTP na 5 A alebo 1 A.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo autotransformátor nemôže byť bezpečnostným transformátorom?',
      options: ['vstup a výstup sú galvanicky spojené', 'má príliš malú účinnosť', 'nedá sa ním znížiť napätie pod 50 V', 'má príliš veľký rozptyl'],
      explanation: 'Bezpečnostný transformátor musí mať vinutia oddelené dvojitou alebo zosilnenou izoláciou. Autotransformátor má jedno spoločné vinutie.',
    },
    {
      lessonId: ID,
      prompt: 'Čo znamená v skupine spojenia Dyn1 písmeno n?',
      options: ['uzol hviezdy na strane NN je vyvedený (stredný vodič)', 'vinutie NN je zapojené do trojuholníka', 'transformátor je naprázdno', 'hodinový uhol je nulový'],
      explanation: 'D – VN do trojuholníka, y – NN do hviezdy, n – vyvedený uzol hviezdy, 1 – hodinový uhol 30°.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je menovitý prúd na strane NN transformátora 400 kVA, 22 / 0,4 kV?',
      options: ['približne 577 A', 'približne 1 000 A', 'približne 10,5 A', 'približne 333 A'],
      explanation: '`$I_{n} = @f{400 000}{@s{3} · 400}` ≈ 577 A. Prúd 10,5 A tečie na strane 22 kV; 1 000 A by vyšlo bez `@s{3}`.',
    },
    {
      lessonId: ID,
      prompt: 'Ampérmeter pripojený cez MTP 300/5 A ukazuje 4 A. Aký prúd tečie vedením?',
      options: ['240 A', '4 A', '75 A', '1 500 A'],
      explanation: 'Prevod je 300 / 5 = 60, skutočný prúd 60 · 4 = 240 A.',
    },
    {
      lessonId: ID,
      prompt: 'Akú hodnotu nesmie prekročiť výstupné napätie bezpečnostného transformátora pre obvody SELV?',
      options: ['50 V striedavých', '230 V', '120 V striedavých', '12 V'],
      explanation: 'Malé napätie (ELV) je najviac 50 V striedavých alebo 120 V jednosmerných bez zvlnenia. Bežne sa používa 12 V alebo 24 V.',
    },
  ],
  generators,
};

export default mod;
