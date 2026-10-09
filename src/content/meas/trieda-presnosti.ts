import type { MeasModule } from './types';
import { int, pick, shuffle, type Rng } from '../../lib/random';
import { roundSig } from '../../lib/units';
import { n, numeric, q, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { absErrorChart, analogScale, relErrorChart } from '../../ui/meas-figures';

/*
 * Lekcia 16 – trieda presnosti analógových (elektromechanických) prístrojov.
 * Značenie podľa skrípt ELM3, kap. 2: MR = merací rozsah, X_N = nameraná hodnota, X_S = skutočná hodnota.
 */

const ID = 'trieda-presnosti';
const NBSP = ' ';

/** Odstráni šum binárnej aritmetiky (0,1 · 3 = 0,30000000000000004). */
const clean = (x: number) => Number(x.toPrecision(10));
/** Hodnota s jednotkou bez predpony, s plnou presnosťou: „23,55 V“. */
const val = (v: number, unit: string) => `${n(v, 6)}${NBSP}${unit}`;

/** Predpísaný rad tried presnosti a ich označenie podľa skrípt. */
const CLASS_NAME: Record<string, string> = {
  '0.1': 'mimoriadne presné',
  '0.2': 'veľmi presné',
  '0.5': 'presné',
  '1': 'montážne a laboratórne',
  '1.5': 'presné prenosné',
  '2.5': 'rozvádzačové',
  '5': 'pomocné a iné menej presné',
};
const CLASSES = [0.1, 0.2, 0.5, 1, 1.5, 2.5, 5];

interface Meter { Nom: string; gen: string; ins: string; what: string }
const VOLTMETER: Meter = { Nom: 'Voltmeter', gen: 'voltmetra', ins: 'voltmetrom', what: 'napätie' };
const AMMETER: Meter = { Nom: 'Ampérmeter', gen: 'ampérmetra', ins: 'ampérmetrom', what: 'prúd' };
const meterOf = (unit: string): Meter => (unit === 'V' ? VOLTMETER : AMMETER);

/** Rozsahy so stupnicami, pri ktorých vychádza „pekná“ konštanta prístroja. */
interface Scale { MR: number; unit: 'V' | 'mA' | 'A'; divs: number[] }
const SCALES: Scale[] = [
  { MR: 3, unit: 'V', divs: [30, 60, 75, 150] },
  { MR: 15, unit: 'V', divs: [30, 75, 150] },
  { MR: 30, unit: 'V', divs: [30, 60, 75, 100, 150] },
  { MR: 60, unit: 'V', divs: [30, 60, 75, 150] },
  { MR: 150, unit: 'V', divs: [30, 50, 75, 150] },
  { MR: 300, unit: 'V', divs: [30, 60, 75, 100, 150] },
  { MR: 30, unit: 'mA', divs: [30, 60, 75, 150] },
  { MR: 150, unit: 'mA', divs: [30, 75, 150] },
  { MR: 3, unit: 'A', divs: [30, 60, 75, 150] },
  { MR: 6, unit: 'A', divs: [30, 60, 75, 150] },
];

/** Výchylka v dielikoch od `minFrac` stupnice po jej koniec; pri jemnej stupnici párna (dá sa odčítať na rysku). */
function pickAlpha(rng: Rng, div: number, minFrac: number): number {
  const step = div >= 100 ? 2 : 1;
  return int(rng, Math.ceil((div * minFrac) / step), div / step) * step;
}

function scaleFigure(sc: Scale, div: number, alpha: number, TP: number) {
  return () => analogScale({ divisions: div, alpha, symbol: sc.unit, range: `MR = ${n(sc.MR)} ${sc.unit}`, accuracyClass: n(TP) });
}

function joinList(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} a ${items[items.length - 1]}`;
}

function choice(prompt: string, options: string[], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId: ID, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

const generators: Generator[] = [
  // Najväčšia absolútna chyba z triedy presnosti a rozsahu.
  (rng) => {
    const sc = pick(rng, SCALES);
    const TP = pick(rng, CLASSES);
    const d = clean((TP * sc.MR) / 100);
    return numeric(ID, `${meterOf(sc.unit).Nom} triedy presnosti ${n(TP)} je prepnutý na merací rozsah ${val(sc.MR, sc.unit)}. Akú najväčšiu absolútnu chybu \`Δ$X_{max}\` môže mať jeho údaj? Zadaj jej veľkosť.`, d, sc.unit, [
      'Trieda presnosti udáva najväčšiu absolútnu chybu v percentách meracieho rozsahu.',
      `\`Δ$X_{max} = @f{TP · MR}{100} = @f{${n(TP)} · ${n(sc.MR)}}{100}\` = **±${val(d, sc.unit)}**`,
      'Táto chyba platí v celom rozsahu – pri malej aj pri veľkej výchylke ručičky.',
    ], { fixedUnit: true, tolerance: 0.005 });
  },

  // Interval, v ktorom leží skutočná hodnota.
  (rng) => {
    const sc = pick(rng, SCALES);
    const div = pick(rng, sc.divs);
    const TP = pick(rng, [1, 1.5, 2.5]);
    const alpha = pickAlpha(rng, div, 0.35);
    const XN = clean((alpha * sc.MR) / div);
    const d = clean((TP * sc.MR) / 100);
    const lower = rng() < 0.5;
    const lo = clean(XN - d);
    const hi = clean(XN + d);
    const m = meterOf(sc.unit);
    return numeric(ID, `${m.Nom} triedy presnosti ${n(TP)} na rozsahu ${val(sc.MR, sc.unit)} ukazuje ${val(XN, sc.unit)}. V akom intervale leží skutočná hodnota meranej veličiny? Zadaj jeho ${lower ? 'dolnú' : 'hornú'} hranicu.`, lower ? lo : hi, sc.unit, [
      `\`Δ$X_{max} = @f{TP · MR}{100} = @f{${n(TP)} · ${n(sc.MR)}}{100}\` = ${val(d, sc.unit)}`,
      `\`$X_{S} = $X_{N} ± Δ$X_{max}\` = ${n(XN, 6)} ± ${val(d, sc.unit)}`,
      `Skutočná hodnota leží v intervale ${val(lo, sc.unit)} až ${val(hi, sc.unit)}, ${lower ? 'dolná' : 'horná'} hranica je **${val(lower ? lo : hi, sc.unit)}**.`,
    ], { fixedUnit: true, tolerance: 0.005, figure: scaleFigure(sc, div, alpha, TP) });
  },

  // Relatívna chyba pri výchylke odčítanej zo stupnice.
  (rng) => {
    const sc = pick(rng, SCALES);
    const div = pick(rng, sc.divs);
    const TP = pick(rng, [0.5, 1, 1.5, 2.5]);
    const alpha = pickAlpha(rng, div, 0.15);
    const K = clean(sc.MR / div);
    const XN = clean(alpha * K);
    const d = clean((TP * sc.MR) / 100);
    const delta = (d / XN) * 100;
    return numeric(ID, `${meterOf(sc.unit).Nom} triedy presnosti ${n(TP)} je prepnutý na rozsah ${val(sc.MR, sc.unit)}, jeho stupnica má ${div} dielikov a ručička ukazuje výchylku \`$α\` = ${alpha} dielikov (obrázok). S akou relatívnou chybou je hodnota odmeraná?`, delta, '%', [
      `Konštanta prístroja: \`$K = @f{MR}{$α_{max}} = @f{${n(sc.MR)}}{${div}}\` = ${val(K, `${sc.unit}/dielik`)}`,
      `Nameraná hodnota: \`$X_{N} = $α · $K\` = ${alpha} · ${n(K, 6)} = ${val(XN, sc.unit)}`,
      `\`Δ$X_{max} = @f{${n(TP)} · ${n(sc.MR)}}{100}\` = ${val(d, sc.unit)}`,
      `\`$δ = @f{Δ$X_{max}}{$X_{N}} · 100 % = @f{${n(d, 6)}}{${n(XN, 6)}} · 100 %\` = **±${n(delta, 3)} %**`,
    ], { fixedUnit: true, tolerance: 0.01, figure: scaleFigure(sc, div, alpha, TP) });
  },

  // Voľba vhodného rozsahu viacrozsahového prístroja.
  (rng) => {
    const set = pick(rng, [
      { m: VOLTMETER, unit: 'V', r: [1.5, 3, 6, 15, 30, 60, 150, 300, 600] },
      { m: AMMETER, unit: 'A', r: [0.003, 0.01, 0.03, 0.1, 0.3, 1, 3, 10] },
    ]);
    const start = int(rng, 0, set.r.length - 4);
    const ranges = set.r.slice(start, start + 4);
    const k = int(rng, 1, 3);
    const u = 0.2 + 0.6 * rng();
    const X = roundSig(ranges[k - 1] + u * (ranges[k] - ranges[k - 1]), 2);
    const TP = pick(rng, [0.5, 1, 1.5, 2.5]);
    const labels = ranges.map((r) => q(r, set.unit));
    const small = labels.slice(0, k);
    const parts = ranges.slice(k).map((r, j) => `${labels[k + j]} → \`$δ\` = ${n((TP * r) / X, 3)} %`);
    const options = [labels[k], ...labels.filter((_, i) => i !== k)];
    return choice(
      `Chceš zmerať ${set.m.what} približne ${q(X, set.unit, 2)} ${set.m.ins} triedy presnosti ${n(TP)}, ktorý má rozsahy ${joinList(labels)}. Ktorý rozsah zvolíš?`,
      options,
      `${small.length === 1 ? `Rozsah ${small[0]} je menší` : `Rozsahy ${joinList(small)} sú menšie`} ako meraná hodnota – prístroj by sa preťažil. ${parts.length === 1
        ? `Zostáva jediný vhodný rozsah **${labels[k]}**, na ktorom je relatívna chyba \`$δ = TP · @f{MR}{$X_{N}}\` = ${n((TP * ranges[k]) / X, 3)} %.`
        : `Na ostatných rozsahoch je relatívna chyba \`$δ = TP · @f{MR}{$X_{N}}\`: ${parts.join('; ')}. Najmenšia je na rozsahu **${labels[k]}** – je to najmenší rozsah, ktorý hodnotu ešte obsiahne, a výchylka je najbližšie ku koncu stupnice.`}`,
      rng,
    );
  },

  // Porovnanie dvoch voltmetrov: lepšia trieda verzus vhodnejší rozsah.
  (rng) => {
    const SERIES = [6, 15, 30, 60, 150, 300, 600];
    let TPA = 0;
    let TPB = 0;
    let MRA = 0;
    let MRB = 0;
    do {
      TPA = pick(rng, [0.2, 0.5, 1]);
      TPB = pick(rng, [1.5, 2.5]);
      MRB = pick(rng, [6, 15, 30, 60]);
      MRA = pick(rng, SERIES.filter((r) => r > MRB && r <= MRB * 20));
    } while (Math.abs(TPA * MRA - TPB * MRB) < 1e-9);
    const X = roundSig(MRB * (0.4 + 0.55 * rng()), 2);
    const dA = clean((TPA * MRA) / 100);
    const dB = clean((TPB * MRB) / 100);
    const aWins = dA < dB;
    const options = ['voltmetrom A', 'voltmetrom B', 'oboma rovnako presne', 'nedá sa rozhodnúť bez poznania skutočnej hodnoty'];
    if (!aWins) [options[0], options[1]] = [options[1], options[0]];
    return choice(
      `Napätie približne ${q(X, 'V', 2)} môžeš zmerať dvoma analógovými voltmetrami: **A** – trieda presnosti ${n(TPA)}, rozsah ${n(MRA)} V; **B** – trieda presnosti ${n(TPB)}, rozsah ${n(MRB)} V. Ktorým z nich zmeriaš napätie s menšou chybou?`,
      options,
      `Voltmeter A: \`Δ$X_{max} = @f{${n(TPA)} · ${n(MRA)}}{100}\` = ${val(dA, 'V')}, \`$δ\` = ${n((dA / X) * 100, 3)} %. Voltmeter B: \`Δ$X_{max} = @f{${n(TPB)} · ${n(MRB)}}{100}\` = ${val(dB, 'V')}, \`$δ\` = ${n((dB / X) * 100, 3)} %. ${aWins
        ? 'Presnejšie meria **voltmeter A** – jeho trieda je natoľko lepšia, že prevýši nevýhodu väčšieho rozsahu.'
        : 'Presnejšie meria **voltmeter B** – horšiu triedu presnosti vyváži menší rozsah, pri ktorom je výchylka bližšie ku koncu stupnice.'}`,
      rng,
    );
  },

  // Trieda presnosti z najväčšej absolútnej chyby.
  (rng) => {
    const set = pick(rng, [
      { m: VOLTMETER, unit: 'V', ranges: [3, 15, 30, 60, 150, 300, 600] },
      { m: AMMETER, unit: 'A', ranges: [0.03, 0.06, 0.15, 0.3, 0.6, 1.5, 3, 6] },
    ]);
    const MR = pick(rng, set.ranges);
    const TP = pick(rng, CLASSES);
    const d = clean((TP * MR) / 100);
    // Výpočet v jednotke rozsahu (pri ampérmetri do 1 A v mA), aby sa nemuseli prevádzať malé čísla.
    const milli = set.unit === 'A' && MR < 1;
    const unit = milli ? 'mA' : set.unit;
    const MRd = clean(milli ? MR * 1000 : MR);
    const dd = clean(milli ? d * 1000 : d);
    const same = q(d, set.unit) === val(dd, unit);
    return numeric(ID, `Najväčšia absolútna chyba ${set.m.gen} na rozsahu ${q(MR, set.unit)} je ±${q(d, set.unit)}. Do akej triedy presnosti prístroj patrí?`, TP, '%', [
      same
        ? `Chyba aj rozsah sú v rovnakej jednotke: \`Δ$X_{max}\` = ${val(dd, unit)}, MR = ${val(MRd, unit)}.`
        : `Preveď chybu na jednotku rozsahu: \`Δ$X_{max}\` = ${q(d, set.unit)} = ${val(dd, unit)}, MR = ${val(MRd, unit)}.`,
      `\`TP = @f{Δ$X_{max}}{MR} · 100 % = @f{${n(dd, 6)}}{${n(MRd, 6)}} · 100 %\` = **${n(TP)} %**`,
      `Na číselníku je vyznačená trieda ${n(TP)} (${CLASS_NAME[String(TP)]} prístroje).`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },
];

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Trieda presnosti analógových prístrojov',
    summary: 'Čo znamená číslo triedy presnosti na číselníku, aká veľká môže byť chyba údaja a prečo sa oplatí merať na čo najmenšom vhodnom rozsahu.',
    minutes: 10,
    blocks: [
      { t: 'p', text: 'Žiadny merací prístroj neukazuje úplne presne. Pri elektromechanických (analógových) prístrojoch výrobca zaručuje, že chyba údaja neprekročí určitú hranicu. Túto hranicu vyjadruje **trieda presnosti TP**, ktorá je súčasťou značiek na číselníku meracieho prístroja.' },
      { t: 'h', text: 'Trieda presnosti' },
      { t: 'p', text: 'Trieda presnosti udáva **maximálnu absolútnu chybu** `Δ$X_{max}` meracieho prístroja vyjadrenú **v percentách meracieho rozsahu** MR. Je to číslo z predpísaného radu (tabuľka pod vzorcom).' },
      {
        t: 'formula',
        tex: 'TP = @f{Δ$X_{max}}{MR} · 100 %',
        legend: [
          ['TP', 'trieda presnosti', '%'],
          ['Δ$X_{max}', 'maximálna absolútna chyba prístroja', 'jednotka meranej veličiny'],
          ['MR', 'merací rozsah', 'jednotka meranej veličiny'],
        ],
      },
      {
        t: 'table',
        head: ['TP', 'Prístroje', '`Δ$X_{max}` pri MR = 100 V'],
        rows: [
          ['0,1', 'mimoriadne presné', '±0,1 V'],
          ['0,2', 'veľmi presné', '±0,2 V'],
          ['0,5', 'presné', '±0,5 V'],
          ['1', 'montážne a laboratórne', '±1 V'],
          ['1,5', 'presné prenosné', '±1,5 V'],
          ['2,5', 'rozvádzačové', '±2,5 V'],
          ['5', 'pomocné a iné menej presné', '±5 V'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Na číselníku je trieda presnosti vytlačená ako samotné číslo, napr. **1,5**. Znamená to ±1,5 % z **meracieho rozsahu**, nie z nameranej hodnoty. V tejto lekcii (podľa skrípt ELM3) je `$X_{N}` nameraná hodnota a MR merací rozsah.' },
      { t: 'h', text: 'Najväčšia absolútna chyba a skutočná hodnota' },
      { t: 'p', text: 'Z triedy presnosti vypočítaš najväčšiu absolútnu chybu. Ak má prístroj merať vo svojej triede presnosti, musí byť splnená podmienka `Δ$X ≤ Δ$X_{max}` – skutočná chyba údaja nesmie prekročiť najväčšiu dovolenú chybu. Prístroj teda meria s chybou ±`Δ$X_{max}` a skutočná hodnota meranej veličiny leží v intervale:' },
      {
        t: 'formula',
        tex: ['Δ$X_{max} = @f{TP · MR}{100}', '$X_{S} = $X_{N} ± Δ$X_{max}'],
        legend: [
          ['$X_{S}', 'skutočná hodnota meranej veličiny', 'jednotka veličiny'],
          ['$X_{N}', 'nameraná hodnota (údaj prístroja)', 'jednotka veličiny'],
        ],
      },
      { t: 'p', text: 'Maximálnu absolútnu chybu považujeme za **konštantnú v celom meracom rozsahu** – nezávisí od nameranej hodnoty, resp. od výchylky ručičky.' },
      { t: 'figure', fig: absErrorChart, caption: 'Obr. 2.1 – najväčšia absolútna chyba ±`Δ$X_{max}` je rovnaká na celej stupnici od 0 do 100 dielikov.' },
      { t: 'figure', fig: () => analogScale({ divisions: 150, alpha: 120, symbol: 'V', range: 'MR = 30 V', accuracyClass: '1,5' }), caption: 'Voltmeter triedy 1,5 na rozsahu 30 V: ručička ukazuje 120 dielikov zo 150.' },
      {
        t: 'example',
        title: 'Interval skutočnej hodnoty',
        given: ['voltmeter triedy presnosti 1,5', 'MR = 30 V, stupnica 150 dielikov', 'výchylka `$α` = 120 dielikov'],
        steps: [
          '`$K = @f{MR}{$α_{max}} = @f{30}{150}` = 0,2 V/dielik, `$X_{N} = $α · $K` = 120 · 0,2 = 24 V',
          '`Δ$X_{max} = @f{1,5 · 30}{100}` = 0,45 V',
          '`$X_{S}` = 24 ± 0,45 V, teda od 23,55 V do 24,45 V',
        ],
        result: 'skutočné napätie je 23,55 V až 24,45 V',
      },
      { t: 'h', text: 'Relatívna chyba' },
      { t: 'p', text: 'Rovnaká absolútna chyba je pri malom údaji oveľa citeľnejšia ako pri veľkom. V každom bode stupnice je preto merací prístroj tým presnejší, čím je väčšia výchylka ručičky. Ukazuje to relatívna chyba:' },
      {
        t: 'formula',
        tex: ['$δ = @f{Δ$X_{max}}{$X_{N}} · 100 %', '$δ = TP · @f{MR}{$X_{N}}'],
        legend: [['$δ', 'relatívna chyba merania', '%']],
      },
      { t: 'figure', fig: relErrorChart, caption: 'Obr. 2.2 – relatívna chyba prístroja triedy 1 so stupnicou 100 dielikov: na konci stupnice ±1 %, pri 20 dielikoch už ±5 %.' },
      { t: 'h', text: 'Voľba meracieho rozsahu' },
      { t: 'p', text: 'Z druhého tvaru vzorca je vidno, že na konci stupnice (`$X_{N}` = MR) sa relatívna chyba rovná triede presnosti, v polovici stupnice je dvojnásobná a v desatine stupnice desaťnásobná. Preto je výhodné **voliť taký rozsah, aby výchylka bola čo najbližšie ku koncu stupnice** – teda najmenší rozsah, ktorý meranú hodnotu ešte obsiahne.' },
      {
        t: 'example',
        title: 'To isté napätie na dvoch rozsahoch',
        given: ['meriame napätie približne 20 V', 'voltmeter triedy presnosti 1 s rozsahmi 30 V a 300 V'],
        steps: [
          'Rozsah 30 V: `Δ$X_{max} = @f{1 · 30}{100}` = 0,3 V, `$δ = @f{0,3}{20} · 100 %` = 1,5 %',
          'Rozsah 300 V: `Δ$X_{max} = @f{1 · 300}{100}` = 3 V, `$δ = @f{3}{20} · 100 %` = 15 %',
        ],
        result: 'na rozsahu 30 V je relatívna chyba 10-krát menšia (1,5 % oproti 15 %)',
      },
      { t: 'note', kind: 'warn', text: 'Rozsah však nesmie byť menší ako meraná hodnota – prístroj by sa preťažil. Ak veľkosť meranej veličiny dopredu nepoznáš, začni na najväčšom rozsahu a postupne prepínaj na menší.' },
      {
        t: 'example',
        title: 'Meria prístroj vo svojej triede?',
        given: ['voltmeter triedy 1, MR = 60 V, ukazuje 41,0 V', 'oveľa presnejší kontrolný prístroj ukazuje 40,5 V'],
        steps: [
          'Skutočná chyba: `Δ$X` = 41,0 − 40,5 = 0,5 V',
          'Dovolená chyba: `Δ$X_{max} = @f{1 · 60}{100}` = 0,6 V',
          '0,5 V ≤ 0,6 V – podmienka `Δ$X ≤ Δ$X_{max}` je splnená',
        ],
        result: 'voltmeter meria vo svojej triede presnosti',
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čo udáva trieda presnosti TP analógového meracieho prístroja?',
      options: ['najväčšiu absolútnu chybu prístroja v % meracieho rozsahu', 'najväčšiu chybu v % nameranej hodnoty', 'počet dielikov stupnice pripadajúcich na jednotku', 'o koľko percent možno prístroj krátkodobo preťažiť'],
      explanation: '`TP = @f{Δ$X_{max}}{MR} · 100 %` – trieda presnosti je najväčšia absolútna chyba vyjadrená v percentách meracieho rozsahu. Preťažiteľnosť je iná vlastnosť prístroja.',
    },
    {
      lessonId: ID,
      prompt: 'Voltmeter triedy presnosti 1,5 je prepnutý na rozsah 100 V. Aká je jeho najväčšia absolútna chyba?',
      options: ['±1,5 V', '±0,15 V', '±15 V', 'závisí od nameranej hodnoty'],
      explanation: '`Δ$X_{max} = @f{1,5 · 100}{100}` = 1,5 V. Táto chyba je rovnaká v celom rozsahu, nezávisí od údaja.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa mení najväčšia absolútna chyba `Δ$X_{max}` analógového prístroja pozdĺž stupnice?',
      options: ['je rovnaká v celom meracom rozsahu', 'rastie s výchylkou ručičky', 'klesá s výchylkou ručičky', 'na konci stupnice je nulová'],
      explanation: 'Maximálnu absolútnu chybu považujeme za konštantnú v celom meracom rozsahu (obr. 2.1). S výchylkou sa mení relatívna chyba.',
    },
    {
      lessonId: ID,
      prompt: 'Pri akej výchylke ručičky meria analógový prístroj s najmenšou relatívnou chybou?',
      options: ['čo najbližšie ku koncu stupnice', 'na začiatku stupnice', 'presne v strede stupnice', 'relatívna chyba je pri každej výchylke rovnaká'],
      explanation: '`$δ = TP · @f{MR}{$X_{N}}` – čím je údaj bližšie k rozsahu, tým je relatívna chyba menšia. Na konci stupnice sa rovná triede presnosti.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa označujú prístroje triedy presnosti 2,5?',
      options: ['rozvádzačové', 'mimoriadne presné', 'montážne a laboratórne', 'presné prenosné'],
      explanation: 'Rad tried: 0,1 mimoriadne presné, 0,2 veľmi presné, 0,5 presné, 1 montážne a laboratórne, 1,5 presné prenosné, 2,5 rozvádzačové, 5 pomocné.',
    },
    {
      lessonId: ID,
      prompt: 'Napätie asi 8 V meriaš voltmetrom s rozsahmi 3 V, 10 V, 30 V a 100 V. Ktorý rozsah zvolíš?',
      options: ['10 V', '3 V', '30 V', '100 V'],
      explanation: 'Na rozsahu 3 V by sa prístroj preťažil. Rozsah 10 V je najmenší, ktorý 8 V obsiahne – výchylka je na 80 % stupnice a relatívna chyba je najmenšia.',
    },
    {
      lessonId: ID,
      prompt: 'Prístroj triedy presnosti 1 na rozsahu 30 V ukazuje 10 V. Aká je relatívna chyba merania?',
      options: ['±3 %', '±1 %', '±0,3 %', '±10 %'],
      explanation: '`Δ$X_{max} = @f{1 · 30}{100}` = 0,3 V, `$δ = @f{0,3}{10} · 100 %` = 3 %. Iba na konci stupnice by bola relatívna chyba 1 %.',
    },
    {
      lessonId: ID,
      prompt: 'Voltmeter triedy presnosti 1 s rozsahom 60 V ukazuje 40 V. V akom intervale leží skutočná hodnota?',
      options: ['39,4 V až 40,6 V', '39,6 V až 40,4 V', '39 V až 41 V', '38,8 V až 41,2 V'],
      explanation: '`Δ$X_{max} = @f{1 · 60}{100}` = 0,6 V, preto `$X_{S}` = 40 ± 0,6 V. Interval 39,6 V až 40,4 V vychádza pri chybnom výpočte 1 % z nameranej hodnoty.',
    },
  ],
  generators,
};

export default mod;
