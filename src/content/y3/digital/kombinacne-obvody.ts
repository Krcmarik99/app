import type { LessonModule } from '../../module';
import { int, pick, shuffle, type Rng } from '../../../lib/random';
import { numeric, type Generator } from '../../../practice/helpers';
import { DIGIT_SEGMENTS, halfAdderFigure, kmapFigure, muxFigure, sevenSegExplorer, sevenSegFigure } from '../../../ui/fig-digital';
import { choice } from '../util';

const ID = 'kombinacne-obvody';

function four(correct: string, candidates: string[], fill: () => string): [string, string, string, string] {
  const out = [correct];
  for (const c of candidates) if (out.length < 4 && !out.includes(c)) out.push(c);
  for (let guard = 0; out.length < 4 && guard < 200; guard++) {
    const c = fill();
    if (!out.includes(c)) out.push(c);
  }
  return out as [string, string, string, string];
}

const exact = (v: number) => Math.min(0.1, 0.45 / v);
const segList = (d: number) => DIGIT_SEGMENTS[d].split('').join(', ');

// ---------------------------------------------------------------- minimalizácia funkcie troch premenných

const VARS = ['A', 'B', 'C'];
/** Kocka (skupina) ako reťazec pre A, B, C: '1', '0' alebo '-' (premenná sa v skupine mení). */
const CUBES: string[] = [];
for (const a of '01-') for (const b of '01-') for (const c of '01-') CUBES.push(a + b + c);
const cubeMask = (cube: string) => {
  let mask = 0;
  for (let m = 0; m < 8; m++) {
    if ([...cube].every((ch, i) => ch === '-' || Number(ch) === ((m >> (2 - i)) & 1))) mask |= 1 << m;
  }
  return mask;
};
const lits = (cube: string) => [...cube].filter((ch) => ch !== '-').length;
const bits = (mask: number) => [0, 1, 2, 3, 4, 5, 6, 7].filter((m) => mask & (1 << m));
const sopMask = (cubes: string[]) => cubes.reduce((m, c) => m | cubeMask(c), 0);
const term = (cube: string) => [...cube].map((ch, i) => (ch === '1' ? `$${VARS[i]}` : ch === '0' ? `@o{$${VARS[i]}}` : '')).filter(Boolean).join(' · ') || '1';
const sop = (cubes: string[]) => `$Y = ${cubes.map(term).join(' + ')}`;

/** Jednoznačné minimálne pokrytie jednotiek prostými implikantmi, inak null. */
function minimalCover(mask: number): string[] | null {
  const imps = CUBES.filter((c) => (cubeMask(c) & ~mask) === 0);
  const primes = imps.filter((c) => !imps.some((d) => d !== c && (cubeMask(c) & ~cubeMask(d)) === 0 && cubeMask(d) !== cubeMask(c)));
  let best = Infinity;
  let found: string[][] = [];
  for (let sel = 1; sel < 1 << primes.length; sel++) {
    const chosen = primes.filter((_, i) => sel & (1 << i));
    if (sopMask(chosen) !== mask) continue;
    const cost = chosen.length * 100 + chosen.reduce((s, c) => s + lits(c), 0);
    if (cost < best) {
      best = cost;
      found = [chosen];
    } else if (cost === best) found.push(chosen);
  }
  return found.length === 1 ? found[0] : null;
}

let pool: { mask: number; cover: string[] }[] | null = null;
function kmapPool() {
  if (!pool) {
    pool = [];
    for (let mask = 1; mask < 255; mask++) {
      const n1 = bits(mask).length;
      if (n1 < 2 || n1 > 6) continue;
      const cover = minimalCover(mask);
      if (cover && cover.length <= 3 && cover.every((c) => lits(c) <= 2 && lits(c) >= 1)) pool.push({ mask, cover });
    }
  }
  return pool;
}

/** Nesprávne tvary: zmenená negácia, vynechaný alebo pridaný člen či premenná. */
function wrongForms(rng: Rng, cover: string[], mask: number): string[] {
  const out: string[][] = [];
  cover.forEach((cube, ti) => {
    [...cube].forEach((ch, vi) => {
      const rep = (x: string) => cover.map((c, j) => (j === ti ? c.slice(0, vi) + x + c.slice(vi + 1) : c));
      if (ch === '1') out.push(rep('0'));
      if (ch === '0') out.push(rep('1'));
      if (ch !== '-' && lits(cube) > 1) out.push(rep('-'));
      if (ch === '-') out.push(rep('1'), rep('0'));
    });
    if (cover.length > 1) out.push(cover.filter((_, j) => j !== ti));
  });
  const seen = new Set<number>([mask]);
  const res: string[] = [];
  for (const f of shuffle(rng, out)) {
    const m = sopMask(f);
    if (seen.has(m) || m === 0) continue;
    seen.add(m);
    res.push(sop(f));
  }
  return res;
}

const describe = (cube: string) => {
  const cells = bits(cubeMask(cube));
  const fixed = [...cube].map((ch, i) => (ch === '-' ? '' : `\`$${VARS[i]}\` = ${ch}`)).filter(Boolean).join(', ');
  return `bunky ${cells.join(', ')} (stále ${fixed}) → \`${term(cube)}\``;
};

const generators: Generator[] = [
  (rng) => {
    const n = int(rng, 1, 6);
    const N = 2 ** n;
    if (rng() < 0.5) {
      return numeric(ID, `Koľko adresových (výberových) vstupov má multiplexor ${N} : 1?`, n, '', [
        `\`$n = log_{2} $N = log_{2} ${N}\` = **${n}**`,
        `Kontrola: \`2^{${n}}\` = ${N} kombinácií adresy, každá vyberie jeden vstup.`,
      ], { fixedUnit: true, tolerance: exact(n) });
    }
    return numeric(ID, `Multiplexor má ${n} adresových vstupov. Z koľkých dátových vstupov môže vyberať?`, N, '', [
      `\`$N = 2^{$n} = 2^{${n}}\` = **${N}**`,
    ], { fixedUnit: true, tolerance: exact(N) });
  },
  (rng) => {
    if (rng() < 0.6) {
      const n = int(rng, 2, 6);
      const N = 2 ** n;
      return numeric(ID, `Koľko výstupov má úplný dekodér (1 z N) s ${n} adresovými vstupmi?`, N, '', [
        `Každá kombinácia vstupov aktivuje jeden výstup: \`$N = 2^{$n} = 2^{${n}}\` = **${N}**`,
      ], { fixedUnit: true, tolerance: exact(N) });
    }
    const N = pick(rng, [3, 4, 6, 8, 10, 12, 16, 20, 32, 50, 64]);
    const n = Math.ceil(Math.log2(N));
    return numeric(ID, `Dekodér má vyberať jeden z ${N} výstupov (zariadení). Koľko adresových vstupov potrebuje najmenej?`, n, '', [
      'Potrebuješ najmenšie `$n`, pre ktoré `2^{$n} ≥ $N`.',
      `\`2^{${n - 1}}\` = ${2 ** (n - 1)} < ${N} ≤ \`2^{${n}}\` = ${2 ** n}, teda **${n}** ${n >= 5 ? 'vstupov' : 'vstupy'}`,
    ], { fixedUnit: true, tolerance: exact(n) });
  },
  (rng) => {
    const full = rng() < 0.65;
    const a = int(rng, 0, 1);
    const b = int(rng, 0, 1);
    const ci = full ? int(rng, 0, 1) : 0;
    const sum = a + b + ci;
    const S = sum & 1;
    const C = sum >> 1;
    const cName = full ? '$C_{out}' : '$C';
    const opt = (sv: number, cv: number) => `\`$S\` = ${sv}, \`${cName}\` = ${cv}`;
    const prompt = full
      ? `Na vstupy úplnej sčítačky privedieš \`$A\` = ${a}, \`$B\` = ${b} a prenos \`$C_{in}\` = ${ci}. Aký je súčet \`$S\` a prenos \`$C_{out}\`?`
      : `Na vstupy polovičnej sčítačky privedieš \`$A\` = ${a}, \`$B\` = ${b}. Aký je súčet \`$S\` a prenos \`$C\`?`;
    return choice(ID, prompt, [opt(S, C), opt(1 - S, C), opt(S, 1 - C), opt(1 - S, 1 - C)],
      `${full ? `${a} + ${b} + ${ci}` : `${a} + ${b}`} = ${sum}, dvojkovo ${C}${S}. Nižší bit je súčet \`$S\` = ${S}, vyšší bit je prenos \`${cName}\` = ${C}.${full ? ' Platí `$S = $A ⊕ $B ⊕ $C_{in}`.' : ' Platí `$S = $A ⊕ $B`, `$C = $A · $B`.'}`,
      rng);
  },
  (rng) => {
    const { mask, cover } = pick(rng, kmapPool());
    const wrong = wrongForms(rng, cover, mask);
    const others = kmapPool().filter((p) => p.mask !== mask);
    const options = four(`\`${sop(cover)}\``, wrong.map((w) => `\`${w}\``), () => `\`${sop(pick(rng, others).cover)}\``);
    const q = choice(ID, 'Karnaughova mapa na obrázku opisuje funkciu `$Y`(`$A`, `$B`, `$C`). Aký je jej minimálny tvar?', options,
      `Skupiny: ${cover.map(describe).join('; ')}. Spolu \`${sop(cover)}\`. Skupiny majú byť čo najväčšie a môžu prechádzať cez okraj mapy.`,
      rng);
    return { ...q, figure: () => kmapFigure(3, bits(mask), [], { idx: true }) };
  },
  (rng) => {
    const d = int(rng, 0, 9);
    const others = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== d)).slice(0, 3);
    return choice(ID, `Ktoré segmenty 7-segmentového displeja svietia pri číslici ${d}?`,
      [segList(d), segList(others[0]), segList(others[1]), segList(others[2])],
      `Číslica ${d} sa zobrazí segmentmi ${segList(d)}. Segmenty sú a (hore), b, c (vpravo), d (dole), e, f (vľavo) a g (stred).`,
      rng);
  },
  (rng) => {
    const n = rng() < 0.5 ? 2 : 3;
    const N = 2 ** n;
    const sel = int(rng, 0, N - 1);
    const code = sel.toString(2).padStart(n, '0');
    const reversed = parseInt([...code].reverse().join(''), 2);
    const lbl = (i: number) => `\`$D_{${i}}\``;
    const addr = n === 2 ? '`$A_{1}$A_{0}`' : '`$A_{2}$A_{1}$A_{0}`';
    return choice(ID, `Multiplexor ${N} : 1 má na adresových vstupoch ${addr} = ${code}. Ktorý dátový vstup je prepojený s výstupom \`$Y\`?`,
      four(lbl(sel), [lbl(reversed), lbl((sel + 1) % N), lbl((sel + N - 1) % N)], () => lbl(int(rng, 0, N - 1))),
      `Adresa ${code} je dvojkovo číslo ${sel} (najvyšší bit je vľavo), preto je na výstup prepojený vstup \`$D_{${sel}}\`.`,
      rng);
  },
  (rng) => {
    const sel = int(rng, 0, 7);
    const code = sel.toString(2).padStart(3, '0');
    const reversed = parseInt([...code].reverse().join(''), 2);
    const lbl = (i: number) => `\`$Y_{${i}}\``;
    return choice(ID, `Dekodér 1 z 8 má na vstupoch \`$A_{2}$A_{1}$A_{0}\` = ${code}. Ktorý výstup je aktívny?`,
      four(lbl(sel), [lbl(reversed), lbl(7 - sel), lbl((sel + 1) % 8)], () => lbl(int(rng, 0, 7))),
      `Kód ${code} = ${sel}, aktívny je výstup \`$Y_{${sel}}\`. Ostatných sedem výstupov je neaktívnych. (Pri obvode 74HC138 je aktívny výstup v stave L.)`,
      rng);
  },
];

const MAJ = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => {
  const a = (m >> 2) & 1;
  const b = (m >> 1) & 1;
  const c = m & 1;
  const y = a + b + c >= 2 ? 1 : 0;
  const t = [a ? '$A' : '@o{$A}', b ? '$B' : '@o{$B}', c ? '$C' : '@o{$C}'].join(' · ');
  return [String(a), String(b), String(c), String(y), y ? `\`${t}\`` : '—'];
});

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'digital',
    title: 'Kombinačné logické obvody',
    summary: 'Návrh obvodu z pravdivostnej tabuľky, minimalizácia Karnaughovou mapou, sčítačky, dekodéry, 7-segmentový displej, multiplexor, demultiplexor a komparátor.',
    minutes: 18,
    blocks: [
      { t: 'p', text: '**Kombinačný logický obvod** je zložený z logických členov bez spätných väzieb. Jeho výstupy závisia **iba od okamžitej kombinácie vstupov** – obvod si nič nepamätá. Opisuje ho pravdivostná tabuľka alebo logický výraz. Typickými kombinačnými obvodmi sú sčítačky, dekodéry, multiplexory a komparátory, ktoré sa vyrábajú aj ako hotové integrované obvody.' },
      { t: 'h', text: 'Návrh z pravdivostnej tabuľky' },
      {
        t: 'list',
        items: [
          'Zostav **pravdivostnú tabuľku** – pre `$n` vstupov má `2^{$n}` riadkov.',
          'Pre každý riadok, v ktorom je `$Y` = 1, napíš **súčin všetkých premenných** (minterm): premenná s hodnotou 0 je v ňom negovaná, s hodnotou 1 nenegovaná.',
          'Súčiny sčítaj – dostaneš **úplnú normálnu disjunktívnu formu** (ÚNDF, súčet súčinov).',
          'Výraz **minimalizuj** Booleovou algebrou alebo Karnaughovou mapou a nakresli schému.',
        ],
      },
      {
        t: 'table',
        head: ['`$A`', '`$B`', '`$C`', '`$Y`', 'Súčin pre `$Y` = 1'],
        rows: MAJ,
      },
      {
        t: 'example',
        title: 'Hlasovanie „2 z 3“',
        given: ['traja porotcovia stláčajú tlačidlá `$A`, `$B`, `$C`', 'kontrolka `$Y` svieti, keď hlasuje väčšina (tabuľka vyššie)'],
        steps: [
          'ÚNDF: `$Y = @o{$A} · $B · $C + $A · @o{$B} · $C + $A · $B · @o{$C} + $A · $B · $C`',
          'Súčin `$A · $B · $C` pripíšeš ešte dvakrát (`$X + $X = $X`) a spáruješ ho s každým z ostatných:',
          '`$Y = (@o{$A} + $A) · $B · $C + $A · (@o{$B} + $B) · $C + $A · $B · (@o{$C} + $C)`',
          '`$Y = $B · $C + $A · $C + $A · $B`',
        ],
        result: '`$Y = $A · $B + $A · $C + $B · $C` – tri dvojvstupové členy AND a jeden trojvstupový OR',
      },
      { t: 'h', text: 'Karnaughova mapa' },
      { t: 'p', text: '**Karnaughova mapa** je pravdivostná tabuľka nakreslená ako mriežka – každá bunka zodpovedá jednému riadku tabuľky. Riadky a stĺpce sú zoradené v Grayovom kóde 00, 01, 11, 10, takže **susedné bunky sa líšia iba v jednej premennej**, a to aj cez okraj mapy (krajné stĺpce aj krajné riadky sú susedné). Jednotky zakrúžkuješ do čo najväčších obdĺžnikových skupín s 1, 2, 4 alebo 8 bunkami. Z každej skupiny zostane súčin iba tých premenných, ktoré sa v nej **nemenia**.' },
      {
        t: 'figure',
        fig: () => kmapFigure(4, [0, 1, 2, 4, 5, 8, 10, 13], [
          { cells: [0, 1, 4, 5], cls: 'trace', label: '@o{$A} · @o{$C}' },
          { cells: [0, 2, 8, 10], cls: 'copper', label: '@o{$B} · @o{$D}' },
          { cells: [5, 13], cls: 'good', label: '$B · @o{$C} · $D' },
        ], { idx: true }),
        caption: 'Mapa štyroch premenných s jednotkami v riadkoch 0, 1, 2, 4, 5, 8, 10 a 13 tabuľky (malé čísla v rohoch buniek). Štyri rohy tvoria jednu skupinu – mapa sa správa ako „stočená“ v oboch smeroch.',
      },
      {
        t: 'example',
        title: 'Čítanie skupín z mapy',
        given: ['mapa na obrázku: riadky `$A$B`, stĺpce `$C$D`'],
        steps: [
          'Modrá štvorica (bunky 0, 1, 4, 5): mení sa `$B` aj `$D`, stále platí `$A` = 0, `$C` = 0 → `@o{$A} · @o{$C}`',
          'Oranžová štvorica v rohoch (0, 2, 8, 10): mení sa `$A` aj `$C`, stále `$B` = 0, `$D` = 0 → `@o{$B} · @o{$D}`',
          'Zelená dvojica (5, 13): mení sa iba `$A` → `$B · @o{$C} · $D`',
        ],
        result: '`$Y = @o{$A} · @o{$C} + @o{$B} · @o{$D} + $B · @o{$C} · $D` namiesto ôsmich štvorvstupových súčinov',
      },
      { t: 'note', kind: 'tip', text: 'Skupín má byť čo najmenej a majú byť čo najväčšie; môžu sa prekrývať a každá jednotka musí patriť aspoň do jednej. Skupina s `2^{$k}` bunkami odstráni `$k` premenných. Bunku, v ktorej na výstupe nezáleží (napr. kódy 1010 až 1111 pri vstupe BCD), označ X a zahrň ju do skupiny, len ak ju tým zväčšíš.' },
      { t: 'h', text: 'Sčítačky' },
      { t: 'p', text: '**Polovičná sčítačka** sčíta dva bity `$A` a `$B`. Výsledkom je súčet `$S` a prenos `$C` do vyššieho rádu: 1 + 1 = 10, teda `$S` = 0 a `$C` = 1. **Úplná sčítačka** pripočíta navyše prenos z nižšieho rádu `$C_{in}` – zostavíš ju z dvoch polovičných sčítačiek a člena OR. Reťazením `$n` úplných sčítačiek vznikne sčítačka `$n`-bitových čísel s postupným prenosom; rýchlejšie obvody (napr. 4-bitová sčítačka 74HC283) počítajú prenosy súbežne.' },
      {
        t: 'table',
        head: ['`$A`', '`$B`', 'súčet `$S`', 'prenos `$C`'],
        rows: [['0', '0', '0', '0'], ['0', '1', '1', '0'], ['1', '0', '1', '0'], ['1', '1', '0', '1']],
      },
      { t: 'figure', fig: halfAdderFigure, caption: 'Polovičná sčítačka: súčet je funkcia XOR, prenos funkcia AND.' },
      {
        t: 'formula',
        tex: ['$S = $A ⊕ $B ⊕ $C_{in}', '$C_{out} = $A · $B + $C_{in} · ($A ⊕ $B)'],
        legend: [['$S', 'súčet (bit výsledku)', '—'], ['$C_{in}', 'prenos z nižšieho rádu', '—'], ['$C_{out}', 'prenos do vyššieho rádu', '—']],
      },
      { t: 'h', text: 'Dekodéry a 7-segmentový displej' },
      { t: 'p', text: '**Dekodér** prevádza binárny kód na signál „1 z N“: s `$n` adresovými vstupmi má `2^{$n}` výstupov a aktívny je vždy práve ten, ktorého číslo je na vstupe. Napríklad 74HC138 je dekodér 1 z 8 (3 vstupy, aktívne výstupy v stave L) – vyberá pamäť alebo periférne zariadenie podľa adresy. **Dekodér BCD na 7-segmentový displej** zo štvorbitového kódu číslice rozsvieti segmenty a až g: obvod 4511 pre displeje so **spoločnou katódou** (segment svieti pri H), 7447 pre displeje so **spoločnou anódou** (segment svieti pri L).' },
      { t: 'figure', fig: () => sevenSegFigure(3), caption: 'Segmenty sa označujú a až f v smere hodinových ručičiek od horného, g je stredný. Každý segment je LED, preto potrebuje predradný rezistor.' },
      { t: 'explore', build: sevenSegExplorer, caption: 'Nastav kód BCD. Kombinácie 1010 až 1111 nie sú platné číslice – dekodér 4511 pri nich displej zhasne. Niektoré dekodéry (napríklad 7447) zobrazujú 6 a 9 bez „chvostíka“ (bez segmentu a, resp. d).' },
      {
        t: 'table',
        head: ['Číslica', 'Svietia segmenty', 'Počet'],
        rows: DIGIT_SEGMENTS.map((sgs, d) => [String(d), sgs.split('').join(', '), String(sgs.length)]),
      },
      { t: 'h', text: 'Multiplexor, demultiplexor a komparátor' },
      { t: 'p', text: '**Multiplexor** (MUX) je číslicový prepínač: podľa kombinácie na adresových (výberových) vstupoch prepojí jeden z `$N` dátových vstupov na výstup. Na výber z `$N` vstupov treba `$n = log_{2} $N` adresových vstupov, teda `$N = 2^{$n}`: MUX 4 : 1 má dva adresové vstupy, MUX 8 : 1 (74HC151) tri. Používa sa na prenos viacerých signálov po jednom vedení a na prevod paralelného údaja na sériový.' },
      { t: 'figure', fig: muxFigure, caption: 'Multiplexor 4 : 1 si môžeš predstaviť ako prepínač ovládaný adresou: pri `$A_{1}$A_{0}` = 10 (dvojkovo 2) je výstup `$Y` spojený so vstupom `$D_{2}`.' },
      { t: 'p', text: '**Demultiplexor** robí opak – jeden vstup rozvedie na jeden z `2^{$n}` výstupov podľa adresy (dekodér s povoľovacím vstupom pracuje ako demultiplexor). **Číslicový komparátor** porovná dve čísla `$A` a `$B` a aktivuje jeden z výstupov `$A > $B`, `$A = $B`, `$A < $B`. Pre jeden bit platí: rovnosť je `@o{$A ⊕ $B}` (XNOR), `$A > $B` je `$A · @o{$B}` a `$A < $B` je `@o{$A} · $B`. Viacbitový komparátor (napr. 4-bitový 74HC85) porovnáva od najvyššieho bitu – o výsledku rozhodne prvý bit, v ktorom sa čísla líšia.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čím sa vyznačuje kombinačný logický obvod?',
      options: ['výstupy závisia iba od okamžitých hodnôt vstupov', 'výstupy závisia aj od predchádzajúcich stavov obvodu', 'vždy obsahuje klopné obvody', 'na činnosť potrebuje hodinový signál'],
      explanation: 'Kombinačný obvod nemá pamäť ani spätné väzby – rovnaká kombinácia vstupov dá vždy rovnaký výstup. Pamäť a hodinový signál majú sekvenčné obvody.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sú riadky a stĺpce Karnaughovej mapy zoradené v poradí 00, 01, 11, 10?',
      options: ['susedné bunky sa tak líšia iba v jednej premennej (Grayov kód)', 'je to vzostupné poradie dvojkových čísel', 'aby sa mapa dala čítať zdola nahor', 'poradie je ľubovoľné, ide len o zvyk'],
      explanation: 'Vďaka Grayovmu kódu sa susedné bunky líšia jedinou premennou, a tá sa pri zlúčení dvoch súčinov vyruší (`$X + @o{$X} = 1`). Pri vzostupnom poradí 00, 01, 10, 11 by sa susedia 01 a 10 líšili v dvoch premenných.',
    },
    {
      lessonId: ID,
      prompt: 'Koľko buniek môže obsahovať skupina jednotiek v Karnaughovej mape?',
      options: ['1, 2, 4, 8 … (mocninu dvoch)', 'ľubovoľný počet susedných buniek', 'iba 2 alebo 4', '3, 6 alebo 9'],
      explanation: 'Skupina musí byť obdĺžnik s počtom buniek `2^{$k}` – len vtedy sa v nej `$k` premenných mení vo všetkých kombináciách a vypadnú. Skupina troch buniek nie je dovolená.',
    },
    {
      lessonId: ID,
      prompt: 'Aké sú výstupné funkcie polovičnej sčítačky?',
      options: ['`$S = $A ⊕ $B`, `$C = $A · $B`', '`$S = $A + $B`, `$C = $A · $B`', '`$S = $A · $B`, `$C = $A ⊕ $B`', '`$S = @o{$A ⊕ $B}`, `$C = $A + $B`'],
      explanation: 'Súčet je 1, keď je práve jeden bit 1 (XOR). Prenos vznikne iba pri 1 + 1 (AND). Funkcia OR by dala pri 1 + 1 súčet 1, čo je chyba.',
    },
    {
      lessonId: ID,
      prompt: 'Čo robí multiplexor?',
      options: ['podľa adresy prepojí jeden z dátových vstupov na výstup', 'podľa adresy rozvedie jeden vstup na jeden z viacerých výstupov', 'porovná dve dvojkové čísla', 'prevedie kód BCD na kód 7-segmentového displeja'],
      explanation: 'Multiplexor vyberá jeden z mnohých vstupov. Rozvedenie jedného vstupu na viac výstupov robí demultiplexor, porovnanie komparátor a prevod BCD dekodér pre displej.',
    },
    {
      lessonId: ID,
      prompt: 'Aký dekodér potrebuje 7-segmentový displej so spoločnou anódou?',
      options: ['s aktívnymi výstupmi v stave L (napr. 7447)', 's aktívnymi výstupmi v stave H (napr. 4511)', 'ľubovoľný, segmenty sa spínajú rovnako', 'nepotrebuje dekodér, stačí multiplexor'],
      explanation: 'Spoločná anóda je pripojená na kladné napätie, segment sa rozsvieti, keď dekodér pripojí jeho katódu cez rezistor na nízku úroveň. Displej so spoločnou katódou potrebuje výstupy aktívne v H.',
    },
    {
      lessonId: ID,
      prompt: 'Čo je úplná normálna disjunktívna forma (ÚNDF) logickej funkcie?',
      options: ['súčet súčinov, v ktorom každý súčin obsahuje všetky premenné a zodpovedá jednému riadku s `$Y` = 1', 'súčin súčtov zostavený z riadkov s `$Y` = 0', 'najkratší možný zápis funkcie', 'zápis funkcie iba pomocou členov NAND'],
      explanation: 'ÚNDF sa číta priamo z pravdivostnej tabuľky – pre každý riadok s jednotkou jeden úplný súčin. Je správna, ale zvyčajne nie najkratšia, preto sa minimalizuje.',
    },
    {
      lessonId: ID,
      prompt: 'Komparátor porovnáva 4-bitové čísla `$A` = 0110 a `$B` = 0101. Ktorý výstup bude aktívny?',
      options: ['`$A > $B`', '`$A < $B`', '`$A = $B`', 'žiadny, čísla majú rovnaký počet jednotiek'],
      explanation: 'Porovnáva sa od najvyššieho bitu. Prvé dva bity sú rovnaké (01), v treťom má `$A` 1 a `$B` 0, preto `$A > $B` (6 > 5).',
    },
  ],
  generators,
};

export default mod;
