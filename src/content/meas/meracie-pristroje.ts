import { pick, shuffle, type Rng } from '../../lib/random';
import { b, n, numeric, q, res, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { ammeterConsumptionFigure, analogScale, voltmeterConsumptionFigure } from '../../ui/meas-figures';
import type { MeasModule } from './types';

const ID = 'meracie-pristroje';

// ---------------------------------------------------------------- údaje

/** Značky na číselníku analógového prístroja. */
const DIAL_MARKS: readonly { mark: string; meaning: string }[] = [
  { mark: '—', meaning: 'prístroj na jednosmerný prúd (napätie)' },
  { mark: '~', meaning: 'prístroj na striedavý prúd (napätie)' },
  { mark: '≂', meaning: 'prístroj na jednosmerný aj striedavý prúd (napätie)' },
  { mark: '1,5', meaning: 'trieda presnosti 1,5 – najväčšia chyba je 1,5 % meracieho rozsahu' },
  { mark: '⊥', meaning: 'pracovná poloha zvislá' },
  { mark: '⊓', meaning: 'pracovná poloha vodorovná' },
  { mark: '∠60°', meaning: 'pracovná poloha šikmá, pod uhlom 60°' },
  { mark: '☆2', meaning: 'izolácia skúšaná skúšobným napätím 2 kV' },
  { mark: '☆', meaning: 'izolácia skúšaná skúšobným napätím 500 V' },
  { mark: '☆0', meaning: 'izolácia nebola skúšaná skúšobným napätím' },
];

/**
 * Stupnice a rozsahy, ktoré k nim reálne patria (konštanta vychádza „pekne“).
 * Napäťové rozsahy vo V, prúdové v A.
 */
const SCALES: readonly { div: number; V: number[]; A: number[] }[] = [
  { div: 30, V: [3, 30, 300], A: [0.03, 0.3, 3] },
  { div: 50, V: [1, 10, 100], A: [0.01, 0.1, 1] },
  { div: 60, V: [3, 6, 30, 60, 300], A: [0.03, 0.06, 0.3, 6] },
  { div: 75, V: [3, 15, 30, 150, 300], A: [0.015, 0.03, 0.075, 0.3, 1.5, 3] },
  { div: 100, V: [0.3, 1, 3, 10, 30, 100, 300], A: [0.001, 0.01, 0.03, 0.1, 0.3, 1, 3, 10] },
  { div: 150, V: [3, 15, 30, 150, 300], A: [0.015, 0.03, 0.15, 0.3, 1.5, 3] },
];

interface Instrument {
  div: number;
  /** Merací rozsah v základnej jednotke (V alebo A). */
  MR: number;
  base: 'V' | 'A';
  /** Jednotka, v ktorej sa vyjadrí konštanta (V, mV, A, mA) a jej násobok voči základnej. */
  unit: string;
  factor: number;
  name: string;
}

function instrument(rng: Rng): Instrument {
  const sc = pick(rng, SCALES);
  const voltage = rng() < 0.55;
  const MR = pick(rng, voltage ? sc.V : sc.A);
  const base = voltage ? 'V' : 'A';
  const small = MR < 1;
  return {
    div: sc.div, MR, base,
    unit: small ? `m${base}` : base,
    factor: small ? 1e3 : 1,
    name: voltage ? 'Voltmeter' : small ? 'Miliampérmeter' : 'Ampérmeter',
  };
}

/** Ampérmetre: rozsah v A a typické vnútorné odpory v Ω. */
const AMMETERS: readonly { MR: number; RA: number[] }[] = [
  { MR: 0.03, RA: [2, 3.3, 5, 10] },
  { MR: 0.1, RA: [0.5, 1, 2] },
  { MR: 0.3, RA: [0.2, 0.25, 0.5] },
  { MR: 1, RA: [0.05, 0.1, 0.2] },
  { MR: 3, RA: [0.02, 0.03, 0.05] },
  { MR: 10, RA: [0.01, 0.015] },
];

/** Úbytok napätia pri menovitom prúde, ktorý udáva výrobca. */
const NOMINAL_DROPS: readonly { MR: number; dU: number[] }[] = [
  { MR: 0.03, dU: [0.06, 0.15, 0.3] },
  { MR: 0.3, dU: [0.06, 0.075, 0.15] },
  { MR: 1, dU: [0.06, 0.075, 0.15] },
  { MR: 3, dU: [0.06, 0.075, 0.15] },
  { MR: 6, dU: [0.06, 0.075, 0.15] },
];

/** Napäťové rozsahy a napätia, ktoré sa na nich typicky merajú. */
const VOLT_READINGS: readonly { MR: number; U: number[] }[] = [
  { MR: 3, U: [1.5, 2.4, 3] },
  { MR: 10, U: [4.5, 6, 9, 10] },
  { MR: 30, U: [12, 15, 24, 30] },
  { MR: 100, U: [48, 60, 100] },
  { MR: 300, U: [150, 230, 300] },
];

const OHM_PER_VOLT = [1000, 2000, 5000, 10000, 20000];

const opv = (RiV: number) => `${q(RiV, 'Ω')}/V`;

// ---------------------------------------------------------------- generátory

function choice(rng: Rng, prompt: string, correct: string, wrong: string[], explanation: string): ChoiceQuestion {
  const options = [correct, ...wrong.slice(0, 3)];
  const order = shuffle(rng, [0, 1, 2, 3]);
  return {
    kind: 'choice', lessonId: ID, prompt,
    options: order.map((i) => options[i]),
    correct: order.indexOf(0),
    explanation,
  };
}

const generators: Generator[] = [
  // konštanta alebo citlivosť
  (rng) => {
    const ins = instrument(rng);
    const K = (ins.MR * ins.factor) / ins.div;
    const mr = q(ins.MR, ins.base);
    const kFrac = `\`$K = @f{MR}{$α_{max}} = @f{${mr}}{${ins.div} dielikov}\``;
    if (rng() < 0.5) {
      return numeric(ID, `${ins.name} má merací rozsah ${mr} a stupnicu s ${ins.div} dielikmi. Aká je jeho konštanta v ${ins.unit}/dielik?`, K, `${ins.unit}/dielik`, [
        'Konštanta je počet jednotiek meranej veličiny, ktoré pripadnú na jeden dielik stupnice.',
        `${kFrac} = **${n(K)} ${ins.unit}/dielik**`,
      ], { fixedUnit: true });
    }
    const C = 1 / K;
    return numeric(ID, `${ins.name} má merací rozsah ${mr} a stupnicu s ${ins.div} dielikmi. Aká je jeho citlivosť v dielikoch na ${ins.unit}?`, C, `dielik/${ins.unit}`, [
      `${kFrac} = ${n(K)} ${ins.unit}/dielik`,
      `\`$C = @f{1}{$K} = @f{1}{${n(K)}}\` = **${n(C)} dielik/${ins.unit}**`,
    ], { fixedUnit: true });
  },

  // nameraná hodnota z výchylky (obrázok stupnice)
  (rng) => {
    const ins = instrument(rng);
    const step = ins.div >= 100 ? 2 : 1;
    const minA = Math.ceil((0.2 * ins.div) / step);
    const maxA = ins.div / step;
    const alpha = step * (minA + Math.floor(rng() * (maxA - minA + 1)));
    const K = (ins.MR * ins.factor) / ins.div;
    const NH = (alpha * ins.MR) / ins.div;
    const mr = q(ins.MR, ins.base);
    return numeric(ID, `${ins.name} so stupnicou ${ins.div} dielikov je prepnutý na rozsah ${mr}. Ručička ukazuje výchylku ${alpha} dielikov (pozri obrázok). Aká je nameraná hodnota?`, NH, ins.base, [
      `\`$K = @f{MR}{$α_{max}} = @f{${mr}}{${ins.div} dielikov}\` = ${n(K)} ${ins.unit}/dielik`,
      `\`NH = $α · $K\` = ${alpha} · ${n(K)} ${ins.unit} = ${res(NH, ins.base)}`,
    ], {
      figure: () => analogScale({ divisions: ins.div, alpha, symbol: ins.unit, range: `MR = ${mr}` }),
    });
  },

  // vnútorný odpor voltmetra z Ω/V
  (rng) => {
    const RiV = pick(rng, OHM_PER_VOLT);
    const ranges = [1, 3, 10, 30, 100, 300];
    const MR = pick(rng, ranges);
    if (rng() < 0.6) {
      const RV = RiV * MR;
      return numeric(ID, `Analógový voltmeter má vnútorný odpor ${opv(RiV)}. Aký je jeho vnútorný odpor na rozsahu ${q(MR, 'V')}?`, RV, 'Ω', [
        'Vnútorný odpor voltmetra sa udáva na 1 V rozsahu, preto ho vynásobíme rozsahom.',
        `\`$R_{V} = $R_{iV} · MR\` = ${b(RiV, 'Ω/V')} · ${b(MR, 'V')} = ${res(RV, 'Ω')}`,
      ]);
    }
    const MR2 = pick(rng, ranges.filter((r) => r !== MR));
    const RV1 = RiV * MR;
    const RV2 = RiV * MR2;
    return numeric(ID, `Na rozsahu ${q(MR, 'V')} má voltmeter vnútorný odpor ${q(RV1, 'Ω')}. Aký vnútorný odpor bude mať po prepnutí na rozsah ${q(MR2, 'V')}?`, RV2, 'Ω', [
      `Odpor na 1 V rozsahu: \`$R_{iV} = @f{$R_{V}}{MR} = @f{${b(RV1, 'Ω')}}{${b(MR, 'V')}}\` = ${opv(RiV)}`,
      `\`$R_{V2} = $R_{iV} · MR_{2}\` = ${b(RiV, 'Ω/V')} · ${b(MR2, 'V')} = ${res(RV2, 'Ω')}`,
    ]);
  },

  // spotreba voltmetra
  (rng) => {
    const RiV = pick(rng, OHM_PER_VOLT);
    const { MR, U: list } = pick(rng, VOLT_READINGS);
    const U = pick(rng, list);
    const RV = RiV * MR;
    const PV = (U * U) / RV;
    const full = U === MR ? ' (plná výchylka, teda vlastná spotreba voltmetra)' : '';
    return numeric(ID, `Voltmeter s vnútorným odporom ${opv(RiV)} je prepnutý na rozsah ${q(MR, 'V')} a meria napätie ${q(U, 'V')}${full}. Aký príkon odoberá z meraného obvodu?`, PV, 'W', [
      `\`$R_{V} = $R_{iV} · MR\` = ${b(RiV, 'Ω/V')} · ${b(MR, 'V')} = ${q(RV, 'Ω')}`,
      `\`$P_{V} = @f{$U^{2}}{$R_{V}} = @f{(${b(U, 'V')})^{2}}{${b(RV, 'Ω')}}\` = ${res(PV, 'W')}`,
    ]);
  },

  // ampérmeter: úbytok napätia, príkon, vnútorný odpor
  (rng) => {
    const variant = rng();
    if (variant < 0.35) {
      const { MR, RA: list } = pick(rng, AMMETERS);
      const RA = pick(rng, list);
      const dU = RA * MR;
      return numeric(ID, `Ampérmeter s vnútorným odporom ${q(RA, 'Ω')} má rozsah ${q(MR, 'A')}. Aký je úbytok napätia na ampérmetri pri plnej výchylke?`, dU, 'V', [
        'Pri plnej výchylke prechádza ampérmetrom prúd rovný jeho rozsahu.',
        `\`Δ$U_{A} = $R_{A} · MR\` = ${b(RA, 'Ω')} · ${b(MR, 'A')} = ${res(dU, 'V')}`,
      ]);
    }
    if (variant < 0.7) {
      const { MR, RA: list } = pick(rng, AMMETERS);
      const RA = pick(rng, list);
      const I = Number((MR * pick(rng, [0.4, 0.5, 0.6, 0.75, 0.8, 1])).toPrecision(6));
      const PA = I * I * RA;
      return numeric(ID, `Ampérmeter s vnútorným odporom ${q(RA, 'Ω')} na rozsahu ${q(MR, 'A')} meria prúd ${q(I, 'A')}. Aký príkon odoberá z obvodu?`, PA, 'W', [
        `Prúd v základných jednotkách: \`$I\` = ${b(I, 'A')}.`,
        `\`$P_{A} = $I^{2} · $R_{A} = (${b(I, 'A')})^{2} · ${b(RA, 'Ω')}\` = ${res(PA, 'W')}`,
      ]);
    }
    const { MR, dU: list } = pick(rng, NOMINAL_DROPS);
    const dU = pick(rng, list);
    const RA = dU / MR;
    return numeric(ID, `Výrobca ampérmetra s rozsahom ${q(MR, 'A')} udáva, že pri menovitom prúde je na ňom úbytok napätia ${q(dU, 'V')}. Aký je vnútorný odpor ampérmetra?`, RA, 'Ω', [
      'Pri menovitom prúde (plnej výchylke) platí `Δ$U_{A} = $R_{A} · MR`, odtiaľ `$R_{A} = @f{Δ$U_{A}}{MR}`.',
      `\`$R_{A} = @f{${b(dU, 'V')}}{${b(MR, 'A')}}\` = ${res(RA, 'Ω')}`,
    ]);
  },

  // značky na číselníku
  (rng) => {
    const [right, ...rest] = shuffle(rng, DIAL_MARKS);
    const wrong = rest.slice(0, 3);
    return choice(rng, `Na číselníku analógového prístroja je značka **${right.mark}**. Čo znamená?`, right.meaning,
      wrong.map((w) => w.meaning),
      `Značka „${right.mark}“ znamená: ${right.meaning}. Ostatné možnosti: ${wrong.map((w) => `${w.meaning} – značka „${w.mark}“`).join('; ')}.`);
  },
];

// ---------------------------------------------------------------- lekcia

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Elektrické meracie prístroje',
    summary: 'Merací rozsah, konštanta a citlivosť prístroja, preťažiteľnosť, značky na číselníku a vlastná spotreba voltmetra a ampérmetra.',
    minutes: 11,
    blocks: [
      { t: 'p', text: 'Elektrický merací prístroj (MP) premení meranú veličinu na výchylku ručičky – **analógový** prístroj (AMP) – alebo na číselný údaj na displeji – **číslicový** prístroj (ČMP). Na správne meranie treba poznať jeho základné vlastnosti. Prvou z nich je **merací rozsah** (MR) – súhrn najvyššej a najnižšej hodnoty meranej veličiny, ktorú môžeme prístrojom odmerať. Rozsah sa dá zmeniť:' },
      {
        t: 'list',
        items: [
          'zmenou polohy **otočného prepínača**,',
          'zasunutím **kolíčka** do príslušnej zdierky,',
          'zasunutím **vodiča** do príslušnej svorky,',
          'opakovaným **stláčaním tlačidla** na prístroji,',
          '**automaticky** podľa veľkosti meranej veličiny.',
        ],
      },
      { t: 'h', text: 'Konštanta, nameraná hodnota a citlivosť' },
      { t: 'p', text: 'Stupnica analógového prístroja je rozdelená na **dieliky**. **Konštanta** prístroja `$K` je počet jednotiek meranej veličiny, ktoré pripadnú na jeden dielik stupnice. Nameranú hodnotu NH potom vypočítaš z výchylky ručičky `$α`. **Citlivosť** `$C` znamená reagovanie prístroja na čo najmenšiu zmenu meranej veličiny – vyjadruje sa ako prevrátená hodnota konštanty.' },
      {
        t: 'formula',
        tex: ['$K = @f{MR}{$α_{max}}', 'NH = $α · $K', '$C = @f{1}{$K}'],
        legend: [
          ['$K', 'konštanta prístroja', 'V/dielik, A/dielik'],
          ['MR', 'merací rozsah', 'V, A'],
          ['$α_{max}', 'počet dielikov celej stupnice', 'dielik'],
          ['$α', 'výchylka ručičky', 'dielik'],
          ['NH', 'nameraná hodnota', 'V, A'],
          ['$C', 'citlivosť', 'dielik/V, dielik/A'],
        ],
      },
      {
        t: 'figure',
        fig: () => analogScale({ divisions: 75, alpha: 48, symbol: 'V', range: 'MR = 30 V', accuracyClass: '1,5' }),
        caption: 'Voltmeter so stupnicou 75 dielikov prepnutý na rozsah 30 V. Ručička ukazuje 48 dielikov.',
      },
      {
        t: 'example',
        title: 'Odčítanie údaja voltmetra',
        given: ['MR = 30 V', '`$α_{max}` = 75 dielikov', '`$α` = 48 dielikov'],
        steps: [
          '`$K = @f{MR}{$α_{max}} = @f{30 V}{75 dielikov}` = 0,4 V/dielik',
          '`NH = $α · $K` = 48 · 0,4 V = 19,2 V',
          '`$C = @f{1}{$K} = @f{1}{0,4}` = 2,5 dielika/V',
          'Na rozsahu 300 V by mal ten istý prístroj `$K` = 300 V / 75 dielikov = 4 V/dielik a rovnaká výchylka by znamenala 48 · 4 V = 192 V. Po každom prepnutí rozsahu treba konštantu vypočítať znova.',
        ],
        result: 'NH = 19,2 V; `$K` = 0,4 V/dielik; `$C` = 2,5 dielika/V',
      },
      { t: 'h', text: 'Preťažiteľnosť' },
      { t: 'p', text: '**Preťažiteľnosť** je odolnosť prístroja voči preťaženiu prúdom alebo napätím, ktoré vydrží za určitý krátky čas bez poškodenia, teda bez zmeny triedy presnosti. Výrobca obyčajne zabezpečuje krátkodobé preťaženie o 20 % rozsahu. Preťažením sa môžu poškodiť **mechanické časti** (ohnutie ručičky, poškodenie direktívnej pružiny) aj **elektrické časti** (vodiče, diódy). Základné zásady proti preťaženiu:' },
      {
        t: 'list',
        items: [
          'ak dopredu nepoznáš veľkosť meranej veličiny, nastav **najväčší rozsah**,',
          'správne zapoj **polaritu** jednosmerného zdroja,',
          'pred zapnutím **zníž napätie zdroja na minimum**,',
          'správne zvoľ **meraciu metódu a meracie prístroje**,',
          'prípojný vodič najprv len **krátkodobo prilož** k zdierke prístroja a sleduj výchylku.',
        ],
      },
      { t: 'h', text: 'Elektrická pevnosť a značky na číselníku' },
      { t: 'p', text: '**Elektrická pevnosť** izolácie elektrických prístrojov sa skúša **skúšobným napätím**. Jeho hodnotu aj ďalšie dôležité vlastnosti prístroja vyjadrujú **značky na číselníku**:' },
      {
        t: 'table',
        head: ['Značka', 'Význam'],
        rows: [
          ['grafická značka meracej sústavy', 'princíp, na ktorom prístroj pracuje, napr. magnetoelektrický alebo elektromagnetický'],
          ...DIAL_MARKS.map((m) => [m.mark === '☆' ? '☆ (bez čísla)' : m.mark, m.meaning]),
        ],
      },
      { t: 'h', text: 'Vlastná spotreba prístroja' },
      { t: 'p', text: '**Vlastná spotreba** meracieho prístroja je príkon, ktorý prístroj spotrebuje pri plnej výchylke. Prístroj zaťažuje meraný objekt ako záťaž s určitým odporom, a preto môže spôsobiť chybu merania. Pri meraniach, v ktorých sa robí korekcia na spotrebu prístroja, treba poznať vnútorné odpory voltmetra a ampérmetra.' },
      {
        t: 'figure',
        fig: voltmeterConsumptionFigure,
        caption: 'Voltmeter pripojený paralelne k odporu `$R` odoberá prúd `$I_{V}`. Jeho vnútorný odpor sa obyčajne udáva na 1 V rozsahu (Ω/V), preto so zväčšovaním rozsahu rastie.',
      },
      {
        t: 'formula',
        tex: ['$R_{V} = $R_{iV} · MR', '$P_{V} = @f{$U^{2}}{$R_{V}}'],
        legend: [
          ['$R_{iV}', 'vnútorný odpor na 1 V rozsahu', 'Ω/V'],
          ['MR', 'napäťový rozsah voltmetra', 'V'],
          ['$R_{V}', 'vnútorný odpor voltmetra na danom rozsahu', 'Ω'],
          ['$U', 'napätie na voltmetri', 'V'],
          ['$P_{V}', 'príkon voltmetra', 'W'],
        ],
      },
      {
        t: 'example',
        title: 'Spotreba voltmetra',
        given: ['`$R_{iV}` = 1 000 Ω/V', 'MR = 30 V', '`$U` = 24 V'],
        steps: [
          '`$R_{V} = $R_{iV} · MR` = 1 000 Ω/V · 30 V = 30 000 Ω = 30 kΩ',
          'Pri plnej výchylke: `$P_{V} = @f{30^{2}}{30 000}` W = 0,03 W = 30 mW',
          'Pri napätí 24 V: `$P_{V} = @f{24^{2}}{30 000}` W = 0,0192 W = 19,2 mW',
          'Voltmeter s 20 kΩ/V by mal na tom istom rozsahu `$R_{V}` = 600 kΩ a vlastnú spotrebu len `@f{30^{2}}{600 000}` W = 1,5 mW.',
        ],
        result: '`$R_{V}` = 30 kΩ, vlastná spotreba 30 mW, pri 24 V odoberá 19,2 mW',
      },
      {
        t: 'figure',
        fig: ammeterConsumptionFigure,
        caption: 'Na vnútornom odpore ampérmetra vzniká úbytok napätia `Δ$U_{A}`. Výrobca udáva `$R_{A}` priamo alebo nepriamo ako úbytok napätia pri menovitom prúde – vtedy `$R_{A} = @f{Δ$U_{A}}{MR}`. Pri bežných ampérmetroch sa udáva zriedkavo, častejšie pri presných laboratórnych.',
      },
      {
        t: 'formula',
        tex: ['Δ$U_{A} = $R_{A} · MR', '$P_{A} = $I^{2} · $R_{A}'],
        legend: [
          ['$R_{A}', 'vnútorný odpor ampérmetra', 'Ω'],
          ['MR', 'prúdový rozsah ampérmetra', 'A'],
          ['Δ$U_{A}', 'úbytok napätia na ampérmetri pri plnej výchylke', 'V'],
          ['$I', 'prúd ampérmetrom', 'A'],
          ['$P_{A}', 'príkon ampérmetra', 'W'],
        ],
      },
      {
        t: 'example',
        title: 'Spotreba ampérmetra',
        given: ['`$R_{A}` = 0,05 Ω', 'MR = 2 A', '`$I` = 1,5 A'],
        steps: [
          '`Δ$U_{A} = $R_{A} · MR` = 0,05 Ω · 2 A = 0,1 V',
          'Pri plnej výchylke: `$P_{A}` = 2² · 0,05 W = 0,2 W',
          'Pri prúde 1,5 A: `$P_{A}` = 1,5² · 0,05 W = 2,25 · 0,05 W ≈ 0,113 W',
          'Spotreba ampérmetra je tým menšia, čím menší je jeho vnútorný odpor.',
        ],
        result: '`Δ$U_{A}` = 0,1 V, vlastná spotreba 0,2 W, pri 1,5 A odoberá ≈ 113 mW',
      },
      { t: 'note', kind: 'remember', text: '**Zapojenie meracích prístrojov:** voltmeter pripájaj **paralelne** k meranému objektu a vyber ho s čo **najväčším** vnútorným odporom. Ampérmeter zapájaj **do série** a vyber ho s čo **najmenším** vnútorným odporom – ideálny ampérmeter by mal `$R_{A}` = 0 Ω.' },
    ],
  },

  questions: [
    {
      lessonId: ID,
      prompt: 'Čo udáva konštanta analógového meracieho prístroja?',
      options: [
        'počet jednotiek meranej veličiny, ktoré pripadnú na jeden dielik stupnice',
        'počet dielikov, ktoré pripadnú na jednu jednotku meranej veličiny',
        'počet dielikov celej stupnice',
        'najväčšiu chybu prístroja v percentách rozsahu',
      ],
      explanation: '`$K = @f{MR}{$α_{max}}` – napr. V/dielik. Počet dielikov na jednotku veličiny je citlivosť `$C = @f{1}{$K}`, chybu v % rozsahu udáva trieda presnosti.',
    },
    {
      lessonId: ID,
      prompt: 'Voltmeter má rozsah 60 V a stupnicu so 120 dielikmi. Ručička ukazuje 90 dielikov. Aká je nameraná hodnota?',
      options: ['45 V', '90 V', '180 V', '0,75 V'],
      explanation: '`$K` = 60 V / 120 dielikov = 0,5 V/dielik, `NH = $α · $K` = 90 · 0,5 V = 45 V.',
    },
    {
      lessonId: ID,
      prompt: 'Prístroj s jednou stupnicou prepneš na väčší rozsah. Ako sa zmení jeho citlivosť?',
      options: [
        'zmenší sa, lebo konštanta `$K` sa zväčší',
        'zväčší sa, lebo konštanta `$K` sa zväčší',
        'nezmení sa, stupnica je stále rovnaká',
        'zväčší sa, lebo pribudnú dieliky',
      ],
      explanation: 'Pri rovnakom počte dielikov rastie `$K = @f{MR}{$α_{max}}` s rozsahom. Citlivosť `$C = @f{1}{$K}` preto klesá.',
    },
    {
      lessonId: ID,
      prompt: 'Čo NEPATRÍ medzi zásady ochrany meracieho prístroja proti preťaženiu?',
      options: [
        'pri neznámej veľkosti meranej veličiny začať na najmenšom rozsahu',
        'pri neznámej veľkosti meranej veličiny nastaviť najväčší rozsah',
        'pred zapnutím znížiť napätie zdroja na minimum',
        'prípojný vodič najprv len krátkodobo priložiť k zdierke prístroja',
      ],
      explanation: 'Ak veľkosť meranej veličiny dopredu nepoznáme, začíname na najväčšom rozsahu. Na najmenšom rozsahu by sa prístroj mohol preťažiť a poškodiť.',
    },
    {
      lessonId: ID,
      prompt: 'Ako zapájame voltmeter a aký má mať vnútorný odpor?',
      options: ['paralelne, s čo najväčším vnútorným odporom', 'paralelne, s čo najmenším vnútorným odporom', 'do série, s čo najväčším vnútorným odporom', 'do série, s čo najmenším vnútorným odporom'],
      explanation: 'Voltmeter meria napätie medzi dvoma bodmi, preto je paralelne. Čím väčší má vnútorný odpor, tým menší prúd odoberá a tým menej ovplyvní meraný obvod.',
    },
    {
      lessonId: ID,
      prompt: 'Voltmeter má údaj 20 kΩ/V. Aký je jeho vnútorný odpor na rozsahu 10 V?',
      options: ['200 kΩ', '20 kΩ', '2 kΩ', '2 MΩ'],
      explanation: '`$R_{V} = $R_{iV} · MR` = 20 000 Ω/V · 10 V = 200 000 Ω = 200 kΩ.',
    },
    {
      lessonId: ID,
      prompt: 'Na číselníku prístroja je hviezdička s číslom 2. Čo znamená?',
      options: ['izolácia bola skúšaná skúšobným napätím 2 kV', 'trieda presnosti je 2', 'prístroj znesie dvojnásobné preťaženie', 'prístroj má dva meracie rozsahy'],
      explanation: 'Hviezdička označuje skúšobné napätie izolácie – číslo udáva napätie v kV. Hviezdička bez čísla znamená 500 V, s číslom 0 izolácia skúšaná nebola.',
    },
    {
      lessonId: ID,
      prompt: 'Čo je vlastná spotreba meracieho prístroja?',
      options: [
        'príkon, ktorý prístroj spotrebuje pri plnej výchylke',
        'energia, ktorú prístroj spotrebuje za hodinu merania',
        'najväčší prúd, ktorý prístroj krátkodobo vydrží',
        'úbytok napätia na meranom spotrebiči',
      ],
      explanation: 'Vlastná spotreba je príkon prístroja pri plnej výchylke. Pre voltmeter `$P_{V} = @f{$U^{2}}{$R_{V}}`, pre ampérmeter `$P_{A} = $I^{2} · $R_{A}`.',
    },
    {
      lessonId: ID,
      prompt: 'Dva ampérmetre s rovnakým rozsahom majú vnútorný odpor 0,1 Ω a 1 Ω. Ktorý menej ovplyvní meraný obvod?',
      options: [
        'ampérmeter s odporom 0,1 Ω – má menší úbytok napätia aj spotrebu',
        'ampérmeter s odporom 1 Ω – väčší odpor znamená presnejšie meranie',
        'oba rovnako, lebo majú rovnaký rozsah',
        'nedá sa určiť bez triedy presnosti',
      ],
      explanation: 'Úbytok `Δ$U_{A} = $R_{A} · $I` aj príkon `$P_{A} = $I^{2} · $R_{A}` sú úmerné vnútornému odporu. Ideálny ampérmeter by mal `$R_{A}` = 0 Ω.',
    },
  ],

  generators,
};

export default mod;
