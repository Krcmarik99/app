import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { explorer } from '../../../ui/explorer';
import { deltaLoadFigure, phasorDiagram, starLoadFigure, threePhaseChart } from '../../../ui/fig-ac';
import { choice, rad } from '../util';

const ID = 'trojfazova-sustava';
const SQRT3 = Math.sqrt(3);

/** Prúd stredným vodičom pri odporovej (alebo rovnako posunutej) záťaži fáz. */
function neutralCurrent(i1: number, i2: number, i3: number): number {
  const x = i1 + i2 * Math.cos(rad(-120)) + i3 * Math.cos(rad(120));
  const y = i2 * Math.sin(rad(-120)) + i3 * Math.sin(rad(120));
  return Math.hypot(x, y);
}

const voltagePhasors = () => {
  const p = (deg: number, r = 5): [number, number] => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
  const [u1, u2, u3] = [p(90), p(-30), p(210)];
  const u12: [number, number] = [u1[0] - u2[0], u1[1] - u2[1]];
  return phasorDiagram([
    { x: u1[0], y: u1[1], label: 'U_1', cls: 'ink' },
    { x: u2[0], y: u2[1], label: 'U_2', cls: 'ink' },
    { x: u3[0], y: u3[1], label: 'U_3', cls: 'ink' },
    { x: -u2[0], y: -u2[1], label: '−U_2', cls: 'trace', dashed: true },
    { x: u12[0], y: u12[1], label: '', cls: 'trace', from: u1, dashed: true },
    { x: u12[0], y: u12[1], label: 'U_12', cls: 'copper' },
  ], 'Fázory fázových napätí U1, U2, U3 posunutých o 120° a združené napätie U12 = U1 − U2', { height: 280 });
};

function neutralExplorer(): HTMLElement {
  return explorer({
    title: 'Prúd stredným vodičom pri nesúmernej záťaži',
    params: [
      { key: 'i1', label: 'Prúd fázou L1 `$I_{1}`', unit: 'A', min: 0, max: 16, value: 10, format: (v) => `${fmt(v, 3)} A` },
      { key: 'i2', label: 'Prúd fázou L2 `$I_{2}`', unit: 'A', min: 0, max: 16, value: 10, format: (v) => `${fmt(v, 3)} A` },
      { key: 'i3', label: 'Prúd fázou L3 `$I_{3}`', unit: 'A', min: 0, max: 16, value: 4, format: (v) => `${fmt(v, 3)} A` },
    ],
    draw: ({ i1, i2, i3 }) => {
      const a2 = rad(-120);
      const a3 = rad(120);
      const sx = i1 + i2 * Math.cos(a2) + i3 * Math.cos(a3);
      const sy = i2 * Math.sin(a2) + i3 * Math.sin(a3);
      const iN = Math.hypot(sx, sy);
      const vectors = [
        { x: i1, y: 0, label: 'I_1', cls: 'ink' as const },
        { x: i2 * Math.cos(a2), y: i2 * Math.sin(a2), label: 'I_2', cls: 'ink' as const },
        { x: i3 * Math.cos(a3), y: i3 * Math.sin(a3), label: 'I_3', cls: 'ink' as const },
        { x: sx, y: sy, label: 'I_N', cls: 'copper' as const },
      ].filter((v) => Math.hypot(v.x, v.y) > 0.05);
      const chart = phasorDiagram(vectors.length ? vectors : [{ x: 1e-3, y: 0, label: '', cls: 'ink' }],
        `Fázory prúdov fáz a prúd stredným vodičom ${fmt(iN, 3)} A`, { width: 360, height: 280 });
      const max = Math.max(i1, i2, i3);
      return {
        chart,
        readouts: [
          ['Prúd stredným vodičom `$I_{N}`', `${fmt(iN, 3)} A`],
          ['Najväčší fázový prúd', `${fmt(max, 3)} A`],
        ],
        note: iN < 0.05
          ? 'Záťaž je súmerná: fázory prúdov sa sčítajú na nulu a stredným vodičom netečie žiadny prúd.'
          : 'Fázy sú zaťažené rôzne, preto sa prúdy nevyrušia a ich súčet tečie späť stredným vodičom. Ak by sa prerušil, napätia na spotrebičoch by sa nerovnomerne rozdelili.',
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const U = pick(rng, [400, 400, 690, 230]);
    const I = pick(rng, [4.5, 8, 11, 16, 25, 32]);
    const c = pick(rng, [0.78, 0.82, 0.85, 0.88, 0.9]);
    const P = SQRT3 * U * I * c;
    return numeric(ID, `Trojfázový motor na sieti so združeným napätím ${q(U, 'V')} odoberá prúd ${q(I, 'A')} pri účinníku ${n(c)}. Aký je jeho príkon (činný výkon odoberaný zo siete)?`, P, 'W', [
      'Pre súmernú záťaž v ľubovoľnom zapojení: `$P = @s{3} · $U · $I · cos $φ` (U a I sú združené napätie a prúd vo vodiči).',
      `\`$P\` = 1,732 · ${n(U)} · ${n(I)} · ${n(c)} = ${res(P, 'W')}`,
    ]);
  },
  (rng) => {
    const P = pick(rng, [3e3, 5.5e3, 7.5e3, 11e3, 15e3, 22e3]);
    const c = pick(rng, [0.8, 0.85, 0.87, 0.9]);
    const I = P / (SQRT3 * 400 * c);
    return numeric(ID, `Trojfázový spotrebič s príkonom ${q(P, 'W')} a účinníkom ${n(c)} je pripojený na sieť 230/400 V. Aký prúd tečie každým fázovým vodičom?`, I, 'A', [
      '`$I = @f{$P}{@s{3} · $U · cos $φ}`',
      `\`$I = @f{${n(P)}}{1,732 · 400 · ${n(c)}}\` = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const Uf = pick(rng, [230, 127, 400, 133]);
    const U = SQRT3 * Uf;
    return numeric(ID, `Fázové napätie trojfázovej siete je ${q(Uf, 'V')}. Aké je združené napätie medzi dvoma fázovými vodičmi?`, U, 'V', [
      'Združené napätie je rozdiel dvoch fázových napätí posunutých o 120°: `$U = @s{3} · $U_{f}`.',
      `\`$U\` = 1,732 · ${n(Uf)} = ${res(U, 'V')}`,
    ]);
  },
  (rng) => {
    const R = pick(rng, [22, 33, 47, 53, 100, 150]);
    const star = rng() < 0.5;
    const Uz = star ? 400 / SQRT3 : 400;
    const P = 3 * (Uz * Uz) / R;
    return numeric(ID, `Tri rovnaké vykurovacie telesá s odporom ${q(R, 'Ω')} sú zapojené do ${star ? 'hviezdy' : 'trojuholníka'} na sieť 230/400 V. Aký je celkový výkon?`, P, 'W', star
      ? [
        'V zapojení do hviezdy je na každom telese fázové napätie `$U_{f} = @f{400}{@s{3}}` = 230,9 V.',
        `Jedno teleso: \`$P_{1} = @f{$U_{f}^{2}}{$R} = @f{230,9^{2}}{${n(R)}}\` = ${n(Uz * Uz / R, 4)} W`,
        `Spolu: \`$P = 3 · $P_{1}\` = ${res(P, 'W')}`,
      ]
      : [
        'V zapojení do trojuholníka je na každom telese združené napätie 400 V.',
        `Jedno teleso: \`$P_{1} = @f{$U^{2}}{$R} = @f{400^{2}}{${n(R)}}\` = ${n(Uz * Uz / R, 4)} W`,
        `Spolu: \`$P = 3 · $P_{1}\` = ${res(P, 'W')}`,
      ]);
  },
  (rng) => {
    const Iph = pick(rng, [2.5, 4, 5.8, 8.66, 10, 12]);
    const I = SQRT3 * Iph;
    return numeric(ID, `Motor zapojený do trojuholníka má v každom vinutí prúd ${q(Iph, 'A')}. Aký prúd tečie prívodným vodičom?`, I, 'A', [
      'V zapojení do trojuholníka sa v každom uzle stretajú prúdy dvoch vinutí posunuté o 120°, preto `$I = @s{3} · $I_{f}`.',
      `\`$I\` = 1,732 · ${n(Iph)} = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const [i1, i2, i3] = pick(rng, [[10, 10, 0], [16, 8, 8], [10, 5, 5], [12, 6, 0], [16, 10, 10], [8, 8, 2]] as const);
    const iN = neutralCurrent(i1, i2, i3);
    return numeric(ID, `Odporové spotrebiče zapojené do hviezdy odoberajú z fáz prúdy ${n(i1)} A, ${n(i2)} A a ${n(i3)} A. Aký prúd tečie stredným vodičom?`, iN, 'A', [
      'Prúdy sú vo fáze so svojimi napätiami, teda navzájom posunuté o 120°. Ich fázorový súčet: `$I_{N}^{2} = $I_{1}^{2} + $I_{2}^{2} + $I_{3}^{2} − $I_{1}$I_{2} − $I_{2}$I_{3} − $I_{3}$I_{1}`',
      `\`$I_{N}^{2}\` = ${n(i1 * i1)} + ${n(i2 * i2)} + ${n(i3 * i3)} − ${n(i1 * i2)} − ${n(i2 * i3)} − ${n(i3 * i1)} = ${n(iN * iN, 4)}`,
      `\`$I_{N} = @s{${n(iN * iN, 4)}}\` = ${res(iN, 'A')}`,
    ]);
  },
  (rng) => {
    const which = pick(rng, [0, 1, 2] as const);
    if (which === 0) {
      return choice(ID, 'Koľkokrát väčší výkon majú tri rovnaké rezistory zapojené do trojuholníka oproti zapojeniu do hviezdy na tej istej sieti?',
        ['trikrát', '`@s{3}`-krát', 'dvakrát', 'rovnaký'],
        'V trojuholníku je na každom rezistore `@s{3}`-krát väčšie napätie (400 V namiesto 230 V). Výkon rastie s druhou mocninou napätia: `(@s{3})^{2}` = 3. Na tom je založený rozbeh motora prepínačom hviezda – trojuholník.', rng);
    }
    if (which === 1) {
      return choice(ID, 'Akú farbu má v pevnom rozvode stredný (neutrálny) vodič N?',
        ['modrú', 'zelenožltú', 'hnedú', 'čiernu'],
        'Stredný vodič N je modrý, ochranný vodič PE zelenožltý. Fázové vodiče L1, L2, L3 sú hnedý, čierny a sivý.', rng);
    }
    return choice(ID, 'Ako zmeníš smer otáčania trojfázového asynchrónneho motora?',
      ['vymeníš ľubovoľné dva fázové vodiče', 'vymeníš fázový a stredný vodič', 'prepneš motor z hviezdy do trojuholníka', 'zmeníš polaritu jednosmerného budenia'],
      'Výmenou dvoch fáz sa zmení sled fáz (L1 – L3 – L2), a tým aj smer točivého magnetického poľa a otáčania rotora.', rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'ac',
    title: 'Trojfázová sústava',
    summary: 'Fázové a združené napätie 230/400 V, zapojenie do hviezdy a do trojuholníka a výkon trojfázového spotrebiča.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Elektrická energia sa vyrába, prenáša a rozvádza v **trojfázovej sústave**. Alternátor má na statore tri rovnaké vinutia pootočené o 120°. Otáčajúce sa magnetické pole rotora v nich indukuje tri napätia s rovnakou amplitúdou a frekvenciou, ale navzájom posunuté o tretinu periódy.' },
      { t: 'figure', fig: threePhaseChart, caption: 'Fázové napätia L1, L2 a L3 siete 230 V / 50 Hz. Posun o 120° zodpovedá tretine periódy, teda 6,67 ms. V každom okamihu je súčet všetkých troch napätí nulový.' },
      { t: 'p', text: 'Trojfázová sústava má oproti trom samostatným jednofázovým obvodom veľké výhody: na prenos rovnakého výkonu stačia 3 alebo 4 vodiče namiesto 6, výkon súmerného spotrebiča sa v čase nemení (motory bežia pokojne) a tri posunuté prúdy vytvoria **točivé magnetické pole** – základ asynchrónnych motorov.' },
      { t: 'h', text: 'Fázové a združené napätie' },
      {
        t: 'list',
        items: [
          '**Fázové napätie** `$U_{f}` je medzi fázovým vodičom (L1, L2, L3) a stredným vodičom N – v našej sieti 230 V.',
          '**Združené napätie** `$U` je medzi dvoma fázovými vodičmi – 400 V. Sieť preto označujeme 3 × 230/400 V.',
        ],
      },
      { t: 'figure', fig: voltagePhasors, caption: 'Združené napätie `$U_{12}` je rozdiel fázorov `$U_{1}` a `$U_{2}` – k fázoru `$U_{1}` pripočítame opačný fázor `−$U_{2}` (čiarkovane, rovnobežník). Z trojuholníka s uhlom 120° vychádza `$U_{12} = @s{3} · $U_{f}` a `$U_{12}` predbieha `$U_{1}` o 30°.' },
      {
        t: 'formula',
        tex: ['$U = @s{3} · $U_{f}', '400 V ≈ 1,732 · 230 V'],
        legend: [['$U', 'združené napätie (medzi fázami)', 'V'], ['$U_{f}', 'fázové napätie (fáza – N)', 'V']],
      },
      {
        t: 'table',
        head: ['Vodič', 'Označenie', 'Farba izolácie'],
        rows: [
          ['fázové vodiče', 'L1, L2, L3', 'hnedá, čierna, sivá'],
          ['stredný (neutrálny) vodič', 'N', 'modrá'],
          ['ochranný vodič', 'PE', 'zelenožltá'],
          ['vodič PEN (spojený N a PE)', 'PEN', 'zelenožltá s modrými koncami'],
        ],
      },
      { t: 'h', text: 'Zapojenie do hviezdy (Y)' },
      { t: 'figure', fig: starLoadFigure, caption: 'Zapojenie do hviezdy: konce všetkých troch spotrebičov sú spojené v uzle hviezdy, ktorý je pripojený na stredný vodič N.' },
      { t: 'p', text: 'Každý spotrebič je pripojený medzi fázu a stredný vodič, teda na **fázové napätie** 230 V. Prúd vo fázovom vodiči je ten istý ako prúd spotrebičom.' },
      { t: 'formula', tex: ['$U_{f} = @f{$U}{@s{3}}', '$I = $I_{f}'] },
      { t: 'p', text: 'Pri **súmernej** záťaži (všetky tri fázy rovnako) sa prúdy v uzle hviezdy vyrušia a stredným vodičom netečie nič. Pri **nesúmernej** záťaži (domácnosti, osvetlenie) tečie stredným vodičom rozdiel prúdov.' },
      { t: 'explore', build: neutralExplorer, caption: 'Nastav rovnaké prúdy vo všetkých fázach – prúd stredným vodičom zmizne. Vypni jednu fázu (prúd 0) a sleduj, ako narastie.' },
      { t: 'note', kind: 'warn', text: 'Stredný vodič sa **nikdy neistí** a nesmie sa prerušiť. Pri prerušení „N“ v nesúmerne zaťaženej sieti sa napätia na spotrebičoch rozdelia podľa ich odporov – na málo zaťaženej fáze môže stúpnuť až k 400 V a zničiť spotrebiče.' },
      { t: 'h', text: 'Zapojenie do trojuholníka (D)' },
      { t: 'figure', fig: deltaLoadFigure, caption: 'Zapojenie do trojuholníka: spotrebiče sú zapojené medzi dvojice fáz, stredný vodič sa nepoužíva.' },
      { t: 'p', text: 'Každý spotrebič je pripojený medzi dve fázy, teda na **združené napätie** 400 V. Prúd vo vodiči je fázorovým rozdielom prúdov dvoch spotrebičov, a preto je `@s{3}`-krát väčší ako prúd jedným spotrebičom.' },
      { t: 'formula', tex: ['$U_{f} = $U', '$I = @s{3} · $I_{f}'] },
      { t: 'h', text: 'Výkon trojfázového spotrebiča' },
      { t: 'p', text: 'Výkon súmerného spotrebiča je trojnásobkom výkonu jednej fázy. Keď dosadíme združené hodnoty (tie meriame na prívode), dostaneme pre obe zapojenia rovnaký vzťah:' },
      {
        t: 'formula',
        tex: ['$P = 3 · $U_{f} · $I_{f} · cos $φ = @s{3} · $U · $I · cos $φ', '$Q = @s{3} · $U · $I · sin $φ', '$S = @s{3} · $U · $I'],
        legend: [['$U', 'združené napätie', 'V'], ['$I', 'prúd vo fázovom vodiči', 'A'], ['$φ', 'fázový posun v jednej fáze spotrebiča', '°']],
      },
      {
        t: 'example',
        title: 'Príkon trojfázového motora',
        given: ['`$U` = 400 V', '`$I` = 10 A', '`cos $φ` = 0,85'],
        steps: [
          '`$P = @s{3} · $U · $I · cos $φ` = 1,732 · 400 · 10 · 0,85 = 5 889 W',
          '`$S = @s{3} · $U · $I` = 1,732 · 400 · 10 = 6 928 VA',
          '`$Q = @s{$S^{2} − $P^{2}}` = 3 650 var',
        ],
        result: '`$P` ≈ 5,9 kW, `$S` ≈ 6,9 kVA, `$Q` ≈ 3,65 kvar',
      },
      {
        t: 'example',
        title: 'Ohrievač zapojený do hviezdy a do trojuholníka',
        given: ['tri telesá po `$R` = 100 Ω', 'sieť 230/400 V'],
        steps: [
          'Hviezda: na telese `$U_{f} = @f{400}{@s{3}}` = 230,9 V, `$P = 3 · @f{230,9^{2}}{100}` = 1 600 W',
          'Trojuholník: na telese 400 V, `$P = 3 · @f{400^{2}}{100}` = 4 800 W',
          'Pomer `@f{4 800}{1 600}` = 3',
        ],
        result: 'V trojuholníku má ohrievač trojnásobný výkon – takto sa prepínajú stupne výkonu sporákov a rozbieha sa motor prepínačom Y/D.',
      },
      { t: 'note', kind: 'remember', text: 'Hviezda: `$U = @s{3} · $U_{f}`, `$I = $I_{f}`. Trojuholník: `$U = $U_{f}`, `$I = @s{3} · $I_{f}`. Výkon v oboch prípadoch: `$P = @s{3} · $U · $I · cos $φ`.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aké je združené napätie siete, ktorej fázové napätie je 230 V?',
      options: ['400 V', '460 V', '690 V', '230 V'],
      explanation: '`$U = @s{3} · $U_{f}` = 1,732 · 230 ≈ 400 V. Fázory sú posunuté o 120°, preto sa napätia nesčítajú aritmeticky (to by bolo 460 V).',
    },
    {
      lessonId: ID,
      prompt: 'Aký prúd tečie stredným vodičom pri súmernej záťaži zapojenej do hviezdy?',
      options: ['nulový', 'trojnásobok fázového prúdu', '`@s{3}`-násobok fázového prúdu', 'rovnaký ako vo fázovom vodiči'],
      explanation: 'Tri rovnako veľké prúdy posunuté o 120° majú nulový fázorový súčet. Preto pri súmernej záťaži (napr. motor) stredný vodič nie je potrebný.',
    },
    {
      lessonId: ID,
      prompt: 'Na aké napätie je pripojený každý spotrebič zapojený do trojuholníka v sieti 230/400 V?',
      options: ['400 V', '230 V', '133 V', '690 V'],
      explanation: 'V trojuholníku je každý spotrebič medzi dvoma fázami, teda na združenom napätí 400 V.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa stredný vodič neistí poistkou ani ističom?',
      options: ['jeho prerušenie by pri nesúmernej záťaži spôsobilo nebezpečné zmeny napätia na spotrebičoch', 'netečie ním nikdy žiadny prúd', 'má väčší prierez ako fázové vodiče', 'je spojený so zemou, takže prúd ním tečie len pri poruche'],
      explanation: 'Stredný vodič udržiava na každom spotrebiči fázové napätie. Po jeho prerušení by sa napätia rozdelili podľa odporov záťaže a niektoré spotrebiče by dostali až takmer 400 V.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorý vzťah platí pre činný výkon súmerného trojfázového spotrebiča (U a I sú združené hodnoty)?',
      options: ['`$P = @s{3} · $U · $I · cos $φ`', '`$P = 3 · $U · $I · cos $φ`', '`$P = $U · $I · cos $φ`', '`$P = @f{$U · $I}{@s{3}}`'],
      explanation: 'Výkon je trojnásobkom výkonu fázy: `3 · $U_{f} · $I_{f} · cos $φ`. Pri hviezde je `$U_{f} = @f{$U}{@s{3}}`, pri trojuholníku `$I_{f} = @f{$I}{@s{3}}` – v oboch prípadoch vyjde `@s{3} · $U · $I · cos $φ`.',
    },
    {
      lessonId: ID,
      prompt: 'O aký čas sú posunuté fázové napätia siete 50 Hz?',
      options: ['o 6,67 ms (tretina periódy)', 'o 20 ms', 'o 10 ms', 'o 120 ms'],
      explanation: 'Perióda je 20 ms, posun 120° je tretina periódy: 20 / 3 = 6,67 ms.',
    },
    {
      lessonId: ID,
      prompt: 'Akú farbu má ochranný vodič PE?',
      options: ['zelenožltú', 'modrú', 'hnedú', 'čiernu'],
      explanation: 'Zelenožltá kombinácia je vyhradená iba pre ochranný vodič PE (a vodič PEN, ktorý má navyše modré označenie koncov). Stredný vodič je modrý.',
    },
  ],
  generators,
};

export default mod;
