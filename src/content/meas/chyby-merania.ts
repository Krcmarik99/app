import type { MeasModule } from './types';
import { s } from '../../lib/dom';
import { int, pick, shuffle, type Rng } from '../../lib/random';
import { fmt, fmtFixed, roundSig } from '../../lib/units';
import { n, numeric, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';

/*
 * Lekcia 17 – chyby a neistota merania (skriptá ELM3, kap. 2.2).
 * Značenie ako v kap. 2: X_N = nameraná hodnota, X_S = skutočná hodnota, MR = merací rozsah.
 */

const ID = 'chyby-merania';
const NBSP = ' ';

const clean = (x: number) => Number(x.toPrecision(10));
const val = (v: number, unit: string, sig = 6) => `${n(v, sig)}${NBSP}${unit}`;
/** Číslo so znamienkom: „+0,04“, „−0,04“. */
const signed = (v: number) => `${v < 0 ? '−' : '+'}${n(Math.abs(v), 6)}`;

function choice(prompt: string, options: string[], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId: ID, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

// ---------------------------------------------------------------- obrázok: opakované meranie

/** Opakované meranie napätia 10 V dvoma prístrojmi – náhodné chyby verzus systematická chyba. */
function repeatedMeasurementFigure(): SVGSVGElement {
  const W = 420;
  const H = 250;
  const m = { l: 50, r: 18, t: 44, b: 44 };
  const xMin = 0.5;
  const xMax = 8.5;
  const yMin = 9.6;
  const yMax = 10.5;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const sx = (v: number) => r1(m.l + ((v - xMin) / (xMax - xMin)) * (W - m.l - m.r));
  const sy = (v: number) => r1(H - m.b - ((v - yMin) / (yMax - yMin)) * (H - m.t - m.b));
  const A = [10.12, 9.86, 10.05, 9.92, 10.18, 9.95, 9.83, 10.08];
  const B = [10.31, 10.28, 10.33, 10.3, 10.29, 10.32, 10.3, 10.31];
  const meanB = B.reduce((a, x) => a + x, 0) / B.length;
  const label = 'Opakované meranie napätia 10 V: údaje prístroja A sú rozptýlené okolo skutočnej hodnoty, údaje prístroja B sú tesne pri sebe, ale posunuté približne o 0,3 V nahor';
  const copper = 'fill: var(--copper); stroke: var(--copper)';
  const parts: SVGElement[] = [];
  for (const t of [9.6, 9.8, 10, 10.2, 10.4]) {
    parts.push(
      s('line', { x1: m.l, x2: W - m.r, y1: sy(t), y2: sy(t), class: 'grid' }),
      s('text', { x: m.l - 7, y: sy(t) + 4, 'text-anchor': 'end', class: 'tick' }, fmt(t)),
    );
  }
  for (let i = 1; i <= 8; i++) {
    parts.push(s('text', { x: sx(i), y: H - m.b + 17, 'text-anchor': 'middle', class: 'tick' }, String(i)));
  }
  parts.push(
    s('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, class: 'axis' }),
    s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }),
    s('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'axis-label' }, 'poradie merania'),
    s('text', { x: 4, y: m.t - 6, class: 'axis-label' }, 'U [V]'),
    // skutočná hodnota a priemer údajov prístroja B
    s('line', { x1: m.l, x2: W - m.r, y1: sy(10), y2: sy(10), class: 'line dashed' }),
    s('text', { x: m.l + 6, y: sy(10) + 14, class: 'axis-label' }, 'skutočná hodnota 10 V'),
    s('line', { x1: m.l, x2: W - m.r, y1: sy(meanB), y2: sy(meanB), class: 'hline' }),
  );
  A.forEach((y, i) => parts.push(s('circle', { cx: sx(i + 1), cy: sy(y), r: 4.5, class: 'marker' })));
  B.forEach((y, i) => parts.push(s('rect', { x: sx(i + 1) - 4, y: sy(y) - 4, width: 8, height: 8, style: copper })));
  // legenda
  parts.push(
    s('circle', { cx: 66, cy: 12, r: 4.5, class: 'marker' }),
    s('text', { x: 78, y: 16, class: 'axis-label' }, 'A: rozptyl okolo skutočnej hodnoty – náhodné chyby'),
    s('rect', { x: 62, y: 24, width: 8, height: 8, style: copper }),
    s('text', { x: 78, y: 32, class: 'axis-label' }, 'B: posun o 0,3 V nahor – systematická chyba'),
  );
  return s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, class: 'chart', role: 'img', 'aria-label': label }, s('title', null, label), ...parts);
}

// ---------------------------------------------------------------- generátory

const CAUSES = ['chyba meracej metódy', 'chyba meracieho prístroja', 'osobná chyba', 'chyba spôsobená rušivým vplyvom'];

const CAUSE_CASES: { text: string; cause: number; why: string }[] = [
  { text: 'Pri odčítaní výchylky nepozeráš na stupnicu kolmo, ale šikmo zboku (paralaxa).', cause: 2, why: 'Ide o nepresné odčítanie výchylky z analógového prístroja – chybu spôsobuje človek, ktorý meria.' },
  { text: 'Odčítaný údaj 12,46 V zapíšeš zaokrúhlene ako 12 V a ďalej s ním počítaš.', cause: 2, why: 'Zaokrúhľovanie hodnôt patrí medzi osobné chyby.' },
  { text: 'Z nameraných bodov nakreslíš graf a hodnotu z neho odčítaš na nesprávnej osi.', cause: 2, why: 'Nesprávna interpretácia výsledkov, napr. pri grafických závislostiach, je osobná chyba.' },
  { text: 'Pri Ohmovej metóde vypočítaš odpor ako `$R = @f{$U}{$I}` a zanedbáš, že časť prúdu tečie voltmetrom.', cause: 0, why: 'Metóda kvôli zjednodušeniu neuvažuje so všetkými vplyvmi – tu s vlastnou spotrebou voltmetra.' },
  { text: 'Pri meraní malého odporu zvolíš jednoduchú metódu, ktorá zanedbáva odpor prívodných vodičov.', cause: 0, why: 'Chyba vzniká zjednodušením meracej metódy – zanedbaný vplyv sa pri malých odporoch prejaví.' },
  { text: 'Správne zapojený a správne odčítaný voltmeter triedy presnosti 1,5 ukazuje na rozsahu 30 V o 0,3 V viac, než je skutočná hodnota.', cause: 1, why: 'Takú chybu má samotný prístroj – vyjadruje ju jeho trieda presnosti (tu najviac ±0,45 V).' },
  { text: 'Ampérmeter triedy presnosti 2,5 má na rozsahu 1 A údaj nepresný o 20 mA, hoci meranie prebehlo správne.', cause: 1, why: 'Ide o chybu meracieho prístroja v rámci jeho triedy presnosti (najviac ±25 mA).' },
  { text: 'Prístroj leží tesne vedľa transformátora a jeho údaj sa mení podľa toho, ako ho natočíš.', cause: 3, why: 'Vonkajšie elektromagnetické pole vyvoláva sily a momenty, ktoré menia údaj prístroja – ochranou je magnetické tienenie.' },
  { text: 'Prístroj určený na prácu vo zvislej polohe položíš na stôl vodorovne.', cause: 3, why: 'Nesprávna pracovná poloha patrí medzi mechanické rušivé vplyvy.' },
  { text: 'Stôl s prístrojom sa otriasa od blízkeho stroja a ručička sa chveje.', cause: 3, why: 'Vibrácie sú mechanický rušivý vplyv.' },
  { text: 'Meriaš v prehriatej dielni pri teplote mimo dovoleného rozsahu teplôt prístroja.', cause: 3, why: 'So zmenou teploty sa mení napr. rezistancia a rozmery častí prístroja – teplota je rušivý vplyv.' },
  { text: 'Prístroj určený na meranie pri 50 Hz použiješ na prúd s frekvenciou 5 kHz.', cause: 3, why: 'Trieda presnosti je zaručená len v určitom intervale frekvencií; frekvencia je rušivý vplyv.' },
];

const KIND_OPTIONS = ['systematická chyba (neistota typu B)', 'náhodná chyba (neistota typu A)', 'systematická chyba (neistota typu A)', 'náhodná chyba (neistota typu B)'];

const KIND_CASES: { text: string; systematic: boolean; why: string }[] = [
  { text: 'Pri desiatich opakovaných meraniach toho istého napätia sa údaj zakaždým trochu líši – raz je väčší, raz menší – a príčinu nepoznáš.', systematic: false, why: 'Chyba sa pri opakovaní mení s neznámou zákonitosťou a jej príčinu nepoznáme.' },
  { text: 'Údaj ampérmetra pri opakovaných meraniach nepravidelne kolíše okolo priemernej hodnoty.', systematic: false, why: 'Rôzna veľkosť chyby pri každom opakovaní je znakom náhodnej chyby.' },
  { text: 'Pri opakovanom odčítaní tej istej výchylky dostaneš zakaždým trochu inú hodnotu.', systematic: false, why: 'Rozptyl odčítaných hodnôt sa mení nepredvídateľne – je to náhodná chyba.' },
  { text: 'Prúd voltmetra zaťažuje meraný obvod, preto je údaj pri každom opakovaní o rovnakú hodnotu menší; vieš ju vypočítať a korigovať.', systematic: true, why: 'Chyba spôsobená vlastnou spotrebou prístroja má pri opakovaní stále rovnakú veľkosť a dá sa korigovať.' },
  { text: 'Ručička prístroja nie je nastavená na nulu, takže všetky údaje sú o 2 dieliky väčšie.', systematic: true, why: 'Chyba má pri každom meraní rovnakú veľkosť a poznáme jej príčinu – dá sa korigovať.' },
  { text: 'Úbytok napätia na ampérmetri zmenšuje prúd v obvode vždy o rovnakú, vypočítateľnú hodnotu.', systematic: true, why: 'Vplyv vlastnej spotreby prístroja je stály a známy – je to systematická chyba.' },
];

interface Reading { Nom: string; gen: string; unit: string; xs: number[]; dec: number; dMax: number }
/** Prístroje a skutočné hodnoty; chyba sa generuje v jednotkách posledného desatinného miesta `dec`. */
const READINGS: Reading[] = [
  { Nom: 'Voltmeter', gen: 'voltmetra', unit: 'V', xs: [5, 9, 12, 15, 24], dec: 2, dMax: 40 },
  { Nom: 'Voltmeter', gen: 'voltmetra', unit: 'V', xs: [110, 220, 230, 400], dec: 1, dMax: 60 },
  { Nom: 'Ampérmeter', gen: 'ampérmetra', unit: 'A', xs: [0.5, 1.2, 2, 2.5, 4], dec: 3, dMax: 80 },
  { Nom: 'Miliampérmeter', gen: 'miliampérmetra', unit: 'mA', xs: [20, 25, 40, 50, 75], dec: 1, dMax: 20 },
  { Nom: 'Ohmmeter', gen: 'ohmmetra', unit: 'Ω', xs: [100, 220, 330, 470, 680], dec: 0, dMax: 15 },
];

/** Skutočná a nameraná hodnota ako celé násobky posledného miesta (bez chýb zaokrúhľovania). */
function readingCase(rng: Rng) {
  const c = pick(rng, READINGS);
  const step = 10 ** -c.dec;
  const xsCount = Math.round(pick(rng, c.xs) / step);
  const d = int(rng, Math.max(2, Math.round(c.dMax / 6)), c.dMax) * (rng() < 0.5 ? -1 : 1);
  const XS = clean(xsCount * step);
  const XN = clean((xsCount + d) * step);
  const D = clean(d * step);
  return { c, XS, XN, D, f: (v: number) => fmtFixed(v, c.dec) };
}

const generators: Generator[] = [
  // Klasifikácia chyby – podľa príčiny vzniku alebo podľa spôsobu výskytu.
  (rng) => {
    if (rng() < 0.6) {
      const c = pick(rng, CAUSE_CASES);
      const options = [CAUSES[c.cause], ...CAUSES.filter((_, i) => i !== c.cause)];
      return choice(`${c.text} O akú chybu ide podľa príčiny vzniku?`, options, `**${CAUSES[c.cause][0].toUpperCase()}${CAUSES[c.cause].slice(1)}.** ${c.why}`, rng);
    }
    const c = pick(rng, KIND_CASES);
    const options = c.systematic ? KIND_OPTIONS : [KIND_OPTIONS[1], KIND_OPTIONS[0], KIND_OPTIONS[2], KIND_OPTIONS[3]];
    return choice(`${c.text} O akú chybu ide podľa spôsobu výskytu?`, options, `**${c.systematic ? 'Systematická chyba' : 'Náhodná chyba'}.** ${c.why} Podľa novej klasifikácie sa ${c.systematic ? 'systematické chyby označujú ako neistoty typu B' : 'náhodné chyby označujú ako neistoty typu A'}.`, rng);
  },

  // Veľkosť absolútnej chyby a korekcia.
  (rng) => {
    const { c, XS, XN, D, f } = readingCase(rng);
    return numeric(ID, `${c.Nom} ukazuje ${f(XN)} ${c.unit}. Oveľa presnejší kontrolný prístroj ukazuje ${f(XS)} ${c.unit} – jeho údaj považuj za skutočnú hodnotu. Aká veľká je absolútna chyba merania ${c.gen}? Zadaj jej veľkosť bez znamienka.`, Math.abs(D), c.unit, [
      `\`Δ$X = $X_{N} − $X_{S}\` = ${f(XN)} − ${f(XS)} = ${signed(D)} ${c.unit}`,
      `Prístroj ukazuje ${D > 0 ? 'viac' : 'menej'}, ako je skutočná hodnota, preto je chyba ${D > 0 ? 'kladná' : 'záporná'}. Jej veľkosť je **${val(Math.abs(D), c.unit)}**.`,
      `Korekcia \`$K = −Δ$X\` = ${signed(-D)} ${c.unit}; kontrola: ${f(XN)} ${D > 0 ? '−' : '+'} ${n(Math.abs(D), 6)} = ${f(XS)} ${c.unit}.`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },

  // Veľkosť relatívnej chyby.
  (rng) => {
    const { c, XS, XN, D, f } = readingCase(rng);
    const delta = (Math.abs(D) / XS) * 100;
    return numeric(ID, `${c.Nom} ukazuje ${f(XN)} ${c.unit}, skutočná hodnota meranej veličiny je ${f(XS)} ${c.unit}. Aká veľká je relatívna chyba merania? Zadaj ju v percentách bez znamienka.`, delta, '%', [
      `\`Δ$X = $X_{N} − $X_{S}\` = ${f(XN)} − ${f(XS)} = ${signed(D)} ${c.unit}`,
      `\`$δ = @f{Δ$X}{$X_{S}} · 100 % = @f{${signed(D)}}{${f(XS)}} · 100 %\` = ${D < 0 ? '−' : '+'}${n(delta, 3)} %`,
      `Veľkosť relatívnej chyby je **${n(delta, 3)} %**.`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },

  // Aritmetický priemer opakovaných meraní.
  (rng) => {
    const c = pick(rng, [
      { what: 'napätia článku', unit: 'V', base: [1.5, 4.5, 9, 12], dec: 2 },
      { what: 'prúdu', unit: 'mA', base: [20, 25, 40, 50], dec: 1 },
      { what: 'odporu rezistora', unit: 'Ω', base: [220, 330, 470, 680], dec: 0 },
    ]);
    const count = pick(rng, [4, 5]);
    const step = 10 ** -c.dec;
    const baseCount = Math.round(pick(rng, c.base) / step);
    // Rozptyl približne ±1 % okolo základnej hodnoty, aspoň ±3 jednotky posledného miesta.
    const spread = Math.max(3, Math.round(baseCount * 0.01));
    const counts = Array.from({ length: count }, () => baseCount + int(rng, -spread, spread));
    const sumCount = counts.reduce((a, x) => a + x, 0);
    const readings = counts.map((k) => fmtFixed(clean(k * step), c.dec));
    const sum = clean(sumCount * step);
    const mean = clean(sum / count);
    return numeric(ID, `Pri ${count === 4 ? 'štyroch' : 'piatich'} opakovaných meraniach ${c.what} vyšli tieto hodnoty: ${readings.join('; ')} ${c.unit}. Aký je aritmetický priemer nameraných hodnôt?`, mean, c.unit, [
      'Aritmetický priemer je súčet nameraných hodnôt vydelený ich počtom: `x̄ = @f{∑ $x_{i}}{$n}`.',
      `Súčet: ${readings.join(' + ')} = ${val(sum, c.unit, 8)}`,
      `\`x̄ = @f{${n(sum, 8)}}{${count}}\` = **${val(mean, c.unit, 8)}**`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },

  // Štandardná neistota typu B z triedy presnosti.
  (rng) => {
    let TP = 0;
    let MR = 0;
    let unit = 'V';
    do {
      const set = pick(rng, [
        { unit: 'V', ranges: [3, 15, 30, 60, 150, 300] },
        { unit: 'mA', ranges: [30, 60, 150, 300] },
        { unit: 'A', ranges: [1.5, 3, 6] },
      ]);
      unit = set.unit;
      MR = pick(rng, set.ranges);
      TP = pick(rng, [0.5, 1, 1.5, 2.5]);
    } while (TP * MR < 4);
    const d = clean((TP * MR) / 100);
    const uB = d / Math.sqrt(3);
    const what = unit === 'V' ? 'Napätie meriaš analógovým voltmetrom' : 'Prúd meriaš analógovým ampérmetrom';
    return numeric(ID, `${what} triedy presnosti ${n(TP)} na rozsahu ${val(MR, unit)}. Akú štandardnú neistotu typu B \`$u_{B}\` spôsobuje prístroj?`, uB, unit, [
      `Najväčšia chyba prístroja: \`Δ$X_{max} = @f{TP · MR}{100} = @f{${n(TP)} · ${n(MR)}}{100}\` = ${val(d, unit)}`,
      `\`$u_{B} = @f{Δ$X_{max}}{@s{3}} = @f{${n(d, 6)}}{1,732}\` = **${val(uB, unit, 3)}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },

  // Kombinovaná štandardná neistota z u_A a triedy presnosti.
  (rng) => {
    const MR = pick(rng, [15, 30, 60, 150]);
    const TP = pick(rng, [0.5, 1, 1.5]);
    const d = clean((TP * MR) / 100);
    const uB2 = (d * d) / 3;
    const uB = Math.sqrt(uB2);
    const uA = roundSig(uB * pick(rng, [0.4, 0.6, 0.8, 1, 1.3, 1.6]), 2);
    const uA2 = uA * uA;
    const sum = uA2 + uB2;
    const uC = Math.sqrt(sum);
    return numeric(ID, `Z opakovaných meraní napätia vyšla štandardná neistota typu A \`$u_{A}\` = ${val(uA, 'V')}. Meralo sa voltmetrom triedy presnosti ${n(TP)} na rozsahu ${n(MR)} V. Aká je kombinovaná štandardná neistota \`$u_{C}\`?`, uC, 'V', [
      `\`Δ$X_{max} = @f{${n(TP)} · ${n(MR)}}{100}\` = ${val(d, 'V')}, \`$u_{B} = @f{Δ$X_{max}}{@s{3}}\` = ${val(uB, 'V', 4)}`,
      `\`$u_{A}^{2}\` = ${n(uA2, 4)} V², \`$u_{B}^{2} = @f{Δ$X_{max}^{2}}{3}\` = ${n(uB2, 4)} V²`,
      `\`$u_{C} = @s{$u_{A}^{2} + $u_{B}^{2}} = @s{${n(sum, 4)}}\` = **${val(uC, 'V', 3)}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
];

// ---------------------------------------------------------------- lekcia

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Chyby a neistota merania',
    summary: 'Prečo žiadne meranie nie je úplne presné: chyba a neistota, druhy chýb podľa výskytu a príčiny, korekcia a základný výpočet neistoty.',
    minutes: 11,
    blocks: [
      { t: 'p', text: 'Žiadnym meracím prístrojom a žiadnou meracou metódou nie je možné určiť úplne presne skutočnú hodnotu meranej veličiny. Presnosť merania je bližšie určená **chybou merania** a **neistotou merania**.' },
      {
        t: 'list',
        items: [
          '**Chyba merania** je rozdiel medzi nameranou a skutočnou hodnotou meranej veličiny.',
          '**Neistota merania** – „úplne správnu“ hodnotu pri meraní nikdy nepoznáme. Neistota výsledku merania je **interval okolo výsledku merania**, ktorý môžeme priradiť hodnote meranej veličiny.',
          'S chybami je neistota úzko spojená. Údaje o neistote výsledku merania sú nutnou súčasťou dokumentácie technických meraní.',
        ],
      },
      { t: 'h', text: 'Absolútna a relatívna chyba' },
      {
        t: 'formula',
        tex: ['Δ$X = $X_{N} − $X_{S}', '$δ = @f{Δ$X}{$X_{S}} · 100 %'],
        legend: [
          ['Δ$X', 'absolútna chyba merania', 'jednotka veličiny'],
          ['$X_{N}', 'nameraná hodnota', 'jednotka veličiny'],
          ['$X_{S}', 'skutočná hodnota', 'jednotka veličiny'],
          ['$δ', 'relatívna chyba merania', '%'],
        ],
      },
      { t: 'p', text: 'Absolútna chyba má jednotku meranej veličiny a znamienko: je **kladná**, keď prístroj ukazuje viac, ako je skutočná hodnota, a **záporná**, keď ukazuje menej. Relatívna chyba je v percentách, a preto umožňuje porovnať presnosť meraní rôzne veľkých hodnôt. Skutočnú hodnotu presne nepoznáme – v praxi ju nahrádza údaj oveľa presnejšieho prístroja.' },
      { t: 'p', text: 'Ak chybu poznáme, nameranú hodnotu opravíme **korekciou**. Korekcia má rovnakú veľkosť ako absolútna chyba, ale opačné znamienko:' },
      { t: 'formula', tex: ['$K = −Δ$X', '$X_{S} = $X_{N} + $K'], legend: [['$K', 'korekcia', 'jednotka veličiny']] },
      {
        t: 'example',
        title: 'Chyba a korekcia ampérmetra',
        given: ['údaj ampérmetra `$X_{N}` = 1,96 A', 'údaj presnejšieho kontrolného prístroja `$X_{S}` = 2,00 A'],
        steps: [
          '`Δ$X = $X_{N} − $X_{S}` = 1,96 − 2,00 = −0,04 A (prístroj ukazuje menej)',
          '`$δ = @f{Δ$X}{$X_{S}} · 100 % = @f{−0,04}{2,00} · 100 %` = −2 %',
          '`$K = −Δ$X` = +0,04 A, kontrola: 1,96 + 0,04 = 2,00 A',
        ],
        result: '`Δ$X` = −0,04 A, `$δ` = −2 %, korekcia `$K` = +0,04 A',
      },
      { t: 'note', kind: 'warn', text: 'Korekciu nezamieňaj s konštantou meracieho prístroja – obe sa označujú `$K`. Pri relatívnej chybe z triedy presnosti (`$δ = @f{Δ$X_{max}}{$X_{N}} · 100 %`) delíme nameranou hodnotou, lebo skutočnú nepoznáme; pri malých chybách je rozdiel zanedbateľný.' },
      { t: 'h', text: 'Delenie chýb podľa spôsobu výskytu' },
      {
        t: 'table',
        head: ['Druh chyby', 'Ako sa prejavuje', 'Príklad', 'Nová klasifikácia'],
        rows: [
          ['**systematické (sústavné)**', 'pri opakovaní toho istého merania majú stále rovnakú veľkosť; veľkosť a príčinu vzniku často poznáme a vieme ich korigovať', 'chyby spôsobené vlastnou spotrebou prístrojov', 'neistoty typu B'],
          ['**náhodné**', 'vyskytujú sa s neznámou zákonitosťou, pri opakovanom meraní majú rôznu veľkosť, príčinu ich vzniku nepoznáme', 'údaj sa pri opakovaní merania nepravidelne mení', 'neistoty typu A'],
        ],
      },
      { t: 'figure', fig: repeatedMeasurementFigure, caption: 'Opakované meranie napätia 10 V. Údaje prístroja A sú rozptýlené okolo skutočnej hodnoty – prevládajú náhodné chyby. Údaje prístroja B sú tesne pri sebe, ale všetky približne o 0,3 V vyššie – to je systematická chyba, ktorú odstráni korekcia −0,3 V.' },
      { t: 'h', text: 'Delenie chýb podľa príčiny vzniku' },
      {
        t: 'list',
        items: [
          '**Chyby meracej metódy** – vznikajú tým, že sa kvôli zjednodušeniu neuvažuje so všetkými vplyvmi (napr. s prúdom voltmetra pri Ohmovej metóde). Metódu volíme podľa požadovanej presnosti a veľkosti meranej veličiny – ak postačuje menšia presnosť, môžeme použiť jednoduchšiu a rýchlejšiu metódu.',
          '**Chyby meracích prístrojov** – vyjadruje ich trieda presnosti prístroja.',
          '**Osobné chyby** – presnosť odčítania výchylky z analógového prístroja, zaokrúhľovanie hodnôt, nesprávna interpretácia výsledkov, napr. pri znázornení grafických závislostí.',
          '**Chyby spôsobené rušivými vplyvmi** – vonkajšie vplyvy, ktoré pôsobia na meracie prístroje počas merania (tabuľka).',
        ],
      },
      {
        t: 'table',
        head: ['Rušivý vplyv', 'Ako pôsobí'],
        rows: [
          ['mechanické vplyvy', 'trenie v ložiskách, pracovná poloha prístroja, vibrácie'],
          ['teplota', 'prístroj má pracovať v dovolenom rozsahu teplôt – so zmenou teploty sa mení napr. rezistancia a rozmery'],
          ['vonkajšie elektromagnetické pole', 'vyvoláva sily a momenty, ktoré menia údaj; pôsobí na prístroje so slabým vlastným poľom – ochranou je **magnetické tienenie**'],
          ['frekvencia', 'trieda presnosti je zaručená len v určenom intervale frekvencií; frekvencia ovplyvňuje napr. reaktanciu, pri niektorých prístrojoch od nej priamo závisí moment systému'],
          ['časový priebeh meranej veličiny', 'prístroj je ciachovaný pre určitý priebeh (napr. sínusový); pri inom tvare priebehu môže ukazovať nesprávne'],
        ],
      },
      { t: 'note', kind: 'tip', text: 'Osobnú chybu pri odčítaní (paralaxu) zmenšíš, keď na ručičku pozeráš kolmo na stupnicu. Presnejšie prístroje majú pod stupnicou zrkadlo – správne pozeráš vtedy, keď ručička zakryje svoj odraz.' },
      { t: 'h', text: 'Ako sa počíta neistota (doplnok)' },
      { t: 'p', text: 'Nasledujúci postup v skriptách nie je rozpísaný – je to štandardný spôsob vyhodnotenia podľa medzinárodného návodu GUM (Návod na vyjadrovanie neistoty merania), z ktorého vychádzajú aj normy STN. Neistotu **typu A** určíme štatisticky z opakovaných meraní, neistotu **typu B** z iných údajov, napr. z triedy presnosti prístroja. Pri type B predpokladáme, že chyba môže s rovnakou pravdepodobnosťou ležať kdekoľvek v intervale ±`Δ$X_{max}` – odtiaľ delenie `@s{3}`.' },
      {
        t: 'formula',
        tex: [
          'x̄ = @f{∑ $x_{i}}{$n}',
          '$u_{A} = @s{@f{∑ ($x_{i} − x̄)^{2}}{$n · ($n − 1)}}',
          '$u_{B} = @f{Δ$X_{max}}{@s{3}}',
          '$u_{C} = @s{$u_{A}^{2} + $u_{B}^{2}}',
        ],
        legend: [
          ['x̄', 'aritmetický priemer opakovaných meraní', 'jednotka veličiny'],
          ['$x_{i}', 'jednotlivé namerané hodnoty, `$n` je ich počet', 'jednotka veličiny'],
          ['$u_{A}', 'štandardná neistota typu A (z opakovaných meraní)', 'jednotka veličiny'],
          ['$u_{B}', 'štandardná neistota typu B (z triedy presnosti)', 'jednotka veličiny'],
          ['$u_{C}', 'kombinovaná štandardná neistota', 'jednotka veličiny'],
        ],
      },
      {
        t: 'example',
        title: 'Výsledok opakovaného merania s neistotou',
        given: ['5 meraní napätia: 24,1 V; 24,3 V; 24,2 V; 24,4 V; 24,0 V', 'voltmeter triedy presnosti 0,5 na rozsahu 30 V'],
        steps: [
          '`x̄ = @f{24,1 + 24,3 + 24,2 + 24,4 + 24,0}{5} = @f{121,0}{5}` = 24,2 V',
          'Odchýlky od priemeru: −0,1; 0,1; 0; 0,2; −0,2 V, súčet ich štvorcov: 0,01 + 0,01 + 0 + 0,04 + 0,04 = 0,10 V²',
          '`$u_{A} = @s{@f{0,10}{5 · 4}} = @s{0,005}` = 0,0707 V',
          '`Δ$X_{max} = @f{0,5 · 30}{100}` = 0,15 V, `$u_{B} = @f{0,15}{@s{3}}` = 0,0866 V',
          '`$u_{C} = @s{0,0707^{2} + 0,0866^{2}} = @s{0,005 + 0,0075}` = 0,112 V',
        ],
        result: '`$U` = (24,20 ± 0,11) V',
      },
      { t: 'note', kind: 'remember', text: 'Opakovaním merania a spriemerovaním sa zmenšuje vplyv náhodných chýb – `$u_{A}` s rastúcim počtom meraní klesá. Systematickú chybu opakovaním neodstrániš, tú treba poznať a korigovať.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Ako sa správajú systematické (sústavné) chyby pri opakovaní toho istého merania?',
      options: ['majú stále rovnakú veľkosť, a preto ich vieme korigovať', 'zakaždým majú inú, nepredvídateľnú veľkosť', 'opakovaním a spriemerovaním sa úplne odstránia', 'vyskytujú sa iba pri číslicových prístrojoch'],
      explanation: 'Systematické chyby majú pri opakovaní rovnakú veľkosť a ich príčinu často poznáme (napr. vlastná spotreba prístrojov), preto ich vieme korigovať. Opakovaním sa neodstránia.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa podľa novej klasifikácie označujú náhodné chyby?',
      options: ['neistoty typu A', 'neistoty typu B', 'chyby meracej metódy', 'kombinovaná neistota'],
      explanation: 'Náhodné chyby → neistoty typu A (vyhodnotia sa štatisticky z opakovaných meraní), systematické chyby → neistoty typu B.',
    },
    {
      lessonId: ID,
      prompt: 'Pri odčítaní výchylky pozeráš na stupnicu šikmo zboku (paralaxa). O akú chybu ide podľa príčiny vzniku?',
      options: ['osobná chyba', 'chyba meracej metódy', 'chyba meracieho prístroja', 'chyba spôsobená rušivým vplyvom'],
      explanation: 'Presnosť odčítania výchylky z analógového prístroja závisí od človeka, ktorý meria – je to osobná chyba.',
    },
    {
      lessonId: ID,
      prompt: 'Voltmeter ukazuje 10,2 V, skutočná hodnota je 10,0 V. Aká je korekcia?',
      options: ['−0,2 V', '+0,2 V', '−2 %', '+2 %'],
      explanation: 'Absolútna chyba `Δ$X` = 10,2 − 10,0 = +0,2 V, korekcia `$K = −Δ$X` = −0,2 V. Hodnota 2 % je relatívna chyba, nie korekcia.',
    },
    {
      lessonId: ID,
      prompt: 'Čo je neistota výsledku merania?',
      options: ['interval okolo výsledku merania, ktorý môžeme priradiť hodnote meranej veličiny', 'rozdiel medzi nameranou a skutočnou hodnotou', 'trieda presnosti použitého prístroja', 'chyba, ktorú spôsobí nepozornosť pri meraní'],
      explanation: 'Úplne správnu hodnotu nikdy nepoznáme, preto k výsledku uvádzame interval – neistotu. Rozdiel nameranej a skutočnej hodnoty je chyba merania.',
    },
    {
      lessonId: ID,
      prompt: 'Čo chráni meracie prístroje pred vplyvom vonkajšieho magnetického poľa?',
      options: ['magnetické tienenie', 'voľba väčšieho meracieho rozsahu', 'opakovanie merania a výpočet priemeru', 'meranie pri teplote 20 °C'],
      explanation: 'Vonkajšie pole vyvoláva sily a momenty, ktoré menia údaj, najmä pri prístrojoch so slabým vlastným poľom. Ochranou je magnetické tienenie.',
    },
    {
      lessonId: ID,
      prompt: 'Ako vypočítaš štandardnú neistotu typu B z najväčšej chyby prístroja `Δ$X_{max}`?',
      options: ['`$u_{B} = @f{Δ$X_{max}}{@s{3}}`', '`$u_{B} = Δ$X_{max} · @s{3}`', '`$u_{B} = @f{Δ$X_{max}}{3}`', '`$u_{B} = @s{Δ$X_{max}}`'],
      explanation: 'Chyba môže ležať kdekoľvek v intervale ±`Δ$X_{max}` s rovnakou pravdepodobnosťou, preto `$u_{B} = @f{Δ$X_{max}}{@s{3}}`.',
    },
    {
      lessonId: ID,
      prompt: 'Pri Ohmovej metóde zanedbáš prúd, ktorý tečie voltmetrom. Akú chybu tým spôsobíš?',
      options: ['chybu meracej metódy – je systematická a dá sa korigovať', 'osobnú chybu – je náhodná', 'chybu spôsobenú rušivým vplyvom', 'žiadnu, prúd voltmetra je vždy nulový'],
      explanation: 'Metóda kvôli zjednodušeniu neuvažuje s vlastnou spotrebou voltmetra. Táto chyba má pri opakovaní rovnakú veľkosť, je teda systematická a dá sa vypočítať a korigovať.',
    },
  ],
  generators,
};

export default mod;
