import type { LessonModule } from '../../module';
import { int, pick, type Rng } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { numeric, q, res, type Generator } from '../../../practice/helpers';
import { counterFigure, counterTimingFigure, dTimingFigure, flipFlopExplorer, rsNorFigure, shiftRegisterFigure } from '../../../ui/fig-digital';
import { choice } from '../util';

const ID = 'klopne-obvody';

const num = (v: number) => fmt(v, 12);
const fq = (f: number) => (f >= 100e3 ? q(f, 'Hz') : `${num(f)} Hz`);
const exact = (v: number) => Math.min(0.1, 0.45 / v);

function four(correct: string, candidates: string[], fill: () => string): [string, string, string, string] {
  const out = [correct];
  for (const c of candidates) if (out.length < 4 && !out.includes(c)) out.push(c);
  for (let guard = 0; out.length < 4 && guard < 200; guard++) {
    const c = fill();
    if (!out.includes(c)) out.push(c);
  }
  return out as [string, string, string, string];
}

const randomBits = (rng: Rng, n: number) => Array.from({ length: n }, () => int(rng, 0, 1)).join('');

type Jk = [number, number];
function jkRun(q0: number, seq: Jk[], rule: 'ok' | 'hold11' | 'asD'): number[] {
  let qv = q0;
  return seq.map(([j, k]) => {
    if (rule === 'asD') qv = j;
    else if (j && k) qv = rule === 'ok' ? 1 - qv : qv;
    else if (j) qv = 1;
    else if (k) qv = 0;
    return qv;
  });
}

const generators: Generator[] = [
  (rng) => {
    const f = pick(rng, [32768, 1e6, 100e3, 4e6, 16e6, 10e6, 1000, 50]);
    const n = int(rng, 1, Math.min(12, Math.floor(Math.log2(f))));
    const fo = f / 2 ** n;
    return numeric(ID, `Na vstup asynchrónneho binárneho čítača privádzaš hodinový signál s frekvenciou ${fq(f)}. Aká je frekvencia na výstupe ${n}. preklápača (\`$Q_{${n - 1}}\`)?`, fo, 'Hz', [
      'Každý preklápač delí frekvenciu dvoma.',
      `\`$f_{n} = @f{$f}{2^{$n}} = @f{${num(f)}}{2^{${n}}} = @f{${num(f)}}{${num(2 ** n)}}\` = ${fo !== Math.round(fo) ? `${fmt(fo, 8)} Hz ≈ **${q(fo, 'Hz')}**` : fo >= 1000 ? `${fmt(fo, 8)} Hz = **${q(fo, 'Hz')}**` : `**${fmt(fo, 8)} Hz**`}`,
    ]);
  },
  (rng) => {
    const N = pick(rng, [3, 5, 6, 7, 9, 10, 12, 16, 24, 60, 100, 200]);
    const n = Math.ceil(Math.log2(N));
    return numeric(ID, `Koľko klopných obvodov potrebuje čítač modulo ${N} (počíta od 0 do ${N - 1})?`, n, '', [
      'Potrebuješ najmenšie `$n`, pre ktoré `2^{$n} ≥ $N`.',
      `\`2^{${n - 1}}\` = ${2 ** (n - 1)} < ${N} ≤ \`2^{${n}}\` = ${2 ** n}`,
      `Treba **${n}** ${n <= 4 ? 'klopné obvody' : 'klopných obvodov'}${N === 2 ** n - 1 ? `; nepotrebný stav ${N} preskočí nulovanie` : N < 2 ** n ? `; nepotrebné stavy ${N} až ${2 ** n - 1} preskočí nulovanie` : ''}.`,
    ], { fixedUnit: true, tolerance: exact(n) });
  },
  (rng) => {
    const b = rng() < 0.5 ? 3 : 4;
    const M = 2 ** b;
    const k = int(rng, b === 3 ? 3 : 5, b === 3 ? 30 : 40);
    const st = k % M;
    const fmtB = (v: number) => v.toString(2).padStart(b, '0');
    const head = b === 3 ? '`$Q_{2}$Q_{1}$Q_{0}`' : '`$Q_{3}$Q_{2}$Q_{1}$Q_{0}`';
    const reversed = parseInt([...fmtB(st)].reverse().join(''), 2);
    return choice(ID, `${b}-bitový binárny čítač začína v stave 0. V akom stave ${head} bude po ${k} impulzoch?`,
      four(fmtB(st), [fmtB(reversed), fmtB((st + 1) % M), fmtB((st + M - 1) % M)], () => fmtB(int(rng, 0, M - 1))),
      `Čítač má ${M} stavov (modulo ${M}), po stave ${M - 1} prejde na 0. Zvyšok ${k} : ${M} je ${st}, teda stav ${fmtB(st)}.`,
      rng);
  },
  (rng) => {
    const q0 = int(rng, 0, 1);
    const all: Jk[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const seq: Jk[] = Array.from({ length: 4 }, () => pick(rng, all));
    if (!seq.some(([j, k]) => j && k)) seq[int(rng, 0, 3)] = [1, 1];
    const show = (a: number[]) => a.join(', ');
    const ok = jkRun(q0, seq, 'ok');
    const last = [...ok];
    last[3] = 1 - last[3];
    const why = seq.map(([j, k], i) => `${i + 1}. hrana: ${j && k ? 'preklopenie' : j ? 'nastavenie' : k ? 'nulovanie' : 'pamätá'} → ${ok[i]}`).join('; ');
    return choice(ID, `Klopný obvod JK je v stave \`$Q\` = ${q0}. Pri štyroch hodinových hranách sú na vstupoch \`$J$K\` postupne ${seq.map(([j, k]) => `${j}${k}`).join(', ')}. Aké hodnoty \`$Q\` budú po jednotlivých hranách?`,
      four(show(ok), [show(jkRun(q0, seq, 'hold11')), show(jkRun(q0, seq, 'asD')), show(last)], () => [0, 1, 2, 3].map(() => int(rng, 0, 1)).join(', ')),
      `${why}. Pri \`$J\` = \`$K\` = 1 sa výstup preklopí do opačného stavu, pri 00 sa nemení.`,
      rng);
  },
  (rng) => {
    const nand = rng() < 0.4;
    const s = int(rng, 0, 1);
    const r = int(rng, 0, 1);
    const options: [string, string, string, string] = ['nastaví výstup `$Q` = 1', 'vynuluje výstup `$Q` = 0', 'zachová predchádzajúci stav', 'dostane sa do zakázaného stavu'];
    // Pre NOR sú vstupy aktívne v H, pre NAND v L.
    const act = (v: number) => (nand ? v === 0 : v === 1);
    const idx = act(s) && act(r) ? 3 : act(s) ? 0 : act(r) ? 1 : 2;
    const ordered = [options[idx], ...options.filter((_, i) => i !== idx)] as [string, string, string, string];
    const inputs = nand ? `\`@o{$S}\` = ${s}, \`@o{$R}\` = ${r}` : `\`$S\` = ${s}, \`$R\` = ${r}`;
    return choice(ID, `Čo urobí klopný obvod RS zostavený z členov ${nand ? 'NAND' : 'NOR'} pri vstupoch ${inputs}?`, ordered,
      nand
        ? 'Pri zapojení z členov NAND sú vstupy aktívne v stave L: `@o{$S}` = 0 nastaví, `@o{$R}` = 0 vynuluje, 11 zachová stav a 00 je zakázaná kombinácia.'
        : 'Pri zapojení z členov NOR sú vstupy aktívne v stave H: `$S` = 1 nastaví, `$R` = 1 vynuluje, 00 zachová stav a 11 je zakázaná kombinácia.',
      rng);
  },
  (rng) => {
    const k = int(rng, 3, 6);
    const seq = randomBits(rng, k);
    const run = (bits: string) => {
      let reg = [0, 0, 0, 0];
      for (const ch of bits) reg = [Number(ch), reg[0], reg[1], reg[2]];
      return reg.join('');
    };
    const ok = run(seq);
    const wrongDir = (() => {
      let reg = [0, 0, 0, 0];
      for (const ch of seq) reg = [reg[1], reg[2], reg[3], Number(ch)];
      return reg.join('');
    })();
    return choice(ID, `Do 4-bitového posuvného registra (na začiatku 0000) vstupujú sériovým vstupom \`$D_{S}\` bity ${seq.split('').join(', ')} (prvý vľavo), pri každom hodinovom impulze jeden. Aký je obsah \`$Q_{0}$Q_{1}$Q_{2}$Q_{3}\` po ${k} impulzoch?`,
      four(ok, [[...ok].reverse().join(''), wrongDir, run(seq.slice(0, -1))], () => randomBits(rng, 4)),
      `Každý impulz zapíše nový bit do \`$Q_{0}\` a ostatné posunie o miesto ďalej (\`$Q_{0}\` → \`$Q_{1}\` → \`$Q_{2}\` → \`$Q_{3}\`). Posledný vložený bit je v \`$Q_{0}\`, predchádzajúce za ním: ${ok}.`,
      rng);
  },
  (rng) => {
    const [N, label] = pick(rng, [[10, 'dekadického čítača (modulo 10)'], [6, 'čítača modulo 6'], [12, 'čítača modulo 12'], [60, 'čítača modulo 60'], [16, 'štvorbitového binárneho čítača']] as [number, string][]);
    const f = pick(rng, [50, 100, 1000, 10e3, 32768, 1e6]);
    const fo = f / N;
    return numeric(ID, `Na vstup ${label} privádzaš impulzy s frekvenciou ${fq(f)}. Aká je frekvencia na výstupe prenosu (jeden impulz za celý cyklus čítača)?`, fo, 'Hz', [
      `Čítač modulo ${N} vydá jeden výstupný impulz za ${N} vstupných – delí frekvenciu ${N}.`,
      `\`$f_{v} = @f{$f}{$N} = @f{${num(f)}}{${N}}\` = ${res(fo, 'Hz')}`,
    ]);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'digital',
    title: 'Klopné obvody, čítače a registre',
    summary: 'Sekvenčné obvody: klopné obvody RS, D, JK a T, časové diagramy, asynchrónny a dekadický čítač, delička frekvencie a posuvný register.',
    minutes: 18,
    blocks: [
      { t: 'p', text: 'Výstup **sekvenčného obvodu** závisí nielen od okamžitých vstupov, ale aj od toho, čo sa dialo predtým – obvod **má pamäť**. Základom je **klopný obvod** (preklápací obvod, angl. flip-flop): bistabilný obvod, ktorý zostane v jednom z dvoch stavov, kým ho vstupný signál nepreklopí. Uchová teda jeden bit. Z klopných obvodov sa skladajú registre, čítače, deličky frekvencie aj pamäte.' },
      { t: 'h', text: 'Klopný obvod RS' },
      { t: 'p', text: 'Najjednoduchší klopný obvod vznikne z dvoch členov NOR, ktorých výstupy sú privedené späť na vstup druhého člena. Vstupom **S** (set) sa výstup `$Q` nastaví na 1, vstupom **R** (reset) sa vynuluje. Keď sú oba vstupy 0, obvod si stav **pamätá**. Kombinácia S = R = 1 je **zakázaná** – oba výstupy by boli 0 a po súčasnom uvoľnení vstupov by nebolo isté, do ktorého stavu sa obvod preklopí. Pri zapojení z členov NAND sú vstupy aktívne v L (`@o{$S}`, `@o{$R}`) a zakázaná je kombinácia `@o{$S}` = `@o{$R}` = 0.' },
      { t: 'figure', fig: rsNorFigure, caption: 'Klopný obvod RS z dvoch členov NOR. Spätná väzba (prekrížené vodiče) udržiava stav aj po uvoľnení vstupov.' },
      {
        t: 'table',
        head: ['`$S`', '`$R`', '`$Q_{n+1}`', 'Význam'],
        rows: [
          ['0', '0', '`$Q_{n}`', 'pamätá si predchádzajúci stav'],
          ['1', '0', '1', 'nastavenie (set)'],
          ['0', '1', '0', 'nulovanie (reset)'],
          ['1', '1', '—', 'zakázaný stav: `$Q` = `@o{$Q}` = 0, po uvoľnení neurčitý'],
        ],
      },
      { t: 'h', text: 'Klopný obvod D' },
      { t: 'p', text: 'Klopný obvod **D** (data) má dátový vstup D a hodinový (riadiaci) vstup C. **Hladinový** obvod D (angl. latch) je pri C = 1 „priehľadný“ – výstup sleduje vstup D – a pri C = 0 si pamätá posledný stav. **Hranový** klopný obvod D prevezme hodnotu D **iba v okamihu nábežnej hrany** hodín (prechodu C z 0 na 1); zmeny D medzi hranami sa neprejavia. Zakázaný stav nemá. Príklady: 74HC74 (2× hranový D s asynchrónnym nastavením a nulovaním), 74HC373 (8× hladinový), 74HC374 (8× hranový).' },
      { t: 'figure', fig: dTimingFigure, caption: 'Podfarbené sú úseky C = 1. Hladinový obvod (zelený) v nich sleduje D, hranový (oranžový) mení výstup iba pri nábežných hranách (čiarkované čiary). Krátky impulz na D medzi hranami neovplyvní ani jeden.' },
      { t: 'explore', build: flipFlopExplorer, caption: 'Vyber typ, nastav vstupy a stláčaj „Hodinový impulz“. Diagram ukazuje posledných osem taktov – výstup sa mení iba pri nábežnej hrane.' },
      { t: 'h', text: 'Klopné obvody JK a T' },
      {
        t: 'table',
        head: ['`$J`', '`$K`', '`$Q_{n+1}`', 'Význam'],
        rows: [
          ['0', '0', '`$Q_{n}`', 'pamätá (stav sa nemení)'],
          ['0', '1', '0', 'nulovanie'],
          ['1', '0', '1', 'nastavenie'],
          ['1', '1', '`@o{$Q_{n}}`', 'preklopenie do opačného stavu'],
        ],
      },
      { t: 'p', text: 'Klopný obvod **JK** je hranový a nemá zakázaný stav: pri J = K = 1 sa výstup s každou hodinovou hranou **preklopí**. Ak J a K trvalo spojíš do log. 1, vznikne klopný obvod **T** (toggle, preklápač), ktorý mení stav pri každom impulze – na výstupe má preto **polovičnú frekvenciu** hodín. Preklápač T vznikne aj z obvodu D, keď jeho vstup spojíš s výstupom `@o{$Q}`. Príkladom JK je 74HC112 (2× JK, reaguje na dobežnú hranu).' },
      {
        t: 'formula',
        tex: ['$Q_{n+1} = $D', '$Q_{n+1} = $J · @o{$Q_{n}} + @o{$K} · $Q_{n}', '$Q_{n+1} = $T ⊕ $Q_{n}'],
        legend: [['$Q_{n}', 'stav výstupu pred hodinovou hranou', '—'], ['$Q_{n+1}', 'stav výstupu po hrane', '—'], ['$D, $J, $K, $T', 'hodnoty vstupov v okamihu hrany', '—']],
      },
      {
        t: 'example',
        title: 'Priebeh výstupu klopného obvodu JK',
        given: ['začiatočný stav `$Q` = 0', '`$J$K` pri piatich hranách: 10, 00, 11, 11, 01'],
        steps: [
          '1. hrana: `$J` = 1, `$K` = 0 → nastavenie, `$Q` = 1',
          '2. hrana: `$J` = `$K` = 0 → pamätá, `$Q` = 1',
          '3. hrana: `$J` = `$K` = 1 → preklopenie, `$Q` = 0',
          '4. hrana: `$J` = `$K` = 1 → preklopenie, `$Q` = 1',
          '5. hrana: `$J` = 0, `$K` = 1 → nulovanie, `$Q` = 0',
        ],
        result: '`$Q` po hranách: 1, 1, 0, 1, 0',
      },
      { t: 'h', text: 'Čítače a deličky frekvencie' },
      { t: 'p', text: '**Asynchrónny binárny čítač** je reťaz preklápačov T: hodinový signál vedie iba na prvý, každý ďalší je riadený výstupom predchádzajúceho. Každý stupeň delí frekvenciu dvoma, takže `$n` preklápačov počíta od 0 do `2^{$n} − 1` (čítač modulo `2^{$n}`). Nevýhodou je, že oneskorenia stupňov sa sčítavajú a pri prechode napríklad zo 0111 na 1000 vznikajú krátke chybné medzistavy. **Synchrónny čítač** má hodiny privedené na všetky klopné obvody naraz, a tak tento problém nemá.' },
      { t: 'figure', fig: counterFigure, caption: 'Asynchrónny trojbitový čítač. Preklápače reagujú na dobežnú (zostupnú) hranu – vyznačuje ju krúžok pred hodinovým vstupom – a vstupy T sú trvalo v log. 1.' },
      { t: 'figure', fig: counterTimingFigure, caption: 'Čísla nad diagramom sú stavy čítača `$Q_{2}$Q_{1}$Q_{0}` v desiatkovej sústave. Po stave 7 (111) nasleduje 0. Výstup `$Q_{2}` má osminovú frekvenciu hodín.' },
      {
        t: 'formula',
        tex: ['$f_{n} = @f{$f}{2^{$n}}', '$N = 2^{$n}'],
        legend: [['$f', 'frekvencia hodinového signálu', 'Hz'], ['$f_{n}', 'frekvencia na výstupe n-tého preklápača', 'Hz'], ['$n', 'počet preklápačov', '—'], ['$N', 'modul čítača (počet stavov)', '—']],
      },
      {
        t: 'example',
        title: 'Delička frekvencie pre hodinky',
        given: ['kryštálový oscilátor `$f` = 32 768 Hz', 'požadovaný výstup 1 Hz (sekundové impulzy)'],
        steps: [
          'Potrebný deliaci pomer: `$N = @f{32 768}{1}` = 32 768',
          '32 768 = `2^{15}`, preto `$n` = 15 preklápačov',
          'Napríklad po 4 stupňoch je `$f_{4} = @f{32 768}{2^{4}}` = 2 048 Hz',
        ],
        result: '15 preklápačov za sebou – preto majú hodinové kryštály práve 32 768 Hz',
      },
      { t: 'p', text: '**Čítač modulo N** počíta od 0 do `$N − 1` a potom sa vráti na 0. Potrebuje `$n` klopných obvodov, kde `2^{$n} ≥ $N`. **Dekadický čítač** (modulo 10) má štyri klopné obvody: keď dosiahne stav 1010 (10), člen NAND zo signálov `$Q_{3}` a `$Q_{1}` ho okamžite vynuluje. Výstupom je kód BCD – napríklad obvod 74HC390 obsahuje dva dekadické čítače. Čítače sa používajú v hodinách, v meračoch frekvencie a ako deličky frekvencie.' },
      { t: 'h', text: 'Posuvné registre' },
      { t: 'p', text: '**Register** je skupina klopných obvodov D so spoločnými hodinami – uchová celé slovo (napr. bajt). V **posuvnom registri** je výstup každého klopného obvodu vstupom nasledujúceho, takže každý hodinový impulz posunie údaj o jedno miesto. Register so sériovým vstupom a paralelnými výstupmi (SIPO, napr. 74HC595) po `$n` taktoch prevedie sériový údaj na paralelný – takto sa tromi vývodmi mikrokontroléra ovláda osem LED. Opačný register (PISO, napr. 74HC165) načíta naraz osem tlačidiel a pošle ich po jednom vodiči.' },
      { t: 'figure', fig: shiftRegisterFigure, caption: 'Štvorbitový posuvný register SIPO: sériový vstup `$D_{S}`, spoločný hodinový signál CLK a paralelné výstupy `$Q_{0}` až `$Q_{3}`.' },
      {
        t: 'table',
        head: ['Takt', '`$D_{S}`', '`$Q_{0}`', '`$Q_{1}`', '`$Q_{2}`', '`$Q_{3}`'],
        rows: [
          ['na začiatku', '—', '0', '0', '0', '0'],
          ['1.', '1', '1', '0', '0', '0'],
          ['2.', '0', '0', '1', '0', '0'],
          ['3.', '1', '1', '0', '1', '0'],
          ['4.', '1', '1', '1', '0', '1'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Klopné obvody sú základom pamätí, registrov, čítačov a deličiek frekvencie. Klopný obvod RS sa používa aj na **ošetrenie zákmitov tlačidla** (debounce): kontakt pri stlačení niekoľkokrát odskočí a čítač by bez ošetrenia napočítal viac impulzov. Prepínacie tlačidlo pripojené na vstupy S a R preklopí obvod pri prvom dotyku a ďalšie odskoky už stav nezmenia.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čím sa sekvenčný obvod líši od kombinačného?',
      options: ['jeho výstup závisí aj od predchádzajúceho stavu – má pamäť', 'nemá žiadne vstupy', 'skladá sa iba z členov NAND', 'jeho výstup závisí iba od okamžitých hodnôt vstupov'],
      explanation: 'Sekvenčný obvod obsahuje klopné obvody (spätné väzby), ktoré si pamätajú stav. Posledná možnosť opisuje kombinačný obvod.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá kombinácia vstupov je zakázaná pri klopnom obvode RS zostavenom z členov NOR?',
      options: ['S = 1, R = 1', 'S = 0, R = 0', 'S = 1, R = 0', 'S = 0, R = 1'],
      explanation: 'Pri S = R = 1 sú oba výstupy 0, čo odporuje tomu, že `@o{$Q}` má byť negáciou `$Q`. Po súčasnom uvoľnení vstupov sa obvod preklopí náhodne. Kombinácia 00 znamená pamätanie stavu.',
    },
    {
      lessonId: ID,
      prompt: 'Kedy prevezme hranový klopný obvod D hodnotu zo vstupu D?',
      options: ['v okamihu aktívnej (napr. nábežnej) hrany hodinového signálu', 'počas celého času, keď je C = 1', 'kedykoľvek sa zmení D', 'iba po zapnutí napájania'],
      explanation: 'Hranový obvod reaguje iba na prechod hodinového signálu, napr. z 0 na 1. Sledovanie D počas C = 1 je vlastnosť hladinového obvodu (latch).',
    },
    {
      lessonId: ID,
      prompt: 'Čo urobí klopný obvod JK pri J = K = 1 a hodinovom impulze?',
      options: ['preklopí výstup do opačného stavu', 'vynuluje výstup', 'nastaví výstup na 1', 'dostane sa do zakázaného stavu'],
      explanation: 'Na rozdiel od RS nemá JK zakázanú kombináciu – pri J = K = 1 sa preklopí: `$Q_{n+1} = @o{$Q_{n}}`. Tak vzniká preklápač T.',
    },
    {
      lessonId: ID,
      prompt: 'Akú frekvenciu má výstup klopného obvodu T s trvalo T = 1, ak naň privádzaš hodiny 10 kHz?',
      options: ['5 kHz', '10 kHz', '20 kHz', '2,5 kHz'],
      explanation: 'Preklápač mení stav pri každej aktívnej hrane, celá perióda výstupu trvá dve periódy hodín. Frekvencia sa vydelí dvoma: 10 kHz / 2 = 5 kHz.',
    },
    {
      lessonId: ID,
      prompt: 'Koľko klopných obvodov potrebuje dekadický čítač (modulo 10)?',
      options: ['4', '10', '3', '5'],
      explanation: 'Tri klopné obvody dajú iba 8 stavov, štyri 16 stavov. Dekadický čítač preto potrebuje 4 klopné obvody a stavy 10 až 15 preskočí nulovaním.',
    },
    {
      lessonId: ID,
      prompt: 'Na čo sa používa posuvný register 74HC595 pripojený k mikrokontroléru?',
      options: ['prevádza sériový údaj na paralelný – niekoľkými vývodmi ovládaš osem výstupov', 'meria frekvenciu vstupného signálu', 'prevádza kód BCD na kód 7-segmentového displeja', 'zosilňuje analógový signál'],
      explanation: 'Mikrokontrolér pošle osem bitov po jednom (dáta a hodiny) a register ich zobrazí naraz na ôsmich paralelných výstupoch. Reťazením registrov sa dá ovládať aj viac výstupov.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo treba tlačidlo pripojené na vstup čítača ošetriť proti zákmitom?',
      options: ['kontakt pri stlačení niekoľkokrát odskočí a čítač by napočítal viac impulzov', 'tlačidlo by sa inak prehrievalo', 'čítač by začal počítať nadol', 'bez ošetrenia by sa zmenila frekvencia hodín'],
      explanation: 'Mechanický kontakt počas niekoľkých milisekúnd viackrát zopne a rozopne. Rýchly čítač každé zopnutie započíta. Pomôže klopný obvod RS s prepínacím tlačidlom, člen RC so Schmittovým obvodom alebo programové ošetrenie.',
    },
  ],
  generators,
};

export default mod;
