import type { MeasModule } from './types';
import { s } from '../../lib/dom';
import { pick, shuffle, type Rng } from '../../lib/random';
import { fmt } from '../../lib/units';
import { b, n, numeric, q, type Generator } from '../../practice/helpers';
import type { ChoiceQuestion } from '../../practice/types';
import { ohmmeterFigure } from '../../ui/meas-figures';

/*
 * Lekcia 19 – meranie elektrického odporu priamymi metódami (skriptá ELM3, kap. 3 a 3.1.1).
 */

const ID = 'meranie-odporu';

/** Odstráni šum binárnej aritmetiky. */
const clean = (x: number) => Number(x.toPrecision(10));

function choice(prompt: string, options: string[], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId: ID, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

// ---------------------------------------------------------------- stupnica ohmmetra

/**
 * Stupnica sériového ohmmetra s vnútorným odporom Ri: 0 Ω vpravo (plná výchylka), ∞ vľavo.
 * Poloha na stupnici je α/αmax = Ri / (Ri + Rx), preto je stupnica obrátená a nelineárna.
 */
function ohmScale(ri: number, needleRx: number): SVGSVGElement {
  const W = 360;
  const H = 214;
  const cx = W / 2;
  const cy = 196;
  const r = 158;
  const sweep = 48;
  const pos = (rx: number) => (Number.isFinite(rx) ? ri / (ri + rx) : 0);
  const pt = (p: number, rad: number): [number, number] => {
    const a = ((-sweep + 2 * sweep * p) * Math.PI) / 180;
    return [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  };
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const major = [0, 0.2, 0.4, 1, 2, 4, 10, Infinity].map((k) => k * ri);
  const minor = [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9, 1.5, 3, 6, 20].map((k) => k * ri);
  const label = (rx: number) => (Number.isFinite(rx) ? fmt(rx, 3) : '∞');

  const [ax, ay] = pt(0, r);
  const [bx, by] = pt(1, r);
  const parts: SVGElement[] = [
    s('rect', { x: 1, y: 1, width: W - 2, height: H - 2, rx: 12, class: 'dial-face' }),
    s('path', { d: `M${r1(ax)} ${r1(ay)}A${r} ${r} 0 0 1 ${r1(bx)} ${r1(by)}`, class: 'dial-arc' }),
  ];
  for (const rx of minor) {
    const [x1, y1] = pt(pos(rx), r);
    const [x2, y2] = pt(pos(rx), r - 7);
    parts.push(s('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: 'dial-tick' }));
  }
  for (const rx of major) {
    const p = pos(rx);
    const [x1, y1] = pt(p, r);
    const [x2, y2] = pt(p, r - 15);
    const [lx, ly] = pt(p, r - 28);
    parts.push(
      s('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: 'dial-tick major' }),
      s('text', { x: r1(lx), y: r1(ly + 4), 'text-anchor': 'middle', class: 'dial-num' }, label(rx)),
    );
  }
  const [nx, ny] = pt(pos(needleRx), r - 4);
  parts.push(
    s('text', { x: 30, y: H - 40, class: 'dial-sym' }, 'Ω'),
    s('text', { x: W - 16, y: H - 14, 'text-anchor': 'end', class: 'dial-small' }, `stred stupnice ${fmt(ri, 3)} Ω`),
    s('line', { x1: cx, y1: cy, x2: r1(nx), y2: r1(ny), class: 'dial-needle' }),
    s('circle', { cx, cy, r: 7, class: 'dial-pivot' }),
  );
  return s(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, width: W, class: 'dial', role: 'img', 'aria-label': `Obrátená nelineárna stupnica ohmmetra, ručička ukazuje ${label(needleRx)} Ω` },
    s('title', null, 'Stupnica ohmmetra'),
    ...parts,
  );
}

// ---------------------------------------------------------------- generátory

const MATERIALS = [
  { name: 'medené', alpha: 0.0039 },
  { name: 'hliníkové', alpha: 0.004 },
];

const OBJECTS: { what: string; ohms: number }[] = [
  { what: 'prechodový odpor kontaktov ističa', ohms: 0.002 },
  { what: 'vinutie zváracieho transformátora', ohms: 0.05 },
  { what: 'medený vodič predlžovačky', ohms: 0.35 },
  { what: 'bočník ampérmetra', ohms: 0.01 },
  { what: 'vinutie stýkača', ohms: 220 },
  { what: 'rezistor na doske plošných spojov', ohms: 4700 },
  { what: 'vlákno žiarovky za studena', ohms: 30 },
  { what: 'potenciometer hlasitosti', ohms: 47000 },
  { what: 'izolačný odpor kábla', ohms: 500e6 },
  { what: 'izolačný odpor vinutia motora', ohms: 20e6 },
  { what: 'zvodový odpor kondenzátora', ohms: 1e9 },
  { what: 'odpor ľudského tela pri suchej koži', ohms: 100e3 },
];

type Group = 'malé' | 'stredné' | 'veľké';
const groupOf = (ohms: number): Group => (ohms < 1 ? 'malé' : ohms <= 1e6 ? 'stredné' : 'veľké');
const GROUP_TEXT: Record<Group, string> = {
  malé: 'malé odpory (do 1 Ω)',
  stredné: 'stredné odpory (od 1 Ω do 1 MΩ)',
  veľké: 'veľké odpory (nad 1 MΩ)',
};

const generators: Generator[] = [
  // Zaradenie odporu do skupiny podľa veľkosti.
  (rng) => {
    const target = pick(rng, ['malé', 'stredné', 'veľké'] as Group[]);
    const right = pick(rng, OBJECTS.filter((o) => groupOf(o.ohms) === target));
    const others = shuffle(rng, OBJECTS.filter((o) => groupOf(o.ohms) !== target)).slice(0, 3);
    const fmtObj = (o: { what: string; ohms: number }) => `${o.what}, ${q(o.ohms, 'Ω')}`;
    return choice(
      `Ktorý z týchto odporov patrí medzi **${GROUP_TEXT[target]}**?`,
      [fmtObj(right), ...others.map(fmtObj)],
      `Podľa veľkosti delíme odpory na malé (do 1 Ω), stredné (od 1 Ω do 1 MΩ) a veľké (nad 1 MΩ). ${right.what[0].toUpperCase()}${right.what.slice(1)} má ${q(right.ohms, 'Ω')}, patrí teda medzi ${target} odpory.`,
      rng,
    );
  },

  // Prepočet odporu na inú teplotu alebo späť na 20 °C.
  (rng) => {
    const mat = pick(rng, MATERIALS);
    const r20 = pick(rng, [2.5, 4, 6.8, 12, 18, 33, 56, 120]);
    const temp = pick(rng, [45, 55, 65, 75, 85, 95]);
    const k = clean(1 + mat.alpha * (temp - 20));
    const rx = r20 * k;
    const toTemp = rng() < 0.5;
    if (toTemp) {
      return numeric(ID, `Vinutie s ${mat.name.replace('é', 'ým')} vodičom má pri 20 °C odpor ${q(r20, 'Ω')}. Aký odpor nameráš, keď sa vinutie zahreje na ${temp} °C? (\`$α\` = ${n(mat.alpha)} K⁻¹)`, rx, 'Ω', [
        `\`$R_{x} = $R_{20} · [1 + $α · ($ϑ_{x} − $ϑ_{20})]\``,
        `\`$R_{x}\` = ${n(r20)} · [1 + ${n(mat.alpha)} · (${temp} − 20)] = ${n(r20)} · ${n(k, 6)} = **${q(rx, 'Ω')}**`,
      ]);
    }
    const shown = Number(rx.toPrecision(4));
    const back = shown / k;
    return numeric(ID, `Odpor ${mat.name.replace('é', 'ého')} vinutia zmeraný pri teplote ${temp} °C je ${q(shown, 'Ω', 4)}. Aký odpor má vinutie pri laboratórnej teplote 20 °C? (\`$α\` = ${n(mat.alpha)} K⁻¹)`, back, 'Ω', [
      `\`$R_{20} = @f{$R_{x}}{1 + $α · ($ϑ_{x} − $ϑ_{20})}\``,
      `\`$R_{20} = @f{${n(shown)}}{1 + ${n(mat.alpha)} · (${temp} − 20)} = @f{${n(shown)}}{${n(k, 6)}}\` = **${q(back, 'Ω')}**`,
    ]);
  },

  // Číslicový ohmmeter so zdrojom definovaného prúdu.
  (rng) => {
    const set = pick(rng, [
      { i0: 1e-3, rs: [100, 150, 220, 330, 470, 680, 1000, 1500] },
      { i0: 0.1e-3, rs: [1000, 2200, 3300, 4700, 6800, 10000, 15000] },
      { i0: 10e-6, rs: [10000, 22000, 47000, 68000, 100000, 150000] },
    ]);
    const rx = pick(rng, set.rs);
    const ux = clean(rx * set.i0);
    return numeric(ID, `Číslicový ohmmeter pretláča cez meraný odpor definovaný prúd ${q(set.i0, 'A')} a jeho voltmeter nameria na odpore úbytok napätia ${q(ux, 'V', 4)}. Aký odpor prístroj zobrazí?`, rx, 'Ω', [
      'Prístroj pracuje na princípe Ohmovej metódy – prúd pozná, napätie zmeria a vypočíta podiel.',
      `\`$R_{x} = @f{$U_{x}}{$I_{0}} = @f{${b(ux, 'V')}}{${b(set.i0, 'A')}}\` = **${q(rx, 'Ω')}**`,
    ]);
  },

  // Výchylka sériového ohmmetra (obrátená nelineárna stupnica).
  (rng) => {
    const ri = pick(rng, [20, 50, 100, 500, 1000, 5000]);
    const mult = pick(rng, [0.25, 0.5, 1, 1.5, 3, 4, 9]);
    const rx = clean(ri * mult);
    const p = (ri / (ri + rx)) * 100;
    if (rng() < 0.5) {
      return numeric(ID, `Sériový ohmmeter má s nastavenou elektrickou nulou vnútorný odpor \`$R_{i}\` = ${q(ri, 'Ω')}. Na koľko percent celej stupnice sa vychýli ručička pri meraní odporu ${q(rx, 'Ω')}?`, p, '%', [
        'Prúd obvodom je `$I = @f{$U}{$R_{i} + $R_{x}}`, pri skratovaných svorkách `$I_{max} = @f{$U}{$R_{i}}`. Výchylka je úmerná prúdu.',
        `\`@f{$α}{$α_{max}} = @f{$R_{i}}{$R_{i} + $R_{x}} = @f{${n(ri)}}{${n(ri)} + ${n(rx)}}\` = ${n(p / 100, 4)} → **${n(p, 3)} %**`,
      ], { fixedUnit: true, tolerance: 0.01, figure: () => ohmScale(ri, rx) });
    }
    return numeric(ID, `Ručička sériového ohmmetra s vnútorným odporom \`$R_{i}\` = ${q(ri, 'Ω')} ukazuje ${n(p, 4)} % celej stupnice. Aký odpor je pripojený na meracie svorky?`, rx, 'Ω', [
      `Z \`@f{$α}{$α_{max}} = @f{$R_{i}}{$R_{i} + $R_{x}}\` vyjadríme \`$R_{x} = $R_{i} · (@f{$α_{max}}{$α} − 1)\`.`,
      `\`$R_{x}\` = ${n(ri)} · (${n(100 / p, 5)} − 1) = **${q(rx, 'Ω')}**`,
    ], { figure: () => ohmScale(ri, rx) });
  },
];

// ---------------------------------------------------------------- lekcia

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Meranie odporu ohmmetrom',
    summary: 'Malé, stredné a veľké odpory, prepočet na 20 °C, ohmmeter s magnetoelektrickým voltmetrom a číslicový ohmmeter.',
    minutes: 10,
    blocks: [
      { t: 'p', text: 'Elektrický odpor je jedna zo základných vlastností elektrických obvodov. Z hľadiska veľkosti ho rozdeľujeme do troch skupín – a pre každú sa hodí iná meracia metóda.' },
      {
        t: 'table',
        head: ['Skupina', 'Veľkosť', 'Príklady'],
        rows: [
          ['malé odpory', 'do 1 Ω', 'vodiče, vinutia transformátorov a motorov, bočníky, prechodové odpory kontaktov'],
          ['stredné odpory', 'od 1 Ω do 1 MΩ', 'bežné rezistory, cievky relé a stýkačov, vlákna žiaroviek'],
          ['veľké odpory', 'nad 1 MΩ', 'izolačné odpory káblov a vinutí, zvodové odpory kondenzátorov'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Ak chceš meraním určiť **len elektrický odpor**, napájaj obvod **jednosmerným zdrojom**. So striedavým zdrojom by sa prejavili aj ďalšie vlastnosti obvodu – indukčnosť, kapacita, zvod a pod.' },
      { t: 'h', text: 'Odpor závisí od teploty' },
      { t: 'p', text: 'Pre odpory všetkých veľkostí je charakteristická ich závislosť od teploty. Odpory preto meriame najčastejšie pri tzv. **laboratórnych podmienkach**, t. j. pri teplote 20 °C. Ak chceš poznať odpor pri inej teplote, prepočítaj ho:' },
      {
        t: 'formula',
        tex: '$R_{x} = $R_{20} · [1 + $α · ($ϑ_{x} − $ϑ_{20})]',
        legend: [
          ['$R_{x}', 'odpor pri teplote ϑx', 'Ω'],
          ['$R_{20}', 'odpor pri 20 °C', 'Ω'],
          ['$α', 'teplotný súčiniteľ odporu (z tabuliek)', '1/°C'],
          ['$ϑ_{x}', 'teplota pri meraní', '°C'],
          ['$ϑ_{20}', 'laboratórna teplota 20 °C', '°C'],
        ],
      },
      { t: 'p', text: 'Často to potrebuješ naopak: odpor zmeraný pri inej teplote (napríklad vinutie motora hneď po chode) prepočítaš na 20 °C, aby sa dal porovnať s hodnotou od výrobcu:' },
      { t: 'formula', tex: '$R_{20} = @f{$R_{x}}{1 + $α · ($ϑ_{x} − $ϑ_{20})}' },
      {
        t: 'example',
        title: 'Vinutie motora po chode',
        given: ['`$R_{x}` = 8,2 Ω pri `$ϑ_{x}` = 65 °C', 'meď: `$α` = 0,0039 1/°C'],
        steps: [
          '`1 + $α · ($ϑ_{x} − $ϑ_{20})` = 1 + 0,0039 · (65 − 20) = 1 + 0,1755 = 1,1755',
          '`$R_{20} = @f{8,2}{1,1755}` = 6,98 Ω',
        ],
        result: '`$R_{20}` ≈ 6,98 Ω – za tepla má vinutie o 17,6 % väčší odpor',
      },
      { t: 'h', text: 'Meracie metódy' },
      { t: 'p', text: 'Na meranie elektrického odporu sa používa veľké množstvo meracích metód. V tejto lekcii sú **priame metódy** – prístroj ukáže odpor priamo na stupnici alebo na displeji. **Nepriamu absolútnu metódu**, pri ktorej sa odpor vypočíta z nameraného napätia a prúdu, preberá lekcia o Ohmovej (VA) metóde.' },
      { t: 'h', text: 'Ohmmeter s magnetoelektrickým voltmetrom' },
      { t: 'figure', fig: ohmmeterFigure, caption: 'Zdroj, meracie svorky `$R_{x}`, tlačidlo TL na skratovanie svoriek, merací prístroj Ω, elektrický bočník `$R_{b}` a odpor `$R_{p}`. Meraný odpor je v sérii so zdrojom a prístrojom.' },
      { t: 'p', text: 'Merací prístroj je v skutočnosti **magnetoelektrický voltmeter ciachovaný v ohmoch**. Meraný odpor `$R_{x}` je zapojený do série so zdrojom a prístrojom, takže **výchylka závisí od veľkosti** `$R_{x}`: čím väčší odpor, tým menší prúd a menšia výchylka.' },
      {
        t: 'list',
        items: [
          '`$R_{x}` = ∞ (meracie svorky **rozpojené**) – obvodom neteče prúd a ručička stojí na **mechanickej nule**, na začiatku stupnice so značkou ∞.',
          '`$R_{x}` = 0 (meracie svorky **skratované**, napr. tlačidlom TL) – tečie najväčší prúd a ručička je na konci stupnice, na **elektrickej nule** (0 Ω).',
        ],
      },
      { t: 'p', text: 'Výchylka prístroja závisí aj od **napätia zdroja**, ktoré sa s vybíjaním batérie zmenšuje. Preto má prístroj **elektrický bočník** `$R_{b}`, ktorým sa **pred každým meraním nastavuje elektrická nula**: skratuješ svorky a bočníkom nastavíš ručičku presne na 0 Ω.' },
      { t: 'h', text: 'Prečo je stupnica obrátená a nelineárna' },
      { t: 'p', text: 'Pri nastavenej elektrickej nule má ohmmeter vnútorný odpor `$R_{i}` (zdroj, prístroj a odpory spolu). Prúd a s ním aj výchylka klesajú so zväčšujúcim sa `$R_{x}`:' },
      {
        t: 'formula',
        tex: ['$I = @f{$U}{$R_{i} + $R_{x}}', '@f{$α}{$α_{max}} = @f{$R_{i}}{$R_{i} + $R_{x}}'],
        legend: [['$R_{i}', 'vnútorný odpor ohmmetra s nastavenou nulou', 'Ω'], ['$α_{max}', 'výchylka pri skratovaných svorkách (0 Ω)', 'dielik']],
      },
      { t: 'figure', fig: () => ohmScale(50, 50), caption: 'Stupnica ohmmetra s `$R_{i}` = 50 Ω. Pri `$R_{x} = $R_{i}` je ručička presne v strede. Smerom k ∞ sa dieliky zhusťujú, preto sa najpresnejšie odčítava okolo stredu stupnice.' },
      {
        t: 'example',
        title: 'Odčítanie zo stupnice ohmmetra',
        given: ['`$R_{i}` = 50 Ω', 'ručička ukazuje 40 % celej stupnice'],
        steps: [
          'Z `@f{$α}{$α_{max}} = @f{$R_{i}}{$R_{i} + $R_{x}}` vyjadríme `$R_{x} = $R_{i} · (@f{$α_{max}}{$α} − 1)`.',
          '`$R_{x}` = 50 · (`@f{1}{0,4}` − 1) = 50 · 1,5 = 75 Ω',
        ],
        result: '`$R_{x}` = 75 Ω',
      },
      { t: 'h', text: 'Číslicový ohmmeter (multimeter)' },
      { t: 'p', text: 'Väčšina číslicových ohmmetrov pracuje na princípe merania odporu **Ohmovou metódou**, teda `$R = @f{$U}{$I}`, s tým, že:' },
      {
        t: 'list',
        items: [
          'pri meraní **veľkých odporov** je zdroj a voltmeter nahradený **zdrojom definovaného napätia**,',
          'pri meraní **stredných a malých odporov** je zdroj a ampérmeter nahradený **zdrojom definovaného prúdu**.',
        ],
      },
      { t: 'formula', tex: '$R_{x} = @f{$U_{x}}{$I_{0}}', legend: [['$I_{0}', 'známy prúd zo zdroja definovaného prúdu', 'A'], ['$U_{x}', 'úbytok napätia na meranom odpore', 'V']] },
      { t: 'p', text: 'Samotné meranie je potom založené na princípoch činnosti číslicových meracích prístrojov – prístroj zmeria napätie, vydelí ho známym prúdom a výsledok zobrazí v ohmoch. Pre jeho presnosť platí všetko z lekcie o chybách ČMP.' },
      {
        t: 'example',
        title: 'Ako „počíta“ multimeter',
        given: ['definovaný prúd `$I_{0}` = 1 mA = 0,001 A', 'nameraný úbytok `$U_{x}` = 0,47 V'],
        steps: ['`$R_{x} = @f{$U_{x}}{$I_{0}} = @f{0,47}{0,001}` = 470 Ω'],
        result: 'displej ukáže 470 Ω',
      },
      { t: 'note', kind: 'warn', text: 'Odpor meraj vždy **bez napätia** – vypni zdroj a vybi kondenzátory. Súčiastku podľa možnosti odpoj z obvodu, inak meriaš aj odpor paralelných vetiev.' },
      { t: 'note', kind: 'tip', text: 'Pri malých odporoch sa prejaví aj odpor meracích šnúr a prechodový odpor svoriek (desatiny ohmu). Skratuj meracie hroty, zapamätaj si údaj a odčítaj ho od nameranej hodnoty.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Do ktorej skupiny patrí rezistor s odporom 47 kΩ?',
      options: ['stredné odpory', 'malé odpory', 'veľké odpory', 'nepatrí do žiadnej skupiny'],
      explanation: 'Stredné odpory majú od 1 Ω do 1 MΩ, 47 kΩ do tohto intervalu patrí.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa pri meraní len elektrického odporu používa jednosmerný zdroj?',
      options: [
        'so striedavým zdrojom by sa prejavila aj indukčnosť, kapacita a zvod obvodu',
        'jednosmerné napätie je vždy bezpečnejšie',
        'striedavý prúd by ohmmeter poškodil',
        'odpor sa pri striedavom prúde nedá vypočítať z Ohmovho zákona',
      ],
      explanation: 'Pri striedavom napätí by sa okrem odporu uplatnila aj reaktancia a zvod – nameraná hodnota by nebola čistý odpor.',
    },
    {
      lessonId: ID,
      prompt: 'Čomu zodpovedá mechanická nula ohmmetra s magnetoelektrickým voltmetrom?',
      options: ['`$R_{x}` = ∞ – meracie svorky sú rozpojené', '`$R_{x}` = 0 – meracie svorky sú skratované', '`$R_{x} = $R_{i}` – stred stupnice', 'najmenšiemu odporu, ktorý sa dá zmerať'],
      explanation: 'Pri rozpojených svorkách neteče prúd a ručička zostane na mechanickej nule. Skratovaným svorkám (0 Ω) zodpovedá elektrická nula.',
    },
    {
      lessonId: ID,
      prompt: 'Na čo slúži elektrický bočník Rb ohmmetra?',
      options: ['pred každým meraním sa ním nastaví elektrická nula', 'prepína merací rozsah', 'chráni prístroj pred preťažením', 'nastavuje mechanickú nulu ručičky'],
      explanation: 'Výchylka závisí od napätia zdroja, ktoré sa mení. Pri skratovaných svorkách sa bočníkom Rb nastaví ručička na 0 Ω – elektrickú nulu.',
    },
    {
      lessonId: ID,
      prompt: 'Ako meria číslicový ohmmeter stredné a malé odpory?',
      options: [
        'zdroj a ampérmeter nahradí zdroj definovaného prúdu, prístroj meria napätie na odpore',
        'zdroj a voltmeter nahradí zdroj definovaného napätia, prístroj meria prúd',
        'porovnáva meraný odpor s odporovou dekádou',
        'meria striedavým prúdom a vyhodnocuje fázový posun',
      ],
      explanation: 'Pri stredných a malých odporoch pretláča zdroj definovaného prúdu známy prúd a prístroj zmeria úbytok napätia. Zdroj definovaného napätia sa používa pri veľkých odporoch.',
    },
    {
      lessonId: ID,
      prompt: 'Pri akej teplote sa odpory najčastejšie merajú (laboratórne podmienky)?',
      options: ['20 °C', '0 °C', '25 °C', '100 °C'],
      explanation: 'Laboratórne podmienky znamenajú teplotu 20 °C. Odpor nameraný pri inej teplote sa na ňu prepočíta.',
    },
    {
      lessonId: ID,
      prompt: 'Kde je na stupnici sériového ohmmetra značka 0 Ω?',
      options: ['na konci stupnice, pri plnej výchylke', 'na začiatku stupnice, pri mechanickej nule', 'v strede stupnice', 'značka 0 Ω na stupnici nie je'],
      explanation: 'Pri 0 Ω tečie najväčší prúd, ručička sa vychýli na koniec stupnice. Stupnica je preto obrátená – ∞ je vľavo, 0 vpravo.',
    },
  ],
  generators,
};

export default mod;
