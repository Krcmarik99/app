import type { FigureFn } from '../practice/types';
import type { FigureId } from '../ui/figures';
import { MODULES } from './all-modules';

/*
 * Obsah lekcií. Vo vzorcoch (v `...` a v blokoch formula) platí zápis z lib/formula.ts:
 * $U je veličina kurzívou, _{1} dolný index, ^{2} horný index, @f{a}{b} zlomok, @s{a} odmocnina.
 */

export type ChapterId = 'dc' | 'fields' | 'ac' | 'parts' | 'machines' | 'electronics' | 'digital' | 'power' | 'meas';

export interface Chapter {
  id: ChapterId;
  title: string;
  blurb: string;
  /** V ktorom ročníku strednej priemyselnej školy elektrotechnickej sa učivo zvyčajne preberá. */
  grade: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'dc', title: 'Jednosmerný prúd', blurb: 'Veličiny, Ohmov a Kirchhoffove zákony, výkon a reálny zdroj.', grade: '1. ročník' },
  { id: 'fields', title: 'Elektrické a magnetické pole', blurb: 'Kondenzátor, cievka, elektromagnetická indukcia.', grade: '1. ročník' },
  { id: 'parts', title: 'Súčiastky v praxi', blurb: 'Farebný kód rezistorov, diódy a LED.', grade: '1. ročník' },
  { id: 'ac', title: 'Striedavý prúd', blurb: 'Sínusové veličiny, impedancia, výkon a účinník, rezonančné obvody, filtre a trojfázová sústava.', grade: '2. a 3. ročník' },
  { id: 'machines', title: 'Elektrické stroje', blurb: 'Transformátory, asynchrónny motor, jednosmerné a synchrónne stroje.', grade: '3. ročník' },
  { id: 'electronics', title: 'Elektronika', blurb: 'Usmerňovače, stabilizátory, tranzistorový a operačný zosilňovač, oscilátory.', grade: '3. ročník' },
  { id: 'digital', title: 'Číslicová technika', blurb: 'Číselné sústavy, logické členy, kombinačné a sekvenčné obvody.', grade: '3. ročník' },
  { id: 'power', title: 'Elektroenergetika a bezpečnosť', blurb: 'Výroba a rozvod energie, ochrana pred úrazom elektrickým prúdom, istenie vedení.', grade: '3. ročník' },
  { id: 'meas', title: 'Elektrotechnické merania', blurb: 'Jednotky SI, meracie prístroje, chyby merania, meranie odporu, výkonu a osciloskop.', grade: '2. a 3. ročník' },
];

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'formula'; tex: string | string[]; legend?: [string, string, string][] }
  | { t: 'list'; items: string[] }
  | { t: 'note'; kind: 'tip' | 'warn' | 'remember'; text: string }
  | { t: 'example'; title: string; given: string[]; steps: string[]; result: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'figure'; fig: FigureId | FigureFn; caption?: string }
  /** Interaktívny graf s posuvníkmi. */
  | { t: 'explore'; build: () => HTMLElement; caption?: string }
  | { t: 'colortable' };

export interface Lesson {
  id: string;
  chapter: ChapterId;
  title: string;
  summary: string;
  minutes: number;
  blocks: Block[];
}

const BASE_LESSONS: readonly Lesson[] = [
  {
    id: 'zaklady',
    chapter: 'dc',
    title: 'Elektrické veličiny a jednotky',
    summary: 'Náboj, prúd, napätie a odpor – pojmy, na ktorých stojí celá elektrotechnika.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Elektrotechnika opisuje javy spojené s pohybom elektrického náboja. Skôr než začneš počítať obvody, potrebuješ poznať základné veličiny, ich značky a jednotky.' },
      { t: 'h', text: 'Elektrický náboj' },
      { t: 'p', text: 'Elektrický náboj `$Q` je vlastnosť častíc – elektrón má záporný náboj, protón kladný. Jednotkou je **coulomb (C)**. Náboj jedného elektrónu je veľmi malý: `$e = 1,602 · 10^{−19} C`.' },
      { t: 'h', text: 'Elektrický prúd' },
      { t: 'p', text: 'Elektrický prúd `$I` je usporiadaný pohyb nosičov náboja. Udáva, aký náboj prejde prierezom vodiča za jednotku času. Jednotkou je **ampér (A)**.' },
      { t: 'formula', tex: '$I = @f{$Q}{$t}', legend: [['$I', 'elektrický prúd', 'A'], ['$Q', 'elektrický náboj', 'C'], ['$t', 'čas', 's']] },
      { t: 'note', kind: 'remember', text: 'Dohodnutý (technický) smer prúdu je od kladného pólu zdroja cez spotrebič k zápornému. Elektróny sa v kovoch pohybujú opačne.' },
      { t: 'h', text: 'Elektrické napätie' },
      { t: 'p', text: 'Elektrické napätie `$U` je rozdiel elektrických potenciálov medzi dvoma bodmi. Je príčinou prúdu v uzavretom obvode. Jednotkou je **volt (V)**. Napätie meriame vždy **medzi dvoma bodmi**, preto voltmeter pripájame paralelne.' },
      { t: 'h', text: 'Elektrický odpor' },
      { t: 'p', text: 'Elektrický odpor `$R` vyjadruje, ako veľmi vodič bráni prechodu prúdu. Jednotkou je **ohm (Ω)**. Prevrátená hodnota odporu je vodivosť `$G = @f{1}{$R}` s jednotkou **siemens (S)**.' },
      {
        t: 'table',
        head: ['Veličina', 'Značka', 'Jednotka', 'Meriame'],
        rows: [
          ['Prúd', '`$I`', 'ampér (A)', 'ampérmetrom zapojeným do série'],
          ['Napätie', '`$U`', 'volt (V)', 'voltmetrom zapojeným paralelne'],
          ['Odpor', '`$R`', 'ohm (Ω)', 'ohmmetrom, bez napätia v obvode'],
          ['Náboj', '`$Q`', 'coulomb (C)', 'nepriamo, z prúdu a času'],
          ['Výkon', '`$P`', 'watt (W)', 'wattmetrom'],
        ],
      },
      { t: 'h', text: 'Predpony jednotiek' },
      { t: 'p', text: 'V praxi sa stretneš s veľmi veľkými aj veľmi malými hodnotami. Namiesto mocnín desiatich používame predpony sústavy SI.' },
      {
        t: 'table',
        head: ['Predpona', 'Značka', 'Násobok', 'Príklad'],
        rows: [
          ['giga', 'G', '10⁹', '2,4 GHz (Wi-Fi)'],
          ['mega', 'M', '10⁶', '1 MΩ'],
          ['kilo', 'k', '10³', '4,7 kΩ'],
          ['mili', 'm', '10⁻³', '20 mA'],
          ['mikro', 'µ', '10⁻⁶', '100 µF'],
          ['nano', 'n', '10⁻⁹', '10 nF'],
          ['piko', 'p', '10⁻¹²', '22 pF'],
        ],
      },
      {
        t: 'example',
        title: 'Prevod jednotiek',
        given: ['`$I` = 0,035 A'],
        steps: ['1 A = 1 000 mA, preto hodnotu vynásobíme tisícom.', '0,035 · 1 000 = 35'],
        result: '`$I` = 35 mA',
      },
      {
        t: 'example',
        title: 'Náboj, ktorý prejde vodičom',
        given: ['`$I` = 2 A', '`$t` = 1 min = 60 s'],
        steps: ['Zo vzťahu `$I = @f{$Q}{$t}` vyjadríme `$Q = $I · $t`.', '`$Q` = 2 A · 60 s = 120 C'],
        result: '`$Q` = 120 C',
      },
    ],
  },
  {
    id: 'ohmov-zakon',
    chapter: 'dc',
    title: 'Ohmov zákon',
    summary: 'Vzťah medzi napätím, prúdom a odporom. Najpoužívanejší vzorec elektrotechniky.',
    minutes: 7,
    blocks: [
      { t: 'p', text: 'Nemecký fyzik Georg Simon Ohm zistil, že prúd prechádzajúci vodičom je priamo úmerný napätiu na jeho koncoch a nepriamo úmerný odporu vodiča.' },
      { t: 'formula', tex: '$I = @f{$U}{$R}', legend: [['$I', 'prúd', 'A'], ['$U', 'napätie', 'V'], ['$R', 'odpor', 'Ω']] },
      { t: 'p', text: 'Zo vzorca vieš vyjadriť ľubovoľnú z troch veličín:' },
      { t: 'formula', tex: ['$U = $R · $I', '$R = @f{$U}{$I}'] },
      { t: 'figure', fig: 'ohm', caption: 'Ampérmeter je v sérii so spotrebičom, voltmeter je k nemu pripojený paralelne.' },
      { t: 'note', kind: 'tip', text: '**Trojuholník U–R–I:** napíš `$U` hore, `$R` a `$I` dole vedľa seba. Zakry hľadanú veličinu a zvyšok ti ukáže vzorec: `$U = $R · $I`, `$I = @f{$U}{$R}`, `$R = @f{$U}{$I}`.' },
      { t: 'h', text: 'Ako sa správa prúd' },
      {
        t: 'list',
        items: [
          'Ak pri rovnakom odpore zväčšíš napätie dvakrát, prúd sa zväčší dvakrát.',
          'Ak pri rovnakom napätí zväčšíš odpor dvakrát, prúd klesne na polovicu.',
          'Pri takmer nulovom odpore (skrat) prúd prudko narastie. Preto obvody chránime poistkami a ističmi.',
        ],
      },
      { t: 'p', text: 'Graf závislosti `$I` od `$U` je pri stálom odpore priamka prechádzajúca začiatkom – taký prvok nazývame **lineárny**. Žiarovka alebo dióda Ohmov zákon v tejto jednoduchej podobe nespĺňajú, ich odpor sa mení.' },
      {
        t: 'example',
        title: 'Prúd rezistorom',
        given: ['`$U` = 12 V', '`$R` = 470 Ω'],
        steps: ['`$I = @f{$U}{$R} = @f{12 V}{470 Ω}` = 0,0255 A'],
        result: '`$I` ≈ 25,5 mA',
      },
      {
        t: 'example',
        title: 'Napätie na rezistore',
        given: ['`$I` = 20 mA = 0,02 A', '`$R` = 330 Ω'],
        steps: ['`$U = $R · $I` = 330 Ω · 0,02 A = 6,6 V'],
        result: '`$U` = 6,6 V',
      },
      { t: 'note', kind: 'warn', text: 'Pred dosadením preveď jednotky na základné: mA na A, kΩ na Ω. Najčastejšia chyba je dosadiť 20 mA ako 20 A.' },
    ],
  },
  {
    id: 'odpor-vodica',
    chapter: 'dc',
    title: 'Odpor vodiča a teplota',
    summary: 'Prečo má dlhý tenký vodič veľký odpor a ako odpor rastie s teplotou.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Odpor vodiča závisí od materiálu, dĺžky a prierezu. Dlhší vodič má väčší odpor, hrubší vodič menší.' },
      { t: 'formula', tex: '$R = $ρ · @f{$l}{$S}', legend: [['$ρ', 'rezistivita (merný odpor)', 'Ω·mm²/m'], ['$l', 'dĺžka vodiča', 'm'], ['$S', 'prierez vodiča', 'mm²']] },
      {
        t: 'table',
        head: ['Materiál', '`$ρ` [Ω·mm²/m]', '`$α` [K⁻¹]'],
        rows: [
          ['striebro', '0,016', '0,0038'],
          ['meď', '0,0178', '0,0039'],
          ['hliník', '0,0286', '0,0040'],
          ['železo', '0,10', '0,0050'],
          ['konštantán', '0,50', '≈ 0,00001'],
          ['chrómnikel', '1,10', '≈ 0,0001'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Jednotka Ω·mm²/m je praktická: prierez dosádzaš priamo v mm² a dĺžku v metroch. V základných jednotkách SI má meď `$ρ` = 1,78 · 10⁻⁸ Ω·m.' },
      { t: 'h', text: 'Závislosť od teploty' },
      { t: 'p', text: 'Pri kovoch odpor s teplotou rastie – atómy kmitajú intenzívnejšie a viac bránia pohybu elektrónov. Pre bežné teploty platí:' },
      { t: 'formula', tex: '$R_{$ϑ} = $R_{20} · [1 + $α · ($ϑ − 20 °C)]', legend: [['$R_{20}', 'odpor pri 20 °C', 'Ω'], ['$α', 'teplotný súčiniteľ odporu', 'K⁻¹'], ['$ϑ', 'teplota vodiča', '°C']] },
      { t: 'p', text: 'Zliatiny ako konštantán majú `$α` takmer nulové, preto sa z nich robia presné rezistory. Uhlík a polovodiče majú `$α` záporné: ich odpor s teplotou klesá (termistory NTC).' },
      {
        t: 'example',
        title: 'Odpor medeného vodiča',
        given: ['`$l` = 50 m', '`$S` = 1,5 mm²', '`$ρ` = 0,0178 Ω·mm²/m'],
        steps: ['`$R = $ρ · @f{$l}{$S} = 0,0178 · @f{50}{1,5}` = 0,593 Ω'],
        result: '`$R` ≈ 0,59 Ω',
      },
      {
        t: 'example',
        title: 'Zahriate vinutie motora',
        given: ['`$R_{20}` = 12 Ω', '`$ϑ` = 80 °C', '`$α` = 0,0039 K⁻¹'],
        steps: ['`$R_{80} = 12 · [1 + 0,0039 · (80 − 20)]`', '`$R_{80}` = 12 · 1,234 = 14,81 Ω'],
        result: '`$R_{80}` ≈ 14,8 Ω',
      },
      { t: 'note', kind: 'tip', text: 'Pri predlžovacom kábli nezabudni, že prúd tečie tam aj späť. Dĺžka vodiča je dvojnásobkom dĺžky kábla.' },
    ],
  },
  {
    id: 'spajanie-rezistorov',
    chapter: 'dc',
    title: 'Sériové a paralelné zapojenie',
    summary: 'Výsledný odpor rezistorov zapojených za sebou, vedľa seba aj zmiešane.',
    minutes: 9,
    blocks: [
      { t: 'h', text: 'Sériové zapojenie' },
      { t: 'p', text: 'Rezistory sú zapojené za sebou a prúd má len jednu cestu. **Všetkými prechádza rovnaký prúd**, napätie zdroja sa medzi ne rozdelí.' },
      { t: 'figure', fig: 'series' },
      { t: 'formula', tex: '$R = $R_{1} + $R_{2} + $R_{3} + …' },
      {
        t: 'list',
        items: [
          'Výsledný odpor je vždy väčší ako najväčší z rezistorov.',
          '`$U = $U_{1} + $U_{2} + $U_{3}`',
          'Na väčšom odpore je väčšie napätie: `$U_{1} : $U_{2} = $R_{1} : $R_{2}`.',
        ],
      },
      { t: 'h', text: 'Paralelné zapojenie' },
      { t: 'p', text: 'Rezistory sú zapojené vedľa seba medzi tie isté dva uzly. **Na všetkých je rovnaké napätie**, prúd sa rozdelí do vetiev.' },
      { t: 'figure', fig: 'parallel' },
      { t: 'formula', tex: '@f{1}{$R} = @f{1}{$R_{1}} + @f{1}{$R_{2}} + @f{1}{$R_{3}} + …' },
      { t: 'p', text: 'Pre dva rezistory je praktickejší tvar „súčin lomeno súčet“:' },
      { t: 'formula', tex: '$R = @f{$R_{1} · $R_{2}}{$R_{1} + $R_{2}}' },
      {
        t: 'list',
        items: [
          'Výsledný odpor je vždy menší ako najmenší z rezistorov.',
          '`$I = $I_{1} + $I_{2} + $I_{3}`',
          'Dva rovnaké rezistory paralelne dajú polovičný odpor, `$n` rovnakých dá `@f{$R}{$n}`.',
        ],
      },
      { t: 'h', text: 'Zmiešané zapojenie' },
      { t: 'p', text: 'Zložitejší obvod zjednodušuješ postupne: nájdi časti, ktoré sú čisto sériové alebo čisto paralelné, nahraď ich jedným rezistorom a pokračuj, kým nezostane jediný odpor.' },
      { t: 'figure', fig: 'mixed' },
      {
        t: 'example',
        title: 'Zmiešané zapojenie',
        given: ['`$R_{1}` = 100 Ω', '`$R_{2}` = 220 Ω', '`$R_{3}` = 330 Ω'],
        steps: [
          '`$R_{2}` a `$R_{3}` sú paralelne: `$R_{23} = @f{220 · 330}{220 + 330}` = 132 Ω',
          '`$R_{1}` je s nimi v sérii: `$R = $R_{1} + $R_{23}` = 100 + 132 = 232 Ω',
        ],
        result: '`$R` = 232 Ω',
      },
    ],
  },
  {
    id: 'kirchhoffove-zakony',
    chapter: 'dc',
    title: 'Kirchhoffove zákony a deliče',
    summary: 'Prúdy v uzloch, napätia v slučkách a ako z dvoch rezistorov urobiť delič napätia.',
    minutes: 9,
    blocks: [
      { t: 'p', text: 'Dva Kirchhoffove zákony platia v každom obvode. Spolu s Ohmovým zákonom stačia na výpočet ľubovoľnej siete rezistorov.' },
      { t: 'h', text: '1. Kirchhoffov zákon (prúdový)' },
      { t: 'p', text: 'Súčet prúdov, ktoré do uzla vtekajú, sa rovná súčtu prúdov, ktoré z neho vytekajú. Náboj sa v uzle nehromadí ani nestráca.' },
      { t: 'figure', fig: 'node' },
      { t: 'formula', tex: ['$I_{1} + $I_{2} = $I_{3} + $I_{4}', '∑ $I = 0'] },
      { t: 'h', text: '2. Kirchhoffov zákon (napäťový)' },
      { t: 'p', text: 'V uzavretej slučke sa súčet napätí zdrojov rovná súčtu úbytkov napätia na spotrebičoch. Ak obídeš slučku dookola, súčet všetkých napätí je nula.' },
      { t: 'figure', fig: 'series-voltages' },
      { t: 'formula', tex: ['$U = $U_{1} + $U_{2} + $U_{3}', '∑ $U = 0'] },
      { t: 'h', text: 'Delič napätia' },
      { t: 'p', text: 'Dva rezistory v sérii rozdelia napätie v pomere svojich odporov. Delič sa používa na získanie menšieho napätia, napríklad keď mikrokontrolér meria napätie batérie.' },
      { t: 'figure', fig: 'divider' },
      { t: 'formula', tex: '$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}' },
      { t: 'note', kind: 'warn', text: 'Vzorec platí pre nezaťažený delič. Záťaž pripojená na výstup je paralelne k `$R_{2}`, a preto výstupné napätie klesne.' },
      { t: 'h', text: 'Delič prúdu' },
      { t: 'p', text: 'Pri dvoch paralelných rezistoroch tečie väčší prúd vetvou s menším odporom:' },
      { t: 'formula', tex: ['$I_{1} = $I · @f{$R_{2}}{$R_{1} + $R_{2}}', '$I_{2} = $I · @f{$R_{1}}{$R_{1} + $R_{2}}'] },
      {
        t: 'example',
        title: 'Delič napätia',
        given: ['`$U` = 12 V', '`$R_{1}` = 10 kΩ', '`$R_{2}` = 4,7 kΩ'],
        steps: ['`$U_{2} = 12 · @f{4,7}{10 + 4,7}` = 12 · 0,3197 = 3,84 V'],
        result: '`$U_{2}` ≈ 3,84 V',
      },
    ],
  },
  {
    id: 'zdroj',
    chapter: 'dc',
    title: 'Reálny zdroj napätia',
    summary: 'Prečo napätie batérie pri zaťažení klesá: vnútorný odpor, stav naprázdno a nakrátko.',
    minutes: 7,
    blocks: [
      { t: 'p', text: 'Skutočný zdroj (batéria, akumulátor, dynamo) nie je ideálny: pri zaťažení jeho napätie klesá. Modelujeme ho ako ideálny zdroj napätia `$U_{e}` so sériovým vnútorným odporom `$R_{i}`.' },
      { t: 'figure', fig: 'real-source' },
      {
        t: 'formula',
        tex: ['$U = $U_{e} − $R_{i} · $I', '$I = @f{$U_{e}}{$R_{i} + $R_{z}}'],
        legend: [['$U', 'svorkové napätie', 'V'], ['$U_{e}', 'elektromotorické napätie', 'V'], ['$R_{i}', 'vnútorný odpor zdroja', 'Ω'], ['$R_{z}', 'odpor záťaže', 'Ω']],
      },
      { t: 'h', text: 'Stav naprázdno a nakrátko' },
      {
        t: 'list',
        items: [
          '**Naprázdno** (bez záťaže, `$I` = 0) sa svorkové napätie rovná `$U_{e}`. Takto zmeriaš napätie článku voltmetrom.',
          '**Nakrátko** (skrat, `$R_{z}` = 0) tečie najväčší možný prúd `$I_{k} = @f{$U_{e}}{$R_{i}}`. Pri autobatérii to sú stovky ampérov – nebezpečné!',
        ],
      },
      { t: 'note', kind: 'tip', text: 'Najväčší výkon odovzdá zdroj do záťaže, keď `$R_{z} = $R_{i}` (výkonové prispôsobenie). Účinnosť je vtedy len 50 %.' },
      {
        t: 'example',
        title: 'Svorkové napätie batérie',
        given: ['`$U_{e}` = 9 V', '`$R_{i}` = 1,5 Ω', '`$R_{z}` = 30 Ω'],
        steps: ['`$I = @f{9}{1,5 + 30}` = 0,286 A', '`$U = $R_{z} · $I` = 30 · 0,286 = 8,57 V'],
        result: '`$U` ≈ 8,57 V',
      },
      {
        t: 'example',
        title: 'Vnútorný odpor z merania',
        given: ['naprázdno: 4,5 V', 'pri prúde 0,5 A: 4,2 V'],
        steps: ['`$R_{i} = @f{$U_{e} − $U}{$I} = @f{4,5 − 4,2}{0,5}` = 0,6 Ω'],
        result: '`$R_{i}` = 0,6 Ω',
      },
    ],
  },
  {
    id: 'vykon-a-praca',
    chapter: 'dc',
    title: 'Výkon, práca a účinnosť',
    summary: 'Koľko wattov má spotrebič, koľko zaplatíš za kilowatthodiny a kam sa stráca energia.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Spotrebič premieňa elektrickú energiu na teplo, svetlo alebo pohyb. Elektrický výkon hovorí, ako rýchlo sa táto premena deje.' },
      { t: 'formula', tex: '$P = $U · $I', legend: [['$P', 'výkon', 'W'], ['$U', 'napätie', 'V'], ['$I', 'prúd', 'A']] },
      { t: 'p', text: 'Dosadením Ohmovho zákona dostaneš ďalšie dva tvary, ktoré sa hodia pri rezistoroch:' },
      { t: 'formula', tex: ['$P = $R · $I^{2}', '$P = @f{$U^{2}}{$R}'] },
      { t: 'h', text: 'Elektrická práca (energia)' },
      { t: 'formula', tex: '$W = $P · $t', legend: [['$W', 'práca, energia', 'J = W·s'], ['$t', 'čas', 's']] },
      { t: 'p', text: 'Elektromer v domácnosti počíta energiu v kilowatthodinách: **1 kWh = 1 000 W · 3 600 s = 3,6 MJ**. Za každú kWh platíš dodávateľovi elektriny.' },
      { t: 'h', text: 'Účinnosť' },
      { t: 'p', text: 'Časť príkonu sa vždy stratí, najčastejšie ako teplo. Účinnosť `$η` je pomer užitočného výkonu `$P_{2}` k príkonu `$P_{1}`:' },
      { t: 'formula', tex: '$η = @f{$P_{2}}{$P_{1}} · 100 %' },
      { t: 'note', kind: 'warn', text: 'Pri rezistoroch sleduj aj dovolené zaťaženie. Bežný malý rezistor znesie 0,25 W alebo 0,6 W, pri väčšom výkone sa prehreje.' },
      {
        t: 'example',
        title: 'Rýchlovarná kanvica',
        given: ['`$P` = 2 000 W', '`$U` = 230 V', '`$t` = 3 min = 0,05 h'],
        steps: ['`$I = @f{$P}{$U} = @f{2000}{230}` = 8,7 A', '`$W = $P · $t` = 2 kW · 0,05 h = 0,1 kWh'],
        result: '`$I` ≈ 8,7 A, `$W` = 0,1 kWh',
      },
      {
        t: 'example',
        title: 'Koľko stojí televízor',
        given: ['`$P` = 120 W', '4 hodiny denne, 30 dní', 'cena 0,18 €/kWh'],
        steps: ['`$W` = 0,12 kW · 4 h · 30 = 14,4 kWh', 'cena = 14,4 kWh · 0,18 €/kWh = 2,59 €'],
        result: 'približne 2,59 € za mesiac',
      },
    ],
  },
  {
    id: 'kondenzator',
    chapter: 'fields',
    title: 'Kondenzátor a RC obvod',
    summary: 'Kapacita, spájanie kondenzátorov a exponenciálne nabíjanie cez rezistor.',
    minutes: 10,
    blocks: [
      { t: 'p', text: 'Kondenzátor tvoria dve vodivé elektródy oddelené izolantom (dielektrikom). Po pripojení napätia sa na elektródach nahromadí náboj a kondenzátor uchováva energiu v elektrickom poli.' },
      { t: 'formula', tex: '$C = @f{$Q}{$U}', legend: [['$C', 'kapacita', 'F'], ['$Q', 'náboj', 'C'], ['$U', 'napätie', 'V']] },
      { t: 'p', text: 'Kapacita doskového kondenzátora rastie s plochou elektród a klesá so vzdialenosťou medzi nimi:' },
      {
        t: 'formula',
        tex: '$C = $ε_{0} · $ε_{r} · @f{$S}{$d}',
        legend: [['$ε_{0}', 'permitivita vákua, 8,854 · 10⁻¹²', 'F/m'], ['$ε_{r}', 'relatívna permitivita dielektrika', '–'], ['$S', 'plocha elektród', 'm²'], ['$d', 'vzdialenosť elektród', 'm']],
      },
      { t: 'note', kind: 'remember', text: '1 F je obrovská kapacita. V praxi stretneš pF, nF a µF. Elektrolytické kondenzátory majú stovky až tisíce µF a záleží na ich polarite.' },
      { t: 'h', text: 'Spájanie kondenzátorov' },
      { t: 'p', text: 'Pri kondenzátoroch je to presne naopak ako pri rezistoroch:' },
      {
        t: 'table',
        head: ['Zapojenie', 'Výsledná kapacita', 'Rovnaké je'],
        rows: [
          ['paralelné', '`$C = $C_{1} + $C_{2} + …`', 'napätie'],
          ['sériové', '`@f{1}{$C} = @f{1}{$C_{1}} + @f{1}{$C_{2}} + …`', 'náboj'],
        ],
      },
      { t: 'h', text: 'Energia v kondenzátore' },
      { t: 'formula', tex: '$W = @f{1}{2} · $C · $U^{2}' },
      { t: 'h', text: 'Nabíjanie cez rezistor' },
      { t: 'p', text: 'Ak kondenzátor nabíjaš cez rezistor, napätie na ňom nerastie skokom, ale exponenciálne. Rýchlosť určuje časová konštanta `$τ`.' },
      { t: 'figure', fig: 'rc' },
      { t: 'formula', tex: ['$τ = $R · $C', '$u_{C} = $U · (1 − e^{−$t/$τ})'] },
      { t: 'figure', fig: 'rc-curve', caption: 'Za čas τ sa kondenzátor nabije na 63 % napätia zdroja, za 5τ na viac ako 99 %. Vybíjanie prebieha zrkadlovo.' },
      {
        t: 'example',
        title: 'Časová konštanta',
        given: ['`$R` = 10 kΩ', '`$C` = 100 µF'],
        steps: ['`$τ = $R · $C` = 10 000 Ω · 0,0001 F = 1 s', 'Prakticky nabitý je po `5$τ` = 5 s.'],
        result: '`$τ` = 1 s',
      },
    ],
  },
  {
    id: 'magnetizmus-cievka',
    chapter: 'fields',
    title: 'Magnetické pole a cievka',
    summary: 'Magnetická indukcia, sila na vodič, indukované napätie a indukčnosť.',
    minutes: 10,
    blocks: [
      { t: 'p', text: 'Okolo každého vodiča s prúdom vzniká magnetické pole. Jeho smer určíš pravidlom pravej ruky: palec ukazuje smer prúdu, prsty smer magnetických indukčných čiar.' },
      { t: 'h', text: 'Veličiny magnetického poľa' },
      {
        t: 'table',
        head: ['Veličina', 'Značka', 'Jednotka'],
        rows: [
          ['magnetická indukcia', '`$B`', 'tesla (T)'],
          ['magnetický tok', '`$Φ`', 'weber (Wb)'],
          ['intenzita magnetického poľa', '`$H`', 'ampér na meter (A/m)'],
          ['indukčnosť', '`$L`', 'henry (H)'],
        ],
      },
      { t: 'formula', tex: ['$Φ = $B · $S', '$B = $μ_{0} · $μ_{r} · $H'], legend: [['$μ_{0}', 'permeabilita vákua, 4π · 10⁻⁷', 'H/m'], ['$μ_{r}', 'relatívna permeabilita (železo: stovky až tisíce)', '–']] },
      { t: 'h', text: 'Sila na vodič v magnetickom poli' },
      { t: 'formula', tex: '$F = $B · $I · $l', legend: [['$F', 'sila', 'N'], ['$l', 'dĺžka vodiča v poli', 'm']] },
      { t: 'p', text: 'Vzťah platí, ak je vodič kolmý na indukčné čiary. Na tomto princípe pracujú elektromotory a reproduktory.' },
      { t: 'h', text: 'Elektromagnetická indukcia' },
      { t: 'p', text: 'Ak sa mení magnetický tok cievkou, indukuje sa v nej napätie (Faradayov zákon). Indukovaný prúd pôsobí proti zmene, ktorá ho vyvolala (Lenzov zákon) – odtiaľ znamienko mínus.' },
      { t: 'formula', tex: '$u_{i} = −$N · @f{Δ$Φ}{Δ$t}', legend: [['$N', 'počet závitov', '–'], ['Δ$Φ', 'zmena magnetického toku', 'Wb'], ['Δ$t', 'čas zmeny', 's']] },
      { t: 'p', text: 'Na indukcii je založený generátor, transformátor aj indukčný varič.' },
      { t: 'h', text: 'Indukčnosť cievky' },
      { t: 'p', text: 'Cievka bráni zmene prúdu, ktorý ňou prechádza. Mieru tohto správania udáva indukčnosť `$L`.' },
      { t: 'formula', tex: ['$u = $L · @f{Δ$i}{Δ$t}', '$W = @f{1}{2} · $L · $I^{2}', '$τ = @f{$L}{$R}'] },
      { t: 'note', kind: 'warn', text: 'Pri rýchlom prerušení prúdu cievkou vznikne veľké indukované napätie. Preto sa ku cievke relé pripája nulová (ochranná) dióda.' },
      {
        t: 'example',
        title: 'Sila na vodič',
        given: ['`$B` = 0,8 T', '`$I` = 5 A', '`$l` = 0,2 m'],
        steps: ['`$F = $B · $I · $l` = 0,8 · 5 · 0,2 = 0,8 N'],
        result: '`$F` = 0,8 N',
      },
      {
        t: 'example',
        title: 'Indukované napätie',
        given: ['`$N` = 200', 'Δ`$Φ` = 3 mWb', 'Δ`$t` = 10 ms'],
        steps: ['`|$u_{i}| = $N · @f{Δ$Φ}{Δ$t} = 200 · @f{0,003}{0,01}` = 60 V'],
        result: '`|$u_{i}|` = 60 V',
      },
    ],
  },
  {
    id: 'striedavy-prud',
    chapter: 'ac',
    title: 'Striedavý prúd',
    summary: 'Sínusové napätie, perióda, frekvencia a prečo má sieť 230 V amplitúdu 325 V.',
    minutes: 7,
    blocks: [
      { t: 'p', text: 'V elektrickej sieti nie je jednosmerné napätie, ale striedavé – jeho veľkosť aj smer sa periodicky menia podľa sínusoidy.' },
      { t: 'formula', tex: '$u = $U_{m} · sin($ω$t)', legend: [['$u', 'okamžitá hodnota napätia', 'V'], ['$U_{m}', 'maximálna hodnota (amplitúda)', 'V'], ['$ω', 'uhlová frekvencia', 'rad/s']] },
      { t: 'figure', fig: 'sine', caption: 'Napätie siete 230 V / 50 Hz: amplitúda je približne 325 V, jedna perióda trvá 20 ms.' },
      { t: 'h', text: 'Perióda a frekvencia' },
      { t: 'formula', tex: ['$f = @f{1}{$T}', '$ω = 2π$f'], legend: [['$f', 'frekvencia', 'Hz'], ['$T', 'perióda', 's']] },
      { t: 'h', text: 'Efektívna hodnota' },
      { t: 'p', text: 'Efektívna hodnota striedavého prúdu je taká hodnota jednosmerného prúdu, ktorý by v rezistore vyvinul rovnaké teplo. Pri sínusovom priebehu platí:' },
      { t: 'formula', tex: ['$U = @f{$U_{m}}{@s{2}} ≈ 0,707 · $U_{m}', '$I = @f{$I_{m}}{@s{2}}'] },
      { t: 'note', kind: 'remember', text: 'Keď sa povie „sieť 230 V“, myslí sa efektívna hodnota. Bežné voltmetre a ampérmetre pre striedavý prúd ukazujú efektívne hodnoty.' },
      {
        t: 'example',
        title: 'Amplitúda sieťového napätia',
        given: ['`$U` = 230 V'],
        steps: ['`$U_{m} = $U · @s{2}` = 230 · 1,414 = 325 V'],
        result: '`$U_{m}` ≈ 325 V',
      },
      {
        t: 'example',
        title: 'Frekvencia z periódy',
        given: ['`$T` = 20 ms = 0,02 s'],
        steps: ['`$f = @f{1}{$T} = @f{1}{0,02}` = 50 Hz', '`$ω = 2π$f` = 2 · 3,1416 · 50 = 314 rad/s'],
        result: '`$f` = 50 Hz, `$ω` ≈ 314 rad/s',
      },
    ],
  },
  {
    id: 'obvody-rlc',
    chapter: 'ac',
    title: 'Obvody RLC',
    summary: 'Reaktancia cievky a kondenzátora, impedancia, výkony a rezonancia.',
    minutes: 11,
    blocks: [
      { t: 'p', text: 'V striedavom obvode sa cievka a kondenzátor správajú ako odpor, ktorý závisí od frekvencie. Tento zdanlivý odpor nazývame reaktancia `$X`.' },
      {
        t: 'table',
        head: ['Prvok', 'Odpor / reaktancia', 'Prúd voči napätiu'],
        rows: [
          ['rezistor', '`$R` (nezávisí od frekvencie)', 'vo fáze'],
          ['cievka', '`$X_{L} = 2π$f$L`', 'zaostáva o 90°'],
          ['kondenzátor', '`$X_{C} = @f{1}{2π$f$C}`', 'predbieha o 90°'],
        ],
      },
      { t: 'p', text: 'S rastúcou frekvenciou reaktancia cievky rastie a reaktancia kondenzátora klesá. Kondenzátor jednosmerný prúd neprepustí, cievka ho prepustí bez prekážky (okrem odporu vinutia).' },
      { t: 'h', text: 'Impedancia sériového obvodu' },
      { t: 'figure', fig: 'rlc' },
      { t: 'formula', tex: '$Z = @s{$R^{2} + ($X_{L} − $X_{C})^{2}}', legend: [['$Z', 'impedancia', 'Ω']] },
      { t: 'figure', fig: 'impedance', caption: 'Odpor a reaktancia sa nesčítajú aritmeticky, ale ako odvesny pravouhlého trojuholníka. Uhol φ je fázový posun.' },
      { t: 'formula', tex: ['$I = @f{$U}{$Z}', 'cos $φ = @f{$R}{$Z}'] },
      { t: 'h', text: 'Výkony v striedavom obvode' },
      {
        t: 'list',
        items: [
          'Činný výkon `$P = $U$I · cos $φ` [W] sa mení na teplo a prácu.',
          'Jalový výkon `$Q = $U$I · sin $φ` [var] sa prelieva medzi zdrojom a poľom cievky či kondenzátora.',
          'Zdanlivý výkon `$S = $U$I` [VA] určuje dimenzovanie vodičov a transformátorov.',
        ],
      },
      { t: 'h', text: 'Rezonancia' },
      { t: 'p', text: 'Pri rezonančnej frekvencii sú reaktancie rovnaké, `$X_{L} = $X_{C}`. Navzájom sa vyrušia a impedancia sériového obvodu je najmenšia, `$Z = $R`.' },
      { t: 'formula', tex: '$f_{0} = @f{1}{2π@s{$L$C}}' },
      {
        t: 'example',
        title: 'Sériový obvod RLC na sieti',
        given: ['`$R` = 40 Ω', '`$L` = 0,1 H', '`$C` = 47 µF', '`$U` = 230 V, `$f` = 50 Hz'],
        steps: [
          '`$X_{L}` = 2π · 50 · 0,1 = 31,4 Ω',
          '`$X_{C} = @f{1}{2π · 50 · 47 · 10^{−6}}` = 67,7 Ω',
          '`$Z = @s{40^{2} + (31,4 − 67,7)^{2}}` = 54,0 Ω',
          '`$I = @f{230}{54,0}` = 4,26 A, cos `$φ = @f{40}{54,0}` = 0,74',
        ],
        result: '`$Z` ≈ 54 Ω, `$I` ≈ 4,26 A (kapacitný charakter)',
      },
    ],
  },
  {
    id: 'farebny-kod',
    chapter: 'parts',
    title: 'Farebné značenie rezistorov',
    summary: 'Ako prečítať hodnotu z prúžkov a prečo sa rezistory vyrábajú v radách E12 a E24.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Hodnota malých rezistorov je vyznačená farebnými prúžkami. Čítame ich od okraja, ku ktorému sú prúžky bližšie. Prúžok tolerancie býva oddelený väčšou medzerou.' },
      { t: 'figure', fig: 'bands', caption: 'Žltá, fialová, červená, zlatá: 47 · 10² Ω = 4,7 kΩ s toleranciou ±5 %.' },
      { t: 'colortable' },
      { t: 'h', text: 'Štyri alebo päť prúžkov' },
      {
        t: 'list',
        items: [
          '**4 prúžky:** 1. číslica, 2. číslica, násobiteľ, tolerancia.',
          '**5 prúžkov:** 1., 2. a 3. číslica, násobiteľ, tolerancia. Používa sa pri presnejších rezistoroch (±1 % a lepších).',
        ],
      },
      { t: 'h', text: 'Normalizované rady' },
      { t: 'p', text: 'Rezistory sa nevyrábajú v každej hodnote, ale v radách. Rada E12 má v každej dekáde 12 hodnôt, E24 ich má 24.' },
      { t: 'p', text: '**E12:** 1,0 · 1,2 · 1,5 · 1,8 · 2,2 · 2,7 · 3,3 · 3,9 · 4,7 · 5,6 · 6,8 · 8,2' },
      { t: 'note', kind: 'tip', text: 'Na schémach sa hodnota často píše bez desatinnej čiarky, s písmenom na jej mieste: 4k7 = 4,7 kΩ, 1R5 = 1,5 Ω, 2M2 = 2,2 MΩ.' },
      {
        t: 'example',
        title: 'Prečítaj rezistor',
        given: ['hnedá – čierna – oranžová – zlatá'],
        steps: ['hnedá = 1, čierna = 0 → 10', 'oranžová = násobiteľ 10³', '10 · 1 000 = 10 000 Ω, zlatá = ±5 %'],
        result: '10 kΩ ±5 %',
      },
    ],
  },
  {
    id: 'polovodice',
    chapter: 'parts',
    title: 'Dióda a LED',
    summary: 'Priepustný a záverný smer, prahové napätie a výpočet predradného rezistora pre LED.',
    minutes: 7,
    blocks: [
      { t: 'p', text: 'Dióda je polovodičová súčiastka, ktorá vedie prúd prakticky len jedným smerom – od anódy ku katóde.' },
      {
        t: 'list',
        items: [
          '**Priepustný smer:** anóda je kladnejšia ako katóda. Po prekročení prahového napätia (kremík ≈ 0,7 V, germánium ≈ 0,3 V) dióda vedie.',
          '**Záverný smer:** dióda nevedie, kým napätie neprekročí prierazné napätie.',
        ],
      },
      { t: 'p', text: 'Diódy sa používajú v usmerňovačoch, ako ochrana proti prepólovaniu a ako nulové diódy pri cievkach relé.' },
      { t: 'h', text: 'LED – svetelná dióda' },
      { t: 'p', text: 'LED svieti, keď ňou tečie prúd v priepustnom smere. Napätie na nej závisí od farby a prúd musíš obmedziť **predradným rezistorom**, inak LED zničíš.' },
      {
        t: 'table',
        head: ['Farba LED', 'Typické napätie `$U_{F}`'],
        rows: [
          ['červená', '1,8 – 2,1 V'],
          ['žltá, oranžová', '2,0 – 2,2 V'],
          ['zelená', '2,0 – 3,2 V (podľa technológie)'],
          ['modrá, biela', '2,9 – 3,4 V'],
        ],
      },
      { t: 'figure', fig: 'led' },
      { t: 'formula', tex: '$R = @f{$U − $U_{F}}{$I_{F}}', legend: [['$U', 'napätie zdroja', 'V'], ['$U_{F}', 'napätie na LED', 'V'], ['$I_{F}', 'prúd LED', 'A']] },
      {
        t: 'example',
        title: 'Červená LED na 5 V',
        given: ['`$U` = 5 V', '`$U_{F}` = 2 V', '`$I_{F}` = 15 mA'],
        steps: [
          '`$R = @f{5 − 2}{0,015}` = 200 Ω',
          'Najbližšia vyššia hodnota z rady E12 je 220 Ω.',
          'Prúd potom bude `@f{3 V}{220 Ω}` = 13,6 mA a výkon na rezistore 3 V · 0,0136 A ≈ 0,04 W.',
        ],
        result: 'rezistor 220 Ω, 0,25 W',
      },
      { t: 'note', kind: 'remember', text: 'Katóda LED je kratší vývod a na puzdre ju označuje zrezaná hrana. Predradný rezistor zaokrúhľuj na najbližšiu **vyššiu** hodnotu z rady.' },
    ],
  },
];

/** Všetky lekcie v poradí kurzu – po kapitolách v poradí CHAPTERS. */
export const LESSONS: readonly Lesson[] = (() => {
  const all = [...BASE_LESSONS, ...MODULES.map((m) => m.lesson)];
  return CHAPTERS.flatMap((ch) => all.filter((l) => l.chapter === ch.id));
})();

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonIndex(id: string): number {
  return LESSONS.findIndex((l) => l.id === id);
}
