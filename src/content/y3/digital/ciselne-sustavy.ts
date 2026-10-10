import type { LessonModule } from '../../module';
import { int, pick, type Rng } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { numeric, type Generator } from '../../../practice/helpers';
import { byteExplorer, byteWeightsFigure, divisionFigure, groupingFigure } from '../../../ui/fig-digital';
import { choice } from '../util';

const ID = 'ciselne-sustavy';

/** Celé číslo so slovenským oddeľovačom tisícov. */
const num = (v: number) => fmt(v, 12);
/** Bity zoskupené sprava po štyroch: 1011 0101. */
const grp = (bits: string) => bits.replace(/\B(?=([01]{4})+$)/g, ' ');
const bin = (v: number, width = 0) => grp(v.toString(2).padStart(width, '0'));
const hex = (v: number) => v.toString(16).toUpperCase();
/** Tolerancia, pri ktorej sa uzná iba presné celé číslo (nad 999 stačí zaokrúhlenie na 3 platné číslice). */
const exact = (v: number) => (v < 1000 ? Math.min(0.1, 0.45 / v) : 0.005);
/** Pozície jednotkových bitov od najvyššieho. */
const ones = (v: number) => [...v.toString(2)].map((c, i, a) => (c === '1' ? a.length - 1 - i : -1)).filter((i) => i >= 0);
const bcd = (v: number) => String(v).split('').map((d) => Number(d).toString(2).padStart(4, '0')).join(' ');

/** Správna možnosť a tri rôzne nesprávne (doplní náhodnými, ak kandidáti nestačia). */
function four(correct: string, candidates: string[], fill: () => string): [string, string, string, string] {
  const out = [correct];
  for (const c of candidates) if (out.length < 4 && !out.includes(c)) out.push(c);
  for (let guard = 0; out.length < 4 && guard < 200; guard++) {
    const c = fill();
    if (!out.includes(c)) out.push(c);
  }
  return out as [string, string, string, string];
}

const flipBit = (rng: Rng, v: number, width: number) => v ^ (1 << int(rng, 0, width - 1));

const generators: Generator[] = [
  (rng) => {
    const v = int(rng, 37, 255);
    const p = ones(v);
    return numeric(ID, `Preveď dvojkové číslo \`${bin(v)}_{2}\` do desiatkovej sústavy.`, v, '', [
      `Sčítaj váhy bitov, ktoré majú hodnotu 1: \`${p.map((i) => `2^{${i}}`).join(' + ')}\``,
      `${p.map((i) => num(2 ** i)).join(' + ')} = **${v}**`,
    ], { fixedUnit: true, tolerance: exact(v) });
  },
  (rng) => {
    const v = rng() < 0.7 ? int(rng, 26, 255) : int(rng, 256, 999);
    const h = hex(v);
    const k = h.length;
    const d = h.split('').map((c) => parseInt(c, 16));
    const letters = /[A-F]/.test(h) ? ' (A = 10, B = 11, C = 12, D = 13, E = 14, F = 15)' : '';
    return numeric(ID, `Preveď šestnástkové číslo \`${h}_{16}\` do desiatkovej sústavy.`, v, '', [
      `Rozvoj podľa mocnín 16${letters}:`,
      `\`${h}_{16} = ${d.map((x, i) => `${x} · 16^{${k - 1 - i}}`).join(' + ')}\``,
      `= ${d.map((x, i) => num(x * 16 ** (k - 1 - i))).join(' + ')} = **${v}**`,
    ], { fixedUnit: true, tolerance: exact(v) });
  },
  (rng) => {
    const v = int(rng, 20, 255);
    const bits = v.toString(2);
    const w = bits.length;
    const p = ones(v);
    const reversed = grp([...bits].reverse().join(''));
    const options = four(bin(v), [reversed, bin(v + 1), bin(v - 1), bin(flipBit(rng, v, w - 1))], () => bin(flipBit(rng, v, w)));
    return choice(ID, `Ako sa zapíše desiatkové číslo ${v} v dvojkovej sústave?`, options,
      `Rozlož číslo na mocniny dvoch: ${v} = ${p.map((i) => num(2 ** i)).join(' + ')}, preto má jednotky na pozíciách ${p.join(', ')} → \`${bin(v)}_{2}\`. Pri delení dvoma čítaj zvyšky zdola nahor – posledný zvyšok je MSB.`,
      rng);
  },
  (rng) => {
    const v = pick(rng, [5, 9, 12, 20, 31, 32, 50, 63, 64, 100, 127, 128, 200, 255, 256, 300, 500, 999, 1000, 1023, 1024, 4095, 5000, 65535]);
    const k = v.toString(2).length;
    return numeric(ID, `Koľko bitov potrebuješ najmenej na zápis čísla ${num(v)} v dvojkovej sústave (bez znamienka)?`, k, '', [
      'Hľadáš najmenšie `$n`, pre ktoré platí `$N ≤ 2^{$n} − 1`, teda `2^{$n−1} ≤ $N < 2^{$n}`.',
      `\`2^{${k - 1}}\` = ${num(2 ** (k - 1))} ≤ ${num(v)} < \`2^{${k}}\` = ${num(2 ** k)}`,
      `Potrebuješ **${k} bitov**.`,
    ], { fixedUnit: true, tolerance: exact(k) });
  },
  (rng) => {
    const nb = int(rng, 3, 9);
    if (rng() < 0.5) {
      const K = 2 ** nb;
      return numeric(ID, `Koľko rôznych kombinácií (stavov) možno zapísať ${nb} bitmi?`, K, '', [
        'Každý bit má 2 stavy, kombinácie sa násobia: `$K = 2^{$n}`.',
        `\`$K = 2^{${nb}}\` = **${K}**`,
      ], { fixedUnit: true, tolerance: exact(K) });
    }
    const M = 2 ** nb - 1;
    return numeric(ID, `Aké najväčšie celé číslo bez znamienka zapíšeš ${nb} bitmi?`, M, '', [
      `\`$N_{max} = 2^{$n} − 1 = 2^{${nb}} − 1\` = **${M}**`,
      `Všetky bity sú jednotky: \`${bin(M)}_{2}\`.`,
    ], { fixedUnit: true, tolerance: exact(M) });
  },
  (rng) => {
    const a = int(rng, 20, 127);
    const b = int(rng, 20, 127);
    const sum = a + b;
    const options = four(bin(sum, 8), [bin(a ^ b, 8), bin(a | b, 8), bin(flipBit(rng, sum, 8), 8)], () => bin(flipBit(rng, sum, 8), 8));
    return choice(ID, `Sčítaj v dvojkovej sústave: \`${bin(a, 8)}_{2} + ${bin(b, 8)}_{2}\``, options,
      `Sčítavaj od najnižšieho bitu: 1 + 1 = 10, teda zapíš 0 a prenes 1 do vyššieho rádu. Kontrola v desiatkovej sústave: ${a} + ${b} = ${sum} = \`${bin(sum, 8)}_{2}\`. Možnosť bez prenosov by zodpovedala funkcii XOR, nie súčtu.`,
      rng);
  },
  (rng) => {
    const v = rng() < 0.6 ? int(rng, 10, 99) : int(rng, 100, 999);
    const digits = String(v).split('');
    if (rng() < 0.5) {
      const wrongDigit = digits.map((d, i) => (i === digits.length - 1 ? ((Number(d) + 1) % 10).toString(2).padStart(4, '0') : Number(d).toString(2).padStart(4, '0'))).join(' ');
      const options = four(bcd(v), [bin(v), bcd(Number([...digits].reverse().join('')) || v + 1), wrongDigit], () => bcd(int(rng, 10, 999)));
      return choice(ID, `Ako sa zapíše desiatkové číslo ${v} v kóde BCD 8421?`, options,
        `V kóde BCD sa každá desiatková číslica zapíše samostatne štyrmi bitmi: ${digits.map((d) => `${d} → ${Number(d).toString(2).padStart(4, '0')}`).join(', ')}. Zápis \`${bin(v)}\` je obyčajné dvojkové číslo, nie BCD.`,
        rng);
    }
    const asBinary = parseInt(bcd(v).replace(/ /g, ''), 2);
    const options = four(String(v), [String(asBinary), [...digits].reverse().join(''), String(v + 1)], () => String(int(rng, 10, 999)));
    return choice(ID, `Aké desiatkové číslo je v kóde BCD zapísané ako \`${bcd(v)}\`?`, options,
      `Každú štvoricu bitov prečítaj ako jednu desiatkovú číslicu: ${bcd(v).split(' ').map((g) => `${g} → ${parseInt(g, 2)}`).join(', ')}, spolu ${v}. Hodnota ${asBinary} by vznikla, keby sa celý zápis prečítal ako jedno dvojkové číslo.`,
      rng);
  },
  (rng) => {
    const v = int(rng, 17, 255);
    const hi = v >> 4;
    const lo = v & 15;
    const swapped = (lo << 4) | hi;
    const off = ((hi + 1) % 16 << 4) | lo;
    const rev = grp([...v.toString(2).padStart(8, '0')].reverse().join(''));
    const options = four(bin(v, 8), [bin(swapped, 8), bin(off, 8), rev], () => bin(flipBit(rng, v, 8), 8));
    return choice(ID, `Zapíš šestnástkové číslo \`${hex(v).padStart(2, '0')}_{16}\` v dvojkovej sústave.`, options,
      `Každú šestnástkovú číslicu nahraď štyrmi bitmi: ${hex(hi)} → ${hi.toString(2).padStart(4, '0')}, ${hex(lo)} → ${lo.toString(2).padStart(4, '0')}. Poradie skupín sa nemení – vyššia číslica je vľavo.`,
      rng);
  },
  (rng) => {
    const x = int(rng, 3, 120);
    const options = four(bin(256 - x, 8), [bin(255 - x, 8), bin(128 + x, 8), bin(x, 8)], () => bin(int(rng, 128, 255), 8));
    return choice(ID, `Ako sa zapíše číslo −${x} v 8-bitovom dvojkovom doplnku?`, options,
      `Zapíš ${x} = \`${bin(x, 8)}\`, invertuj všetky bity (\`${bin(255 - x, 8)}\`) a pripočítaj 1: \`${bin(256 - x, 8)}\`. Kontrola: 256 − ${x} = ${256 - x}. Samotná inverzia je jednotkový doplnok, nie dvojkový.`,
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'digital',
    title: 'Číselné sústavy a kódy',
    summary: 'Dvojková, osmičková a šestnástková sústava, prevody, bit a bajt, dvojkové sčítanie a doplnok, kódy BCD, Grayov kód a ASCII.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Číslicové obvody rozlišujú iba dva stavy – napätie nízke (L) a vysoké (H), ktorým priradíme číslice 0 a 1. Preto čísla, znaky aj povely ukladajú a spracúvajú v **dvojkovej (binárnej) sústave**. Dlhé rady núl a jednotiek sa však ťažko čítajú, a tak ich ľudia zapisujú skrátene v šestnástkovej sústave.' },
      { t: 'h', text: 'Pozičné číselné sústavy' },
      { t: 'p', text: 'V pozičnej sústave so základom `$z` závisí hodnota číslice od jej pozície. Pozícia `$i` (počítaná sprava od nuly) má váhu `$z^{$i}`, číslice sú 0 až `$z − 1`. Desiatkové číslo 347 znamená `3 · 10^{2} + 4 · 10^{1} + 7 · 10^{0}`. Základ sa píše ako index: `1101_{2}`, `D6_{16}`; v programoch sa šestnástkové čísla označujú predponou 0x (0xD6).' },
      {
        t: 'formula',
        tex: '$N = $a_{$n−1} · $z^{$n−1} + … + $a_{1} · $z^{1} + $a_{0} · $z^{0}',
        legend: [['$N', 'hodnota čísla', '—'], ['$a_{$i}', 'číslica na pozícii i (0 až z − 1)', '—'], ['$z', 'základ sústavy (2, 8, 10, 16)', '—'], ['$n', 'počet číslic', '—']],
      },
      {
        t: 'table',
        head: ['Desiatková', 'Dvojková', 'Osmičková', 'Šestnástková'],
        rows: Array.from({ length: 16 }, (_, v) => [String(v), v.toString(2).padStart(4, '0'), v.toString(8), hex(v)]),
      },
      { t: 'h', text: 'Bit, bajt a rozsah čísel' },
      { t: 'p', text: 'Jedna dvojková číslica je **bit** (b). Štyri bity tvoria **tetrádu** (jednu šestnástkovú číslicu), osem bitov **bajt** (B). Bit s najväčšou váhou je **MSB** (most significant bit), s najmenšou váhou **LSB**. Pomocou `$n` bitov zapíšeš `2^{$n}` rôznych kombinácií – celé čísla bez znamienka od 0 do `2^{$n} − 1`. Bajt teda pokryje 0 až 255, 16 bitov 0 až 65 535.' },
      {
        t: 'formula',
        tex: ['$K = 2^{$n}', '$N_{max} = 2^{$n} − 1'],
        legend: [['$K', 'počet rôznych kombinácií (stavov)', '—'], ['$n', 'počet bitov', '—'], ['$N_{max}', 'najväčšie číslo bez znamienka', '—']],
      },
      { t: 'figure', fig: () => byteWeightsFigure(181), caption: 'Hodnota bajtu je súčet váh tých bitov, ktoré majú hodnotu 1: `1011 0101_{2}` = 181.' },
      { t: 'explore', build: byteExplorer, caption: 'Klikaj na bity alebo posúvaj hodnotu. Sleduj, že šestnástková číslica sa zmení vždy len v tej štvorici bitov, ktorú meníš.' },
      { t: 'h', text: 'Prevody medzi sústavami' },
      { t: 'p', text: 'Z desiatkovej do dvojkovej sústavy prevádzaš **postupným delením dvoma**. Zapisuješ zvyšky (0 alebo 1), kým podiel neklesne na nulu. Prvý zvyšok je LSB, posledný MSB – výsledok preto čítaš **zdola nahor**. Rovnako funguje prevod do ľubovoľnej sústavy, napríklad delenie šestnástimi.' },
      { t: 'figure', fig: () => divisionFigure(45), caption: 'Prevod čísla 45: zvyšky čítané zdola nahor dávajú `101101_{2}`. Kontrola: 32 + 8 + 4 + 1 = 45.' },
      { t: 'p', text: 'Do desiatkovej sústavy prevádzaš **rozvojom podľa mocnín** – sčítaš súčiny číslic a váh. Pri dlhších číslach je rýchlejšia **Hornerova schéma**: začni najvyššou číslicou, výsledok vždy vynásob základom a pripočítaj ďalšiu číslicu.' },
      {
        t: 'example',
        title: 'Prevod do desiatkovej sústavy',
        given: ['`1011 0110_{2}`', '`2F_{16}`'],
        steps: [
          'Rozvoj: `1 · 2^{7} + 0 · 2^{6} + 1 · 2^{5} + 1 · 2^{4} + 0 · 2^{3} + 1 · 2^{2} + 1 · 2^{1} + 0 · 2^{0}` = 128 + 32 + 16 + 4 + 2 = 182',
          'Hornerova schéma (číslice 1, 0, 1, 1, 0, 1, 1, 0): 1 → 2 → 5 → 11 → 22 → 45 → 91 → 182',
          '`2F_{16} = 2 · 16^{1} + 15 · 16^{0}` = 32 + 15 = 47 (F = 15)',
        ],
        result: '`1011 0110_{2}` = **182**, `2F_{16}` = **47**',
      },
      { t: 'p', text: 'Medzi dvojkovou a šestnástkovou sústavou je prevod najjednoduchší: `16 = 2^{4}`, takže bity rozdelíš **sprava po štyroch** a každú štvoricu nahradíš jednou šestnástkovou číslicou. Pre osmičkovú sústavu (`8 = 2^{3}`) delíš bity **po troch**. Chýbajúce bity vľavo doplníš nulami.' },
      { t: 'figure', fig: () => groupingFigure(214), caption: 'To isté číslo 214: po štyroch bitoch `D6_{16}`, po troch bitoch `326_{8}`. Malé čísla nad bitmi sú váhy v rámci skupiny.' },
      {
        t: 'example',
        title: 'Prevod čísla 156 do dvojkovej a šestnástkovej sústavy',
        given: ['`$N` = 156'],
        steps: [
          '156 : 2 = 78 zv. 0, 78 : 2 = 39 zv. 0, 39 : 2 = 19 zv. 1, 19 : 2 = 9 zv. 1',
          '9 : 2 = 4 zv. 1, 4 : 2 = 2 zv. 0, 2 : 2 = 1 zv. 0, 1 : 2 = 0 zv. 1',
          'Zvyšky zdola nahor: `1001 1100_{2}`',
          'Štvorice: 1001 → 9, 1100 → C, teda `9C_{16}`. Kontrola: 9 · 16 + 12 = 156',
        ],
        result: '156 = `1001 1100_{2}` = `9C_{16}`',
      },
      { t: 'h', text: 'Sčítanie a záporné čísla' },
      { t: 'p', text: 'Dvojkové čísla sa sčítavajú pod sebou ako desiatkové, od najnižšieho bitu: 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10 (zapíš 0, **prenes 1**), 1 + 1 + 1 = 11. **Záporné čísla** sa ukladajú v **dvojkovom doplnku**: MSB je znamienkový bit (1 = záporné) a číslo `−$x` vznikne tak, že v zápise `$x` invertuješ všetky bity a pripočítaš 1. Rozsah 8-bitového čísla so znamienkom je −128 až 127, všeobecne `−2^{$n−1}` až `2^{$n−1} − 1`. Výhoda: sčítačka nepotrebuje osobitné odčítanie, `$a − $b = $a + (−$b)`.' },
      {
        t: 'example',
        title: 'Sčítanie a dvojkový doplnok',
        given: ['`0101 1011_{2}` (91) a `0011 0110_{2}` (54)', 'číslo −45 v 8 bitoch'],
        steps: [
          'Sčítanie s prenosmi: `0101 1011 + 0011 0110 = 1001 0001_{2}`, kontrola 91 + 54 = 145 = 128 + 16 + 1',
          '45 = `0010 1101_{2}`, inverzia: `1101 0010`',
          'Pripočítaj 1: `1101 0011` = 211 = 256 − 45',
        ],
        result: 'súčet `1001 0001_{2}` = 145, −45 = `1101 0011_{2}`',
      },
      { t: 'h', text: 'Kódy BCD, Grayov kód a ASCII' },
      { t: 'p', text: 'V kóde **BCD 8421** sa každá desiatková číslica zapíše samostatne štyrmi bitmi: 59 = `0101 1001`. Kombinácie 1010 až 1111 sa nepoužívajú (pseudotetrády). BCD používajú displeje, hodiny reálneho času a meracie prístroje, lebo sa ľahko zobrazuje. V **Grayovom kóde** sa dve susedné hodnoty líšia iba v jednom bite, preto sa používa v snímačoch polohy (absolútnych enkodéroch) – pri prechode medzi polohami nevznikne chybný medzistav. Kód **ASCII** priraďuje 128 znakom 7-bitové čísla: medzera 32, číslica 0 je 48 (0x30), písmeno A je 65 (0x41), a je 97 (0x61).' },
      {
        t: 'table',
        head: ['Desiatkovo', 'Dvojkovo', 'Grayov kód', 'BCD'],
        rows: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15].map((v) => [String(v), v.toString(2).padStart(4, '0'), (v ^ (v >> 1)).toString(2).padStart(4, '0'), bcd(v)]),
      },
      { t: 'note', kind: 'remember', text: 'Ten istý rad bitov môže znamenať rôzne veci: `1001 0001` je dvojkovo 145, v BCD 91 a ako 8-bitové číslo so znamienkom −111. Význam určuje kód, ktorý sa dohodne.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Koľko rôznych hodnôt možno zapísať jedným bajtom?',
      options: ['256 (0 až 255)', '255 (1 až 255)', '128 (0 až 127)', '8 (0 až 7)'],
      explanation: 'Bajt má 8 bitov, teda `2^{8}` = 256 kombinácií. Bez znamienka sú to čísla 0 až 255.',
    },
    {
      lessonId: ID,
      prompt: 'Aký rozsah má 8-bitové celé číslo so znamienkom v dvojkovom doplnku?',
      options: ['−128 až 127', '−127 až 127', '0 až 255', '−255 až 255'],
      explanation: 'Polovica z 256 kombinácií je záporná (MSB = 1): −128 až −1, druhá polovica 0 až 127. Nula je iba jedna, preto je záporných čísel o jedno viac.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá štvorica bitov nie je platná v kóde BCD 8421?',
      options: ['1100', '1001', '0110', '0000'],
      explanation: 'V BCD sa používajú iba kombinácie 0000 až 1001 (číslice 0 až 9). Kombinácie 1010 až 1111 (10 až 15) sú nepoužité pseudotetrády.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa v číslicovej technike často používa šestnástková sústava?',
      options: ['jedna šestnástková číslica zodpovedá presne štyrom bitom, zápis je kratší a ľahko sa prevádza', 'obvody v nej počítajú rýchlejšie ako v dvojkovej sústave', 'iba v nej sa dajú zapísať záporné čísla', 'šestnástkové čísla zaberajú v pamäti menej bitov'],
      explanation: 'Obvody pracujú stále s bitmi. Šestnástková sústava je len prehľadný zápis: bajt sú dve číslice (napr. 0xD6 = 1101 0110) a prevod sa robí po štvoriciach bez počítania.',
    },
    {
      lessonId: ID,
      prompt: 'Ako čítaš zvyšky pri prevode desiatkového čísla do dvojkovej sústavy delením dvoma?',
      options: ['od posledného k prvému – posledný zvyšok je MSB', 'od prvého k poslednému – prvý zvyšok je MSB', 'nečítajú sa zvyšky, ale podiely', 'iba párne zvyšky, nepárne sa vynechajú'],
      explanation: 'Prvý zvyšok udáva, či je číslo párne – to je bit s váhou 1 (LSB). Každé ďalšie delenie zistí bit s dvojnásobnou váhou, preto výsledok čítaš zdola nahor.',
    },
    {
      lessonId: ID,
      prompt: 'Čím je výnimočný Grayov kód?',
      options: ['dve susedné hodnoty sa líšia iba v jednom bite', 'každá desiatková číslica má vlastnú štvoricu bitov', 'umožňuje zapísať záporné čísla', 'je to 7-bitový kód znakov'],
      explanation: 'Pri prechode na susednú hodnotu sa mení jediný bit, takže nevzniká chybný medzistav. Preto sa používa v snímačoch polohy a v Karnaughových mapách. Druhá možnosť opisuje BCD, posledná ASCII.',
    },
    {
      lessonId: ID,
      prompt: 'Podľa čoho spoznáš, že číslo zapísané v dvojkovom doplnku je záporné?',
      options: ['najvyšší bit (MSB) je 1', 'najnižší bit (LSB) je 1', 'číslo má nepárny počet jednotiek', 'za číslom je písmeno h'],
      explanation: 'MSB je znamienkový bit. Napríklad `1101 0011` je v 8 bitoch −45, kým `0010 1101` je +45. Podľa LSB sa rozlišujú párne a nepárne čísla.',
    },
    {
      lessonId: ID,
      prompt: 'Aký kód má v tabuľke ASCII veľké písmeno A?',
      options: ['65 (0x41)', '1 (0x01)', '97 (0x61)', '48 (0x30)'],
      explanation: 'Veľké písmená začínajú kódom 65 (A), malé kódom 97 (a), číslice kódom 48 (znak 0). Malé a veľké písmeno sa líšia iba bitom s váhou 32.',
    },
  ],
  generators,
};

export default mod;
