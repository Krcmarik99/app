import type { LessonModule } from '../../module';
import { int, pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, type Generator } from '../../../practice/helpers';
import { explorer } from '../../../ui/explorer';
import { MAGNETIC, thermalMax, thermalMin, tripChart, tripCurvesChart, type TripChar } from '../../../ui/fig-power';
import { choice } from '../util';

const ID = 'istenie';
const RHO = 0.0178;
const STD_IN = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
const STD_S = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

/** Čas v sekundách čitateľne: 0,05 s, 12 s, 3,2 min. */
function timeText(t: number): string {
  if (!Number.isFinite(t)) return 'nevypne do 1 h';
  if (t >= 3600) return 'viac ako 1 h';
  if (t >= 120) return `${fmt(t / 60, 2)} min`;
  return `${fmt(t, 2)} s`;
}

/** Ktorá spúšť zareaguje pri násobku k menovitého prúdu a v akom čase. */
export function tripAt(ch: TripChar, k: number): { release: string; range?: [number, number]; text: string } {
  const [m1, m2] = MAGNETIC[ch];
  if (k < 1.13) return { release: 'žiadna', text: 'Istič nevypne – prúd neprekročil dohovorený nevypínací prúd 1,13 · In.' };
  if (k < 1.45) {
    return { release: 'tepelná', range: [thermalMin(k), Math.min(10000, thermalMax(k))], text: 'Mierne preťaženie: istič môže vypnúť až po dlhom čase, do jednej hodiny vypnúť nemusí. Pri 1,45 · In už vypne zaručene do 1 h.' };
  }
  if (k < m1) {
    return { release: 'tepelná', range: [thermalMin(k), thermalMax(k)], text: `Preťaženie: bimetal sa zohrieva a istič vypne s oneskorením ${timeText(thermalMin(k))} až ${timeText(thermalMax(k))}. Elektromagnetická spúšť ešte nereaguje (pod ${m1} · In).` };
  }
  if (k < m2) {
    return { release: 'elmag. alebo tepelná', range: [0.01, thermalMax(k)], text: `Pásmo elektromagnetickej spúšte ${m1} až ${m2} · In: istič môže vypnúť okamžite, ale zaručené to nie je. Inak vypne tepelná spúšť najneskôr za ${timeText(thermalMax(k))}.` };
  }
  return { release: 'elektromagnetická', range: [0.01, 0.1], text: `Skrat: prúd je aspoň ${m2} · In, elektromagnetická spúšť vypne okamžite (do 0,1 s).` };
}

function tripExplorer(): HTMLElement {
  return explorer({
    title: 'Vypínacia charakteristika ističa',
    params: [{ key: 'k', label: 'Prúd ako násobok `$I_{n}`', unit: '', min: 1, max: 60, value: 4, log: true, format: (v) => `${fmt(v, 3)} · In` }],
    choices: [{ key: 'ch', label: 'Charakteristika', options: [['B', 'B (3 až 5 · In)'], ['C', 'C (5 až 10 · In)'], ['D', 'D (10 až 20 · In)']], value: 'B' }],
    draw: ({ k }, { ch }) => {
      const c = ch as TripChar;
      const r = tripAt(c, k);
      const timeRange = r.range ? (r.release === 'elektromagnetická' ? 'do 0,1 s' : `${timeText(r.range[0])} až ${timeText(r.range[1])}`) : '—';
      return {
        chart: tripChart(c, k, r.range),
        readouts: [
          ['Prúd pri `$I_{n}` = 16 A', `${fmt(16 * k, 3)} A`],
          ['Spúšť', r.release],
          ['Čas vypnutia', timeRange],
        ],
        note: r.text,
      };
    },
  });
}

const CABLES = [
  { S: 1.5, Iz: 16.5 },
  { S: 2.5, Iz: 23 },
  { S: 4, Iz: 30 },
  { S: 6, Iz: 38 },
  { S: 10, Iz: 52 },
];

const generators: Generator[] = [
  // Prúd zaručeného okamžitého vypnutia.
  (rng) => {
    const ch = pick(rng, ['B', 'C', 'D'] as TripChar[]);
    const In = pick(rng, STD_IN);
    const [m1, m2] = MAGNETIC[ch];
    const I = m2 * In;
    return numeric(ID, `Pri akom najmenšom prúde istič ${ch}${In} zaručene vypne okamžite elektromagnetickou spúšťou?`, I, 'A', [
      `Charakteristika ${ch} má pásmo elektromagnetickej spúšte ${m1} až ${m2} · \`$I_{n}\`. Okamžité vypnutie je zaručené až na hornej hranici.`,
      `\`$I\` = ${m2} · \`$I_{n}\` = ${m2} · ${In} = **${n(I)} A**`,
      `Pri prúde ${n(m1 * In)} A až ${n(I)} A môže vypnúť okamžite, ale nemusí.`,
    ]);
  },
  // Prevádzkový prúd spotrebiča.
  (rng) => {
    if (rng() < 0.55) {
      const P = pick(rng, [800, 1200, 2000, 2200, 3000, 3500]);
      const c = pick(rng, [1, 1, 0.95, 0.9, 0.8]);
      const IB = P / (230 * c);
      return numeric(ID, `Jednofázový spotrebič s príkonom ${q(P, 'W')} pracuje pri napätí 230 V s účinníkom ${n(c)}. Aký je prevádzkový prúd \`$I_{B}\`, s ktorým sa dimenzuje jeho obvod?`, IB, 'A', [
        `\`$I_{B} = @f{$P}{$U · cos $φ} = @f{${n(P)}}{230 · ${n(c)}}\` = **${n(IB, 4)} A**`,
      ]);
    }
    const P = pick(rng, [4000, 5500, 7500, 11000, 15000, 22000]);
    const c = pick(rng, [0.8, 0.85, 0.9]);
    const IB = P / (Math.sqrt(3) * 400 * c);
    return numeric(ID, `Trojfázový spotrebič s príkonom ${q(P, 'W')} je pripojený na sieť 400 V a má účinník ${n(c)}. Aký je prevádzkový prúd \`$I_{B}\`?`, IB, 'A', [
      `\`$I_{B} = @f{$P}{@s{3} · $U · cos $φ} = @f{${n(P)}}{1,732 · 400 · ${n(c)}}\` = **${n(IB, 4)} A**`,
    ]);
  },
  // Voľba ističa podľa IB ≤ In ≤ Iz.
  (rng) => {
    let cable = CABLES[0];
    let P = 0;
    let IB = 0;
    let correct = 0;
    do {
      cable = pick(rng, CABLES.slice(0, 4));
      const allowed = STD_IN.filter((x) => x >= 10 && x <= cable.Iz);
      const target = pick(rng, allowed);
      const prev = STD_IN[STD_IN.indexOf(target) - 1];
      P = Math.round(((prev + (target - prev) * (0.3 + 0.6 * rng())) * 230) / 100) * 100;
      IB = P / 230;
      correct = STD_IN.find((x) => x >= IB) ?? 0;
    } while (!(correct > 0 && correct <= cable.Iz && STD_IN.indexOf(correct) > 0));
    const below = STD_IN[STD_IN.indexOf(correct) - 1];
    const over = STD_IN.filter((x) => x > cable.Iz);
    const options = [correct, below, over[0], over[1]].map((x) => `istič ${x} A`) as [string, string, string, string];
    return choice(ID, `Jednofázový spotrebič s príkonom ${q(P, 'W')} (\`cos $φ\` = 1, 230 V) je pripojený medeným vodičom ${n(cable.S)} mm², ktorý má pri danom uložení dovolené zaťaženie \`$I_{z}\` = ${n(cable.Iz)} A. Ktorý najmenší vhodný istič zvolíš?`,
      options,
      `\`$I_{B} = @f{${n(P)}}{230}\` = ${n(IB, 3)} A. Podmienka \`$I_{B} ≤ $I_{n} ≤ $I_{z}\`: istič ${below} A je menší ako prevádzkový prúd (vypínal by), ističe ${over[0]} A a ${over[1]} A sú väčšie ako \`$I_{z}\` = ${n(cable.Iz)} A (nechránili by vodič pred preťažením). Vyhovuje **${correct} A**.`,
      rng);
  },
  // Prierez z dovoleného úbytku napätia.
  (rng) => {
    const l = pick(rng, [15, 20, 25, 30, 40, 50, 60]);
    const I = pick(rng, [10, 13, 16, 20, 25, 32]);
    const du = pick(rng, [3, 5]);
    const dU = (du / 100) * 230;
    const S = (2 * l * I * RHO) / dU;
    const std = STD_S.find((x) => x >= S) ?? 50;
    return numeric(ID, `Jednofázový obvod 230 V s medenými vodičmi (\`$ρ\` = 0,0178 Ω·mm²/m) má dĺžku ${n(l)} m a prevádzkový prúd ${n(I)} A. Úbytok napätia nesmie prekročiť ${du} %. Aký najmenší prierez vodičov vychádza výpočtom?`, S, 'mm²', [
      `Dovolený úbytok: \`Δ$U\` = ${du} % z 230 V = ${n(dU, 4)} V`,
      `\`$S = @f{2 · $l · $I · $ρ}{Δ$U} = @f{2 · ${n(l)} · ${n(I)} · 0,0178}{${n(dU, 4)}}\` = **${n(S, 3)} mm²**`,
      `Zvolíš najbližší väčší normalizovaný prierez ${n(std)} mm² a overíš aj podmienku \`$I_{B} ≤ $I_{n} ≤ $I_{z}\`.`,
    ], { fixedUnit: true, tolerance: 0.02 });
  },
  // Úbytok v percentách pri danom priereze.
  (rng) => {
    const S = pick(rng, [1.5, 2.5, 4, 6]);
    const l = int(rng, 3, 12) * 5;
    const I = pick(rng, S === 1.5 ? [6, 8, 10] : S === 2.5 ? [10, 13, 16] : [16, 20, 25]);
    const dU = (2 * l * I * RHO) / S;
    const pct = (dU / 230) * 100;
    return numeric(ID, `Zásuvkový obvod 230 V je vedený medeným káblom s prierezom ${n(S)} mm² (\`$ρ\` = 0,0178 Ω·mm²/m) na vzdialenosť ${n(l)} m a tečie ním prúd ${n(I)} A. Aký je percentuálny úbytok napätia?`, pct, '%', [
      `Prúd tečie tam aj späť, preto dĺžka slučky je \`2 · $l\`: \`Δ$U = @f{2 · $l · $I · $ρ}{$S} = @f{2 · ${n(l)} · ${n(I)} · 0,0178}{${n(S)}}\` = ${n(dU, 4)} V`,
      `\`Δ$u = @f{Δ$U}{$U} · 100 % = @f{${n(dU, 4)}}{230} · 100 %\` = **${n(pct, 3)} %**`,
      pct <= 3 ? 'Úbytok je v poriadku aj pre svetelné obvody (do 3 %).' : pct <= 5 ? 'Pre zásuvkové obvody vyhovuje (do 5 %), pre svetelné by bol príliš veľký.' : 'Úbytok je väčší ako 5 % – treba väčší prierez.',
    ], { fixedUnit: true, tolerance: 0.02 });
  },
  // Charakteristika podľa spotrebiča.
  (rng) => {
    const v = pick(rng, [
      { load: 'zásuvkový obvod v byte', a: 'B', why: 'Bežné domové zásuvkové a svetelné obvody nemajú veľké záberové prúdy – istia sa ističmi B.' },
      { load: 'svetelný obvod v rodinnom dome so žiarovkami a LED svietidlami', a: 'B', why: 'Svetelné obvody v domácnosti sa istia ističmi B, okamžitá spúšť vypína už od 3 až 5 · In.' },
      { load: 'trojfázový asynchrónny motor čerpadla', a: 'C', why: 'Motor má pri rozbehu záberový prúd asi 5- až 7-násobok menovitého – istič B by pri rozbehu vypínal, preto C.' },
      { load: 'dielenský kompresor s motorom a skupina žiarivkových svietidiel', a: 'C', why: 'Motory a svietidlá s väčším záberovým prúdom sa istia charakteristikou C (5 až 10 · In).' },
      { load: 'transformátor alebo zváračka s veľmi veľkým nárazovým prúdom pri zapnutí', a: 'D', why: 'Pri zapnutí transformátora vzniká nárazový prúd aj viac ako 10 · In – treba charakteristiku D (10 až 20 · In).' },
    ]);
    const options = [v.a, ...['B', 'C', 'D'].filter((x) => x !== v.a), 'gG'].map((x) => (x === 'gG' ? 'poistka aM namiesto ističa' : `charakteristika ${x}`)) as [string, string, string, string];
    return choice(ID, `Akú vypínaciu charakteristiku ističa zvolíš pre tento obvod: ${v.load}?`, options, v.why, rng);
  },
  // Ktorá spúšť zareaguje.
  (rng) => {
    const ch = pick(rng, ['B', 'C', 'D'] as TripChar[]);
    const In = pick(rng, [10, 16, 20, 25, 32]);
    const [m1, m2] = MAGNETIC[ch];
    const kind = pick(rng, ['none', 'thermal', 'magnetic'] as const);
    const k = kind === 'none' ? pick(rng, [0.6, 0.8, 1]) : kind === 'thermal' ? pick(rng, [1.5, 2, 2.5].filter((x) => x < m1)) : pick(rng, [1.2, 1.5, 2]) * m2;
    const I = Math.round(k * In);
    const thermal = 'tepelná spúšť (bimetal) – vypne s oneskorením';
    const magnetic = 'elektromagnetická spúšť – vypne okamžite';
    const none = 'istič nevypne, je to bežná prevádzka';
    const correct = kind === 'none' ? none : kind === 'thermal' ? thermal : magnetic;
    const rest = [thermal, magnetic, none].filter((x) => x !== correct);
    return choice(ID, `Ističom ${ch}${In} začne tiecť prúd ${I} A. Čo sa stane?`, [correct, rest[0], rest[1], 'vypne prúdový chránič, istič nereaguje'],
      `Pomer \`@f{$I}{$I_{n}} = @f{${I}}{${In}}\` = ${n(I / In, 3)}. ${kind === 'none'
        ? 'Prúd neprekračuje menovitý prúd ističa – istič nevypne.'
        : kind === 'thermal'
          ? `Je to preťaženie (väčšie ako 1,45 · In, ale menšie ako ${m1} · In) – zareaguje tepelná spúšť s oneskorením.`
          : `Prúd je väčší ako ${m2} · In – ide o skrat a elektromagnetická spúšť vypne okamžite.`}`,
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'power',
    title: 'Istenie vedení: poistky a ističe',
    summary: 'Preťaženie a skrat, tavné poistky gG a aM, istič s tepelnou a elektromagnetickou spúšťou, charakteristiky B, C a D, selektivita, dimenzovanie vedenia a úbytok napätia.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Každé vedenie má prierez dimenzovaný na určitý prúd. Väčší prúd – **nadprúd** – by vodiče prehrieval, poškodil izoláciu a mohol spôsobiť požiar. Istiace prvky (poistky a ističe) nadprúd včas odpoja. Rozlišujeme dva druhy nadprúdu:' },
      {
        t: 'list',
        items: [
          '**Preťaženie** – v neporušenom obvode tečie väčší prúd ako menovitý, napríklad keď zapneš príliš veľa spotrebičov alebo je motor mechanicky preťažený. Prúd je obvykle 1- až 3-násobkom menovitého a vodiče sa zohrievajú postupne – odpojiť ho stačí s oneskorením.',
          '**Skrat** – vodivé spojenie vodičov s rôznym potenciálom cez zanedbateľnú impedanciu (L s N, L s PE, dve fázy). Prúd dosiahne stovky až tisíce ampérov a musí sa odpojiť **okamžite**.',
        ],
      },
      { t: 'h', text: 'Tavná poistka' },
      { t: 'p', text: 'Poistka obsahuje **tavný vodič** v keramickom puzdre vyplnenom kremenným pieskom, ktorý uhasí oblúk. Pri nadprúde sa tavný vodič pretaví a obvod sa preruší – čím väčší prúd, tým rýchlejšie. Poistka je jednorázová, po vypnutí sa vymení za novú s **rovnakým menovitým prúdom**. Dôležité parametre sú **menovitý prúd** `$I_{n}`, menovité napätie a **vypínacia schopnosť** – najväčší skratový prúd, ktorý poistka bezpečne preruší (pri poistkách rádovo desiatky kA). V rozvodoch sa používajú závitové poistky (D, D0) a nožové poistky (PN, NH).' },
      {
        t: 'table',
        head: ['Označenie', 'Vlastnosti', 'Použitie'],
        rows: [
          ['**gG**', 'celorozsahová poistka – vypína preťaženie aj skrat', 'istenie vedení a káblov, všeobecné použitie'],
          ['**aM**', 'poistka s čiastkovým rozsahom – len pri veľkých prúdoch (skrat), znesie záberové prúdy', 'istenie motorov; pred preťažením chráni motor tepelné relé alebo motorový spúšťač'],
        ],
      },
      { t: 'h', text: 'Istič' },
      { t: 'p', text: '**Istič** je spínací prístroj, ktorý vie obvod zapnúť a vypnúť ručne aj samočinne pri nadprúde, a po odstránení príčiny sa dá znova zapnúť. Má dve spúšte: **tepelnú** – bimetal, ktorý sa prechodom prúdu zohrieva a ohýba; reaguje na **preťaženie** s oneskorením, ktoré je tým kratšie, čím je prúd väčší; a **elektromagnetickú** – cievku s kotvou, ktorá pri veľkom prúde okamžite uvoľní západku; reaguje na **skrat**. Oblúk medzi kontaktmi uhasí zhášacia komora. Bežné menovité prúdy ističov sú 6, 10, 13, 16, 20, 25, 32, 40, 50 a 63 A, vypínacia schopnosť domových ističov býva 6 kA alebo 10 kA.' },
      { t: 'figure', fig: tripCurvesChart, caption: 'Vypínacie charakteristiky ističov (logaritmické osi). Tepelná spúšť má pre všetky tri charakteristiky rovnaké pásmo; líšia sa pásmom okamžitého vypnutia elektromagnetickou spúšťou.' },
      {
        t: 'table',
        head: ['Charakteristika', 'Okamžité vypnutie', 'Použitie'],
        rows: [
          ['**B**', '3 až 5 · `$I_{n}`', 'svetelné a zásuvkové obvody v domácnostiach, dlhé vedenia'],
          ['**C**', '5 až 10 · `$I_{n}`', 'motory, svietidlá s väčším záberovým prúdom, priemyselné obvody'],
          ['**D**', '10 až 20 · `$I_{n}`', 'transformátory, zváračky, motory s ťažkým rozbehom – veľké nárazové prúdy'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Pri prúde 1,13 · `$I_{n}` istič **nesmie** vypnúť do jednej hodiny, pri 1,45 · `$I_{n}` **musí** vypnúť do jednej hodiny. Pri dolnej hranici pásma elektromagnetickej spúšte (napr. 3 · `$I_{n}` pri B) nesmie vypnúť okamžite, pri hornej hranici (5 · `$I_{n}`) musí vypnúť do 0,1 s.' },
      { t: 'explore', build: tripExplorer, caption: 'Posuň prúd a zmeň charakteristiku. Červená úsečka ukazuje rozsah možných časov vypnutia pri danom prúde.' },
      {
        t: 'example',
        title: 'Skrat 120 A v obvode s ističom B16 alebo C16',
        given: ['skratový prúd `$I_{k}` = 120 A', 'istič B16 alebo C16'],
        steps: [
          'B16: okamžité vypnutie je zaručené od 5 · 16 = 80 A. 120 A > 80 A → vypne elektromagnetická spúšť do 0,1 s.',
          'C16: pásmo okamžitého vypnutia je 5 · 16 = 80 A až 10 · 16 = 160 A. 120 A je v tomto pásme → okamžité vypnutie nie je zaručené.',
          'Pomer `@f{120}{16}` = 7,5 – ak nezareaguje elektromagnetická spúšť, vypne tepelná spúšť až za niekoľko sekúnd.',
        ],
        result: 'B16 vypne okamžite, C16 nemusí – v obvode s veľkou impedanciou slučky je vhodnejší istič B',
      },
      { t: 'h', text: 'Selektivita' },
      { t: 'p', text: 'Istiace prvky sú zapojené za sebou – hlavný istič pred elektromerom, ističe v bytovom rozvádzači, prípadne istič v spotrebiči. **Selektivita** znamená, že pri poruche vypne len istiaci prvok **najbližší k miestu poruchy** a ostatné časti inštalácie zostanú v prevádzke. Dosahuje sa odstupňovaním menovitých prúdov a charakteristík, prípadne časovým oneskorením nadradeného prvku. Pri poistkách gG sa za selektívne považujú poistky, ktorých menovité prúdy sú v pomere aspoň 1,6 : 1.' },
      { t: 'h', text: 'Dimenzovanie vedenia' },
      {
        t: 'formula',
        tex: ['$I_{B} ≤ $I_{n} ≤ $I_{z}', '$I_{2} ≤ 1,45 · $I_{z}'],
        legend: [
          ['$I_{B}', 'prevádzkový (výpočtový) prúd obvodu, napr. `@f{$P}{$U · cos $φ}`', 'A'],
          ['$I_{n}', 'menovitý prúd istiaceho prvku', 'A'],
          ['$I_{z}', 'dovolené trvalé zaťaženie vodiča (závisí od prierezu, izolácie a uloženia)', 'A'],
          ['$I_{2}', 'prúd, pri ktorom istiaci prvok zaručene vypne (istič 1,45 · In) – pri ističoch je podmienka splnená automaticky', 'A'],
        ],
      },
      {
        t: 'table',
        head: ['Prierez Cu (PVC)', '`$I_{z}` približne podľa uloženia', 'Bežný istič', 'Typické použitie'],
        rows: [
          ['1,5 mm²', '14,5 až 19,5 A', '10 A (pri vhodnom uložení 16 A)', 'svetelné obvody'],
          ['2,5 mm²', '19,5 až 27 A', '16 A (pri vhodnom uložení 20 A)', 'zásuvkové obvody'],
          ['4 mm²', '26 až 36 A', '20 až 25 A', 'samostatné výkonnejšie spotrebiče'],
          ['6 mm²', '34 až 46 A', '32 A', 'prívody podružných rozvádzačov'],
          ['10 mm²', '46 až 63 A', '40 A', 'prívody do bytov a domov'],
        ],
      },
      { t: 'note', kind: 'tip', text: 'Tabuľka je len **orientačná** – platí pre dva zaťažené medené vodiče s izoláciou PVC. Skutočné `$I_{z}` určuje norma podľa spôsobu uloženia (v rúrke v tepelne izolačnej stene, na povrchu, v zemi…), počtu zaťažených vodičov a teploty okolia.' },
      {
        t: 'example',
        title: 'Istenie kuchynského zásuvkového obvodu',
        given: ['kanvica 2 kW a mikrovlnná rúra 1 kW, `cos $φ` = 1, 230 V', 'vodič Cu 2,5 mm² v rúrke v stene, `$I_{z}` = 23 A'],
        steps: [
          '`$I_{B} = @f{$P}{$U} = @f{3 000}{230}` = 13,04 A',
          'Najbližší väčší menovitý prúd ističa je 16 A.',
          'Kontrola: 13,04 A ≤ 16 A ≤ 23 A – podmienka je splnená.',
        ],
        result: 'istič B16 a vodič 2,5 mm² vyhovujú',
      },
      { t: 'h', text: 'Úbytok napätia' },
      {
        t: 'formula',
        tex: ['Δ$U = @f{2 · $l · $I · $ρ}{$S}', 'Δ$u = @f{Δ$U}{$U} · 100 %', '$S = @f{2 · $l · $I · $ρ}{Δ$U}'],
        legend: [
          ['$l', 'dĺžka vedenia (jednoduchá, prúd tečie tam aj späť)', 'm'],
          ['$ρ', 'rezistivita – meď 0,0178, hliník 0,0285', 'Ω·mm²/m'],
          ['$S', 'prierez jedného vodiča', 'mm²'],
          ['Δ$u', 'úbytok napätia v percentách menovitého napätia', '%'],
        ],
      },
      {
        t: 'example',
        title: 'Úbytok napätia v zásuvkovom obvode',
        given: ['`$l` = 25 m, `$I` = 16 A', 'Cu, `$S` = 2,5 mm²', '`$U` = 230 V'],
        steps: [
          '`Δ$U = @f{2 · 25 · 16 · 0,0178}{2,5}` = 5,70 V',
          '`Δ$u = @f{5,70}{230} · 100 %` = 2,48 %',
        ],
        result: '2,48 % – vyhovuje (dovolené je 5 %, pre svetelné obvody 3 %)',
      },
      {
        t: 'example',
        title: 'Prierez z dovoleného úbytku',
        given: ['`$l` = 40 m, `$I` = 20 A, Cu', 'dovolený úbytok 3 % z 230 V'],
        steps: [
          '`Δ$U` = 0,03 · 230 = 6,9 V',
          '`$S = @f{2 · 40 · 20 · 0,0178}{6,9}` = 4,13 mm²',
          'Najbližší väčší normalizovaný prierez je 6 mm².',
        ],
        result: '`$S` = 6 mm² (4 mm² by úbytok nesplnil)',
      },
      { t: 'note', kind: 'warn', text: 'Od miesta pripojenia (elektromera) po spotrebič sa obvykle pripúšťa úbytok **3 % pre svetelné** a **5 % pre ostatné obvody**. Vypálenú poistku nikdy nenahrádzaj drôtom ani poistkou s väčším menovitým prúdom a istič nevymieňaj za väčší – vodiče by prestali byť chránené pred preťažením.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Ktorá spúšť ističa reaguje na preťaženie?',
      options: ['tepelná spúšť s bimetalom – vypne s oneskorením', 'elektromagnetická spúšť – vypne okamžite', 'súčtový transformátor prúdu', 'zhášacia komora'],
      explanation: 'Bimetal sa pri preťažení postupne zohrieva a ohýba – čím väčší prúd, tým skôr vypne. Elektromagnetická spúšť je na skrat.',
    },
    {
      lessonId: ID,
      prompt: 'V akom rozsahu prúdov vypína okamžite istič s charakteristikou C?',
      options: ['5 až 10-násobok menovitého prúdu', '3 až 5-násobok menovitého prúdu', '10 až 20-násobok menovitého prúdu', '1,13 až 1,45-násobok menovitého prúdu'],
      explanation: 'B: 3 až 5 · In, C: 5 až 10 · In, D: 10 až 20 · In. Hodnoty 1,13 a 1,45 · In patria tepelnej spúšti.',
    },
    {
      lessonId: ID,
      prompt: 'Čo vyjadruje podmienka `$I_{B} ≤ $I_{n} ≤ $I_{z}`?',
      options: [
        'istič nesmie vypínať pri prevádzkovom prúde a zároveň musí chrániť vodič pred preťažením',
        'impedancia slučky musí byť dosť malá',
        'prúdový chránič musí vypnúť pri 30 mA',
        'úbytok napätia nesmie prekročiť 3 %',
      ],
      explanation: 'Menovitý prúd istiaceho prvku musí byť aspoň taký ako prevádzkový prúd obvodu `$I_{B}` a najviac taký ako dovolené zaťaženie vodiča `$I_{z}`.',
    },
    {
      lessonId: ID,
      prompt: 'Čo znamená označenie poistky gG?',
      options: [
        'celorozsahová poistka na istenie vedení – vypína preťaženie aj skrat',
        'poistka len na skratovú ochranu motorov',
        'rýchla poistka na polovodiče',
        'poistka pre jednosmerný prúd',
      ],
      explanation: 'gG je poistka na všeobecné použitie (istenie vedení). Motory s veľkými záberovými prúdmi sa istia poistkami aM, ktoré vypínajú len veľké prúdy.',
    },
    {
      lessonId: ID,
      prompt: 'Čo je selektivita istenia?',
      options: [
        'pri poruche vypne len istiaci prvok najbližší k miestu poruchy',
        'pri poruche vypnú všetky ističe naraz',
        'istič vypína len jednu fázu',
        'schopnosť ističa vypnúť veľký skratový prúd',
      ],
      explanation: 'Vďaka selektivite zostane zvyšok inštalácie v prevádzke. Schopnosť vypnúť veľký prúd je vypínacia schopnosť.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa motor s veľkým záberovým prúdom neisti ističom B?',
      options: [
        'záberový prúd pri rozbehu by mohol spôsobiť okamžité vypnutie elektromagnetickou spúšťou',
        'istič B nemá tepelnú spúšť',
        'istič B sa smie použiť len pre jednosmerný prúd',
        'istič B má príliš veľkú vypínaciu schopnosť',
      ],
      explanation: 'Záberový prúd motora býva 5- až 7-násobok menovitého, čo je v pásme okamžitého vypnutia ističa B (3 až 5 · In). Preto sa používa charakteristika C alebo D.',
    },
    {
      lessonId: ID,
      prompt: 'Aký úbytok napätia sa obvykle pripúšťa v svetelných obvodoch od elektromera po svietidlo?',
      options: ['3 %', '10 %', '0,5 %', '20 %'],
      explanation: 'Pre svetelné obvody sa pripúšťa 3 %, pre ostatné obvody 5 % menovitého napätia.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmení úbytok napätia, keď pri rovnakom prúde a dĺžke použiješ vodič s dvojnásobným prierezom?',
      options: ['zmenší sa na polovicu', 'zdvojnásobí sa', 'nezmení sa', 'zmenší sa na štvrtinu'],
      explanation: '`Δ$U = @f{2 · $l · $I · $ρ}{$S}` – úbytok je nepriamo úmerný prierezu.',
    },
  ],
  generators,
};

export default mod;
