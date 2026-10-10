import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, formatSI } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { regulatorFigure, zenerChart, zenerStabFigure } from '../../../ui/fig-electronics';
import { choice } from '../util';

const ID = 'stabilizatory';

/** Výstupné napätie parametrického stabilizátora (Zenerova dióda s dynamickým odporom 5 Ω). */
export function zenerOutput(U1: number, R: number, RL: number, Uz: number, rz = 5): number {
  const open = (U1 * RL) / (R + RL);
  if (open <= Uz) return open;
  return (U1 / R + Uz / rz) / (1 / R + 1 / RL + 1 / rz);
}

function stabExplorer(): HTMLElement {
  return explorer({
    title: 'Parametrický stabilizátor so Zenerovou diódou',
    params: [
      { key: 'U1', label: 'Vstupné napätie `$U_{1}`', unit: 'V', min: 0, max: 20, value: 12, format: (v) => `${fmt(v, 3)} V` },
      { key: 'R', label: 'Predradný rezistor `$R`', unit: 'Ω', min: 47, max: 1000, value: 220, log: true },
      { key: 'RL', label: 'Záťaž `$R_{L}`', unit: 'Ω', min: 100, max: 10000, value: 470, log: true },
    ],
    choices: [{ key: 'uz', label: 'Zenerova dióda', options: [['3.3', '3,3 V'], ['5.1', '5,1 V'], ['5.6', '5,6 V'], ['9.1', '9,1 V'], ['12', '12 V']], value: '5.6' }],
    draw: ({ U1, R, RL }, { uz }) => {
      const Uz = Number(uz);
      const U2 = zenerOutput(U1, R, RL, Uz);
      const I = (U1 - U2) / R;
      const IL = U2 / RL;
      const IZ = U2 > Uz ? (U2 - Uz) / 5 : 0;
      const PZ = U2 * IZ;
      const chart = lineChart({
        ariaLabel: `Výstupné napätie stabilizátora v závislosti od vstupného napätia, Zenerova dióda ${fmt(Uz, 2)} V`,
        width: 460,
        height: 250,
        x: { min: 0, max: 20, ticks: [0, 4, 8, 12, 16, 20], format: (v) => `${v}`, label: 'U1 [V]' },
        y: { min: 0, max: 15, ticks: [0, 3, 6, 9, 12, 15], format: (v) => `${v}`, label: 'U2 [V]' },
        series: [
          { points: sample((u) => (u * RL) / (R + RL), 0, 20, 40), className: 'dashed' },
          { points: sample((u) => zenerOutput(u, R, RL, Uz), 0, 20, 400), className: 'copper' },
        ],
        markers: [{ x: U1, y: U2, label: `${fmt(U2, 3)} V`, above: true }],
        legend: [{ label: 'bez Zenerovej diódy', className: 'dashed' }, { label: 'U2 so Zenerovou diódou', className: 'copper' }],
      });
      const note = IZ < 1e-3
        ? 'Zenerovou diódou tečie menej ako 1 mA – dióda nie je v oblasti prierazu a výstupné napätie nie je stabilizované. Zvýš vstupné napätie, zmenši R alebo odľahči záťaž.'
        : PZ > 0.5
          ? `Výkon na Zenerovej dióde je ${fmt(PZ, 2)} W – bežná dióda s dovoleným výkonom 0,5 W by sa prehriala. Zväčši R.`
          : 'Pokiaľ dióda vedie, výstupné napätie sa mení len nepatrne: nadbytočné napätie zostane na rezistore R a nadbytočný prúd prevezme Zenerova dióda.';
      return {
        chart,
        readouts: [
          ['`$U_{2}`', `${fmt(U2, 3)} V`],
          ['`$I`', formatSI(I, 'A', 3)],
          ['`$I_{Z}`', formatSI(IZ, 'A', 3)],
          ['`$I_{L}`', formatSI(IL, 'A', 3)],
          ['`$P_{Z}`', formatSI(PZ, 'W', 3)],
        ],
        note,
      };
    },
  });
}

const UZ = [3.3, 4.7, 5.1, 5.6, 6.2, 6.8, 9.1];
const REG = [
  { type: '7805', u: 5 },
  { type: '7809', u: 9 },
  { type: '7812', u: 12 },
];

const generators: Generator[] = [
  (rng) => {
    const Uz = pick(rng, UZ);
    const U1 = pick(rng, [9, 12, 15, 18, 24].filter((u) => u - Uz >= 3));
    const Iz = pick(rng, [5, 8, 10, 15]) / 1000;
    const IL = pick(rng, [10, 15, 20, 30, 50]) / 1000;
    const R = (U1 - Uz) / (Iz + IL);
    return numeric(ID, `Parametrický stabilizátor so Zenerovou diódou \`$U_{Z}\` = ${q(Uz, 'V')} je napájaný napätím ${q(U1, 'V')}. Záťaž odoberá ${q(IL, 'A')} a Zenerovou diódou má tiecť aspoň ${q(Iz, 'A')}. Aký odpor musí mať predradný rezistor?`, R, 'Ω', [
      `Rezistorom tečie prúd záťaže aj prúd diódy: \`$I = $I_{Z} + $I_{L}\` = ${n(Iz * 1000)} + ${n(IL * 1000)} = ${n((Iz + IL) * 1000)} mA`,
      `\`$R = @f{$U_{1} − $U_{Z}}{$I_{Z} + $I_{L}} = @f{${n(U1)} − ${n(Uz)}}{${n(Iz + IL)}}\` = ${res(R, 'Ω')}`,
    ]);
  },
  (rng) => {
    const Uz = pick(rng, UZ);
    const U1 = pick(rng, [9, 12, 15, 18, 24].filter((u) => u - Uz >= 3));
    const R = pick(rng, [100, 150, 180, 220, 270, 330, 470]);
    const I = (U1 - Uz) / R;
    const P = Uz * I;
    return numeric(ID, `Stabilizátor má predradný rezistor ${q(R, 'Ω')}, Zenerovu diódu ${q(Uz, 'V')} a vstupné napätie ${q(U1, 'V')}. Aký výkon sa premení na teplo v Zenerovej dióde, keď odpojíš záťaž?`, P, 'W', [
      'Bez záťaže tečie celý prúd rezistora cez Zenerovu diódu.',
      `\`$I_{Z} = @f{$U_{1} − $U_{Z}}{$R} = @f{${n(U1)} − ${n(Uz)}}{${n(R)}}\` = ${n(I * 1000, 4)} mA`,
      `\`$P_{Z} = $U_{Z} · $I_{Z}\` = ${n(Uz)} · ${n(I, 4)} = ${res(P, 'W')}`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, [220, 240]);
    const R2 = pick(rng, [330, 470, 680, 820, 1000, 1500, 1800, 2200]);
    const U2 = 1.25 * (1 + R2 / R1);
    return numeric(ID, `Nastaviteľný stabilizátor LM317 má rezistory \`$R_{1}\` = ${q(R1, 'Ω')} (medzi OUT a ADJ) a \`$R_{2}\` = ${q(R2, 'Ω')} (z ADJ na zem). Aké je výstupné napätie?`, U2, 'V', [
      '`$U_{2} = 1,25 · (1 + @f{$R_{2}}{$R_{1}})`',
      `\`$U_{2}\` = 1,25 · (1 + ${n(R2)}/${n(R1)}) = 1,25 · ${n(1 + R2 / R1, 4)} = ${res(U2, 'V')}`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, [120, 220, 240]);
    const U2 = pick(rng, [3.3, 5, 6, 9, 12, 15]);
    const R2 = R1 * (U2 / 1.25 - 1);
    return numeric(ID, `Stabilizátor LM317 má \`$R_{1}\` = ${q(R1, 'Ω')}. Aký odpor \`$R_{2}\` potrebuješ, aby bolo výstupné napätie ${q(U2, 'V')}?`, R2, 'Ω', [
      'Z `$U_{2} = 1,25 · (1 + @f{$R_{2}}{$R_{1}})` vyjadríš `$R_{2} = $R_{1} · (@f{$U_{2}}{1,25} − 1)`.',
      `\`$R_{2}\` = ${n(R1)} · (${n(U2)}/1,25 − 1) = ${n(R1)} · ${n(U2 / 1.25 - 1, 4)} = ${res(R2, 'Ω')}`,
    ]);
  },
  (rng) => {
    const reg = pick(rng, REG);
    const U1 = pick(rng, [9, 12, 15, 18, 24].filter((u) => u >= reg.u + 3));
    const I = pick(rng, [0.1, 0.2, 0.25, 0.3, 0.5, 0.8, 1]);
    const P = (U1 - reg.u) * I;
    return numeric(ID, `Stabilizátor ${reg.type} je napájaný napätím ${q(U1, 'V')} a záťaž odoberá ${q(I, 'A')}. Aký výkon sa v ňom premení na teplo?`, P, 'W', [
      `Stabilizátor ${reg.type} má výstupné napätie ${reg.u} V; rozdiel napätí zostáva na ňom.`,
      `\`$P = ($U_{1} − $U_{2}) · $I\` = (${n(U1)} − ${reg.u}) · ${n(I)} = ${res(P, 'W')}`,
    ]);
  },
  (rng) => {
    const reg = pick(rng, REG);
    const U1 = pick(rng, [9, 12, 15, 18, 24].filter((u) => u >= reg.u + 3));
    const eta = (reg.u / U1) * 100;
    return numeric(ID, `Aká je približne účinnosť lineárneho stabilizátora ${reg.type} pri vstupnom napätí ${q(U1, 'V')}? (Vlastnú spotrebu stabilizátora zanedbaj.)`, eta, '%', [
      'Vstupný aj výstupný prúd sú takmer rovnaké, preto `$η = @f{$U_{2} · $I}{$U_{1} · $I} = @f{$U_{2}}{$U_{1}}`.',
      `\`$η\` = ${reg.u}/${n(U1)} = ${n(eta / 100, 3)} = **${n(eta, 3)} %**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const t = pick(rng, ['7805', '7806', '7809', '7812', '7815', '7824', '7905', '7912', '7915']);
    const neg = t.startsWith('79');
    const u = Number(t.slice(2));
    const v = (x: number, sign: string) => `${sign}${fmt(x, 3)} V`;
    return choice(ID, `Aké výstupné napätie dáva integrovaný stabilizátor ${t}?`,
      [v(u, neg ? '−' : '+'), v(u, neg ? '+' : '−'), v(Number(t.slice(0, 2)), '+'), v(u / 10, neg ? '−' : '+')],
      `Prvé dvojčíslie určuje typ: 78xx sú stabilizátory **kladného**, 79xx **záporného** napätia. Posledné dvojčíslie je výstupné napätie vo voltoch, takže ${t} dáva ${v(u, neg ? '−' : '+')}.`,
      rng);
  },
  (rng) => {
    const k = pick(rng, ['odpojis', 'vstup', 'zataz'] as const);
    const prompt = {
      odpojis: 'V parametrickom stabilizátore odpojíš záťaž. Čo sa stane s prúdom Zenerovej diódy?',
      vstup: 'V parametrickom stabilizátore sa zvýši vstupné napätie (záťaž sa nemení). Čo sa stane s prúdom Zenerovej diódy?',
      zataz: 'V parametrickom stabilizátore sa zväčší prúd odoberaný záťažou. Čo sa stane s prúdom Zenerovej diódy?',
    }[k];
    const options: [string, string, string, string] = k === 'zataz'
      ? ['zmenší sa', 'zväčší sa', 'nezmení sa', 'zväčší sa na dvojnásobok']
      : ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'];
    const expl = {
      odpojis: 'Prúd rezistorom `$I = @f{$U_{1} − $U_{Z}}{$R}` zostáva rovnaký. Bez záťaže ho celý prevezme Zenerova dióda – preto sa jej výkon kontroluje práve pri odpojenej záťaži.',
      vstup: 'Napätie na výstupe zostáva `$U_{Z}`, takže väčší rozdiel `$U_{1} − $U_{Z}` zvýši prúd rezistorom. Prúd záťaže sa nemení, prírastok prevezme Zenerova dióda.',
      zataz: 'Prúd rezistorom `$I = $I_{Z} + $I_{L}` je daný vstupným napätím a `$R`. Keď si záťaž vezme viac, na diódu zostane menej. Ak by `$I_{Z}` kleslo pod minimum, stabilizácia prestane fungovať.',
    }[k];
    return choice(ID, prompt, options, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'electronics',
    title: 'Stabilizátory napätia',
    summary: 'Zenerova dióda a parametrický stabilizátor, integrované stabilizátory 78xx, 79xx a LM317, princíp spínaného zdroja.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Napätie za usmerňovačom s filtrom nie je stále: kolíše so sieťou (±10 %), klesá pri väčšom odbere a obsahuje zvlnenie. Elektronika – mikrokontroléry, zosilňovače, senzory – však potrebuje presné napätie. To zabezpečí **stabilizátor**: udržiava výstupné napätie takmer stále pri zmenách vstupného napätia aj záťaže.' },
      { t: 'h', text: 'Zenerova dióda' },
      { t: 'p', text: 'Zenerova dióda pracuje v **závernom smere**, v oblasti prierazu. Kým je záverné napätie menšie ako **Zenerovo napätie** `$U_{Z}`, prakticky nevedie. Po jeho dosiahnutí začne viesť a napätie na nej sa pri veľkej zmene prúdu zmení len nepatrne. Prieraz nie je deštruktívny – diódu zničí až prekročenie dovoleného výkonu.' },
      { t: 'figure', fig: zenerChart, caption: 'VA charakteristika Zenerovej diódy 5,6 V. V priamom smere sa správa ako bežná dióda, v závernom smere je strmá oblasť prierazu pri `$U_{Z}` – tu dióda stabilizuje.' },
      { t: 'list', items: [
        'Vyrábajú sa v rade napätí, napríklad 3,3 · 4,7 · 5,1 · 5,6 · 6,2 · 6,8 · 9,1 · 12 V, s dovoleným výkonom 0,5 W, 1,3 W aj viac.',
        'Pracovný prúd musí byť medzi `$I_{Z min}` (niekoľko mA – inak dióda nestabilizuje) a `$I_{Z max} = @f{$P_{Z max}}{$U_{Z}}`.',
        'Pri napätiach do asi 5 V prevláda Zenerov jav, pri vyšších lavínový prieraz. Diódy okolo 5 až 6 V majú najmenšiu teplotnú závislosť napätia.',
      ] },
      { t: 'h', text: 'Parametrický stabilizátor' },
      { t: 'p', text: 'Najjednoduchší stabilizátor tvorí **predradný rezistor** `$R` a Zenerova dióda zapojená paralelne k záťaži. Napätie na výstupe je približne `$U_{Z}`. Rozdiel napätí `$U_{1} − $U_{Z}` zostane na rezistore a jeho prúd sa delí medzi diódu a záťaž: keď záťaž odoberá menej, viac prúdu prevezme dióda a naopak.' },
      { t: 'figure', fig: () => zenerStabFigure(), caption: 'Parametrický stabilizátor: prúd `$I` predradného rezistora sa delí na prúd Zenerovej diódy `$I_{Z}` a prúd záťaže `$I_{L}` (L z angl. load – záťaž).' },
      {
        t: 'formula',
        tex: ['$R = @f{$U_{1} − $U_{Z}}{$I_{Z} + $I_{L}}', '$P_{Z} = $U_{Z} · $I_{Z}', '$P_{R} = ($U_{1} − $U_{Z}) · $I'],
        legend: [
          ['$U_{1}', 'vstupné (nestabilizované) napätie', 'V'],
          ['$U_{Z}', 'Zenerovo napätie = výstupné napätie', 'V'],
          ['$I_{Z}', 'prúd Zenerovej diódy (zvyčajne 5 až 10 mA)', 'A'],
          ['$I_{L}', 'prúd záťaže', 'A'],
          ['$P_{Z}', 'výkon premenený na teplo v Zenerovej dióde', 'W'],
        ],
      },
      { t: 'p', text: 'Rezistor navrhuješ pre **najmenšie** vstupné napätie a **najväčší** prúd záťaže, aby dióda stále viedla. Výkon diódy kontroluješ v opačnom prípade – pri najväčšom vstupnom napätí a **odpojenej záťaži**, keď celý prúd rezistora tečie diódou.' },
      {
        t: 'example',
        title: 'Návrh parametrického stabilizátora 5,6 V',
        given: ['`$U_{1}` = 12 V', '`$U_{Z}` = 5,6 V', '`$I_{L}` = 20 mA', '`$I_{Z}` = 10 mA'],
        steps: [
          '`$R = @f{12 − 5,6}{0,010 + 0,020} = @f{6,4}{0,030}` = 213 Ω, z rady E12 zvolíš 220 Ω',
          'Prúd rezistorom: `$I = @f{6,4}{220}` = 29,1 mA, so záťažou tečie diódou 29,1 − 20 = 9,1 mA',
          'Pri odpojenej záťaži: `$P_{Z}` = 5,6 · 0,0291 = 0,163 W – dióda 0,5 W vyhovie',
          'Výkon rezistora: `$P_{R}` = 6,4 · 0,0291 = 0,186 W – zvolíš rezistor 0,5 W (0,25 W by bol na hranici)',
        ],
        result: '`$R` = 220 Ω / 0,5 W, Zenerova dióda 5,6 V / 0,5 W',
      },
      { t: 'explore', build: stabExplorer, caption: 'Čiarkovaná čiara je napätie deliča `$R` a `$R_{L}` bez diódy. Keď výstupné napätie dosiahne `$U_{Z}`, dióda začne viesť a krivka sa zlomí do takmer vodorovnej čiary. Skús zmenšiť záťaž `$R_{L}` – pri veľkom odbere stabilizácia prestane fungovať.' },
      { t: 'note', kind: 'tip', text: 'Parametrický stabilizátor je vhodný len pre malé prúdy (jednotky až desiatky mA) – napríklad na referenčné napätie. Prúd rezistorom tečie stále, aj keď záťaž nič neodoberá, takže účinnosť je malá.' },
      { t: 'h', text: 'Integrované stabilizátory 78xx a 79xx' },
      { t: 'p', text: 'Integrovaný stabilizátor obsahuje zdroj referenčného napätia, zosilňovač odchýlky, výkonový tranzistor a ochranu proti skratu a prehriatiu. Rad **78xx** stabilizuje kladné napätie, **79xx** záporné; posledné dvojčíslie je výstupné napätie (7805 → +5 V, 7812 → +12 V, 7905 → −5 V). V puzdre TO-220 dávajú prúd do 1 A, typy 78Lxx do 100 mA. Vývody 7805 sú v poradí IN – GND – OUT, rad 79xx má iné poradie. Vstupné napätie musí byť aspoň o 2 až 3 V vyššie ako výstupné – 7805 potrebuje na vstupe aspoň asi 7 V vrátane poklesov zvlnenia. Rozdiel napätí zostáva na stabilizátore a mení sa na teplo.' },
      { t: 'figure', fig: () => regulatorFigure('7805'), caption: 'Zapojenie stabilizátora 7805. Kondenzátory `$C_{1}` a `$C_{2}` blízko vývodov zabraňujú rozkmitaniu; za usmerňovačom je navyše veľký filtračný kondenzátor.' },
      { t: 'formula', tex: ['$P = ($U_{1} − $U_{2}) · $I', '$η ≈ @f{$U_{2}}{$U_{1}}'], legend: [['$P', 'stratový výkon stabilizátora', 'W'], ['$U_{2}', 'výstupné napätie', 'V'], ['$η', 'účinnosť lineárneho stabilizátora', '–']] },
      {
        t: 'example',
        title: 'Stratový výkon stabilizátora 7805',
        given: ['`$U_{1}` = 12 V', '`$U_{2}` = 5 V', '`$I` = 0,5 A'],
        steps: [
          '`$P = ($U_{1} − $U_{2}) · $I` = (12 − 5) · 0,5 = 3,5 W',
          'Účinnosť `$η ≈ @f{5}{12}` = 0,42 – viac ako polovica energie sa mení na teplo.',
          'Bez chladiča sa puzdro TO-220 pri 3,5 W prehreje a zapôsobí tepelná ochrana – stabilizátor potrebuje chladič.',
        ],
        result: '`$P` = 3,5 W, `$η` ≈ 42 %, nutný chladič',
      },
      { t: 'h', text: 'Nastaviteľný stabilizátor LM317' },
      { t: 'p', text: 'LM317 udržiava medzi vývodmi OUT a ADJ stále referenčné napätie 1,25 V. Delič `$R_{1}`, `$R_{2}` určuje, koľkonásobok tohto napätia bude na výstupe – napätie sa dá nastaviť od 1,25 V do 37 V pri prúde do 1,5 A. Zvyčajne sa volí `$R_{1}` = 240 Ω a `$R_{2}` sa dopočíta alebo nahradí trimrom. Napríklad pre `$U_{2}` = 12 V vyjde `$R_{2} = $R_{1} · (@f{$U_{2}}{1,25} − 1)` = 240 · 8,6 = 2 064 Ω, v praxi trimer 5 kΩ alebo 2 kΩ + 68 Ω v sérii.' },
      { t: 'figure', fig: () => regulatorFigure('lm317'), caption: 'Nastaviteľný stabilizátor LM317: výstupné napätie určuje pomer rezistorov `$R_{2}` a `$R_{1}`.' },
      { t: 'formula', tex: '$U_{2} = 1,25 · (1 + @f{$R_{2}}{$R_{1}})', legend: [['$R_{1}', 'rezistor medzi OUT a ADJ (240 Ω)', 'Ω'], ['$R_{2}', 'rezistor medzi ADJ a zemou', 'Ω']] },
      { t: 'h', text: 'Spínané (impulzné) zdroje' },
      { t: 'p', text: 'Lineárny stabilizátor „spáli“ rozdiel napätí na teplo. **Spínaný zdroj** pracuje inak: tranzistor sa rýchlo zapína a vypína (desiatky až stovky kHz) a energia sa prenáša po dávkach cez cievku alebo malý vysokofrekvenčný transformátor. Výstupné napätie sa reguluje šírkou impulzov (PWM) a vyhladí sa filtrom LC. Tranzistor je buď úplne zopnutý, alebo vypnutý, preto sa v ňom stráca málo energie.' },
      {
        t: 'table',
        head: ['Vlastnosť', 'Lineárny stabilizátor', 'Spínaný zdroj'],
        rows: [
          ['účinnosť', '`$U_{2}/$U_{1}`, často 30 až 60 %', '80 až 95 %'],
          ['hmotnosť a rozmery', 'veľký sieťový transformátor 50 Hz, chladič', 'malý transformátor na vysokej frekvencii'],
          ['rušenie a zvlnenie', 'veľmi malé', 'väčšie, potrebuje filtre'],
          ['použitie', 'malé výkony, citlivé analógové obvody', 'nabíjačky, zdroje počítačov, LED zdroje'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Stabilizátor napätie len zmenšuje a udržiava – výstup nemôže byť vyšší, ako dovolí vstup. Pri lineárnom stabilizátore platí `$P = ($U_{1} − $U_{2}) · $I`, preto vstupné napätie zbytočne neprekračuj.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'V akom smere je zapojená Zenerova dióda v stabilizátore?',
      options: ['v závernom smere – katóda na kladnejšom potenciáli', 'v priepustnom smere', 'nezáleží na tom', 'v sérii so záťažou v priepustnom smere'],
      explanation: 'Zenerova dióda stabilizuje v oblasti prierazu v závernom smere. V priepustnom smere by na nej bolo len asi 0,7 V.',
    },
    {
      lessonId: ID,
      prompt: 'Kedy je Zenerova dióda v parametrickom stabilizátore najviac zaťažená výkonom?',
      options: ['pri najvyššom vstupnom napätí a odpojenej záťaži', 'pri najnižšom vstupnom napätí a plnej záťaži', 'pri skrate na výstupe', 'stále rovnako'],
      explanation: 'Bez záťaže tečie celý prúd rezistora diódou a pri najvyššom vstupnom napätí je tento prúd najväčší. Pri skrate na výstupe je na dióde nulové napätie, teda aj nulový výkon.',
    },
    {
      lessonId: ID,
      prompt: 'Aké výstupné napätie dáva stabilizátor 7912?',
      options: ['−12 V', '+12 V', '+79 V', '−9 V'],
      explanation: 'Rad 79xx stabilizuje záporné napätie, posledné dvojčíslie je napätie vo voltoch.',
    },
    {
      lessonId: ID,
      prompt: 'Aké napätie je na výstupe LM317, ak `$R_{1}` = 240 Ω a `$R_{2}` = 720 Ω?',
      options: ['5 V', '3,75 V', '1,25 V', '4 V'],
      explanation: '`$U_{2} = 1,25 · (1 + @f{720}{240})` = 1,25 · 4 = 5 V.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo potrebuje stabilizátor 7805 pri väčšom prúde chladič?',
      options: ['rozdiel vstupného a výstupného napätia sa v ňom mení na teplo `($U_{1} − $U_{2}) · $I`', 'lebo výstupné napätie je príliš vysoké', 'chladič zlepšuje stabilitu referenčného napätia', 'bez chladiča by kmital'],
      explanation: 'Lineárny stabilizátor funguje ako premenlivý odpor v sérii so záťažou. Celý prúd záťaže ním tečie a rozdiel napätí na ňom vytvára stratový výkon.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo má spínaný zdroj vyššiu účinnosť ako lineárny stabilizátor?',
      options: ['tranzistor je buď úplne zopnutý, alebo vypnutý, a v oboch stavoch sa v ňom stráca málo výkonu', 'lebo nepotrebuje žiadnu cievku ani kondenzátor', 'lebo pracuje so sieťovou frekvenciou 50 Hz', 'lebo má na výstupe Zenerovu diódu'],
      explanation: 'Zopnutý tranzistor má malé napätie, vypnutý nevedie prúd – súčin napätia a prúdu je v oboch stavoch malý. Energia sa prenáša cez cievku alebo transformátor takmer bez strát.',
    },
    {
      lessonId: ID,
      prompt: 'Čo sa stane, ak v parametrickom stabilizátore klesne prúd Zenerovej diódy pod minimálnu hodnotu?',
      options: ['dióda prestane stabilizovať a výstupné napätie klesne', 'dióda sa zničí', 'výstupné napätie stúpne na hodnotu vstupného', 'nič, stabilizácia funguje ďalej'],
      explanation: 'Pod `$I_{Z min}` dióda nie je v oblasti prierazu a obvod sa správa ako obyčajný delič `$R`, `$R_{L}` – výstupné napätie závisí od záťaže.',
    },
  ],
  generators,
};

export default mod;
