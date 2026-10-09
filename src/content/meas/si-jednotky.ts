import { s } from '../../lib/dom';
import { pick, shuffle, type Rng } from '../../lib/random';
import { fmt, superscript } from '../../lib/units';
import { b, n, numeric, q, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { dashedWire, dot, note, schematic, valueText, wire } from '../../ui/schematic';
import type { MeasModule } from './types';

const ID = 'si-jednotky';

const r1 = (x: number) => Math.round(x * 10) / 10;

// ---------------------------------------------------------------- údaje

interface Unit {
  name: string;
  sym: string;
  /** Veličina, ktorej je jednotkou. */
  qty: string;
  /** Názov veličiny v 2. páde („jednotka dĺžky“). */
  qtyGen: string;
}

/** Tab. 1.1 – základné jednotky SI v poradí zo skrípt. */
const BASE_UNITS: readonly (Unit & { qtySym: string })[] = [
  { qty: 'dĺžka', qtyGen: 'dĺžky', qtySym: '$l', name: 'meter', sym: 'm' },
  { qty: 'hmotnosť', qtyGen: 'hmotnosti', qtySym: '$m', name: 'kilogram', sym: 'kg' },
  { qty: 'čas', qtyGen: 'času', qtySym: '$t', name: 'sekunda', sym: 's' },
  { qty: 'termodynamická teplota', qtyGen: 'termodynamickej teploty', qtySym: '$T', name: 'kelvin', sym: 'K' },
  { qty: 'elektrický prúd', qtyGen: 'elektrického prúdu', qtySym: '$I', name: 'ampér', sym: 'A' },
  { qty: 'svietivosť', qtyGen: 'svietivosti', qtySym: '$I_{v}', name: 'kandela', sym: 'cd' },
  { qty: 'látkové množstvo', qtyGen: 'látkového množstva', qtySym: '$n', name: 'mol', sym: 'mol' },
];

/** Odvodené jednotky s osobitným názvom: definičný vzťah a vyjadrenie základnými jednotkami. */
const DERIVED_UNITS: readonly (Unit & { qtySym: string; def: string; base: string })[] = [
  { qty: 'elektrický náboj', qtyGen: 'elektrického náboja', qtySym: '$Q', name: 'coulomb', sym: 'C', def: 'A·s', base: 'A·s' },
  { qty: 'sila', qtyGen: 'sily', qtySym: '$F', name: 'newton', sym: 'N', def: 'kg·m/s²', base: 'kg·m·s⁻²' },
  { qty: 'práca, energia', qtyGen: 'práce a energie', qtySym: '$W', name: 'joule', sym: 'J', def: 'N·m', base: 'kg·m²·s⁻²' },
  { qty: 'výkon', qtyGen: 'výkonu', qtySym: '$P', name: 'watt', sym: 'W', def: 'J/s', base: 'kg·m²·s⁻³' },
  { qty: 'elektrické napätie', qtyGen: 'elektrického napätia', qtySym: '$U', name: 'volt', sym: 'V', def: 'W/A', base: 'kg·m²·s⁻³·A⁻¹' },
  { qty: 'elektrický odpor', qtyGen: 'elektrického odporu', qtySym: '$R', name: 'ohm', sym: 'Ω', def: 'V/A', base: 'kg·m²·s⁻³·A⁻²' },
  { qty: 'elektrická vodivosť', qtyGen: 'elektrickej vodivosti', qtySym: '$G', name: 'siemens', sym: 'S', def: 'A/V', base: 'kg⁻¹·m⁻²·s³·A²' },
  { qty: 'kapacita', qtyGen: 'kapacity', qtySym: '$C', name: 'farad', sym: 'F', def: 'C/V', base: 'kg⁻¹·m⁻²·s⁴·A²' },
  { qty: 'indukčnosť', qtyGen: 'indukčnosti', qtySym: '$L', name: 'henry', sym: 'H', def: 'V·s/A', base: 'kg·m²·s⁻²·A⁻²' },
  { qty: 'frekvencia', qtyGen: 'frekvencie', qtySym: '$f', name: 'hertz', sym: 'Hz', def: '1/s', base: 's⁻¹' },
];

const unitLabel = (u: Unit) => (u.name === u.sym ? u.name : `${u.name} (${u.sym})`);
const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Výsledok bez predpony aj s predponou tak, aby obe čísla boli presné (najviac 6 platných číslic),
 * inak zaokrúhlené na 4 platné číslice – „266 400 C = 266,4 kC“, nie nepravdivé „266 000 C = 266 kC“.
 */
function resExact(v: number, unit: string): string {
  const clean = Number(v.toPrecision(12));
  const sig = [3, 4, 5, 6].find((d) => Number(clean.toPrecision(d)) === clean) ?? 4;
  const base = b(clean, unit, sig);
  const pref = q(clean, unit, sig);
  return base === pref ? `**${pref}**` : `${base} = **${pref}**`;
}

/** Tab. 1.2 – predpony násobkov a dielov. */
const PREFIXES: readonly { name: string; sym: string; exp: number; example: string }[] = [
  { name: 'tera', sym: 'T', exp: 12, example: '1 THz = 10¹² Hz' },
  { name: 'giga', sym: 'G', exp: 9, example: '2,4 GHz (Wi-Fi)' },
  { name: 'mega', sym: 'M', exp: 6, example: '10 MΩ' },
  { name: 'kilo', sym: 'k', exp: 3, example: '22 kV' },
  { name: 'mili', sym: 'm', exp: -3, example: '150 mA' },
  { name: 'mikro', sym: 'µ', exp: -6, example: '50 µA' },
  { name: 'nano', sym: 'n', exp: -9, example: '100 nF' },
  { name: 'piko', sym: 'p', exp: -12, example: '22 pF' },
];

const PREFIX_EXP: Record<string, number> = { T: 12, G: 9, M: 6, k: 3, '': 0, m: -3, 'µ': -6, n: -9, p: -12 };

const pow10 = (e: number) => `10${superscript(e)}`;

// ---------------------------------------------------------------- obrázky

/** Číselná os predpôn: susedné predpony sa líšia 1 000-krát. */
function prefixLadder(): SVGSVGElement {
  const steps = [
    { name: 'piko', sym: 'p', exp: -12 },
    { name: 'nano', sym: 'n', exp: -9 },
    { name: 'mikro', sym: 'µ', exp: -6 },
    { name: 'mili', sym: 'm', exp: -3 },
    { name: '', sym: '—', exp: 0 },
    { name: 'kilo', sym: 'k', exp: 3 },
    { name: 'mega', sym: 'M', exp: 6 },
    { name: 'giga', sym: 'G', exp: 9 },
    { name: 'tera', sym: 'T', exp: 12 },
  ];
  const x = (i: number) => 40 + i * 48;
  const axisY = 54;
  const arrow = (y: number, dir: 1 | -1): SVGElement[] => {
    const from = dir === 1 ? x(0) : x(8);
    const to = dir === 1 ? x(8) : x(0);
    return [
      wire([from, y], [to - dir * 8, y]),
      s('polygon', { points: `${to},${y} ${to - dir * 9},${y - 4.5} ${to - dir * 9},${y + 4.5}`, class: 'f' }),
    ];
  };
  return schematic(
    464, 166, 'Číselná os predpôn od piko po tera, susedné predpony sa líšia tisíckrát',
    wire([x(0) - 16, axisY], [x(8) + 16, axisY]),
    ...steps.flatMap((st, i) => [
      wire([x(i), axisY - 6], [x(i), axisY + 6]),
      ...(st.name ? [valueText(x(i), 16, st.name)] : []),
      note(x(i), 40, st.sym),
      valueText(x(i), 78, pow10(st.exp)),
    ]),
    ...arrow(100, 1),
    valueText(232, 120, 'o krok doprava: číslo vydeľ 1 000 (4 700 µA = 4,7 mA)'),
    ...arrow(138, -1),
    valueText(232, 158, 'o krok doľava: číslo vynásob 1 000 (2,2 kΩ = 2 200 Ω)'),
  );
}

/** Stupnica termodynamickej teploty a teploty podľa Celzia vedľa seba. */
function temperatureScales(): SVGSVGElement {
  const xK = 120;
  const xC = 214;
  const y = (K: number) => r1(250 - 0.55 * K);
  const marks = [
    { K: 373.15, k: '373,15 K', c: '100 °C', desc: 'var vody' },
    { K: 273.15, k: '273,15 K', c: '0 °C', desc: 'topenie ľadu' },
    { K: 0, k: '0 K', c: '−273,15 °C', desc: 'absolútna nula' },
  ];
  const ticksK = Array.from({ length: 9 }, (_, i) => i * 50);
  const ticksC = Array.from({ length: 8 }, (_, i) => -250 + i * 50);
  const header = (cx: number, sym: string, unit: string) =>
    s('text', { x: cx, y: 16, 'text-anchor': 'middle' }, s('tspan', { class: 'it' }, sym), ` [${unit}]`);
  return schematic(
    350, 280, 'Termodynamická teplota v kelvinoch a teplota v stupňoch Celzia sú posunuté o 273,15',
    header(xK, 'T', 'K'),
    header(xC, 't', '°C'),
    wire([xK, 26], [xK, 256]),
    wire([xC, 26], [xC, 256]),
    ...ticksK.map((K) => wire([xK - 5, y(K)], [xK, y(K)])),
    ...ticksC.map((t) => wire([xC, y(t + 273.15)], [xC + 5, y(t + 273.15)])),
    ...marks.flatMap((m) => [
      dashedWire([xK, y(m.K)], [xC, y(m.K)]),
      dot([xK, y(m.K)]),
      dot([xC, y(m.K)]),
      note(xK - 11, y(m.K) + 5, m.k, 'end'),
      note(xC + 11, y(m.K) + 5, m.c, 'start'),
      valueText(xC + 11, y(m.K) + 20, m.desc, 'start'),
    ]),
  );
}

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

const CELSIUS: readonly { t: number; ctx: string }[] = [
  { t: 20, ctx: 'Odpory meriame pri laboratórnej teplote 20 °C.' },
  { t: 23, ctx: 'V meracom laboratóriu je teplota 23 °C.' },
  { t: 37, ctx: 'Teplota ľudského tela je približne 37 °C.' },
  { t: 45, ctx: 'Chladič tranzistora sa zohrial na 45 °C.' },
  { t: 60, ctx: 'Kryt transformátora má teplotu 60 °C.' },
  { t: 85, ctx: 'Vinutie motora sa pri prevádzke zohrialo na 85 °C.' },
  { t: 100, ctx: 'Voda pri normálnom tlaku vrie pri 100 °C.' },
  { t: 125, ctx: 'Súčiastka je určená na prácu do teploty 125 °C.' },
  { t: 250, ctx: 'Hrot spájkovačky má teplotu 250 °C.' },
];

const KELVIN: readonly number[] = [280, 290, 300, 310, 320, 350, 373.15, 400, 450, 500, 600];

const CAPACITIES: readonly { value: number; mAh: boolean; ctx: string }[] = [
  { value: 2000, mAh: true, ctx: 'Nabíjateľný článok NiMH veľkosti AA má kapacitu' },
  { value: 2500, mAh: true, ctx: 'Nabíjateľný článok NiMH veľkosti AA má kapacitu' },
  { value: 4500, mAh: true, ctx: 'Batéria mobilného telefónu má kapacitu' },
  { value: 5000, mAh: true, ctx: 'Batéria mobilného telefónu má kapacitu' },
  { value: 10000, mAh: true, ctx: 'Powerbanka má kapacitu' },
  { value: 7, mAh: false, ctx: 'Olovený akumulátor do záložného zdroja má kapacitu' },
  { value: 12, mAh: false, ctx: 'Akumulátor do elektrobicykla má kapacitu' },
  { value: 45, mAh: false, ctx: 'Akumulátor do auta má kapacitu' },
  { value: 60, mAh: false, ctx: 'Akumulátor do auta má kapacitu' },
  { value: 74, mAh: false, ctx: 'Akumulátor do auta má kapacitu' },
];

/** Prevody s predponami – iné ako v lekcii Elektrické veličiny a jednotky. */
const PREFIX_CONVERSIONS: readonly { m: number[]; from: string; to: string; unit: string }[] = [
  { m: [1.5, 2.2, 4.7, 10], from: 'M', to: '', unit: 'Ω' },
  { m: [2, 20, 200], from: 'G', to: 'M', unit: 'Ω' },
  { m: [1.8, 2.4, 2.45, 5.2], from: 'G', to: 'M', unit: 'Hz' },
  { m: [150, 455, 820], from: 'k', to: 'M', unit: 'Hz' },
  { m: [4.7, 15, 350, 2500], from: 'µ', to: 'm', unit: 'A' },
  { m: [0.25, 0.6, 1.2, 4.5], from: 'm', to: 'µ', unit: 'A' },
  { m: [50, 120, 680, 3300], from: 'm', to: '', unit: 'V' },
  { m: [0.05, 0.2, 1.5], from: 'M', to: 'k', unit: 'W' },
  { m: [25, 100, 470], from: 'm', to: '', unit: 'Ω' },
  { m: [0.1, 0.33, 2.2], from: 'µ', to: 'p', unit: 'F' },
  { m: [40, 250, 1200], from: 'µ', to: 'm', unit: 's' },
];

const generators: Generator[] = [
  // °C ↔ K
  (rng) => {
    if (rng() < 0.5) {
      const { t, ctx } = pick(rng, CELSIUS);
      const T = t + 273.15;
      return numeric(ID, `${ctx} Vyjadri túto teplotu ako termodynamickú teplotu v kelvinoch.`, T, 'K', [
        'K teplote podľa Celzia pripočítaj `$T_{0}`: `$T = $t + $T_{0}`, kde `$T_{0}` = 273,15 K.',
        `\`$T\` = (${n(t)} + 273,15) K = **${fmt(T, 6)} K**`,
      ], { fixedUnit: true, tolerance: 0.005 });
    }
    const T = pick(rng, KELVIN);
    const t = T - 273.15;
    return numeric(ID, `Termodynamická teplota telesa je ${fmt(T, 5)} K. Aká je jeho teplota v stupňoch Celzia?`, t, '°C', [
      'Teplota podľa Celzia je rozdiel `$t = $T − $T_{0}`, kde `$T_{0}` = 273,15 K.',
      `\`$t\` = (${fmt(T, 5)} − 273,15) °C = **${fmt(t, 6)} °C**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },

  // A·h ↔ C
  (rng) => {
    const cap = pick(rng, CAPACITIES);
    const Ah = cap.mAh ? cap.value / 1000 : cap.value;
    const Q = Ah * 3600;
    if (rng() < 0.6) {
      const given = cap.mAh ? `${fmt(cap.value)} mA·h` : `${fmt(cap.value)} A·h`;
      return numeric(ID, `${cap.ctx} ${given}. Aký náboj zodpovedá tejto kapacite?`, Q, 'C', [
        '1 h = 3 600 s, preto 1 A·h = 1 A · 3 600 s = 3 600 C.',
        ...(cap.mAh ? [`${fmt(cap.value)} mA·h = ${n(Ah)} A·h`] : []),
        `\`$Q\` = ${n(Ah)} · 3 600 C = ${resExact(Q, 'C')}`,
      ]);
    }
    return numeric(ID, `Akumulátor prijal pri nabíjaní náboj ${fmt(Q)} C. Koľko ampérhodín (A·h) to je?`, Ah, 'A·h', [
      '1 A·h = 1 A · 3 600 s = 3 600 C, preto náboj v coulomboch vydeľ číslom 3 600.',
      `${fmt(Q)} C : 3 600 C/(A·h) = **${n(Ah)} A·h**`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },

  // prevody s predponami
  (rng) => {
    const c = pick(rng, PREFIX_CONVERSIONS);
    const m = pick(rng, c.m);
    const eFrom = PREFIX_EXP[c.from];
    const eTo = PREFIX_EXP[c.to];
    const d = eFrom - eTo;
    const ans = Number((d >= 0 ? m * 10 ** d : m / 10 ** -d).toPrecision(6));
    const from = `${c.from}${c.unit}`;
    const to = `${c.to}${c.unit}`;
    const one = `1 ${from} = ${pow10(d)} ${to} = ${fmt(10 ** d, 7)} ${to}`;
    const first = c.from !== '' && c.to !== ''
      ? `1 ${from} = ${pow10(eFrom)} ${c.unit} a 1 ${to} = ${pow10(eTo)} ${c.unit}, preto ${one}.`
      : `${one}.`;
    return numeric(ID, `Preveď ${n(m)} ${from} na ${to}.`, ans, to, [
      first,
      `${n(m)} ${from} = ${n(m)} · ${pow10(d)} ${to} = **${fmt(ans, 7)} ${to}**`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },

  // základná alebo odvodená jednotka
  (rng) => {
    const derivedPool = shuffle(rng, DERIVED_UNITS);
    const basePool = shuffle(rng, BASE_UNITS);
    const baseList = 'm, kg, s, A, K, mol, cd';
    if (rng() < 0.5) {
      const right = basePool[0];
      const wrong = derivedPool.slice(0, 3);
      return choice(rng, 'Ktorá z týchto jednotiek je **základnou** jednotkou sústavy SI?', unitLabel(right),
        wrong.map(unitLabel),
        `${capitalize(unitLabel(right))} je základná jednotka ${right.qtyGen}. Základných jednotiek SI je sedem: ${baseList}. Ostatné možnosti sú odvodené: ${wrong.map((u) => `${u.sym} = ${u.def}`).join(', ')}.`);
    }
    const right = derivedPool[0];
    const wrong = basePool.slice(0, 3);
    const expr = right.def === right.base ? right.base : `${right.def} = ${right.base}`;
    return choice(rng, 'Ktorá z týchto jednotiek je **odvodenou** jednotkou sústavy SI?', unitLabel(right),
      wrong.map(unitLabel),
      `${capitalize(unitLabel(right))} je odvodená jednotka ${right.qtyGen}: ${right.sym} = ${expr}. Ostatné tri patria medzi sedem základných jednotiek SI (${baseList}).`);
  },

  // vyjadrenie odvodenej jednotky základnými jednotkami
  (rng) => {
    const [right, ...rest] = shuffle(rng, DERIVED_UNITS);
    const wrong = rest.slice(0, 3);
    return choice(rng, `Ako sa vyjadrí ${unitLabel(right)}, jednotka ${right.qtyGen}, pomocou základných jednotiek SI?`,
      right.base, wrong.map((u) => u.base),
      `${right.sym} = ${right.def}${right.def === right.base ? '' : ` = ${right.base}`}. Ostatné vyjadrenia patria iným jednotkám: ${wrong.map((u) => `${u.base} = ${u.sym} (${u.name})`).join('; ')}.`);
  },
];

// ---------------------------------------------------------------- lekcia

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Zákonné meracie jednotky (SI)',
    summary: 'Základné a odvodené jednotky sústavy SI, predpony násobkov a dielov a prevod teploty medzi kelvinmi a stupňami Celzia.',
    minutes: 9,
    blocks: [
      { t: 'p', text: 'Merať a kontrolovať treba nielen elektrické veličiny, ale aj neelektrické – napríklad čas, dĺžku, teplotu, tlak alebo silu. Výsledok merania má zmysel, len ak mu každý rozumie rovnako, preto používame **zákonné meracie jednotky**. Sú to jednotky Medzinárodnej sústavy jednotiek **SI** a na Slovensku ich ustanovuje **vyhláška č. 206 zo 16. júna 2000** Úradu pre normalizáciu, metrológiu a skúšobníctvo SR o zákonných meracích jednotkách. Patria k nim:' },
      {
        t: 'list',
        items: [
          '**základné jednotky SI** – sedem jednotiek, z ktorých sa odvodzujú všetky ostatné; z jednotiek elektrických veličín medzi ne patrí iba **ampér**,',
          '**odvodené jednotky SI** – získavajú sa zo základných jednotiek pomocou rovnice, ktorou je definovaná príslušná veličina (volt, ohm, farad…),',
          '**násobky a diely jednotiek SI** – vznikajú násobením jednotky mocninou desiatich a označujú sa predponou (kΩ, mA, µF…).',
        ],
      },
      { t: 'h', text: 'Základné jednotky SI' },
      {
        t: 'table',
        head: ['Veličina', 'Značka veličiny', 'Jednotka', 'Značka jednotky'],
        rows: BASE_UNITS.map((u) => [u.qty, `\`${u.qtySym}\``, u.name, u.sym]),
      },
      { t: 'h', text: 'Odvodené jednotky SI' },
      { t: 'p', text: 'Odvodenú jednotku získaš tak, že do rovnice, ktorou je veličina definovaná, dosadíš namiesto veličín ich jednotky. Zápis `[$Q]` čítaj „jednotka veličiny `$Q`“. Elektrický náboj je súčin prúdu a času, `$Q = $I · $t`, preto:' },
      { t: 'formula', tex: '[$Q] = [$I] · [$t] = A · s = C' },
      {
        t: 'table',
        head: ['Veličina', 'Jednotka a jej odvodenie', 'V základných jednotkách'],
        rows: DERIVED_UNITS.map((u) => [`${u.qty} \`${u.qtySym}\``, `${u.name}: ${u.sym} = ${u.def}`, u.base]),
      },
      { t: 'p', text: 'Väčšina odvodených jednotiek má osobitný názov (volt, ohm, farad…), niektoré ho však nemajú – napríklad intenzita elektrického poľa má jednotku **V·m⁻¹** (volt na meter). Každú odvodenú jednotku možno vyjadriť ako súčin mocnín základných jednotiek. Kapacitu akumulátorov udávajú výrobcovia v **ampérhodinách**: keďže 1 h = 3 600 s, platí **1 A·h = 3 600 C**.' },
      {
        t: 'example',
        title: 'Volt vyjadrený základnými jednotkami',
        given: ['V = W/A', 'W = J/s', 'J = N·m', 'N = kg·m·s⁻²'],
        steps: [
          'J = N · m = kg·m·s⁻² · m = kg·m²·s⁻²',
          'W = J/s = kg·m²·s⁻² · s⁻¹ = kg·m²·s⁻³',
          'V = W/A = kg·m²·s⁻³ · A⁻¹',
        ],
        result: '1 V = 1 kg·m²·s⁻³·A⁻¹',
      },
      { t: 'h', text: 'Násobky a diely jednotiek' },
      { t: 'p', text: 'Násobok alebo diel jednotky vytvoríš tak, že jednotku vynásobíš mocninou desiatich. **Názov** násobku vznikne pridaním predpony k názvu jednotky (kiloohm, mikroampér), **symbol** spojením symbolu predpony a symbolu jednotky (kΩ, µA).' },
      {
        t: 'table',
        head: ['Predpona', 'Symbol', 'Mocnina', 'Príklad'],
        rows: PREFIXES.map((p) => [p.name, p.sym, pow10(p.exp), p.example]),
      },
      { t: 'figure', fig: prefixLadder, caption: 'Susedné predpony sa líšia tisíckrát. Pri prechode k väčšej predpone sa číslo tisíckrát zmenší, pri prechode k menšej sa tisíckrát zväčší.' },
      {
        t: 'list',
        items: [
          '**Symbol predpony píš tesne pred symbol jednotky**, bez medzery a bez bodky: kΩ, mA, µF. Medzi číslo a jednotku sa píše medzera: 4,7 kΩ, 230 V, 20 °C.',
          '**Nespájaj dve predpony**: 10⁻⁹ F zapíš ako 1 nF, nie 1 mµF. Kilogram už predponu má, preto sa násobky a diely hmotnosti tvoria od gramu: 1 mg, nie 1 µkg.',
          '**Veľkosť písmen rozhoduje**: m je mili (10⁻³), M je mega (10⁶). Kilo sa píše malým k.',
          '**Mocnina pri jednotke s predponou platí pre celý násobok**: 1 mm² = (10⁻³ m)² = 10⁻⁶ m².',
        ],
      },
      {
        t: 'example',
        title: 'Prevody s predponami',
        given: ['`$I` = 4 700 µA', '`$f` = 2,45 GHz', '`$R` = 2,2 MΩ'],
        steps: [
          '4 700 µA = 4 700 · 10⁻⁶ A = 4,7 · 10⁻³ A = 4,7 mA',
          '2,45 GHz = 2,45 · 10⁹ Hz = 2 450 · 10⁶ Hz = 2 450 MHz',
          '2,2 MΩ = 2,2 · 10⁶ Ω = 2 200 000 Ω',
        ],
        result: '4,7 mA; 2 450 MHz; 2 200 000 Ω',
      },
      { t: 'h', text: 'Termodynamická teplota a teplota podľa Celzia' },
      { t: 'p', text: 'Základnou jednotkou teploty je **kelvin (K)** – jednotka termodynamickej teploty `$T`. Okrem nej sa používa **teplota podľa Celzia** `$t`, ktorej jednotkou je **stupeň Celzia (°C)**. Teplota podľa Celzia je rozdiel dvoch termodynamických teplôt `$T` a `$T_{0}`:' },
      {
        t: 'formula',
        tex: ['$t = $T − $T_{0}', '$T = $t + $T_{0}'],
        legend: [['$T', 'termodynamická teplota', 'K'], ['$t', 'teplota podľa Celzia', '°C'], ['$T_{0}', 'stála hodnota 273,15 K', 'K']],
      },
      { t: 'figure', fig: temperatureScales, caption: 'Obe stupnice majú rovnako veľký dielik, sú len navzájom posunuté o 273,15. Najnižšej možnej teplote – absolútnej nule – zodpovedá 0 K.' },
      { t: 'note', kind: 'remember', text: 'Rozdiel teplôt má v kelvinoch aj v stupňoch Celzia rovnakú číselnú hodnotu: oteplenie z 20 °C na 80 °C je 60 °C, teda aj 60 K. Preto sa teplotný súčiniteľ odporu udáva v K⁻¹ aj v 1/°C. Kelviny píš bez znaku stupňa: 300 K, nie 300 °K.' },
      {
        t: 'example',
        title: 'Prevod teploty',
        given: ['`$t` = 20 °C (laboratórne podmienky)', '`$T` = 350 K'],
        steps: [
          '`$T = $t + $T_{0}` = (20 + 273,15) K = 293,15 K',
          '`$t = $T − $T_{0}` = 350 − 273,15 = 76,85 °C',
        ],
        result: '20 °C = 293,15 K; 350 K zodpovedá 76,85 °C',
      },
    ],
  },

  questions: [
    {
      lessonId: ID,
      prompt: 'Ktorá z týchto jednotiek je základnou jednotkou sústavy SI?',
      options: ['ampér (A)', 'volt (V)', 'ohm (Ω)', 'coulomb (C)'],
      explanation: 'Z elektrických jednotiek je základnou jednotkou SI iba ampér. Volt, ohm aj coulomb sú odvodené jednotky, napríklad C = A·s a Ω = V/A.',
    },
    {
      lessonId: ID,
      prompt: 'Čo patrí podľa vyhlášky č. 206/2000 medzi zákonné meracie jednotky?',
      options: [
        'základné a odvodené jednotky SI a ich násobky a diely',
        'len sedem základných jednotiek SI',
        'len jednotky, ktoré majú osobitný názov',
        'akékoľvek jednotky, ktoré uvedie výrobca prístroja',
      ],
      explanation: 'Zákonné meracie jednotky tvoria základné jednotky SI, odvodené jednotky SI a násobky a diely jednotiek SI vytvorené pomocou predpôn.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa vyjadrí coulomb pomocou základných jednotiek SI?',
      options: ['A·s', 'A/s', 'V·A', 'W·s'],
      explanation: 'Náboj je súčin prúdu a času, `$Q = $I · $t`, preto [`$Q`] = A·s = C. W·s je joule – jednotka energie, V·A je jednotka výkonu.',
    },
    {
      lessonId: ID,
      prompt: 'Ako správne zapíšeš kapacitu 10⁻⁹ F?',
      options: ['1 nF', '1 mµF', '1 kpF', '1 NF'],
      explanation: 'Pre 10⁻⁹ existuje predpona nano (n). Dve predpony sa nespájajú (mµ, kp) a veľkosť písmena rozhoduje – „N“ nie je predpona.',
    },
    {
      lessonId: ID,
      prompt: 'Koľko kelvinov je 0 °C?',
      options: ['273,15 K', '0 K', '−273,15 K', '100 K'],
      explanation: '`$T = $t + 273,15` K, teda 0 °C = 273,15 K. Hodnota 0 K je absolútna nula, čo je −273,15 °C.',
    },
    {
      lessonId: ID,
      prompt: 'Vinutie sa zohrialo z 20 °C na 75 °C. Aké je oteplenie v kelvinoch?',
      options: ['55 K', '328,15 K', '348,15 K', '293,15 K'],
      explanation: 'Rozdiel teplôt má v °C aj v K rovnakú číselnú hodnotu: 75 − 20 = 55 °C, teda 55 K. Konštanta 273,15 sa v rozdiele vyruší: (75 + 273,15) K − (20 + 273,15) K = 55 K.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá z týchto odvodených jednotiek nemá osobitný názov?',
      options: ['V·m⁻¹ – jednotka intenzity elektrického poľa', 'ohm (Ω)', 'farad (F)', 'watt (W)'],
      explanation: 'Volt na meter (V·m⁻¹) je odvodená jednotka bez osobitného názvu. Ohm, farad a watt sú odvodené jednotky s vlastným názvom.',
    },
    {
      lessonId: ID,
      prompt: 'Čo znamená zápis 15 mA?',
      options: ['15 miliampérov, teda 15 · 10⁻³ A', '15 megaampérov, teda 15 · 10⁶ A', '15 mikroampérov, teda 15 · 10⁻⁶ A', 'súčin 15 metrov a ampéra'],
      explanation: 'Malé m pred symbolom jednotky je predpona mili (10⁻³). Veľké M je mega (10⁶), mikro sa značí µ. Symbol predpony sa píše tesne pred symbol jednotky.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá jednotka teploty je základnou jednotkou SI?',
      options: ['kelvin (K)', 'stupeň Celzia (°C)', 'kelvin aj stupeň Celzia', 'stupeň Fahrenheita (°F)'],
      explanation: 'Základnou jednotkou SI je kelvin – jednotka termodynamickej teploty `$T`. Stupeň Celzia je jednotka teploty podľa Celzia `$t = $T − 273,15` K.',
    },
  ],

  generators,
};

export default mod;
