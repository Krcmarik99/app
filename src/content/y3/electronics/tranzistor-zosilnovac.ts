import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, formatSI } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { annotatedChart, ceAmplifierFigure, relaySwitchFigure, transistorSymbols } from '../../../ui/fig-electronics';
import { choice } from '../util';

const ID = 'tranzistor-zosilnovac';

const BETA = 100;
const UCC = 12;
/** Výstupná charakteristika: kolektorový prúd v mA pri UCE [V] a IB [µA] (s oblasťou nasýtenia a miernym stúpaním). */
const ic = (uce: number, ibMicro: number) => (BETA * ibMicro / 1000) * (1 - Math.exp(-uce / 0.12)) * (1 + uce / 80);

/** Pracovný bod: priesečník charakteristiky so zaťažovacou priamkou (bisekcia). */
function operatingPoint(rc: number, ibMicro: number): { uce: number; icmA: number } {
  let lo = 0;
  let hi = UCC;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const f = ic(mid, ibMicro) - ((UCC - mid) / rc) * 1000;
    if (f > 0) hi = mid;
    else lo = mid;
  }
  const uce = (lo + hi) / 2;
  return { uce, icmA: ((UCC - uce) / rc) * 1000 };
}

function outputExplorer(): HTMLElement {
  return explorer({
    title: 'Výstupné charakteristiky a pracovný bod',
    params: [
      { key: 'RC', label: 'Kolektorový rezistor `$R_{C}`', unit: 'Ω', min: 470, max: 10000, value: 2200, log: true },
      { key: 'IB', label: 'Prúd bázy `$I_{B}`', unit: 'A', min: 0, max: 100, value: 25, format: (v) => `${fmt(v, 3)} µA` },
    ],
    draw: ({ RC, IB }) => {
      const p = operatingPoint(RC, IB);
      const family = [20, 40, 60, 80, 100];
      const mode = IB < 0.5 ? 'zatvorený' : p.uce < 0.4 ? 'nasýtený' : 'aktívny';
      const chart = annotatedChart({
        ariaLabel: `Výstupné charakteristiky tranzistora so zaťažovacou priamkou pre RC = ${formatSI(RC, 'Ω', 3)}; pracovný bod UCE = ${fmt(p.uce, 3)} V, IC = ${fmt(p.icmA, 3)} mA`,
        width: 460,
        height: 260,
        x: { min: 0, max: 14, ticks: [0, 2, 4, 6, 8, 10, 12, 14], format: (v) => `${v}`, label: 'UCE [V]' },
        y: { min: 0, max: 13, ticks: [0, 2, 4, 6, 8, 10, 12], format: (v) => `${v}`, label: 'IC [mA]' },
        series: [
          ...family.map((ib) => ({ points: sample((u) => ic(u, ib), 0, 14, 140), className: 'thin' })),
          { points: sample((u) => ((UCC - u) / RC) * 1000, 0, UCC, 2), className: 'dashed' },
          { points: sample((u) => ic(u, IB), 0, 14, 140), className: 'copper' },
        ],
        markers: [{ x: p.uce, y: p.icmA, label: `P (${fmt(p.uce, 2)} V; ${fmt(p.icmA, 2)} mA)`, above: true }],
        legend: [{ label: 'IB = 20 až 100 µA', className: 'thin' }, { label: 'zaťažovacia priamka', className: 'dashed' }],
      }, family.map((ib) => ({ x: 13.9, y: ic(13.9, ib) + 0.35, text: `${ib} µA`, anchor: 'end' as const, cls: 'el-muted' })));
      return {
        chart,
        readouts: [
          ['`$I_{C}`', `${fmt(p.icmA, 3)} mA`],
          ['`$U_{CE}`', `${fmt(p.uce, 3)} V`],
          ['`$β · $I_{B}`', `${fmt((BETA * IB) / 1000, 3)} mA`],
          ['Režim', mode],
          ['Výkon `$P_{C} = $U_{CE} · $I_{C}`', `${fmt(p.uce * p.icmA, 3)} mW`],
        ],
        note: mode === 'nasýtený'
          ? 'Pracovný bod je v oblasti nasýtenia: kolektorový prúd obmedzuje rezistor RC, nie báza. Tak pracuje tranzistor ako zopnutý spínač.'
          : mode === 'zatvorený'
            ? 'Bez prúdu bázy tranzistor nevedie, celé napätie 12 V je medzi kolektorom a emitorom – vypnutý spínač.'
            : `Napájanie 12 V, β = 100. Zaťažovacia priamka spája body ${fmt(UCC, 3)} V (IC = 0) a ${fmt((UCC / RC) * 1000, 3)} mA (UCE = 0). Pre zosilňovač je výhodný pracovný bod blízko stredu priamky.`,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const beta = pick(rng, [50, 80, 100, 150, 200, 250, 300]);
    const IB = pick(rng, [10, 15, 20, 25, 40, 50, 80]) * 1e-6;
    const IC = beta * IB;
    return numeric(ID, `Tranzistor so zosilňovacím činiteľom \`$β\` = ${beta} pracuje v aktívnom režime a bázou tečie ${q(IB, 'A')}. Aký je kolektorový prúd?`, IC, 'A', [
      '`$I_{C} = $β · $I_{B}`',
      `\`$I_{C}\` = ${beta} · ${q(IB, 'A')} = ${res(IC, 'A')}`,
    ]);
  },
  (rng) => {
    const beta = pick(rng, [50, 100, 120, 150, 200]);
    const IB = pick(rng, [20, 30, 40, 50, 60, 100]) * 1e-6;
    const IC = beta * IB;
    const IE = IB + IC;
    return numeric(ID, `Bázou tranzistora s \`$β\` = ${beta} tečie prúd ${q(IB, 'A')}. Aký prúd tečie emitorom?`, IE, 'A', [
      `\`$I_{C} = $β · $I_{B}\` = ${beta} · ${q(IB, 'A')} = ${n(IC * 1000, 4)} mA`,
      `\`$I_{E} = $I_{B} + $I_{C}\` = ${n(IB * 1000, 4)} mA + ${n(IC * 1000, 4)} mA = ${res(IE, 'A')}`,
    ], { tolerance: 0.005 });
  },
  (rng) => {
    const load = pick(rng, ['LED', 'relé'] as const);
    const IC = load === 'LED' ? pick(rng, [10, 15, 20]) / 1000 : pick(rng, [30, 40, 60, 80, 100]) / 1000;
    const beta = pick(rng, [100, 150, 200]);
    const k = pick(rng, [2, 3, 5]);
    const U1 = pick(rng, [3.3, 5]);
    const IB = (k * IC) / beta;
    const RB = (U1 - 0.7) / IB;
    return numeric(ID, `Tranzistor NPN s \`$β\` = ${beta} spína ${load === 'LED' ? 'LED' : 'cievku relé'} s prúdom ${q(IC, 'A')}. Riadi ho výstup mikrokontroléra s napätím ${q(U1, 'V')}, \`$U_{BE}\` = 0,7 V a činiteľ presýtenia je ${k}. Aký odpor má mať rezistor v báze?`, RB, 'Ω', [
      `\`$I_{B} = $k · @f{$I_{C}}{$β} = ${k} · @f{${n(IC)}}{${beta}}\` = ${n(IB * 1000, 4)} mA`,
      `\`$R_{B} = @f{$U_{1} − $U_{BE}}{$I_{B}} = @f{${n(U1)} − 0,7}{${n(IB, 4)}}\` = ${res(RB, 'Ω')}`,
    ]);
  },
  (rng) => {
    let ucc = 12;
    let rc = 2200;
    let beta = 100;
    let ib = 20e-6;
    for (let i = 0; i < 40; i++) {
      ucc = pick(rng, [9, 12, 15, 24]);
      rc = pick(rng, [1000, 1500, 2200, 3300, 4700]);
      beta = pick(rng, [80, 100, 150, 200]);
      ib = pick(rng, [5, 10, 15, 20, 25, 30, 40]) * 1e-6;
      const urc = rc * beta * ib;
      if (urc > 0.25 * ucc && urc < 0.75 * ucc) break;
    }
    const IC = beta * ib;
    const uce = ucc - rc * IC;
    return numeric(ID, `Zosilňovač so spoločným emitorom má \`$U_{CC}\` = ${q(ucc, 'V')}, \`$R_{C}\` = ${q(rc, 'Ω')}, tranzistor s \`$β\` = ${beta} a prúd bázy ${q(ib, 'A')}. Aké je napätie \`$U_{CE}\` v pracovnom bode? (Emitor je pripojený priamo na zem.)`, uce, 'V', [
      `\`$I_{C} = $β · $I_{B}\` = ${beta} · ${q(ib, 'A')} = ${n(IC * 1000, 4)} mA`,
      `\`$U_{CE} = $U_{CC} − $R_{C} · $I_{C}\` = ${n(ucc)} − ${n(rc)} · ${n(IC, 4)} = ${res(uce, 'V')}`,
    ]);
  },
  (rng) => {
    const power = rng() < 0.4;
    const A = pick(rng, power ? [2, 5, 20, 50, 200, 500, 1000] : [2, 5, 20, 50, 200, 500, 1000, 3000]);
    const dB = (power ? 10 : 20) * Math.log10(A);
    return numeric(ID, power
      ? `Zosilňovač zosilňuje výkon ${n(A)}-krát. Aké je jeho výkonové zosilnenie v decibeloch?`
      : `Zosilňovač zosilňuje napätie ${n(A)}-krát. Aké je jeho napäťové zosilnenie v decibeloch?`, dB, 'dB', [
      power ? '`$A_{p} [dB] = 10 · log $A_{p}`' : '`$A_{u} [dB] = 20 · log $A_{u}`',
      `\`${power ? '$A_{p}' : '$A_{u}'}\` = ${power ? 10 : 20} · log ${n(A)} = ${power ? 10 : 20} · ${n(Math.log10(A), 4)} = **${n(dB, 3)} dB**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const dB = pick(rng, [6, 12, 14, 20, 26, 30, 34, 40, 46, 52, 60]);
    const A = 10 ** (dB / 20);
    return numeric(ID, `Napäťové zosilnenie zosilňovača je ${dB} dB. Koľkokrát zosilňuje napätie?`, A, '', [
      'Z `$A_{u} [dB] = 20 · log $A_{u}` vyjadríš `$A_{u} = 10^{$A_{u}[dB]/20}`.',
      `\`$A_{u} = 10^{${dB}/20} = 10^{${n(dB / 20, 3)}}\` = **${n(A, 3)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const k = pick(rng, ['off', 'active', 'sat'] as const);
    const ube = { off: pick(rng, [0, 0.1, 0.2]), active: pick(rng, [0.62, 0.65, 0.68]), sat: pick(rng, [0.75, 0.78, 0.8]) }[k];
    const uce = { off: 12, active: pick(rng, [4.5, 5.8, 6.4, 8.1]), sat: pick(rng, [0.1, 0.15, 0.2]) }[k];
    const names = { off: 'zatvorený (nevodivý)', active: 'aktívny (zosilňovací)', sat: 'nasýtený (saturácia)' };
    const others = (['off', 'active', 'sat'] as const).filter((x) => x !== k).map((x) => names[x]);
    return choice(ID, `Na tranzistore NPN v obvode s napájaním 12 V nameriaš \`$U_{BE}\` = ${n(ube)} V a \`$U_{CE}\` = ${n(uce)} V. V akom režime pracuje?`,
      [names[k], others[0], others[1], 'v prieraze priechodu kolektor – báza'],
      {
        off: 'Napätie báza – emitor je pod prahom asi 0,6 V, bázou netečie prúd. Tranzistor nevedie a celé napájacie napätie je medzi kolektorom a emitorom.',
        active: 'Priechod báza – emitor vedie (asi 0,65 V) a medzi kolektorom a emitorom ostáva niekoľko voltov – kolektorový prúd je `$β · $I_{B}`.',
        sat: 'Priechod báza – emitor vedie a `$U_{CE}` je len desatiny voltu – tranzistor je úplne otvorený a prúd obmedzuje záťaž.',
      }[k],
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'electronics',
    title: 'Bipolárny tranzistor a zosilňovač',
    summary: 'Tranzistor NPN a PNP, prúdy a režimy, tranzistor ako spínač, zosilňovač so spoločným emitorom, výstupné charakteristiky, decibely a MOSFET.',
    minutes: 16,
    blocks: [
      { t: 'p', text: 'Bipolárny tranzistor má tri polovodičové vrstvy – **NPN** alebo **PNP** – a teda dva PN priechody, aké poznáš z diódy. Elektródy sú **báza** (B), **kolektor** (C) a **emitor** (E). Malý prúd bázy riadi veľký prúd kolektora: tranzistor preto môže **zosilňovať** signál alebo **spínať** záťaž.' },
      { t: 'figure', fig: transistorSymbols, caption: 'Značky tranzistorov: šípka je vždy na emitore a ukazuje smer prúdu priechodom báza – emitor. Pri NPN smeruje von, pri PNP dnu.' },
      { t: 'list', items: [
        '**NPN:** kolektor je kladnejší ako emitor, prúd tečie do bázy a do kolektora, z emitora von. Používa sa častejšie.',
        '**PNP:** všetky napätia a prúdy sú opačné – emitor je najkladnejší, prúd z bázy vyteká.',
        'Priechod báza – emitor sa správa ako dióda: v aktívnom režime je na ňom pri kremíkovom tranzistore asi 0,6 až 0,7 V.',
      ] },
      {
        t: 'formula',
        tex: ['$I_{C} = $β · $I_{B}', '$I_{E} = $I_{B} + $I_{C}', '$U_{BE} ≈ 0,7 V'],
        legend: [
          ['$I_{B}', 'prúd bázy', 'A'],
          ['$I_{C}', 'prúd kolektora', 'A'],
          ['$I_{E}', 'prúd emitora', 'A'],
          ['$β', 'prúdový zosilňovací činiteľ (v katalógu aj h21E), bežne 50 až 500', '–'],
        ],
      },
      {
        t: 'example',
        title: 'Prúdy tranzistora',
        given: ['`$I_{B}` = 40 µA', '`$β` = 150'],
        steps: [
          '`$I_{C} = $β · $I_{B}` = 150 · 40 µA = 6 000 µA = 6 mA',
          '`$I_{E} = $I_{B} + $I_{C}` = 0,04 mA + 6 mA = 6,04 mA',
          'Prúd emitora je takmer rovnaký ako prúd kolektora – pri odhadoch sa často kladie `$I_{E} ≈ $I_{C}`.',
        ],
        result: '`$I_{C}` = 6 mA, `$I_{E}` = 6,04 mA',
      },
      { t: 'h', text: 'Pracovné režimy' },
      {
        t: 'table',
        head: ['Režim', 'Priechod B – E', 'Priechod B – C', 'Vlastnosti', 'Použitie'],
        rows: [
          ['zatvorený (nevodivý)', 'nevedie (`$U_{BE}` < 0,5 V)', 'záverný', '`$I_{C}` ≈ 0, `$U_{CE} ≈ $U_{CC}`', 'vypnutý spínač'],
          ['aktívny', 'priepustný (≈ 0,7 V)', 'záverný', '`$I_{C} = $β · $I_{B}`', 'zosilňovač'],
          ['nasýtený (saturácia)', 'priepustný', 'priepustný', '`$U_{CE sat}` ≈ 0,1 až 0,3 V, `$I_{C} < $β · $I_{B}`', 'zopnutý spínač'],
        ],
      },
      { t: 'h', text: 'Tranzistor ako spínač' },
      { t: 'p', text: 'Spínač pracuje len v dvoch stavoch: **zatvorený** (bez prúdu bázy, záťažou netečie prúd) a **nasýtený** (tranzistor je úplne otvorený, je na ňom len `$U_{CE sat}` a celé napätie dostane záťaž). Výstup mikrokontroléra tak môže spínať relé, motor alebo LED s väčším prúdom, ako by sám zvládol. Na istotu nasýtenia sa prúd bázy volí 2- až 5-krát väčší, ako je nevyhnutné – to je **činiteľ presýtenia** `$k`.' },
      { t: 'figure', fig: relaySwitchFigure, caption: 'Tranzistor spína cievku relé `K`. Rezistor `$R_{B}` obmedzuje prúd bázy, nulová dióda `D` paralelne k cievke chráni tranzistor pri vypnutí.' },
      {
        t: 'formula',
        tex: ['$I_{C} ≈ @f{$U_{CC}}{$R_{záť}}', '$I_{B} = $k · @f{$I_{C}}{$β}', '$R_{B} = @f{$U_{1} − $U_{BE}}{$I_{B}}'],
        legend: [
          ['$R_{záť}', 'odpor záťaže v kolektore (napr. cievky relé)', 'Ω'],
          ['$k', 'činiteľ presýtenia, 2 až 5', '–'],
          ['$U_{1}', 'riadiace napätie na vstupe (napr. 5 V z mikrokontroléra)', 'V'],
        ],
      },
      {
        t: 'example',
        title: 'Spínanie relé z mikrokontroléra',
        given: ['relé 12 V s odporom cievky 400 Ω', '`$β` = 100', 'riadiace napätie `$U_{1}` = 5 V', '`$k` = 3'],
        steps: [
          '`$I_{C} = @f{12}{400}` = 0,03 A = 30 mA (napätie `$U_{CE sat}` zanedbáš)',
          'Najmenší potrebný prúd bázy je `@f{30 mA}{100}` = 0,3 mA, s presýtením `$I_{B}` = 3 · 0,3 = 0,9 mA',
          '`$R_{B} = @f{5 − 0,7}{0,0009}` = 4 778 Ω',
          'Zvolíš najbližšiu **nižšiu** hodnotu z rady E12: 4,7 kΩ – prúd bázy bude o niečo väčší, nasýtenie je isté.',
        ],
        result: '`$R_{B}` = 4,7 kΩ',
      },
      { t: 'note', kind: 'warn', text: 'Cievka relé pri vypnutí indukuje napäťovú špičku s opačnou polaritou, ktorá môže prebiť priechod kolektor – emitor. **Nulová dióda** zapojená paralelne k cievke (katódou na `+$U_{CC}`) túto špičku skratuje. Bez nej sa tranzistor skôr či neskôr zničí.' },
      { t: 'h', text: 'Zosilňovač so spoločným emitorom' },
      { t: 'p', text: 'Ako zosilňovač pracuje tranzistor v **aktívnom režime**. Delič `$R_{1}`, `$R_{2}` nastaví jednosmerné napätie bázy a tým **pracovný bod** – kľudový prúd kolektora a napätie `$U_{CE}`. Väzobné kondenzátory `$C_{1}` a `$C_{2}` prepustia striedavý signál, ale oddelia jednosmerné napätia. Rezistor `$R_{E}` stabilizuje pracovný bod pri zmenách teploty a kondenzátor `$C_{E}` ho pre striedavý signál premostí, aby nezmenšoval zosilnenie.' },
      { t: 'figure', fig: ceAmplifierFigure, caption: 'Zosilňovač so spoločným emitorom. Výstupné napätie je voči vstupnému otočené o 180° – keď napätie bázy stúpa, kolektorový prúd rastie a napätie kolektora klesá.' },
      { t: 'p', text: 'Správanie tranzistora opisujú **výstupné charakteristiky** `$I_{C}($U_{CE})` pre rôzne prúdy bázy. Rezistor `$R_{C}` určuje **zaťažovaciu priamku** – všetky body, v ktorých môže obvod pracovať. Pracovný bod je priesečník priamky s charakteristikou pre daný prúd bázy.' },
      { t: 'explore', build: outputExplorer, caption: 'Meň prúd bázy: pracovný bod sa posúva po zaťažovacej priamke. Pri veľkom `$I_{B}` alebo veľkom `$R_{C}` sa dostane do nasýtenia (vľavo hore), pri nulovom prúde bázy je tranzistor zatvorený (vpravo dole).' },
      {
        t: 'formula',
        tex: ['$U_{CE} = $U_{CC} − $R_{C} · $I_{C}', '$A_{u} = @f{$U_{2}}{$U_{1}}', '$A_{p} = @f{$P_{2}}{$P_{1}} = $A_{u} · $A_{i}'],
        legend: [
          ['$U_{CC}', 'napájacie napätie', 'V'],
          ['$A_{u}', 'napäťové zosilnenie (pomer striedavých napätí výstupu a vstupu)', '–'],
          ['$A_{i}', 'prúdové zosilnenie', '–'],
          ['$A_{p}', 'výkonové zosilnenie', '–'],
        ],
      },
      {
        t: 'example',
        title: 'Pracovný bod zosilňovača',
        given: ['`$U_{CC}` = 12 V', '`$R_{C}` = 2,2 kΩ', '`$β` = 100', '`$I_{B}` = 25 µA', '`$R_{E}` zanedbáš'],
        steps: [
          '`$I_{C} = $β · $I_{B}` = 100 · 25 µA = 2,5 mA',
          'Úbytok na `$R_{C}`: 2 200 · 0,0025 = 5,5 V',
          '`$U_{CE} = $U_{CC} − $R_{C} · $I_{C}` = 12 − 5,5 = 6,5 V',
          'Pracovný bod je blízko stredu priamky (`$U_{CC}/2` = 6 V), výstup sa môže meniť nahor aj nadol asi o 5 V bez orezania.',
        ],
        result: '`$I_{C}` = 2,5 mA, `$U_{CE}` = 6,5 V',
      },
      { t: 'h', text: 'Zosilnenie v decibeloch' },
      { t: 'p', text: 'Zosilnenie sa často udáva v **decibeloch** (dB) – logaritmická miera, ktorá zmenší veľké čísla a pri reťazení zosilňovačov sa zosilnenia v dB jednoducho **sčítajú**. Záporná hodnota v dB znamená zoslabenie (útlm).' },
      { t: 'formula', tex: ['$A_{u} [dB] = 20 · log $A_{u}', '$A_{p} [dB] = 10 · log $A_{p}'], legend: [['log', 'dekadický logaritmus', '–']] },
      {
        t: 'table',
        head: ['Pomer', 'napätie (`20 · log`)', 'výkon (`10 · log`)'],
        rows: [
          ['1', '0 dB', '0 dB'],
          ['2', '6 dB', '3 dB'],
          ['10', '20 dB', '10 dB'],
          ['100', '40 dB', '20 dB'],
          ['1 000', '60 dB', '30 dB'],
          ['0,5', '−6 dB', '−3 dB'],
          ['0,1', '−20 dB', '−10 dB'],
        ],
      },
      { t: 'h', text: 'Unipolárny tranzistor MOSFET ako spínač' },
      { t: 'p', text: 'MOSFET má elektródy **hradlo** G, **D** (drain) a **S** (source). Riadi sa **napätím** `$U_{GS}`: hradlo je od kanála izolované tenkou vrstvou oxidu, preto doň netečie jednosmerný prúd. Pri `$U_{GS}` nad prahovým napätím sa kanál otvorí a MOSFET sa správa ako malý odpor `$R_{DS(on)}` – desiatky miliohmov až jednotky ohmov. Strata `$P = $R_{DS(on)} · $I^{2}` je malá, napríklad 0,05 Ω pri 4 A dáva len 0,8 W. Preto sa MOSFETy používajú na spínanie motorov, LED pásov aj v spínaných zdrojoch. Na riadenie priamo z 5 V alebo 3,3 V treba typ s nízkym prahovým napätím (logic-level).' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čo vyjadruje šípka v schematickej značke bipolárneho tranzistora?',
      options: ['označuje emitor a smer prúdu priechodom báza – emitor', 'označuje kolektor a smer prúdu kolektora', 'smer svetla, ktoré tranzistor vyžaruje', 'bázu, do ktorej tečie riadiaci prúd'],
      explanation: 'Šípka je vždy na emitore. Pri NPN ukazuje von (prúd vyteká z emitora), pri PNP dnu.',
    },
    {
      lessonId: ID,
      prompt: 'Tranzistor má `$β` = 200 a bázou tečie 30 µA. Aký je kolektorový prúd v aktívnom režime?',
      options: ['6 mA', '0,15 mA', '6,03 mA', '200 mA'],
      explanation: '`$I_{C} = $β · $I_{B}` = 200 · 30 µA = 6 mA. Hodnota 6,03 mA je prúd emitora `$I_{B} + $I_{C}`.',
    },
    {
      lessonId: ID,
      prompt: 'V akom režime pracuje tranzistor ako zopnutý spínač?',
      options: ['v nasýtenom (saturácia)', 'v aktívnom', 'v zatvorenom', 'v prieraze'],
      explanation: 'Zopnutý spínač má mať čo najmenšie napätie `$U_{CE}`, a teda malú stratu. To platí v nasýtení, keď je `$U_{CE sat}` len 0,1 až 0,3 V.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa pri spínaní relé tranzistorom zapája paralelne k cievke dióda?',
      options: ['pri vypnutí cievka indukuje napäťovú špičku, dióda ju skratuje a chráni tranzistor', 'aby relé rýchlejšie zoplo', 'na usmernenie striedavého prúdu cievky', 'na indikáciu zopnutého stavu'],
      explanation: 'Cievka sa bráni zmene prúdu – pri vypnutí vznikne indukované napätie, ktoré môže byť mnohonásobne väčšie ako napájacie. Nulová dióda nechá prúd cievky doznieť v uzavretom obvode.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je fázový vzťah výstupného a vstupného napätia zosilňovača so spoločným emitorom?',
      options: ['výstup je otočený o 180° (invertuje)', 'sú vo fáze', 'výstup predbieha o 90°', 'výstup zaostáva o 45°'],
      explanation: 'Keď vstupné napätie stúpa, rastie prúd kolektora, zväčší sa úbytok na `$R_{C}` a napätie kolektora klesá.',
    },
    {
      lessonId: ID,
      prompt: 'Zosilňovač má napäťové zosilnenie 40 dB. Koľkokrát zosilňuje napätie?',
      options: ['100-krát', '40-krát', '10 000-krát', '20-krát'],
      explanation: '`$A_{u} = 10^{40/20} = 10^{2}` = 100. Pre výkon by 40 dB znamenalo 10 000-krát.',
    },
    {
      lessonId: ID,
      prompt: 'Čím sa riadi tranzistor MOSFET?',
      options: ['napätím medzi hradlom a source, do hradla netečie jednosmerný prúd', 'prúdom bázy', 'prúdom kolektora', 'magnetickým poľom'],
      explanation: 'Hradlo je izolované vrstvou oxidu, MOSFET je riadený elektrickým poľom – napätím `$U_{GS}`. Prúdom bázy sa riadi bipolárny tranzistor.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa pracovný bod zosilňovača nastavuje približne do stredu zaťažovacej priamky?',
      options: ['aby sa výstupné napätie mohlo meniť rovnako nahor aj nadol bez orezania', 'aby bol tranzistor v nasýtení', 'aby tranzistorom netiekol žiadny prúd', 'aby bolo zosilnenie nulové'],
      explanation: 'Pri `$U_{CE} ≈ @f{$U_{CC}}{2}` má signál rovnaký priestor smerom k nasýteniu aj k zatvoreniu. Pracovný bod pri kraji priamky by jednu polvlnu orezal.',
    },
  ],
  generators,
};

export default mod;
