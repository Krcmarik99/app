import type { MeasModule } from './types';
import { int, pick, shuffle, type Rng } from '../../lib/random';
import { fmtFixed, roundSig, scaleExp, siParts } from '../../lib/units';
import { n, numeric, q, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { cmpAbsErrorChart, cmpRelErrorChart, lcdDisplay } from '../../ui/meas-figures';

/*
 * Lekcia 18 – chyby číslicových meracích prístrojov (skriptá „4 EMR teória“, kap. 6.4).
 * Značenie podľa kap. 6: X_N = merací rozsah, X_m = nameraná hodnota (údaj displeja).
 * Pozor – v lekcii o triede presnosti (ELM3, kap. 2) je X_N nameraná hodnota a rozsah je MR.
 */

const ID = 'chyby-cmp';
const NBSP = ' ';

/** Odstráni šum binárnej aritmetiky (0,1 · 3 = 0,30000000000000004). */
const clean = (x: number) => Number(x.toPrecision(10));
/** Presná hodnota s jednotkou: „0,0617 V“. */
const val = (v: number, unit: string) => `${n(clean(v), 8)}${NBSP}${unit}`;
/** Presné percento: „0,35 %“. */
const pct = (v: number) => `${n(clean(v), 8)}${NBSP}%`;

/** Zaokrúhlená hodnota so znakom „=“, ak je presná, inak „≐“. */
function approx(v: number, sig: number): { sym: string; num: number; text: string } {
  const num = roundSig(clean(v), sig);
  return { sym: num === clean(v) ? '=' : '≐', num, text: n(num, sig) };
}

/** 1 digit, 2 digity, 5 digitov. */
function digits(d: number): string {
  if (d === 1) return '1 digit';
  return d < 5 ? `${d} digity` : `${d} digitov`;
}

function choice(prompt: string, options: string[], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId: ID, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

// ---------------------------------------------------------------- displeje a rozsahy

interface Display {
  /** Maximálny počet indikovaných jednotiek (rozsah / rozlíšenie). */
  N: number;
  /** „s 3½-miestnym displejom“ */
  with: string;
}
const D3H: Display = { N: 2000, with: 's 3½-miestnym displejom' };
const D5K: Display = { N: 5000, with: 's displejom s najväčším údajom 4 999' };
const D4H: Display = { N: 20000, with: 's 4½-miestnym displejom' };

interface Range {
  /** Rozsah v jednotke displeja. */
  XN: number;
  /** Jednotka displeja: mV, V, mA, A. */
  unit: string;
  base: 'V' | 'A';
  /** Prevod z jednotky displeja na základnú jednotku. */
  k: number;
}
const mV = (XN: number): Range => ({ XN, unit: 'mV', base: 'V', k: 1e-3 });
const V = (XN: number): Range => ({ XN, unit: 'V', base: 'V', k: 1 });
const mA = (XN: number): Range => ({ XN, unit: 'mA', base: 'A', k: 1e-3 });
const A = (XN: number): Range => ({ XN, unit: 'A', base: 'A', k: 1 });

const VOLT_RANGES: Record<number, Range[]> = {
  2000: [mV(200), V(2), V(20), V(200)],
  5000: [mV(500), V(5), V(50), V(500)],
  20000: [mV(200), V(2), V(20), V(200)],
};
const AMP_RANGES: Record<number, Range[]> = {
  2000: [mA(20), mA(200), A(2)],
  20000: [mA(20), mA(200), A(2)],
};

/** „vo voltoch“, „v miliampéroch“ */
const UNIT_IN: Record<string, string> = { mV: 'v milivoltoch', V: 'vo voltoch', mA: 'v miliampéroch', A: 'v ampéroch' };

const rangeText = (r: Range) => `${n(r.XN)}${NBSP}${r.unit}`;

/** Údaj na displeji: počet indikovaných jednotiek c → hodnota, text a reťazec pre lcdDisplay. */
interface Reading {
  X: number;
  /** Hodnota jedného digitu v jednotke displeja. */
  res: number;
  dec: number;
  /** „12,34“ – presne tak, ako ho ukazuje displej. */
  num: string;
  lcd: string;
}

function reading(rng: Rng, r: Range, N: number, minFrac: number): Reading {
  const c = int(rng, Math.ceil(N * minFrac), N - 1);
  const res = clean(r.XN / N);
  const dec = Math.round(-Math.log10(res));
  const X = clean(c * res);
  const places = String(N - 1).length;
  let s = String(c).padStart(places, '0');
  const intLen = places - dec;
  if (dec > 0) s = `${s.slice(0, intLen)}.${s.slice(intLen)}`;
  // Nevýznamné nuly pred celou časťou displej nezobrazí (zhasnuté číslice).
  const chars = s.split('');
  for (let i = 0; i < intLen - 1 && chars[i] === '0'; i++) chars[i] = ' ';
  return { X, res, dec, num: fmtFixed(X, dec), lcd: chars.join('') };
}

const lcdFig = (rd: Reading, r: Range) => () => lcdDisplay(rd.lcd, r.unit);

/** Záverečný výsledok absolútnej chyby: v jednotke displeja a v jednotke, v ktorej sa zadáva odpoveď. */
function absResult(vDisp: number, r: Range): string {
  const si = clean(vDisp * r.k);
  const { exp, prefix } = siParts(si, 3);
  const inDisp = `±${val(vDisp, r.unit)}`;
  const inAnswer = `±${val(scaleExp(si, exp), prefix + r.base)}`;
  return inDisp === inAnswer ? `**${inDisp}**` : `${inDisp} = **${inAnswer}**`;
}

const DEV: Record<'V' | 'A', string> = { V: 'voltmeter', A: 'ampérmeter' };

// ---------------------------------------------------------------- špecifikácie výrobcov

type Kind = 'DCV' | 'ACV' | 'DCA' | 'ACA';
const KIND_GEN: Record<Kind, string> = {
  DCV: 'jednosmerného napätia',
  ACV: 'striedavého napätia',
  DCA: 'jednosmerného prúdu',
  ACA: 'striedavého prúdu',
};
/** Chyba v tvare ±(δm % + d digitov) podľa displeja a druhu veličiny. */
const DIGIT_SPECS: Record<number, Partial<Record<Kind, [number, number][]>>> = {
  2000: {
    DCV: [[0.5, 2], [0.5, 3], [0.8, 2], [0.8, 3], [1, 2]],
    ACV: [[0.8, 5], [1, 5], [1.2, 10], [1.5, 5]],
    DCA: [[0.8, 3], [1, 2], [1.2, 3], [1.5, 5]],
    ACA: [[1.5, 7], [1.8, 5], [2, 5], [2.5, 10]],
  },
  5000: {
    DCV: [[0.3, 2], [0.5, 3], [0.5, 5]],
    ACV: [[1, 5], [1.2, 8]],
  },
  20000: {
    DCV: [[0.05, 3], [0.05, 5], [0.1, 5], [0.1, 10]],
    ACV: [[0.5, 20], [0.8, 30], [1, 40]],
    DCA: [[0.2, 10], [0.3, 15]],
    ACA: [[0.8, 30], [1, 50]],
  },
};

/** Náhodný displej, druh veličiny, rozsah a chyba v tvare ±(δm % + d digitov). */
function digitSetup(rng: Rng) {
  const disp = pick(rng, [D3H, D3H, D5K, D4H]);
  const specs = DIGIT_SPECS[disp.N];
  const kind = pick(rng, Object.keys(specs) as Kind[]);
  const [dm, d] = pick(rng, specs[kind]!);
  const r = pick(rng, kind.endsWith('V') ? VOLT_RANGES[disp.N] : AMP_RANGES[disp.N]);
  return { disp, kind, dm, d, r };
}

/** Náhodný prístroj s chybou zadanou cez rdg a FS. */
function fsSetup(rng: Rng) {
  const fine = rng() < 0.25;
  const disp = fine ? D4H : pick(rng, [D3H, D3H, D5K]);
  const base = disp.N === 5000 || rng() < 0.65 ? 'V' : 'A';
  const r = pick(rng, base === 'V' ? VOLT_RANGES[disp.N] : AMP_RANGES[disp.N]);
  const dm = pick(rng, fine ? [0.02, 0.03, 0.05, 0.1] : [0.2, 0.3, 0.5, 0.8, 0.9, 1, 1.5]);
  const da = pick(rng, fine ? [0.005, 0.01, 0.02] : [0.05, 0.1, 0.2]);
  return { disp, r, dm, da };
}

// ---------------------------------------------------------------- generátory

const generators: Generator[] = [
  // Zložky absolútnej chyby z rdg a FS.
  (rng) => {
    const { disp, r, dm, da } = fsSetup(rng);
    const rd = reading(rng, r, disp.N, 0.1);
    const Da = clean((da / 100) * r.XN);
    const Dm = clean((dm / 100) * rd.X);
    const Dc = clean(Da + Dm);
    const target = pick(rng, ['a', 'm', 'c', 'c'] as const);
    const ask = { a: 'aditívnu zložku chyby `Δ_{a}`', m: 'multiplikatívnu zložku chyby `Δ_{m}`', c: 'celkovú absolútnu chybu `Δ_{ČMP}`' }[target];
    const stepA = `\`Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N} = ±@f{${n(da)}}{100} · ${n(r.XN)}\` = ±${val(Da, r.unit)}`;
    const stepM = `\`Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m} = ±@f{${n(dm)}}{100} · ${rd.num}\` = ±${val(Dm, r.unit)}`;
    const value = { a: Da, m: Dm, c: Dc }[target];
    const solution = target === 'a'
      ? [
        'Aditívna zložka (FS) sa počíta z meracieho rozsahu, nie z údaja displeja.',
        `\`Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N} = ±@f{${n(da)}}{100} · ${n(r.XN)}\` = ${absResult(Da, r)}`,
        'Rovnako veľká je pri každom údaji na tomto rozsahu.',
      ]
      : target === 'm'
        ? [
          'Multiplikatívna zložka (rdg) sa počíta z nameranej hodnoty.',
          `\`Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m} = ±@f{${n(dm)}}{100} · ${rd.num}\` = ${absResult(Dm, r)}`,
        ]
        : [
          stepA,
          stepM,
          `\`Δ_{ČMP} = ±(Δ_{m} + Δ_{a}) = ±(${n(Dm, 8)} + ${n(Da, 8)})\` = ${absResult(Dc, r)}`,
        ];
    return numeric(ID, `Číslicový ${DEV[r.base]} ${disp.with} má pre merací rozsah ${rangeText(r)} chybu stanovenú výrobcom: rdg ${n(dm)} % a FS ${n(da)} %. Displej ukazuje ${rd.num}${NBSP}${r.unit} (obrázok). Vypočítaj ${ask} a zadaj jej veľkosť.`,
      clean(value * r.k), r.base, solution, { tolerance: 0.005, figure: lcdFig(rd, r) });
  },

  // Celková relatívna chyba z rdg a FS.
  (rng) => {
    const { disp, r, dm, da } = fsSetup(rng);
    const rd = reading(rng, r, disp.N, 0.1);
    const term = (da * r.XN) / rd.X;
    const t = approx(term, 4);
    const tot = approx(dm + t.num, 3);
    const exact = dm + term;
    return numeric(ID, `Číslicový ${DEV[r.base]} s chybou rdg ${n(dm)} % a FS ${n(da)} % je prepnutý na merací rozsah ${rangeText(r)} a ukazuje ${rd.num}${NBSP}${r.unit} (obrázok). Aká je celková relatívna chyba merania \`$δ_{ČMP}\`?`, exact, '%', [
      `Rozsah aj nameranú hodnotu dosaď v rovnakej jednotke (tu ${UNIT_IN[r.unit]}).`,
      `\`$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}}) = ±(${n(dm)} + ${n(da)} · @f{${n(r.XN)}}{${rd.num}})\` ${t.sym} ±(${n(dm)} + ${t.text}) ${tot.sym} **±${tot.text} %**`,
      `Na konci rozsahu by relatívna chyba klesla na \`$δ_{m} + $δ_{a}\` = ${pct(dm + da)}.`,
    ], { fixedUnit: true, tolerance: 0.01, figure: lcdFig(rd, r) });
  },

  // Prepočet digitov na percentá z rozsahu a naopak.
  (rng) => {
    const { disp, dm, d, kind, r } = digitSetup(rng);
    const da = clean((d / disp.N) * 100);
    const res = clean(r.XN / disp.N);
    const check = `Kontrola na rozsahu ${rangeText(r)}: 1 digit = ${rangeText(r)} / ${n(disp.N)} = ${val(res, r.unit)}, ${digits(d)} = ${val(d * res, r.unit)}, čo je ${pct(da)} z ${rangeText(r)}.`;
    if (rng() < 0.6) {
      return numeric(ID, `Výrobca udáva chybu číslicového multimetra ${disp.with} pre meranie ${KIND_GEN[kind]} v tvare ±(${n(dm)} % + ${digits(d)}). Maximálny počet indikovaných jednotiek je ${n(disp.N)}. Akej aditívnej chybe \`$δ_{a}\` (v % z rozsahu) zodpovedá zložka „${digits(d)}“?`, da, '%', [
        `\`$δ_{a} = @f{$d}{$N_{max}} · 100 % = @f{${d}}{${n(disp.N)}} · 100 %\` = **${pct(da)}**`,
        check,
      ], { fixedUnit: true, tolerance: 0.005 });
    }
    return numeric(ID, `Výrobca udáva aditívnu chybu číslicového multimetra ${disp.with} ako FS ${pct(da)}. Maximálny počet indikovaných jednotiek je ${n(disp.N)}. Koľkým digitom na poslednom mieste displeja táto chyba zodpovedá?`, d, 'digit', [
      `Zo vzťahu \`$δ_{a} = @f{$d}{$N_{max}} · 100 %\` vyjadri počet digitov.`,
      `\`$d = @f{$δ_{a} · $N_{max}}{100} = @f{${n(da, 8)} · ${n(disp.N)}}{100}\` = **${d}**`,
      check,
    ], { fixedUnit: true, tolerance: 0.005 });
  },

  // Celková relatívna chyba z tvaru ±(x % + n digitov) – ako príklad 2 zo skrípt.
  (rng) => {
    const { disp, kind, dm, d, r } = digitSetup(rng);
    const rd = reading(rng, r, disp.N, 0.1);
    const da = clean((d / disp.N) * 100);
    const term = (da * r.XN) / rd.X;
    const t = approx(term, 4);
    const tot = approx(dm + t.num, 3);
    return numeric(ID, `Chyba číslicového multimetra ${disp.with} je pre meranie ${KIND_GEN[kind]} v tvare \`$δ_{ČMP}\` = ±(${n(dm)} % + ${digits(d)}). Na meracom rozsahu ${rangeText(r)} multimeter ukazuje ${rd.num}${NBSP}${r.unit} (obrázok), maximálny počet indikovaných jednotiek je ${n(disp.N)}. Vypočítaj celkovú relatívnu chybu ČMP.`, dm + term, '%', [
      `\`$δ_{a} = @f{$d}{$N_{max}} · 100 % = @f{${d}}{${n(disp.N)}} · 100 %\` = ${pct(da)}`,
      `\`$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}}) = ±(${n(dm)} + ${n(da, 8)} · @f{${n(r.XN)}}{${rd.num}})\` ${t.sym} ±(${n(dm)} + ${t.text}) ${tot.sym} **±${tot.text} %**`,
    ], { fixedUnit: true, tolerance: 0.01, figure: lcdFig(rd, r) });
  },

  // Absolútna chyba z digitov: d × rozlíšenie posledného miesta.
  (rng) => {
    const { disp, kind, dm, d, r } = digitSetup(rng);
    const rd = reading(rng, r, disp.N, 0.1);
    const Da = clean(d * rd.res);
    const Dm = clean((dm / 100) * rd.X);
    const Dc = clean(Da + Dm);
    const total = rng() < 0.6;
    const PLACES = ['', 'jedno desatinné miesto', 'dve desatinné miesta', 'tri desatinné miesta', 'štyri desatinné miesta'];
    const steps = [
      `Údaj ${rd.num}${NBSP}${r.unit} má ${PLACES[rd.dec]}, jeden digit na poslednom mieste je ${val(rd.res, r.unit)} (aj \`@f{$X_{N}}{$N_{max}} = @f{${rangeText(r)}}{${n(disp.N)}}\` = ${val(rd.res, r.unit)}).`,
      total
        ? `\`Δ_{a}\` = ±${d} · ${val(rd.res, r.unit)} = ±${val(Da, r.unit)}`
        : `\`Δ_{a}\` = ±${d} · ${val(rd.res, r.unit)} = ${absResult(Da, r)}`,
    ];
    if (total) {
      steps.push(
        `\`Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m} = ±@f{${n(dm)}}{100} · ${rd.num}\` = ±${val(Dm, r.unit)}`,
        `\`Δ_{ČMP} = ±(Δ_{m} + Δ_{a}) = ±(${n(Dm, 8)} + ${n(Da, 8)})\` = ${absResult(Dc, r)}`,
      );
    }
    const ask = total
      ? 'Aká je celková absolútna chyba merania `Δ_{ČMP}`?'
      : `Akú absolútnu chybu \`Δ_{a}\` predstavuje zložka „${digits(d)}“?`;
    return numeric(ID, `Číslicový multimeter ${disp.with} má pre meranie ${KIND_GEN[kind]} na rozsahu ${rangeText(r)} chybu ±(${n(dm)} % + ${digits(d)}). Displej ukazuje ${rd.num}${NBSP}${r.unit} (obrázok). ${ask}`,
      clean((total ? Dc : Da) * r.k), r.base, steps, { tolerance: 0.005, figure: lcdFig(rd, r) });
  },

  // Porovnanie AMP a ČMP pri rovnakom údaji.
  (rng) => {
    for (;;) {
      const kind = pick(rng, ['DCV', 'ACV', 'DCA', 'ACA'] as const);
      const volt = kind.endsWith('V');
      const base = volt ? 'V' : 'A';
      const MR = pick(rng, volt ? [0.3, 1, 3, 10, 30, 100] : [0.03, 0.1, 0.3, 1]);
      const TP = pick(rng, [0.5, 1, 1.5, 2.5]);
      const X = roundSig(MR * (0.35 + 0.6 * rng()), 2);
      const XN = (volt ? [0.2, 2, 20, 200] : [0.02, 0.2, 2]).find((x) => x > X)!;
      const [dm, d] = pick(rng, DIGIT_SPECS[2000][kind]!);
      // Pri hodnotách pod 1 počítame v mV alebo mA, aby sa nemuseli písať malé desatinné čísla.
      const f = X < 1 ? 1000 : 1;
      const u = (f === 1000 ? 'm' : '') + base;
      const Xu = clean(X * f);
      const MRu = clean(MR * f);
      const XNu = clean(XN * f);
      const res = clean(XNu / 2000);
      const dA = clean((TP / 100) * MRu);
      const Dm = clean((dm / 100) * Xu);
      const Da = clean(d * res);
      const dC = clean(Dm + Da);
      if (Math.max(dA, dC) / Math.min(dA, dC) < 1.15) continue;
      const ampWins = dA < dC;
      const reasons: string[] = [];
      if (ampWins && kind.startsWith('AC')) reasons.push('striedavé veličiny meria cez prevod na jednosmerné napätie, preto má pri nich väčšiu chybu');
      if (ampWins && X / XN < 0.3) reasons.push(`${reasons.length ? 'navyše je údaj' : 'údaj je'} ďaleko od konca rozsahu ČMP, takže sa výrazne prejaví aditívna zložka chyby`);
      const why = reasons.length ? `: ${reasons.join('; ')}` : '';
      const dev = volt ? 'voltmetrom' : 'ampérmetrom';
      const options = [`analógovým ${dev} (AMP)`, 'číslicovým multimetrom (ČMP)', 'oboma rovnako presne', 'nedá sa rozhodnúť bez poznania skutočnej hodnoty'];
      if (!ampWins) [options[0], options[1]] = [options[1], options[0]];
      const what = { DCV: 'Jednosmerné napätie', ACV: 'Striedavé napätie', DCA: 'Jednosmerný prúd', ACA: 'Striedavý prúd' }[kind];
      return choice(
        `${what} približne ${q(X, base, 2)} môžeš zmerať analógovým ${dev} triedy presnosti ${n(TP)} na rozsahu ${q(MR, base)} alebo číslicovým multimetrom (3½ miesta, 2 000 indikovaných jednotiek) na rozsahu ${q(XN, base)} s chybou ±(${n(dm)} % + ${digits(d)}). Ktorým prístrojom ho zmeriaš s menšou chybou?`,
        options,
        `AMP: \`Δ$X = ±@f{TP}{100} · $X_{N} = ±@f{${n(TP)}}{100} · ${val(MRu, u)}\` = ±${val(dA, u)}, relatívne ±${n((dA / Xu) * 100, 3)} %. ČMP: 1 digit = ${val(XNu, u)} / 2 000 = ${val(res, u)}, \`Δ_{ČMP} = ±(@f{${n(dm)}}{100} · ${val(Xu, u)} + ${d} · ${val(res, u)})\` = ±(${n(Dm, 8)} + ${n(Da, 8)})${NBSP}${u} = ±${val(dC, u)}, relatívne ±${n((dC / Xu) * 100, 3)} %. ${ampWins
          ? `Presnejšie meria **analógový prístroj** – číslicový prístroj nie je automaticky presnejší${why}.`
          : 'Presnejšie meria **číslicový multimeter** – jeho dvojzložková chyba je tu menšia ako chyba analógového prístroja danej triedy.'}`,
        rng,
      );
    }
  },
];

// ---------------------------------------------------------------- lekcia

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Chyby číslicových meracích prístrojov',
    summary: 'Ako výrobca udáva dvojzložkovú chybu číslicového prístroja (rdg, FS, digity), ako z nej vypočítaš absolútnu a relatívnu chybu a prečo ČMP nemusí byť presnejší ako analógový prístroj.',
    minutes: 12,
    blocks: [
      { t: 'p', text: 'Veľa ľudí si myslí, že číslicové meracie prístroje (**ČMP**) sú oveľa presnejšie ako analógové (**AMP**). Nemusí to tak byť – veľa číslic na displeji ešte neznamená presný údaj. Presnosť ČMP úzko súvisí s jeho cenou a ČMP sú pomerne presné len pri meraní **jednosmerného napätia**. Ostatné elektrické (striedavé) aj neelektrické veličiny meria ČMP vždy cez **prevod na jednosmerné napätie**, preto je jeho presnosť pri týchto meraniach podstatne nižšia.' },
      { t: 'note', kind: 'warn', text: 'Pozor na značenie! V tejto lekcii (podľa skrípt EMR, kap. 6) je `$X_{N}` **merací rozsah** a `$X_{m}` **nameraná hodnota** (údaj displeja). V lekcii o triede presnosti (skriptá ELM3, kap. 2) bol rozsah označený MR a `$X_{N}` znamenalo nameranú hodnotu.' },
      { t: 'h', text: 'Dvojzložková chyba' },
      { t: 'p', text: 'Chyba ČMP nie je vyznačená na prístroji ako trieda presnosti. Udáva ju výrobca v **technickej dokumentácii**, osobitne pre jednotlivé veličiny a rozsahy, a to vždy ako **dvojzložkovú chybu**. Prvá časť zápisu je vztiahnutá na údaj prístroja, druhá závisí od rozsahu, resp. od rozlišovacej schopnosti displeja.' },
      {
        t: 'table',
        head: ['Zložka', 'Zápis v dokumentácii', 'Absolútna chyba', 'Príčina'],
        rows: [
          ['**multiplikatívna** `$δ_{m}`', '± 0,X % z údaja – **rdg** (reading = čítanie)', '`Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m}`', 'odchýlky odporov vstupného deliča, nepresnosť referenčného napätia'],
          ['**aditívna** `$δ_{a}`', '± 0,X % z rozsahu (range) – **FS** (full scale = plný rozsah), alebo počet digitov `$d`', '`Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N}`', 'zosilňovače, prevodníky, komparátory, spínače'],
        ],
      },
      {
        t: 'formula',
        tex: ['Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m}', 'Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N}', 'Δ_{ČMP} = ±(Δ_{m} + Δ_{a}) = ±(Δ_{m} + $d)'],
        legend: [
          ['Δ_{ČMP}', 'celková absolútna chyba ČMP', 'jednotka veličiny'],
          ['Δ_{m}, Δ_{a}', 'absolútna multiplikatívna a aditívna chyba', 'jednotka veličiny'],
          ['$δ_{m}, $δ_{a}', 'multiplikatívna (rdg) a aditívna (FS) chyba', '%'],
          ['$X_{m}', 'nameraná hodnota', 'jednotka veličiny'],
          ['$X_{N}', 'merací rozsah', 'jednotka veličiny'],
          ['$d', 'aditívna chyba určená počtom digitov na poslednom mieste displeja (do súčtu s Δm sa dosadí prepočítaná na jednotky veličiny, pozri nižšie)', 'digit'],
        ],
      },
      { t: 'h', text: 'Digity a rozlíšenie displeja' },
      { t: 'p', text: 'Aditívna zložka sa často zapisuje ako **d** – chyba určená počtom dibitov (digitov) na poslednom mieste displeja, napr. ±(0,5 % + 2 digity). Jeden digit je jednotka posledného zobrazeného miesta, teda **rozlíšenie** displeja na danom rozsahu. Dnešné ČMP majú 3 až 8½ miesta (maximálny údaj 999 až 199 999 999). Často sa používa **3½-miestny displej**: tri plné miesta 0 – 9 a na začiatku „pol miesta“, ktoré ukáže nanajvýš 1. Pri meracích rozsahoch 200 mV – 2 V – 20 V – 200 V zobrazí najviac číslo 1 999. Prístroj s rozsahmi 500 mV – 5 V – 50 V – 500 V môže zobraziť najviac 4 999.' },
      { t: 'figure', fig: () => lcdDisplay('1.999', 'V'), caption: '3½-miestny displej na rozsahu 2 V s najväčším údajom 1,999 V. Posledné miesto má váhu 1 mV – to je jeden digit.' },
      {
        t: 'table',
        head: ['Rozsah 3½-miestneho ČMP', 'Najväčší údaj', '1 digit (rozlíšenie)', 'Chyba 2 digity'],
        rows: [
          ['200 mV', '199,9 mV', '0,1 mV', '±0,2 mV'],
          ['2 V', '1,999 V', '1 mV', '±2 mV'],
          ['20 V', '19,99 V', '10 mV', '±20 mV'],
          ['200 V', '199,9 V', '0,1 V', '±0,2 V'],
        ],
      },
      { t: 'p', text: 'Chybu v digitoch môžeš prepočítať na percentuálnu chybu z meracieho rozsahu (aditívnu chybu) a naopak – oba spôsoby zápisu sú ekvivalentné. Potrebuješ na to **maximálny počet indikovaných jednotiek** `$N_{max}`, teda koľko digitov sa zmestí do rozsahu: pri 3½-miestnom displeji je to 2 V / 1 mV = **2 000** (údaje 0 až 1 999), pri displeji s najväčším údajom 4 999 je to 5 000.' },
      {
        t: 'formula',
        tex: ['$δ_{a} = @f{$d}{$N_{max}} · 100 %', 'Δ_{a} = $d · @f{$X_{N}}{$N_{max}}'],
        legend: [
          ['$N_{max}', 'maximálny počet indikovaných jednotiek (3½ miesta: 2 000)', '–'],
          ['@f{$X_{N}}{$N_{max}}', 'rozlíšenie – hodnota jedného digitu', 'jednotka veličiny'],
        ],
      },
      { t: 'h', text: 'Relatívna chyba ČMP' },
      {
        t: 'formula',
        tex: '$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}}) = ±@f{Δ_{ČMP}}{$X_{m}} · 100 %',
        legend: [['$δ_{ČMP}', 'celková relatívna chyba ČMP', '%']],
      },
      { t: 'p', text: 'Multiplikatívna chyba ku koncu rozsahu narastá, aditívna je na celom rozsahu konštantná. Celková absolútna chyba preto lineárne rastie – od `Δ_{a}` pri nulovom údaji po `Δ_{m} + Δ_{a}` na konci rozsahu. Celková relatívna chyba naopak ku koncu rozsahu klesá: člen `$δ_{a} · @f{$X_{N}}{$X_{m}}` je pri malom údaji veľký a na konci rozsahu (`$X_{m} = $X_{N}`) klesne `$δ_{ČMP}` na `$δ_{m} + $δ_{a}`. Krivka je hyperbola (skriptá jej pokles opisujú ako „exponenciálny“). Aj pri ČMP je preto výhodné merať na **najmenšom rozsahu, ktorý meranú hodnotu ešte obsiahne**.' },
      { t: 'figure', fig: cmpAbsErrorChart, caption: 'Obr. 6.4 – absolútna chyba voltmetra z príkladu 1 nižšie (rozsah 200 V, rdg 0,9 %, FS 0,1 %): aditívna zložka ±0,2 V (čiarkovane) je stála, celková chyba rastie až na ±2 V na konci rozsahu.' },
      { t: 'figure', fig: cmpRelErrorChart, caption: 'Obr. 6.5 – relatívna chyba toho istého voltmetra: pri 100 V je ±1,1 %, na konci rozsahu klesne na `$δ_{m} + $δ_{a}` = 1 %.' },
      {
        t: 'example',
        title: 'Príklad 1 – chyba zadaná cez rdg a FS',
        given: ['číslicový voltmeter, merací rozsah `$X_{N}` = 200 V', 'chyba stanovená výrobcom: rdg 0,9 %, FS 0,1 %', 'odmeraná hodnota `$X_{m}` = 100 V'],
        steps: [
          '`Δ_{a} = ±(@f{0,1}{100} · 200)` = ±0,2 V',
          '`Δ_{m} = ±(@f{0,9}{100} · 100)` = ±0,9 V',
          '`Δ_{ČMP} = ±(0,2 + 0,9)` = ±1,1 V',
          '`$δ_{ČMP} = ±(0,9 + 0,1 · @f{200}{100}) = ±(@f{1,1}{100} · 100)` = ±1,1 %',
        ],
        result: '`Δ_{ČMP}` = ±1,1 V, `$δ_{ČMP}` = ±1,1 %; skutočné napätie leží medzi 98,9 V a 101,1 V',
      },
      {
        t: 'example',
        title: 'Príklad 2 – chyba zadaná v digitoch',
        given: ['číslicový multimeter s 3½-miestnym displejom, meranie striedavého prúdu', 'chyba `$δ_{ČMP}` = ±(1,5 % + 7 dibitov)', 'merací rozsah `$X_{N}` = 2 A, odmeraná hodnota `$X_{m}` = 0,6 A', 'maximálny počet indikovaných jednotiek 2 000'],
        steps: [
          '`$δ_{a} = @f{7}{2 000} · 100` = 0,35 %',
          '`$δ_{ČMP} = ±(1,5 + 0,35 · @f{2}{0,6})` = ±2,67 %',
          'Kontrola cez absolútne chyby: 1 digit = 2 A / 2 000 = 1 mA, `Δ_{a}` = 7 · 1 mA = 7 mA, `Δ_{m} = @f{1,5}{100} · 600 mA` = 9 mA, `Δ_{ČMP}` = 16 mA a `@f{16}{600} · 100` = 2,67 %',
        ],
        result: 'celková relatívna chyba je ±2,67 % (absolútna ±16 mA)',
      },
      { t: 'h', text: 'Porovnanie chýb AMP a ČMP' },
      {
        t: 'table',
        head: ['', 'Analógový prístroj (AMP)', 'Číslicový prístroj (ČMP)'],
        rows: [
          ['Určenie chyby', 'triedou presnosti TP (%), ktorá je uvedená na číselníku', 'výrobcom v dokumentácii, vždy ako dvojzložková chyba: `$δ_{m}` (rdg – z meranej hodnoty) a `$δ_{a}` (FS – z rozsahu, alebo digity)'],
          ['Absolútna chyba', '`Δ$X = ±@f{TP}{100} · $X_{N}` – rovnaká v celom rozsahu', '`Δ_{ČMP} = ±(Δ_{m} + Δ_{a})` – rastie s nameranou hodnotou'],
          ['Relatívna chyba', '`$δ_{AMP} = ±@f{Δ$X}{$X_{m}} · 100 %`, na konci rozsahu `$δ_{max}` = ±TP', '`$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}})`, na konci rozsahu ±(`$δ_{m} + $δ_{a}`)'],
          ['Prepočet digitov', '–', '`$δ_{a} = @f{$d}{$N_{max}} · 100 %`'],
        ],
      },
      {
        t: 'example',
        title: 'Ktorý prístroj meria presnejšie?',
        given: ['striedavý prúd, údaj 0,6 A', 'ČMP z príkladu 2: rozsah 2 A, ±(1,5 % + 7 digitov)', 'analógový ampérmeter triedy presnosti 1, rozsah `$X_{N}` = 1 A'],
        steps: [
          'ČMP: `Δ_{ČMP}` = ±16 mA, `$δ_{ČMP}` = ±2,67 % (príklad 2)',
          'AMP: `Δ$X = ±@f{TP}{100} · $X_{N} = ±@f{1}{100} · 1 A` = ±0,01 A = ±10 mA',
          'AMP: `$δ_{AMP} = ±@f{Δ$X}{$X_{m}} · 100 % = ±@f{10}{600} · 100 %` = ±1,67 %',
        ],
        result: 'presnejšie tu meria analógový ampérmeter (±10 mA oproti ±16 mA) – číslicový prístroj nie je automaticky presnejší',
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čo vyjadruje zložka chyby ČMP označená **rdg**?',
      options: ['chybu v % z nameranej hodnoty (údaja)', 'chybu v % z meracieho rozsahu', 'počet digitov na poslednom mieste displeja', 'triedu presnosti vyznačenú na prístroji'],
      explanation: 'rdg (reading – čítanie) je multiplikatívna zložka `$δ_{m}`: `Δ_{m} = ±@f{$δ_{m}}{100} · $X_{m}`. Chybu v % z rozsahu označuje FS (full scale).',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá zložka chyby ČMP je rovnaká v celom meracom rozsahu?',
      options: ['aditívna (FS, digity)', 'multiplikatívna (rdg)', 'obe zložky', 'ani jedna – obe rastú s údajom'],
      explanation: '`Δ_{a} = ±@f{$δ_{a}}{100} · $X_{N}` závisí iba od rozsahu, nie od údaja. Multiplikatívna zložka `Δ_{m}` rastie s nameranou hodnotou.',
    },
    {
      lessonId: ID,
      prompt: 'Aké najväčšie číslo zobrazí 3½-miestny displej?',
      options: ['1 999', '999', '19 999', '9 999'],
      explanation: 'Má tri plné miesta 0 – 9 a „pol miesta“ na začiatku, ktoré ukáže najviac 1. Preto majú prístroje s takým displejom rozsahy 200 mV – 2 V – 20 V – 200 V. Číslo 19 999 zobrazí 4½-miestny displej.',
    },
    {
      lessonId: ID,
      prompt: '3½-miestny voltmeter je prepnutý na rozsah 20 V. Akú hodnotu má jeden digit na poslednom mieste?',
      options: ['0,01 V', '0,1 V', '1 mV', '1 V'],
      explanation: 'Najväčší údaj je 19,99 V, posledné miesto sú stotiny voltu. Aj výpočtom: `@f{$X_{N}}{$N_{max}} = @f{20 V}{2 000}` = 0,01 V.',
    },
    {
      lessonId: ID,
      prompt: 'Výrobca udáva chybu ±(0,5 % + 2 digity), maximálny počet indikovaných jednotiek je 2 000. Akej chybe v % z rozsahu zodpovedajú 2 digity?',
      options: ['0,1 %', '0,2 %', '1 %', '0,01 %'],
      explanation: '`$δ_{a} = @f{$d}{$N_{max}} · 100 % = @f{2}{2 000} · 100 %` = 0,1 %.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa mení celková relatívna chyba ČMP, keď na tom istom rozsahu rastie nameraná hodnota?',
      options: ['klesá a na konci rozsahu sa rovná `$δ_{m} + $δ_{a}`', 'rastie, lebo rastie multiplikatívna zložka', 'je v celom rozsahu rovnaká', 'na konci rozsahu klesne na nulu'],
      explanation: '`$δ_{ČMP} = ±($δ_{m} + $δ_{a} · @f{$X_{N}}{$X_{m}})` – druhý člen sa s rastúcim `$X_{m}` zmenšuje. S údajom rastie absolútna chyba, nie relatívna.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo je ČMP pri meraní striedavých veličín menej presný ako pri meraní jednosmerného napätia?',
      options: ['striedavé veličiny meria cez prevod na jednosmerné napätie', 'striedavú hodnotu zobrazuje s menším počtom miest', 'pri striedavých veličinách sa neuplatní aditívna chyba', 'striedavý prúd rýchlejšie vybíja batériu prístroja'],
      explanation: 'ČMP je pomerne presný len pre jednosmerné napätie. Ostatné veličiny meria cez prevod na jednosmerné napätie, a preto je presnosť pri nich podstatne nižšia.',
    },
    {
      lessonId: ID,
      prompt: 'Číslicový voltmeter na rozsahu 200 V (rdg 0,9 %, FS 0,1 %) ukazuje 100 V. Aká je celková absolútna chyba?',
      options: ['±1,1 V', '±0,9 V', '±0,2 V', '±2 V'],
      explanation: '`Δ_{m}` = 0,9 % zo 100 V = 0,9 V, `Δ_{a}` = 0,1 % z 200 V = 0,2 V, spolu ±1,1 V. Chyba ±2 V by platila až pri údaji na konci rozsahu.',
    },
    {
      lessonId: ID,
      prompt: 'Je číslicový merací prístroj vždy presnejší ako analógový?',
      options: ['nie – závisí to od kvality (ceny) prístroja, druhu veličiny a údaja na rozsahu', 'áno, lebo zobrazuje viac číslic', 'áno, lebo pri ňom nevzniká žiadna chyba odčítania', 'nie, číslicové prístroje sú vždy menej presné'],
      explanation: 'Počet zobrazených miest hovorí o rozlíšení, nie o presnosti. ČMP sú pomerne presné len pre jednosmerné napätie; napr. pri striedavom prúde môže analógový prístroj dobrej triedy merať presnejšie.',
    },
    {
      lessonId: ID,
      prompt: 'Čím je spôsobená multiplikatívna chyba ČMP?',
      options: ['odchýlkami odporov vstupného deliča a nepresnosťou referenčného napätia', 'zosilňovačmi, prevodníkmi, komparátormi a spínačmi', 'paralaxou pri odčítaní údaja', 'trením v ložiskách otočného systému'],
      explanation: 'Multiplikatívnu chybu spôsobujú odchýlky odporov vstupného deliča a nepresnosť referenčného napätia, aditívnu zosilňovače, prevodníky, komparátory a spínače. Paralaxa a trenie v ložiskách sa týkajú analógových prístrojov.',
    },
  ],
  generators,
};

export default mod;
