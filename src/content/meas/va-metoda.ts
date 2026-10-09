import type { MeasModule } from './types';
import { pick, shuffle, type Rng } from '../../lib/random';
import { b, n, numeric, q, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { vaMethodFigure } from '../../ui/meas-figures';

/*
 * Lekcia 20 – meranie odporu nepriamou absolútnou metódou: Ohmova (VA) metóda (skriptá ELM3, kap. 3.1.2).
 * Zapojenie AV = ampérmeter „pred“ voltmetrom (voltmeter priamo na Rx), VA = voltmeter „pred“ ampérmetrom.
 */

const ID = 'va-metoda';

/** Odstráni šum binárnej aritmetiky. */
const clean = (x: number) => Number(x.toPrecision(10));

function choice(prompt: string, options: string[], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId: ID, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

/** Percento s rozumným počtom číslic: 0,0021 %, 4,7 %, 99,8 %. */
const pct = (v: number) => `${n(v, v >= 1 ? 3 : 2)} %`;

/** Typické vnútorné odpory prístrojov. */
const RA_LIST = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const RV_LIST = [1e3, 3e3, 10e3, 20e3, 50e3, 100e3, 1e6, 10e6];

const AV_TEXT = 'AV – ampérmeter pred voltmetrom (voltmeter priamo na meranom odpore)';
const VA_TEXT = 'VA – voltmeter pred ampérmetrom (ampérmeter priamo v sérii s meraným odporom)';

const generators: Generator[] = [
  // Kritická hodnota odporu.
  (rng) => {
    const ra = pick(rng, RA_LIST);
    const rv = pick(rng, RV_LIST);
    const rk = Math.sqrt(ra * rv);
    return numeric(ID, `Ampérmeter má vnútorný odpor \`$R_{A}\` = ${q(ra, 'Ω')} a voltmeter \`$R_{V}\` = ${q(rv, 'Ω')}. Aká je kritická hodnota odporu pri meraní Ohmovou metódou s týmito prístrojmi?`, rk, 'Ω', [
      'Pri kritickej hodnote vnášajú obe zapojenia rovnakú metodickú chybu: `@f{$R_{x}}{$R_{V}} = @f{$R_{A}}{$R_{x}}`.',
      `\`$R_{krit} = @s{$R_{A} · $R_{V}} = @s{${n(ra)} · ${n(rv)}}\` = **${q(rk, 'Ω')}**`,
    ]);
  },

  // Voľba zapojenia podľa kritického odporu.
  (rng) => {
    let ra = 0.5;
    let rv = 20e3;
    let rx = 10;
    for (let i = 0; i < 20; i++) {
      ra = pick(rng, RA_LIST);
      rv = pick(rng, RV_LIST);
      rx = pick(rng, [0.47, 2.2, 10, 47, 220, 1e3, 4.7e3, 22e3, 100e3, 470e3, 2.2e6]);
      const ratio = rx / Math.sqrt(ra * rv);
      if (ratio > 3 || ratio < 1 / 3) break;
    }
    const rk = Math.sqrt(ra * rv);
    const av = rx < rk;
    const errAV = (rx / (rx + rv)) * 100;
    const errVA = (ra / rx) * 100;
    return choice(
      `Ohmovou metódou chceš zmerať odpor približne ${q(rx, 'Ω')}. Ampérmeter má \`$R_{A}\` = ${q(ra, 'Ω')}, voltmeter \`$R_{V}\` = ${q(rv, 'Ω')}. Ktoré zapojenie zvolíš?`,
      [av ? AV_TEXT : VA_TEXT, av ? VA_TEXT : AV_TEXT, 'obe zapojenia sú rovnako vhodné', 'takýto odpor sa Ohmovou metódou zmerať nedá'],
      `\`$R_{krit} = @s{$R_{A} · $R_{V}}\` = ${q(rk, 'Ω')}. Meraný odpor je ${av ? 'menší' : 'väčší'} ako kritický, preto zapojenie ${av ? 'AV' : 'VA'}: metodická chyba ${av ? `\`@f{$R_{x}}{$R_{x} + $R_{V}}\` = ${pct(errAV)}` : `\`@f{$R_{A}}{$R_{x}}\` = ${pct(errVA)}`}, kým zapojenie ${av ? 'VA' : 'AV'} by malo chybu ${pct(av ? errVA : errAV)}.`,
      rng,
    );
  },

  // Korekcia v zapojení AV (presné napätie, ampérmeter meria aj prúd voltmetra).
  (rng) => {
    const rx = pick(rng, [100, 150, 220, 330, 470, 680, 1000, 1500, 2200]);
    const rv = pick(rng, [2e3, 3e3, 5e3, 10e3, 20e3]);
    const u = pick(rng, [1.5, 2.4, 3, 4.5, 6, 9]);
    const iShown = Number((u / rx + u / rv).toPrecision(4));
    const iv = u / rv;
    const ir = iShown - iv;
    const res = u / ir;
    const uncorrected = u / iShown;
    return numeric(ID, `V zapojení AV ukazuje voltmeter ${q(u, 'V')} a ampérmeter ${q(iShown, 'A', 4)}. Voltmeter má na použitom rozsahu vnútorný odpor ${q(rv, 'Ω')}. Aký je skutočný odpor \`$R_{x}\` po korekcii na spotrebu voltmetra?`, res, 'Ω', [
      'Ampérmeter meria aj prúd voltmetra: `$I = $I_{R} + $I_{V}`.',
      `\`$I_{V} = @f{$U}{$R_{V}} = @f{${n(u)}}{${n(rv)}}\` = ${b(iv, 'A', 4)}`,
      `\`$I_{R} = $I − $I_{V}\` = ${n(iShown, 4)} − ${n(iv, 4)} = ${b(ir, 'A', 4)}`,
      `\`$R_{x} = @f{$U}{$I_{R}} = @f{${n(u)}}{${n(ir, 4)}}\` = **${q(res, 'Ω')}** (bez korekcie by vyšlo \`@f{$U}{$I}\` = ${q(uncorrected, 'Ω')})`,
    ], { figure: () => vaMethodFigure('AV') });
  },

  // Korekcia v zapojení VA (presný prúd, voltmeter meria aj úbytok na ampérmetri).
  (rng) => {
    const rx = pick(rng, [4.7, 10, 22, 47, 100, 220, 470]);
    const ra = pick(rng, [0.5, 1, 2, 5]);
    const i = pick(rng, [5e-3, 10e-3, 20e-3, 50e-3]);
    const uShown = Number((i * (rx + ra)).toPrecision(4));
    const rApparent = uShown / i;
    const res = rApparent - ra;
    return numeric(ID, `V zapojení VA ukazuje voltmeter ${q(uShown, 'V', 4)} a ampérmeter ${q(i, 'A')}. Ampérmeter má vnútorný odpor ${q(ra, 'Ω')}. Aký je skutočný odpor \`$R_{x}\` po korekcii na spotrebu ampérmetra?`, res, 'Ω', [
      'Voltmeter meria aj úbytok napätia na ampérmetri: `$U = $U_{R} + $U_{A} = $I · $R_{x} + $I · $R_{A}`.',
      `\`$R' = @f{$U}{$I} = @f{${n(uShown, 4)}}{${n(i)}}\` = ${q(rApparent, 'Ω', 4)}`,
      `\`$R_{x} = @f{$U}{$I} − $R_{A}\` = ${n(rApparent, 5)} − ${n(ra)} = **${q(res, 'Ω')}**`,
    ], { figure: () => vaMethodFigure('VA') });
  },

  // Veľkosť metodickej chyby zvoleného zapojenia.
  (rng) => {
    const av = rng() < 0.5;
    if (av) {
      const rx = pick(rng, [10, 47, 100, 220, 470, 1000]);
      const rv = pick(rng, [1e3, 2e3, 5e3, 10e3, 20e3]);
      const d = (rx / (rx + rv)) * 100;
      return numeric(ID, `Odpor ${q(rx, 'Ω')} meriaš v zapojení AV voltmetrom s vnútorným odporom ${q(rv, 'Ω')} a výsledok nekoriguješ. O koľko percent vyjde nameraný odpor \`$R' = @f{$U}{$I}\` menší ako skutočný?`, d, '%', [
        `Meriaš vlastne paralelnú kombináciu: \`$R' = @f{$R_{x} · $R_{V}}{$R_{x} + $R_{V}}\` = ${q(clean((rx * rv) / (rx + rv)), 'Ω', 4)}`,
        `\`|$δ_{AV}| = @f{$R_{x}}{$R_{x} + $R_{V}} · 100 % = @f{${n(rx)}}{${n(rx)} + ${n(rv)}} · 100 %\` = **${n(d, 3)} %** (približne \`@f{$R_{x}}{$R_{V}}\` = ${n((rx / rv) * 100, 3)} %)`,
      ], { fixedUnit: true, tolerance: 0.02 });
    }
    const rx = pick(rng, [10, 22, 47, 100, 220, 470]);
    const ra = pick(rng, [0.1, 0.2, 0.5, 1, 2, 5]);
    const d = (ra / rx) * 100;
    return numeric(ID, `Odpor ${q(rx, 'Ω')} meriaš v zapojení VA ampérmetrom s vnútorným odporom ${q(ra, 'Ω')} a výsledok nekoriguješ. O koľko percent vyjde nameraný odpor \`$R' = @f{$U}{$I}\` väčší ako skutočný?`, d, '%', [
      `Voltmeter meria aj úbytok na ampérmetri: \`$R' = $R_{x} + $R_{A}\` = ${q(clean(rx + ra), 'Ω', 4)}`,
      `\`$δ_{VA} = @f{$R_{A}}{$R_{x}} · 100 % = @f{${n(ra)}}{${n(rx)}} · 100 %\` = **${n(d, 3)} %**`,
    ], { fixedUnit: true, tolerance: 0.02 });
  },
];

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Ohmova (VA) metóda',
    summary: 'Odpor z nameraného napätia a prúdu: zapojenia AV a VA, ich metodické chyby, korekcie a kritická hodnota odporu.',
    minutes: 11,
    blocks: [
      { t: 'p', text: '**Ohmova metóda** (VA metóda) je klasický spôsob merania odporu nepriamou absolútnou metódou: na neznámom odpore zmeriaš **napätie a prúd** a odpor vypočítaš z Ohmovho zákona. Má široký rozsah použitia – dajú sa ňou merať odpory všetkých veľkostí v rozsahu 10⁻³ – 10⁹ Ω. Používa sa aj pri meraní impedancií v testeroch, v moderných RLC meračoch a pri meraní odporov počítačom (PC).' },
      { t: 'formula', tex: '$R = @f{$U}{$I}' },
      { t: 'p', text: 'K meranému prvku musíš súčasne pripojiť voltmeter aj ampérmeter, a tieto prístroje sa navzájom nepriaznivo ovplyvňujú – každý má vnútorný odpor. V zásade sú možné **dva spôsoby zapojenia** a pre každú situáciu treba zvoliť to, ktoré dá menšiu chybu. Rozhoduje o tom **kritická hodnota** meraného odporu.' },
      { t: 'h', text: 'Zapojenie AV – malé a stredné odpory' },
      { t: 'figure', fig: () => vaMethodFigure('AV'), caption: 'Ampérmeter „pred“ voltmetrom: voltmeter je pripojený priamo na meraný odpor `$R_{x}`.' },
      { t: 'p', text: 'Voltmeter meria priamo napätie na meranom odpore – **meranie napätia je bezchybné**. Ampérmeter však nemeria len prúd odporu `$I_{R}`, ale aj prúd voltmetra `$I_{V}`. Chybu tu vnáša **voltmeter** svojím vnútorným odporom; v skutočnosti meriaš paralelnú kombináciu `$R_{x}` ‖ `$R_{V}`.' },
      {
        t: 'formula',
        tex: ['$I = $I_{R} + $I_{V}', '$R_{x} = @f{$U}{$I_{R}} = @f{$U}{$I − @f{$U}{$R_{V}}}'],
        legend: [['$I', 'prúd nameraný ampérmetrom', 'A'], ['$I_{V}', 'prúd voltmetra', 'A'], ['$R_{V}', 'vnútorný odpor voltmetra na použitom rozsahu', 'Ω']],
      },
      { t: 'p', text: 'Ak korekciu nespravíš a vypočítaš len `$R\' = @f{$U}{$I}`, vyjde odpor vždy **menší** ako skutočný. Metodická chyba zapojenia AV:' },
      { t: 'formula', tex: '$δ_{AV} = @f{$R\' − $R_{x}}{$R_{x}} = −@f{$R_{x}}{$R_{x} + $R_{V}} ≈ −@f{$R_{x}}{$R_{V}}' },
      { t: 'note', kind: 'tip', text: 'Chyba je zanedbateľná, keď je `$R_{V}` oveľa väčší ako `$R_{x}`. Preto sa zapojenie AV hodí na **malé a stredné odpory**.' },
      { t: 'h', text: 'Zapojenie VA – veľké odpory' },
      { t: 'figure', fig: () => vaMethodFigure('VA'), caption: 'Voltmeter „pred“ ampérmetrom: ampérmeter je v sérii priamo s meraným odporom `$R_{x}`.' },
      { t: 'p', text: 'Ampérmeter meria presne prúd cez meraný odpor – **meranie prúdu je bezchybné**. Voltmeter však meria okrem napätia na `$R_{x}` aj úbytok napätia na ampérmetri. Chybu tu vnáša **ampérmeter** svojím vnútorným odporom.' },
      {
        t: 'formula',
        tex: ['$U = $U_{R} + $U_{A} = $I · $R_{x} + $I · $R_{A}', '$R_{x} = @f{$U}{$I} − $R_{A}'],
        legend: [['$U', 'napätie namerané voltmetrom', 'V'], ['$U_{A}', 'úbytok napätia na ampérmetri', 'V'], ['$R_{A}', 'vnútorný odpor ampérmetra', 'Ω']],
      },
      { t: 'p', text: 'Bez korekcie vyjde `$R\' = @f{$U}{$I} = $R_{x} + $R_{A}`, teda odpor **väčší** ako skutočný. Metodická chyba zapojenia VA:' },
      { t: 'formula', tex: '$δ_{VA} = @f{$R\' − $R_{x}}{$R_{x}} = @f{$R_{A}}{$R_{x}}' },
      { t: 'note', kind: 'tip', text: 'Chyba je zanedbateľná, keď je `$R_{A}` oveľa menší ako `$R_{x}`. Preto sa zapojenie VA hodí na **veľké odpory**.' },
      { t: 'h', text: 'Kritická hodnota odporu' },
      { t: 'p', text: 'Kritická hodnota odporu je taká hodnota, pri ktorej obe zapojenia vnášajú **rovnakú metodickú chybu**: `$δ_{AV} = $δ_{VA}`, t. j. `@f{$R_{x}}{$R_{V}} = @f{$R_{A}}{$R_{x}}`. Z toho:' },
      { t: 'formula', tex: '$R_{krit} = @s{$R_{A} · $R_{V}}' },
      {
        t: 'list',
        items: [
          '`$R_{x} < $R_{krit}` – „menší“ odpor → zapojenie **AV** (ampérmeter pred voltmetrom),',
          '`$R_{x} > $R_{krit}` – „väčší“ odpor → zapojenie **VA** (voltmeter pred ampérmetrom).',
        ],
      },
      {
        t: 'table',
        head: ['', 'Zapojenie AV', 'Zapojenie VA'],
        rows: [
          ['presne meria', 'napätie na `$R_{x}`', 'prúd cez `$R_{x}`'],
          ['chybu vnáša', 'voltmeter (prúd `$I_{V}`)', 'ampérmeter (úbytok `$U_{A}`)'],
          ['`$R\' = @f{$U}{$I}` vyjde', 'menší ako `$R_{x}`', 'väčší ako `$R_{x}`'],
          ['korekcia', '`$R_{x} = @f{$U}{$I − @f{$U}{$R_{V}}}`', '`$R_{x} = @f{$U}{$I} − $R_{A}`'],
          ['metodická chyba', '`≈ −@f{$R_{x}}{$R_{V}}`', '`@f{$R_{A}}{$R_{x}}`'],
          ['vhodné pre', 'malé a stredné odpory, `$R_{x} < $R_{krit}`', 'veľké odpory, `$R_{x} > $R_{krit}`'],
        ],
      },
      {
        t: 'example',
        title: 'Ktoré zapojenie zvoliť',
        given: ['`$R_{A}` = 0,5 Ω', '`$R_{V}` = 20 kΩ', 'meriame odpory približne 10 Ω a 47 kΩ'],
        steps: [
          '`$R_{krit} = @s{$R_{A} · $R_{V}} = @s{0,5 · 20 000} = @s{10 000}` = 100 Ω',
          '10 Ω < 100 Ω → zapojenie AV, chyba ≈ `@f{10}{20 000}` = 0,05 % (VA by dalo `@f{0,5}{10}` = 5 %)',
          '47 kΩ > 100 Ω → zapojenie VA, chyba = `@f{0,5}{47 000}` ≈ 0,001 % (AV by dalo ≈ `@f{47}{67}` = 70 %!)',
        ],
        result: '10 Ω meraj v zapojení AV, 47 kΩ v zapojení VA',
      },
      {
        t: 'example',
        title: 'Korekcia v zapojení AV',
        given: ['`$U` = 2,35 V', '`$I` = 5,8 mA', 'analógový voltmeter 1 kΩ/V na rozsahu 3 V: `$R_{V}` = 3 kΩ'],
        steps: [
          '`$I_{V} = @f{$U}{$R_{V}} = @f{2,35}{3 000}` = 0,783 mA',
          '`$I_{R} = $I − $I_{V}` = 5,8 − 0,783 = 5,017 mA',
          '`$R_{x} = @f{2,35}{0,005017}` = 468 Ω, bez korekcie by vyšlo `@f{2,35}{0,0058}` = 405 Ω',
        ],
        result: '`$R_{x}` ≈ 468 Ω – nekorigovaný výsledok by bol o 13,5 % menší',
      },
      {
        t: 'example',
        title: 'Korekcia v zapojení VA',
        given: ['`$U` = 9,41 V', '`$I` = 0,2 mA', '`$R_{A}` = 50 Ω'],
        steps: [
          '`$R\' = @f{$U}{$I} = @f{9,41}{0,0002}` = 47 050 Ω',
          '`$R_{x} = $R\' − $R_{A}` = 47 050 − 50 = 47 000 Ω',
        ],
        result: '`$R_{x}` = 47 kΩ; chyba bez korekcie by bola len `@f{50}{47 000}` ≈ 0,1 %',
      },
      { t: 'note', kind: 'remember', text: 'Pri voltmetroch udávaných v Ω/V nezabudni prepočítať vnútorný odpor na použitý rozsah: `$R_{V} = $R_{iV} · MR`. Čím menší rozsah, tým menší `$R_{V}` a tým väčšia chyba zapojenia AV.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Ktoré zapojenie Ohmovej metódy je vhodné na meranie malého odporu?',
      options: ['AV – ampérmeter pred voltmetrom', 'VA – voltmeter pred ampérmetrom', 'obe zapojenia sú rovnako vhodné', 'malý odpor sa Ohmovou metódou merať nedá'],
      explanation: 'Pri malom odpore je prúd voltmetra zanedbateľný oproti prúdu odporu, chyba zapojenia AV ≈ `@f{$R_{x}}{$R_{V}}` je malá.',
    },
    {
      lessonId: ID,
      prompt: 'Čo meria ampérmeter v zapojení AV?',
      options: ['súčet prúdu cez meraný odpor a prúdu voltmetra', 'len prúd cez meraný odpor', 'len prúd voltmetra', 'prúd zdroja bez záťaže'],
      explanation: 'V zapojení AV platí `$I = $I_{R} + $I_{V}` – preto treba odčítať prúd voltmetra `@f{$U}{$R_{V}}`.',
    },
    {
      lessonId: ID,
      prompt: 'Ampérmeter má vnútorný odpor 1 Ω a voltmeter 10 kΩ. Aká je kritická hodnota odporu?',
      options: ['100 Ω', '10 kΩ', '5 kΩ', '10 Ω'],
      explanation: '`$R_{krit} = @s{$R_{A} · $R_{V}} = @s{1 · 10 000}` = 100 Ω.',
    },
    {
      lessonId: ID,
      prompt: 'Aký odpor vyjde v zapojení VA, ak ho vypočítaš len ako U/I bez korekcie?',
      options: ['väčší o vnútorný odpor ampérmetra', 'menší o vnútorný odpor ampérmetra', 'presne skutočný odpor', 'väčší o vnútorný odpor voltmetra'],
      explanation: 'Voltmeter meria aj úbytok na ampérmetri, preto `@f{$U}{$I} = $R_{x} + $R_{A}`.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo má mať voltmeter v zapojení AV čo najväčší vnútorný odpor?',
      options: [
        'aby ním tiekol čo najmenší prúd a ampérmeter meral takmer len prúd odporu',
        'aby presnejšie meral napätie zdroja',
        'aby sa nepreťažil pri zmene rozsahu',
        'aby mal väčšiu citlivosť na malé zmeny napätia',
      ],
      explanation: 'Prúd voltmetra `$I_{V} = @f{$U}{$R_{V}}` sa pripočíta k meranému prúdu. Čím väčší `$R_{V}`, tým menší je tento prúd a metodická chyba.',
    },
    {
      lessonId: ID,
      prompt: 'V akom rozsahu odporov sa dá použiť Ohmova metóda?',
      options: ['10⁻³ až 10⁹ Ω', 'len od 1 Ω do 1 MΩ', 'len nad 1 MΩ', 'len do 1 Ω'],
      explanation: 'Ohmova metóda má široký rozsah použitia – odpory všetkých veľkostí od 10⁻³ do 10⁹ Ω. Treba len zvoliť správne zapojenie.',
    },
  ],
  generators,
};

export default mod;
