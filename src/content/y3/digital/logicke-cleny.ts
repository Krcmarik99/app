import type { LessonModule } from '../../module';
import { int, pick, shuffle } from '../../../lib/random';
import { numeric, type Generator } from '../../../practice/helpers';
import {
  GATE_EXPR, GATE_NAME, TWO_INPUT, gateExplorer, gateOut, gateSymbolsFigure, ic7400Figure, logicLevelsFigure,
  nandUniversalFigure, twoGateFigure, type Gate,
} from '../../../ui/fig-digital';
import { choice } from '../util';

const ID = 'logicke-cleny';

const column = (g: Gate) => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => gateOut(g, a, b)).join(' ');

/** Zjednodušenie výrazov: [výraz, správne, tri nesprávne, vysvetlenie]. */
const SIMPLIFY: [string, string, string, string, string, string][] = [
  ['$A · $B + $A · @o{$B}', '$A', '$B', '$A · $B', '1', '`$A · ($B + @o{$B}) = $A · 1 = $A`'],
  ['$A + $A · $B', '$A', '$A · $B', '$A + $B', '$B', 'Absorpcia: `$A + $A · $B = $A · (1 + $B) = $A · 1 = $A`'],
  ['$A · ($A + $B)', '$A', '$A + $B', '$A · $B', '$B', '`$A · $A + $A · $B = $A + $A · $B = $A` (absorpcia)'],
  ['$A + @o{$A} · $B', '$A + $B', '$A', '$A · $B', '@o{$A} + $B', 'Distributívny zákon: `($A + @o{$A}) · ($A + $B) = 1 · ($A + $B) = $A + $B`'],
  ['$A · $B + @o{$A} · $B', '$B', '$A', '$A · $B', '0', '`$B · ($A + @o{$A}) = $B · 1 = $B`'],
  ['($A + $B) · ($A + @o{$B})', '$A', '$B', '$A + $B', '1', 'Distributívny zákon: `$A + $B · @o{$B} = $A + 0 = $A`'],
  ['@o{$A} · @o{$B} + @o{$A} · $B', '@o{$A}', '@o{$B}', '$A', '@o{$A · $B}', '`@o{$A} · (@o{$B} + $B) = @o{$A} · 1 = @o{$A}`'],
  ['$A · $B · $C + $A · $B · @o{$C}', '$A · $B', '$A · $B · $C', '$C', '$A + $B', '`$A · $B · ($C + @o{$C}) = $A · $B · 1 = $A · $B`'],
  ['$A · @o{$A} + $B', '$B', '$A + $B', '1', '0', '`$A · @o{$A} = 0`, takže `$Y = 0 + $B = $B`'],
  ['$A · $B + $A · $B · $C', '$A · $B', '$A · $B · $C', '$A · $C', '$C', 'Absorpcia: `$A · $B · (1 + $C) = $A · $B`'],
  ['($A + @o{$A}) · $B · $C', '$B · $C', '$A · $B · $C', '0', '$B + $C', '`$A + @o{$A} = 1`, takže `$Y = 1 · $B · $C = $B · $C`'],
  ['$A + $A · $B + $A · @o{$B}', '$A', '$A + $B', '1', '$A · $B', 'Každý člen obsahuje `$A`: `$A · (1 + $B + @o{$B}) = $A`'],
];

/** De Morganove zákony: [výraz, správne, tri nesprávne]. */
const DEMORGAN: [string, string, string, string, string][] = [
  ['@o{$A · $B}', '@o{$A} + @o{$B}', '@o{$A} · @o{$B}', '$A + $B', '@o{$A + $B}'],
  ['@o{$A + $B}', '@o{$A} · @o{$B}', '@o{$A} + @o{$B}', '$A · $B', '@o{$A · $B}'],
  ['@o{$A · $B · $C}', '@o{$A} + @o{$B} + @o{$C}', '@o{$A} · @o{$B} · @o{$C}', '$A + $B + $C', '@o{$A + $B} · $C'],
  ['@o{$A + $B + $C}', '@o{$A} · @o{$B} · @o{$C}', '@o{$A} + @o{$B} + @o{$C}', '$A · $B · $C', '@o{$A · $B} + $C'],
  ['@o{@o{$A} + $B}', '$A · @o{$B}', '@o{$A} · $B', '$A + @o{$B}', '@o{$A} · @o{$B}'],
  ['@o{$A · @o{$B}}', '@o{$A} + $B', '@o{$A} · $B', '$A + @o{$B}', '@o{$A} + @o{$B}'],
  ['@o{@o{$A} · @o{$B}}', '$A + $B', '$A · $B', '@o{$A} + @o{$B}', '@o{$A + $B}'],
];

/** Kombinácia člena a invertorov: [opis, výsledný člen, vysvetlenie]. */
const COMBOS: [string, Gate, string][] = [
  ['Za výstup člena AND zapojíš invertor (NOT).', 'nand', '`$Y = @o{$A · $B}` – to je NAND.'],
  ['Za výstup člena OR zapojíš invertor (NOT).', 'nor', '`$Y = @o{$A + $B}` – to je NOR.'],
  ['Za výstup člena XOR zapojíš invertor (NOT).', 'xnor', '`$Y = @o{$A ⊕ $B}` – výstup je 1 pri rovnakých vstupoch, to je XNOR.'],
  ['Za výstup člena NAND zapojíš invertor (NOT).', 'and', 'Dvojitá negácia sa zruší: `@o{@o{$A · $B}} = $A · $B` – to je AND.'],
  ['Za výstup člena NOR zapojíš invertor (NOT).', 'or', '`@o{@o{$A + $B}} = $A + $B` – to je OR.'],
  ['Pred oba vstupy člena AND zapojíš invertory.', 'nor', 'Podľa De Morgana `@o{$A} · @o{$B} = @o{$A + $B}` – to je NOR.'],
  ['Pred oba vstupy člena OR zapojíš invertory.', 'nand', 'Podľa De Morgana `@o{$A} + @o{$B} = @o{$A · $B}` – to je NAND.'],
  ['Pred oba vstupy člena NAND zapojíš invertory.', 'or', '`@o{@o{$A} · @o{$B}} = $A + $B` – to je OR.'],
  ['Pred oba vstupy člena NOR zapojíš invertory.', 'and', '`@o{@o{$A} + @o{$B}} = $A · $B` – to je AND.'],
];

const fx = (src: string) => `\`${src}\``;

const generators: Generator[] = [
  (rng) => {
    const a = int(rng, 0, 1);
    const b = int(rng, 0, 1);
    const want = int(rng, 0, 1);
    const good = TWO_INPUT.filter((g) => gateOut(g, a, b) === want);
    const bad = TWO_INPUT.filter((g) => gateOut(g, a, b) !== want);
    const correct = pick(rng, good);
    return choice(ID, `Ktorý dvojvstupový člen má pri vstupoch \`$A\` = ${a}, \`$B\` = ${b} na výstupe \`$Y\` = ${want}?`,
      [GATE_NAME[correct], ...bad.map((g) => GATE_NAME[g])] as [string, string, string, string],
      `Pri \`$A\` = ${a}, \`$B\` = ${b} dávajú členy: ${TWO_INPUT.map((g) => `${GATE_NAME[g]} → ${gateOut(g, a, b)}`).join(', ')}. Výstup ${want} má ${good.map((g) => GATE_NAME[g]).join(', ')}; z ponúknutých je to ${GATE_NAME[correct]}.`,
      rng);
  },
  (rng) => {
    const [g, ...others] = shuffle(rng, TWO_INPUT);
    if (rng() < 0.5) {
      return choice(ID, `Dvojvstupový člen dáva pri vstupoch \`$A$B\` = 00, 01, 10, 11 postupne výstupy ${column(g)}. Ktorý je to člen?`,
        [GATE_NAME[g], GATE_NAME[others[0]], GATE_NAME[others[1]], GATE_NAME[others[2]]],
        `Postupnosť ${column(g)} zodpovedá výrazu ${fx(GATE_EXPR[g])}. Porovnaj: AND 0 0 0 1, OR 0 1 1 1, NAND 1 1 1 0, NOR 1 0 0 0, XOR 0 1 1 0, XNOR 1 0 0 1.`,
        rng);
    }
    return choice(ID, `Aký je stĺpec výstupu pravdivostnej tabuľky člena ${GATE_NAME[g]} pre vstupy \`$A$B\` = 00, 01, 10, 11?`,
      [column(g), column(others[0]), column(others[1]), column(others[2])],
      `Člen ${GATE_NAME[g]} má výraz ${fx(GATE_EXPR[g])}, preto pre 00, 01, 10, 11 dáva ${column(g)}.`,
      rng);
  },
  (rng) => {
    const g1 = pick(rng, TWO_INPUT);
    const g2 = pick(rng, TWO_INPUT);
    const a = int(rng, 0, 1);
    const b = int(rng, 0, 1);
    const c = int(rng, 0, 1);
    const x = gateOut(g1, a, b);
    const y = gateOut(g2, x, c);
    const opt = (xv: number, yv: number) => `\`$X\` = ${xv}, \`$Y\` = ${yv}`;
    const q = choice(ID, `Na vstupy zapojenia sú privedené hodnoty \`$A\` = ${a}, \`$B\` = ${b}, \`$C\` = ${c}. Prvý člen je ${GATE_NAME[g1]}, druhý ${GATE_NAME[g2]}. Aké sú hodnoty \`$X\` a \`$Y\`?`,
      [opt(x, y), opt(x, 1 - y), opt(1 - x, y), opt(1 - x, 1 - y)],
      `Prvý člen: ${GATE_NAME[g1]}(${a}, ${b}) → \`$X\` = ${x}. Druhý člen: ${GATE_NAME[g2]}(\`$X\` = ${x}, \`$C\` = ${c}) → \`$Y\` = ${y}.`,
      rng);
    return { ...q, figure: () => twoGateFigure(g1, g2) };
  },
  (rng) => {
    const [text, gate, why] = pick(rng, COMBOS);
    const others = shuffle(rng, TWO_INPUT.filter((g) => g !== gate)).slice(0, 3);
    return choice(ID, `${text} Akú funkciu má celé zapojenie?`,
      [GATE_NAME[gate], GATE_NAME[others[0]], GATE_NAME[others[1]], GATE_NAME[others[2]]], why, rng);
  },
  (rng) => {
    const [expr, ok, w1, w2, w3, why] = pick(rng, SIMPLIFY);
    return choice(ID, `Zjednoduš výraz \`$Y = ${expr}\`.`, [fx(`$Y = ${ok}`), fx(`$Y = ${w1}`), fx(`$Y = ${w2}`), fx(`$Y = ${w3}`)], why, rng);
  },
  (rng) => {
    const k = int(rng, 2, 8);
    const rows = 2 ** k;
    return numeric(ID, `Koľko riadkov má úplná pravdivostná tabuľka logickej funkcie s ${k} vstupmi?`, rows, '', [
      'Každý vstup môže byť 0 alebo 1, počet kombinácií je `2^{$n}`.',
      `\`2^{${k}}\` = **${rows}** riadkov`,
    ], { fixedUnit: true, tolerance: Math.min(0.1, 0.45 / rows) });
  },
  (rng) => {
    const [expr, ok, w1, w2, w3] = pick(rng, DEMORGAN);
    return choice(ID, `Ktorý výraz sa rovná výrazu \`${expr}\`?`, [fx(ok), fx(w1), fx(w2), fx(w3)],
      `Podľa De Morganových zákonov sa pruh nad celým výrazom „rozdelí“ nad jednotlivé premenné a súčin sa zmení na súčet (alebo naopak): ${fx(`${expr} = ${ok}`)}. Dvojitá negácia sa ruší.`,
      rng);
  },
];

const ROWS: [Gate, string][] = [
  ['not', 'vstup je 0'],
  ['and', 'všetky vstupy sú 1'],
  ['or', 'aspoň jeden vstup je 1'],
  ['nand', 'aspoň jeden vstup je 0'],
  ['nor', 'všetky vstupy sú 0'],
  ['xor', 'vstupy sú rôzne'],
  ['xnor', 'vstupy sú rovnaké'],
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'digital',
    title: 'Logické členy a Booleova algebra',
    summary: 'Logické úrovne TTL a CMOS, členy NOT, AND, OR, NAND, NOR, XOR a XNOR, ich značky a pravdivostné tabuľky, zákony Booleovej algebry, De Morgan a obvod 74HC00.',
    minutes: 16,
    blocks: [
      { t: 'p', text: 'Logická premenná nadobúda iba dve hodnoty: 0 (nepravda) a 1 (pravda). V obvode ich predstavujú dve napäťové úrovne – **L** (low, nízka) a **H** (high, vysoká). Bežne sa používa **pozitívna logika**: L = 0, H = 1. Obvody, ktoré s logickými hodnotami počítajú, sa nazývajú **logické členy** (hradlá).' },
      { t: 'h', text: 'Logické úrovne' },
      { t: 'p', text: 'Úroveň nie je jedno presné napätie, ale **pásmo**. Pre obvody TTL s napájaním 5 V platí: vstup vyhodnotí ako L napätie do 0,8 V a ako H napätie od 2 V; výstup zaručuje L najviac 0,4 V a H aspoň 2,4 V. Rozdiel 0,4 V medzi výstupom a vstupom je **šumová imunita** – rušenie menšie ako 0,4 V stav nezmení. Obvody CMOS 74HC majú prahy približne na 30 % a 70 % napájacieho napätia (pri 5 V: L do 1,5 V, H od 3,5 V). Mikrokontroléry s napájaním 3,3 V používajú úrovne L do 0,8 V a H od 2 V.' },
      { t: 'figure', fig: logicLevelsFigure, caption: 'Pásma napätí pre log. 0 a 1. Napätie v neurčitej oblasti môže obvod vyhodnotiť ľubovoľne – pri správnom zapojení sa tam signál zdrží iba počas prechodu.' },
      { t: 'h', text: 'Základné logické členy' },
      { t: 'p', text: '**NOT** (invertor) neguje vstup. **AND** (logický súčin) má výstup 1, len keď sú všetky vstupy 1 – ako dva spínače zapojené za sebou. **OR** (logický súčet) má výstup 1, keď je aspoň jeden vstup 1 – ako spínače zapojené paralelne. **NAND** a **NOR** sú AND a OR s negovaným výstupom. **XOR** (nonekvivalencia, výlučný súčet) má výstup 1 pri rôznych vstupoch, **XNOR** (ekvivalencia) pri rovnakých.' },
      {
        t: 'table',
        head: ['Člen', 'Výraz', '`$Y` pre `$A$B` = 00, 01, 10, 11', 'Výstup je 1, keď…'],
        rows: ROWS.map(([g, when]) => [`**${GATE_NAME[g]}**`, fx(GATE_EXPR[g]), g === 'not' ? '1, 0 (pre `$A` = 0, 1)' : column(g), when]),
      },
      { t: 'figure', fig: gateSymbolsFigure, caption: 'Značky logických členov. Podľa STN EN 60617-12 je člen obdĺžnik so symbolom funkcie (`&`, `≥1`, `=1`, `1`), negácia sa vyznačí krúžkom na výstupe. V amerických katalógoch a programoch sa používajú tvarové značky ANSI.' },
      { t: 'note', kind: 'tip', text: 'V katalógových listoch amerických výrobcov nájdeš takmer vždy tvarové značky (ANSI/IEEE). Funkcia je rovnaká – AND má rovnú zadnú stranu a oblú prednú, OR je zahnutý „štít“, XOR má navyše druhý oblúk a krúžok vždy znamená negáciu. V technickej dokumentácii podľa noriem STN kresli obdĺžnikové značky.' },
      { t: 'explore', build: gateExplorer, caption: 'Vyber člen a klikaním nastav vstupy. V pravdivostnej tabuľke sa zvýrazní riadok, ktorý práve platí.' },
      { t: 'h', text: 'Booleova algebra' },
      { t: 'p', text: 'S logickými výrazmi sa počíta podľa pravidiel **Booleovej algebry**. Negácia má prednosť pred súčinom a súčin pred súčtom (ako násobenie pred sčítaním). Zákony slúžia na **zjednodušenie** výrazov – jednoduchší výraz znamená menej členov, nižšiu cenu a menšie oneskorenie. Každý zákon platí v dvoch podobách: pre súčin aj pre súčet.' },
      {
        t: 'table',
        head: ['Zákon', 'Pre súčin', 'Pre súčet'],
        rows: [
          ['neutrálny prvok', '`$A · 1 = $A`', '`$A + 0 = $A`'],
          ['nulový (agresívny) prvok', '`$A · 0 = 0`', '`$A + 1 = 1`'],
          ['idempotencia', '`$A · $A = $A`', '`$A + $A = $A`'],
          ['komplement', '`$A · @o{$A} = 0`', '`$A + @o{$A} = 1`'],
          ['dvojitá negácia', '`@o{@o{$A}} = $A`', '—'],
          ['komutatívny', '`$A · $B = $B · $A`', '`$A + $B = $B + $A`'],
          ['asociatívny', '`($A · $B) · $C = $A · ($B · $C)`', '`($A + $B) + $C = $A + ($B + $C)`'],
          ['distributívny', '`$A · ($B + $C) = $A · $B + $A · $C`', '`$A + $B · $C = ($A + $B) · ($A + $C)`'],
          ['absorpcia', '`$A · ($A + $B) = $A`', '`$A + $A · $B = $A`'],
        ],
      },
      {
        t: 'formula',
        tex: ['@o{$A · $B} = @o{$A} + @o{$B}', '@o{$A + $B} = @o{$A} · @o{$B}'],
        legend: [['@o{$A}', 'negácia premennej A (čítaj „A s pruhom“, „non A“)', '—'], ['·', 'logický súčin (AND)', '—'], ['+', 'logický súčet (OR)', '—']],
      },
      { t: 'p', text: '**De Morganove zákony**: negácia súčinu je súčet negácií a negácia súčtu je súčin negácií. Pruh nad celým výrazom sa „rozdelí“ nad jednotlivé premenné a znamienko sa zmení. Platia aj pre viac premenných: `@o{$A · $B · $C} = @o{$A} + @o{$B} + @o{$C}`.' },
      {
        t: 'example',
        title: 'Zjednodušenie výrazu',
        given: ['`$Y = $A · $B · $C + $A · $B · @o{$C} + @o{$A} · $B`'],
        steps: [
          'Prvé dva súčiny majú spoločné `$A · $B`: `$A · $B · ($C + @o{$C}) = $A · $B · 1 = $A · $B`',
          '`$Y = $A · $B + @o{$A} · $B = $B · ($A + @o{$A}) = $B · 1`',
          'Overenie dosadením: pre `$A$B$C` = 010 je `$Y` = 0 + 0 + 1 = 1 = `$B` ✓',
        ],
        result: '`$Y = $B` – obvod nepotrebuje žiadny člen, výstup stačí spojiť so vstupom `$B`.',
      },
      {
        t: 'example',
        title: 'Úprava výrazu De Morganovými zákonmi',
        given: ['`$Y_{1} = @o{@o{$A} + $B}`', '`$Y_{2} = @o{$A · $B + $C}`'],
        steps: [
          '`$Y_{1} = @o{@o{$A}} · @o{$B} = $A · @o{$B}` (dvojitá negácia sa zruší)',
          '`$Y_{2} = @o{$A · $B} · @o{$C}`',
          '`@o{$A · $B} = @o{$A} + @o{$B}`, takže `$Y_{2} = (@o{$A} + @o{$B}) · @o{$C}`',
        ],
        result: '`$Y_{1} = $A · @o{$B}`, `$Y_{2} = (@o{$A} + @o{$B}) · @o{$C}`',
      },
      { t: 'h', text: 'NAND a NOR ako univerzálne členy' },
      { t: 'p', text: 'Z členov NAND (alebo len z členov NOR) sa dá zostaviť **ľubovoľná** logická funkcia. Invertor vznikne spojením vstupov: `@o{$A · $A} = @o{$A}`. AND je NAND s invertorom za výstupom. OR vyplýva z De Morganovho zákona: `$A + $B = @o{@o{$A} · @o{$B}}` – vstupy znegujeme a privedieme na NAND. Pri návrhu dosky tak často vystačíš s jedným typom obvodu.' },
      { t: 'figure', fig: nandUniversalFigure, caption: 'Funkcie NOT, AND a OR zložené iba z členov NAND. Analogicky sa dajú zložiť z členov NOR.' },
      { t: 'h', text: 'Integrované obvody' },
      { t: 'p', text: 'Logické členy sa vyrábajú v integrovaných obvodoch radu 74 – pôvodne v technológii TTL (74LS), dnes najmä CMOS (74HC, 74HCT, pri 3,3 V 74LVC). Obvod **74HC00** obsahuje štyri dvojvstupové členy NAND v puzdre DIP-14 (alebo SO-14). Napájanie `$U_{CC}` je na vývode 14, zem GND na vývode 7. Rovnaké rozloženie vývodov majú 74HC08 (4× AND), 74HC32 (4× OR) a 74HC86 (4× XOR); 74HC04 obsahuje šesť invertorov a 74HC02 (4× NOR) má vývody usporiadané inak – vždy si pozri katalógový list. Rad 74HCT je CMOS so vstupnými úrovňami TTL.' },
      { t: 'figure', fig: ic7400Figure, caption: 'Rozloženie vývodov 74HC00 (pohľad zhora). Vývod 1 je vľavo od výrezu, číslovanie pokračuje proti smeru hodinových ručičiek.' },
      {
        t: 'table',
        head: ['Vlastnosť', 'TTL (74LS)', 'CMOS (74HC)'],
        rows: [
          ['napájacie napätie', '5 V ± 5 %', '2 V až 6 V'],
          ['vstupné úrovne pri 5 V', 'L do 0,8 V, H od 2 V', 'L do 1,5 V, H od 3,5 V'],
          ['odber v pokoji', 'jednotky mA na puzdro', 'rádovo µA, rastie s frekvenciou prepínania'],
          ['nezapojený vstup', 'správa sa zvyčajne ako H, je citlivý na rušenie', 'nedefinovaný stav, obvod sa môže prehrievať'],
          ['citlivosť na statickú elektrinu', 'menšia', 'väčšia – vstupy sú hradlá tranzistorov MOSFET'],
        ],
      },
      { t: 'note', kind: 'warn', text: 'Nepoužité vstupy obvodov CMOS **nikdy nenechávaj nezapojené**. Pripoj ich na GND alebo na `$U_{CC}` – pri členoch AND a NAND na `$U_{CC}` (log. 1 výstup neovplyvní), pri OR a NOR na GND. Obvody CMOS chráň pred statickou elektrinou – pri manipulácii používaj uzemnený náramok a antistatickú podložku.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Ktoré napätie na vstupe obvodu TTL (napájanie 5 V) sa spoľahlivo vyhodnotí ako log. 0?',
      options: ['0,6 V', '1,4 V', '2,2 V', '3,5 V'],
      explanation: 'Vstup TTL vyhodnotí ako L napätie najviac 0,8 V a ako H napätie aspoň 2 V. Napätie 1,4 V leží v neurčitej oblasti, 2,2 V a 3,5 V sú log. 1.',
    },
    {
      lessonId: ID,
      prompt: 'Výstup ktorého člena je 1 práve vtedy, keď sú jeho dva vstupy rôzne?',
      options: ['XOR', 'XNOR', 'OR', 'NAND'],
      explanation: 'XOR (nonekvivalencia) dáva pre 00, 01, 10, 11 výstupy 0, 1, 1, 0. XNOR je jeho negácia, OR dáva 1 aj pri 11.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa členy NAND a NOR nazývajú univerzálne?',
      options: ['z jedného z nich sa dá zostaviť ľubovoľná logická funkcia vrátane NOT, AND a OR', 'pracujú pri ľubovoľnom napájacom napätí', 'môžu mať ľubovoľný počet vstupov', 'dajú sa zapojiť do obvodov TTL aj CMOS bez úpravy úrovní'],
      explanation: 'Spojením vstupov NAND vznikne invertor, z NAND a invertora AND a podľa De Morgana z invertorov a NAND aj OR. Tým sa dá realizovať každá funkcia.',
    },
    {
      lessonId: ID,
      prompt: 'Na ktorých vývodoch má obvod 74HC00 v puzdre DIP-14 napájanie?',
      options: ['14 = `$U_{CC}`, 7 = GND', '1 = `$U_{CC}`, 14 = GND', '7 = `$U_{CC}`, 14 = GND', '8 = `$U_{CC}`, 1 = GND'],
      explanation: 'Pri štrnásťvývodových obvodoch radu 74 je napájanie spravidla na vývode 14 (pravý horný roh pri pohľade zhora) a zem na vývode 7 (ľavý dolný roh).',
    },
    {
      lessonId: ID,
      prompt: 'Čo urobíš s nepoužitými vstupmi obvodu CMOS?',
      options: ['pripojíš ich na GND alebo na `$U_{CC}` podľa funkcie člena', 'necháš ich nezapojené, vnútri sú pripojené na L', 'pripojíš ich na výstup iného obvodu cez kondenzátor', 'odstrihneš ich, aby nezachytávali rušenie'],
      explanation: 'Vstup CMOS má veľmi veľký odpor a nezapojený „pláva“ v neurčitej oblasti. Obvod sa potom môže náhodne prepínať a prehrievať. Pri AND/NAND sa nepoužitý vstup pripája na `$U_{CC}`, pri OR/NOR na GND.',
    },
    {
      lessonId: ID,
      prompt: 'Čomu sa rovná `@o{$A + $B}` podľa De Morganovho zákona?',
      options: ['`@o{$A} · @o{$B}`', '`@o{$A} + @o{$B}`', '`$A · $B`', '`@o{$A · $B}`'],
      explanation: 'Negácia súčtu je súčin negácií. Výstup NOR je 1 iba vtedy, keď sú oba vstupy 0, teda keď platí `@o{$A}` a zároveň `@o{$B}`.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa v značke logického člena podľa STN EN 60617-12 vyznačí negovaný výstup?',
      options: ['krúžkom na výstupe obdĺžnika', 'písmenom N v obdĺžniku', 'čiarkovaným obrysom obdĺžnika', 'šípkou na výstupnej čiare'],
      explanation: 'Negácia sa vyznačí malým krúžkom na mieste, kde výstup vychádza z obdĺžnika. Napríklad NAND je obdĺžnik so symbolom & a krúžkom na výstupe.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je výsledok výrazu `$A + 1` v Booleovej algebre?',
      options: ['1', '`$A`', '0', '`@o{$A}`'],
      explanation: 'Ak je jeden vstup člena OR v stave 1, výstup je 1 bez ohľadu na druhý vstup – jednotka je pri súčte nulový (agresívny) prvok. Naopak `$A · 1 = $A`.',
    },
  ],
  generators,
};

export default mod;
