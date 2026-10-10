import type { LessonModule } from '../../module';
import { pick, shuffle } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { conductorColorsFigure, networkFigure, powerChainFigure } from '../../../ui/fig-power';
import { choice, clean } from '../util';

const ID = 'prenos-energie';
const SQ3 = Math.sqrt(3);

/** Straty vo vedení v percentách prenášaného výkonu v závislosti od prenosového napätia. */
function lossExplorer(): HTMLElement {
  const marks = [6, 22, 110, 220, 400];
  return explorer({
    title: 'Straty vo vedení a prenosové napätie',
    params: [
      { key: 'P', label: 'Prenášaný výkon `$P`', unit: 'W', min: 1e6, max: 200e6, value: 50e6, log: true },
      { key: 'U', label: 'Napätie vedenia `$U`', unit: 'V', min: 6e3, max: 400e3, value: 22e3, log: true },
      { key: 'R', label: 'Odpor jedného vodiča `$R`', unit: 'Ω', min: 0.5, max: 10, value: 4 },
    ],
    draw: ({ P, U, R }) => {
      const pct = (u: number) => (100 * R * P) / (u * u);
      const I = P / (SQ3 * U);
      const dP = 3 * R * I * I;
      const rel = (100 * dP) / P;
      const lu = Math.log10(U / 1000);
      const chart = lineChart({
        ariaLabel: `Straty vo vedení v percentách prenášaného výkonu ${fmt(P / 1e6, 3)} MW pri odpore vodiča ${fmt(R, 3)} Ω`,
        width: 460,
        height: 250,
        x: { min: Math.log10(5), max: Math.log10(450), ticks: marks.map((m) => Math.log10(m)), format: (v) => fmt(10 ** v, 3), label: 'U [kV]' },
        y: { min: 0, max: 50, ticks: [0, 10, 20, 30, 40, 50], format: (v) => `${v}`, label: 'ΔP / P [%]' },
        series: [{ points: sample((x) => pct(10 ** x * 1000), Math.log10(5), Math.log10(450), 200), className: 'copper' }],
        markers: [{ x: lu, y: Math.min(50, rel), label: rel > 50 ? `${fmt(rel, 3)} % (mimo grafu)` : `${fmt(rel, 3)} %`, above: rel < 44 }],
      });
      return {
        chart,
        readouts: [
          ['Prúd vodičom `$I`', q(I, 'A')],
          ['Straty `Δ$P`', q(dP, 'W')],
          ['Straty v %', `${fmt(rel, 3)} %`],
          ['Výkon na konci `$P − Δ$P`', dP < P ? q(P - dP, 'W') : '—'],
        ],
        note: rel >= 100
          ? 'Straty by boli väčšie ako samotný prenášaný výkon – pri takomto napätí sa výkon na túto vzdialenosť preniesť nedá.'
          : 'Trojfázové vedenie, `cos $φ` = 1. Keď napätie zvýšiš dvojnásobne, prúd klesne na polovicu a straty na štvrtinu.',
      };
    },
  });
}

interface Level { U: number; P: number[]; R: number[] }
const LEVELS: Level[] = [
  { U: 22e3, P: [2e6, 3e6, 4e6, 5e6, 8e6], R: [1, 1.5, 2, 3, 4] },
  { U: 110e3, P: [20e6, 40e6, 60e6, 80e6], R: [2, 3, 4, 6] },
  { U: 220e3, P: [100e6, 150e6, 200e6, 250e6], R: [2, 3, 5] },
  { U: 400e3, P: [300e6, 500e6, 700e6, 900e6], R: [2, 3, 4, 6] },
];

const SYSTEMS: { name: string; desc: string }[] = [
  { name: 'TN-C', desc: 'uzol zdroja je priamo uzemnený a v celej sieti je stredný a ochranný vodič spojený do jedného vodiča PEN' },
  { name: 'TN-S', desc: 'uzol zdroja je priamo uzemnený a v celej sieti sú samostatné vodiče N a PE' },
  { name: 'TN-C-S', desc: 'uzol zdroja je priamo uzemnený, v prvej časti siete je vodič PEN, ktorý sa ďalej rozdelí na samostatné vodiče N a PE' },
  { name: 'TT', desc: 'uzol zdroja je priamo uzemnený a neživé časti spotrebičov majú vlastný uzemňovač, nezávislý od uzemnenia zdroja' },
  { name: 'IT', desc: 'všetky živé časti zdroja sú izolované od zeme (alebo je zdroj uzemnený cez veľkú impedanciu) a neživé časti sú uzemnené' },
];

const COLORS: { what: string; color: string }[] = [
  { what: 'ochranný vodič PE', color: 'zelenožltá' },
  { what: 'stredný vodič N', color: 'modrá' },
  { what: 'fázový vodič L1', color: 'hnedá' },
  { what: 'fázový vodič L2', color: 'čierna' },
  { what: 'fázový vodič L3', color: 'sivá' },
  { what: 'vodič PEN', color: 'zelenožltá s modrým označením na koncoch' },
];

const generators: Generator[] = [
  // Prúd vedením pri danom výkone a napätí.
  (rng) => {
    const lv = pick(rng, LEVELS);
    const P = pick(rng, lv.P);
    const c = pick(rng, [0.9, 0.95, 1]);
    const I = P / (SQ3 * lv.U * c);
    return numeric(ID, `Trojfázovým vedením s napätím ${q(lv.U, 'V')} sa prenáša činný výkon ${q(P, 'W')} pri účinníku \`cos $φ\` = ${n(c)}. Aký prúd tečie jedným vodičom vedenia?`, I, 'A', [
      'Z výkonu trojfázovej sústavy `$P = @s{3} · $U · $I · cos $φ` vyjadríme prúd.',
      `\`$I = @f{$P}{@s{3} · $U · cos $φ} = @f{${n(P)}}{1,732 · ${n(lv.U)} · ${n(c)}}\` = ${res(I, 'A')}`,
    ]);
  },
  // Straty vo vedení.
  (rng) => {
    const lv = pick(rng, LEVELS);
    const P = pick(rng, lv.P);
    const R = pick(rng, lv.R);
    const I = P / (SQ3 * lv.U);
    const Ir = Number(I.toPrecision(4));
    const dP = 3 * R * Ir * Ir;
    return numeric(ID, `Trojfázové vedenie ${q(lv.U, 'V')} prenáša výkon ${q(P, 'W')} pri \`cos $φ\` = 1. Každý vodič vedenia má odpor ${q(R, 'Ω')}. Aké sú činné straty vo vedení?`, dP, 'W', [
      `\`$I = @f{$P}{@s{3} · $U} = @f{${n(P)}}{1,732 · ${n(lv.U)}}\` = ${n(Ir, 4)} A`,
      `Straty sú v troch vodičoch: \`Δ$P = 3 · $R · $I^{2}\` = 3 · ${n(R)} · ${n(Ir, 4)}² = ${res(dP, 'W')}`,
      `To je ${n((100 * dP) / P, 3)} % prenášaného výkonu.`,
    ]);
  },
  // Pomer strát pri dvoch napätiach.
  (rng) => {
    const [U1, U2] = pick(rng, [[22, 110], [110, 400], [10, 22], [110, 220], [220, 400], [22, 400], [6, 22]] as [number, number][]);
    const k = clean((U2 / U1) ** 2);
    return numeric(ID, `To isté vedenie (rovnaké vodiče) má preniesť rovnaký výkon pri rovnakom účinníku. Koľkokrát budú straty vo vedení menšie, keď namiesto napätia ${n(U1)} kV použiješ ${n(U2)} kV?`, k, '', [
      'Pri rovnakom výkone je prúd nepriamo úmerný napätiu: `@f{$I_{2}}{$I_{1}} = @f{$U_{1}}{$U_{2}}`.',
      'Straty `Δ$P = 3 · $R · $I^{2}` sú úmerné druhej mocnine prúdu, teda nepriamo úmerné druhej mocnine napätia.',
      `\`@f{Δ$P_{1}}{Δ$P_{2}} = (@f{$U_{2}}{$U_{1}})^{2} = (@f{${n(U2)}}{${n(U1)}})^{2}\` = **${n(k, 4)}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  // Percentuálny úbytok napätia.
  (rng) => {
    const U = pick(rng, [22e3, 110e3]);
    const R = U === 22e3 ? pick(rng, [0.8, 1.2, 1.5, 2, 2.5, 3]) : pick(rng, [2, 3, 4, 5, 6]);
    const I = U === 22e3 ? pick(rng, [60, 80, 100, 120, 150, 200]) : pick(rng, [150, 200, 250, 300, 400]);
    const dU = SQ3 * R * I;
    const pct = (100 * dU) / U;
    return numeric(ID, `Trojfázovým vedením ${q(U, 'V')} tečie prúd ${q(I, 'A')} pri \`cos $φ\` ≈ 1. Odpor jedného vodiča je ${q(R, 'Ω')}, reaktanciu vedenia zanedbaj. Aký je percentuálny úbytok napätia na vedení?`, pct, '%', [
      `Úbytok združeného napätia: \`Δ$U ≈ @s{3} · $R · $I\` = 1,732 · ${n(R)} · ${n(I)} = ${n(dU, 4)} V`,
      `\`Δ$u = @f{Δ$U}{$U} · 100 % = @f{${n(dU, 4)}}{${n(U)}} · 100 %\` = **${n(pct, 3)} %**`,
    ], { fixedUnit: true, tolerance: 0.02 });
  },
  // Sústava podľa popisu.
  (rng) => {
    const sys = pick(rng, SYSTEMS);
    const others = SYSTEMS.filter((x) => x !== sys).map((x) => x.name);
    const wrong = shuffle(rng, others).slice(0, 3);
    return choice(ID, `Ktorá sieťová sústava je opísaná: ${sys.desc}?`, [sys.name, wrong[0], wrong[1], wrong[2]],
      `Prvé písmeno opisuje vzťah zdroja k zemi (T – priamo uzemnený bod, I – izolovaný alebo cez impedanciu), druhé vzťah neživých častí k zemi (T – vlastný uzemňovač, N – spojené s uzemneným bodom zdroja). Ďalšie písmená: S – oddelené vodiče N a PE, C – spoločný vodič PEN. Opis zodpovedá sústave **${sys.name}**.`,
      rng);
  },
  // Farba vodiča.
  (rng) => {
    const item = pick(rng, COLORS);
    const pool = ['zelenožltá', 'modrá', 'hnedá', 'čierna', 'sivá', 'červená', 'zelenožltá s modrým označením na koncoch'].filter((c) => c !== item.color);
    const wrong = shuffle(rng, pool).slice(0, 3);
    return choice(ID, `Akú farbu izolácie má podľa normy ${item.what}?`, [item.color, wrong[0], wrong[1], wrong[2]],
      'Fázové vodiče L1, L2, L3 sú hnedý, čierny a sivý, stredný vodič N je modrý, ochranný vodič PE zelenožltý. Vodič PEN je zelenožltý a na koncoch má modré označenie. Zelenožltú farbu nesmie mať žiadny iný vodič.',
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'power',
    title: 'Výroba, prenos a rozvod elektrickej energie',
    summary: 'Druhy elektrární, napäťové hladiny prenosovej a distribučnej sústavy, prečo sa prenáša pri vysokom napätí, úbytok napätia a sieťové sústavy TN, TT a IT.',
    minutes: 14,
    blocks: [
      { t: 'p', text: 'Elektrickú energiu nevieme vo veľkom skladovať, preto ju elektrárne musia v každom okamihu vyrábať presne toľko, koľko sa jej práve spotrebuje. Elektrárne, vedenia, rozvodne a spotrebiče spolu tvoria **elektrizačnú sústavu**. Energia v nej prechádza tromi stupňami: **výroba** v elektrárňach, **prenos** vedeniami veľmi vysokého napätia na veľké vzdialenosti a **rozvod (distribúcia)** až k odberateľom.' },
      { t: 'h', text: 'Elektrárne' },
      {
        t: 'table',
        head: ['Druh elektrárne', 'Premena energie', 'Príklad zo Slovenska'],
        rows: [
          ['tepelná (uhoľná, paroplynová)', 'chemická energia paliva → teplo → para → turbína → alternátor', 'paroplynové elektrárne, teplárne vo veľkých mestách'],
          ['jadrová', 'štiepenie jadier uránu → teplo → para → turbína → alternátor', 'Mochovce, Jaslovské Bohunice'],
          ['vodná (prietočná)', 'energia vody → vodná turbína → alternátor', 'Gabčíkovo na Dunaji, kaskáda na Váhu'],
          ['prečerpávacia vodná', 'pri prebytku čerpá vodu hore, v špičke ju spúšťa cez turbínu', 'Čierny Váh'],
          ['obnoviteľné zdroje', 'slnko (fotovoltika), vietor, biomasa, bioplyn, geotermálna energia', 'fotovoltické elektrárne, bioplynové stanice'],
        ],
      },
      { t: 'p', text: 'Jadrové elektrárne vyrábajú na Slovensku viac ako polovicu elektriny a pracujú ako **základné zaťaženie** – nepretržite s takmer stálym výkonom. Vodné elektrárne sa dajú rýchlo spustiť, a preto pokrývajú **špičky** spotreby. **Prečerpávacia elektráreň** funguje ako obrovský akumulátor: keď je elektriny nadbytok, prečerpáva vodu do hornej nádrže, a keď je jej nedostatok, vyrába. Výkon slnečných a veterných elektrární závisí od počasia, preto ich musia vyrovnávať iné zdroje.' },
      { t: 'p', text: 'Takmer všetky elektrárne vyrábajú elektrinu **synchrónnymi alternátormi**. Ich otáčky sú pevne zviazané s frekvenciou siete **50 Hz**: `$n = @f{60 · $f}{$p}`, kde `$p` je počet pólových dvojíc. Turboalternátor parnej turbíny má jednu pólovú dvojicu a otáča sa 3 000 ot/min, pomalobežný hydroalternátor vodnej elektrárne má mnoho pólov. Alternátor dáva napätie rádovo 6 až 24 kV.' },
      { t: 'note', kind: 'remember', text: 'Frekvencia 50 Hz je v celej prepojenej európskej sústave rovnaká. Keď spotreba prevýši výrobu, alternátory sa brzdia a frekvencia klesá; pri prebytku výroby stúpa. Dispečing preto neustále reguluje výkon elektrární tak, aby frekvencia ostala 50 Hz.' },
      { t: 'h', text: 'Prenos a rozvod' },
      { t: 'figure', fig: powerChainFigure, caption: 'Cesta energie: napätie sa za elektrárňou zvýši, prenesie sa vedeniami veľmi vysokého napätia a v rozvodniach sa postupne znižuje až na 400/230 V.' },
      {
        t: 'table',
        head: ['Hladina', 'Rozsah napätia', 'Siete v SR'],
        rows: [
          ['ZVN – zvlášť vysoké napätie', 'nad 300 kV do 800 kV', 'prenosová sústava 400 kV'],
          ['VVN – veľmi vysoké napätie', 'nad 52 kV do 300 kV', 'prenosová sústava 220 kV, distribúcia 110 kV'],
          ['VN – vysoké napätie', 'nad 1 kV do 52 kV', 'distribučné vedenia 22 kV'],
          ['NN – nízke napätie', 'do 1 kV', 'rozvodná sieť 400/230 V'],
        ],
      },
      { t: 'p', text: '**Prenosovú sústavu** 400 kV a 220 kV prevádzkuje Slovenská elektrizačná prenosová sústava (SEPS); prepája veľké elektrárne a susedné štáty. **Distribučné sústavy** 110 kV, 22 kV a NN prevádzkujú regionálne distribučné spoločnosti. Distribučný transformátor 22/0,4 kV napája jednu ulicu alebo časť obce.' },
      { t: 'h', text: 'Prečo vysoké napätie' },
      {
        t: 'formula',
        tex: ['$I = @f{$P}{@s{3} · $U · cos $φ}', 'Δ$P = 3 · $R · $I^{2} = @f{$R · $P^{2}}{$U^{2} · cos^{2} $φ}'],
        legend: [
          ['$P', 'prenášaný činný výkon', 'W'],
          ['$U', 'združené napätie vedenia', 'V'],
          ['$R', 'odpor jedného vodiča vedenia', 'Ω'],
          ['Δ$P', 'činné straty (teplo) vo všetkých troch vodičoch', 'W'],
        ],
      },
      { t: 'p', text: 'Pri rovnakom prenášanom výkone je prúd nepriamo úmerný napätiu. Straty vo vodičoch rastú s **druhou mocninou prúdu**, a preto klesajú s druhou mocninou napätia: **dvojnásobné napätie znamená štvrtinové straty**. Menší prúd zároveň dovoľuje tenšie, lacnejšie a ľahšie vodiče. Pri jednofázovom vedení s dvoma vodičmi platí `Δ$P = $R · $I^{2}`, kde `$R` je odpor oboch vodičov spolu.' },
      {
        t: 'example',
        title: 'Prenos 50 MW pri 22 kV a pri 110 kV',
        given: ['`$P` = 50 MW, `cos $φ` = 1', 'odpor jedného vodiča `$R` = 4 Ω', 'napätie 22 kV alebo 110 kV'],
        steps: [
          '22 kV: `$I = @f{50 000 000}{1,732 · 22 000}` = 1 312 A, `Δ$P = 3 · 4 · 1 312^{2}` = 20,7 MW',
          '110 kV: `$I = @f{50 000 000}{1,732 · 110 000}` = 262,4 A, `Δ$P = 3 · 4 · 262,4^{2}` = 0,826 MW',
          'Pomer strát: `(@f{110}{22})^{2}` = 25',
        ],
        result: 'pri 22 kV by sa v teplo zmenilo 41 % výkonu, pri 110 kV len 1,65 %',
      },
      { t: 'explore', build: lossExplorer, caption: 'Posuň napätie vedenia: straty klesajú s druhou mocninou napätia. Vyskúšaj aj väčší výkon alebo dlhšie vedenie (väčší odpor).' },
      { t: 'p', text: '**Úbytok napätia.** Prúd vytvára na odpore vodičov úbytok napätia, takže na konci vedenia je napätie menšie ako na začiatku. Pri trojfázovom vedení s `cos $φ` ≈ 1 a so zanedbanou reaktanciou je úbytok združeného napätia `Δ$U ≈ @s{3} · $R · $I`. Vyjadruje sa v percentách menovitého napätia: `Δ$u = @f{Δ$U}{$U} · 100 %`. Aj úbytok sa pri vyššom napätí zmenšuje – je menší prúd a úbytok je navyše menšou časťou väčšieho napätia.' },
      {
        t: 'example',
        title: 'Úbytok napätia na vedení 22 kV',
        given: ['`$U` = 22 kV', '`$I` = 100 A, `cos $φ` ≈ 1', 'odpor jedného vodiča `$R` = 2 Ω'],
        steps: [
          '`Δ$U ≈ @s{3} · $R · $I` = 1,732 · 2 · 100 = 346,4 V',
          '`Δ$u = @f{346,4}{22 000} · 100 %` = 1,57 %',
        ],
        result: 'na konci vedenia je napätie asi o 1,6 % menšie (asi 21,65 kV)',
      },
      { t: 'h', text: 'Sieťové sústavy nízkeho napätia' },
      {
        t: 'list',
        items: [
          '**Prvé písmeno** – vzťah zdroja k zemi: **T** (terra) – jeden bod zdroja, obvykle uzol hviezdy, je priamo uzemnený; **I** – všetky živé časti sú od zeme izolované alebo je bod zdroja uzemnený cez veľkú impedanciu.',
          '**Druhé písmeno** – vzťah neživých častí (kovových krytov spotrebičov) k zemi: **T** – sú uzemnené vlastným uzemňovačom; **N** – sú ochranným vodičom spojené s uzemneným bodom zdroja.',
          '**Ďalšie písmená** v sústave TN: **S** – stredný vodič N a ochranný vodič PE sú oddelené; **C** – ich funkcie spája jeden vodič **PEN**.',
        ],
      },
      { t: 'figure', fig: () => networkFigure('TN-C'), caption: 'TN-C: jeden vodič PEN je zároveň stredným aj ochranným vodičom. Používa sa najmä v distribučnej sieti.' },
      { t: 'figure', fig: () => networkFigure('TN-S'), caption: 'TN-S: v celej sieti je samostatný stredný vodič N a ochranný vodič PE (päť vodičov).' },
      { t: 'figure', fig: () => networkFigure('TN-C-S'), caption: 'TN-C-S: do budovy prichádza PEN, ktorý sa v hlavnom rozvádzači rozdelí na N a PE. Takto je napájaná väčšina domov a bytov na Slovensku.' },
      { t: 'figure', fig: () => networkFigure('TT'), caption: 'TT: kryty spotrebičov sú uzemnené vlastným uzemňovačom, nezávislým od uzemnenia zdroja.' },
      { t: 'figure', fig: () => networkFigure('IT'), caption: 'IT: zdroj je od zeme izolovaný (alebo uzemnený cez impedanciu). Prvá porucha nespôsobí odpojenie – používa sa tam, kde je výpadok nebezpečný (operačné sály, bane).' },
      { t: 'figure', fig: conductorColorsFigure, caption: 'Farby izolácie vodičov podľa normy. Zelenožltú izoláciu smie mať len ochranný vodič PE a vodič PEN.' },
      { t: 'note', kind: 'warn', text: 'Vodič **PEN** sa nesmie prerušiť ani istiť – pri jeho prerušení by sa na kryty spotrebičov mohlo dostať fázové napätie. Po rozdelení PEN na N a PE sa už tieto vodiče **nesmú znova spojiť**.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Prečo sa elektrická energia prenáša na veľké vzdialenosti pri veľmi vysokom napätí?',
      options: [
        'pri rovnakom výkone tečie menší prúd, a tak sú straty vo vedení oveľa menšie',
        'vysoké napätie zvyšuje frekvenciu siete',
        'pri vysokom napätí majú vodiče menší odpor',
        'vysoké napätie sa dá ľahšie usmerniť',
      ],
      explanation: 'Prúd `$I = @f{$P}{@s{3} · $U · cos $φ}` klesá s napätím a straty `Δ$P = 3 · $R · $I^{2}` s druhou mocninou prúdu. Odpor vodičov od napätia nezávisí.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmenia straty vo vedení, keď pri rovnakom prenášanom výkone zvýšiš napätie dvojnásobne?',
      options: ['klesnú na štvrtinu', 'klesnú na polovicu', 'nezmenia sa', 'zväčšia sa dvojnásobne'],
      explanation: 'Prúd klesne na polovicu a straty sú úmerné druhej mocnine prúdu: `(@f{1}{2})^{2} = @f{1}{4}`.',
    },
    {
      lessonId: ID,
      prompt: 'Aké napätie má prenosová sústava Slovenska?',
      options: ['400 kV a 220 kV', '22 kV', '400 V a 230 V', '110 V'],
      explanation: 'Prenosovú sústavu tvoria vedenia 400 kV a 220 kV. Distribúcia pracuje s napätím 110 kV, 22 kV a 400/230 V.',
    },
    {
      lessonId: ID,
      prompt: 'Čo znamená písmeno N v označení sústavy TN?',
      options: [
        'neživé časti sú ochranným vodičom spojené s uzemneným bodom zdroja',
        'v sieti je stredný vodič N',
        'zdroj nie je uzemnený',
        'neživé časti majú vlastný uzemňovač',
      ],
      explanation: 'Druhé písmeno opisuje neživé časti. N znamená spojenie s uzemneným bodom zdroja (cez PE alebo PEN), T by znamenalo vlastný uzemňovač.',
    },
    {
      lessonId: ID,
      prompt: 'Aký účel má prečerpávacia vodná elektráreň?',
      options: [
        'pri prebytku elektriny čerpá vodu do hornej nádrže a v špičke ňou vyrába elektrinu',
        'vyrába stále rovnaký výkon ako jadrová elektráreň',
        'zvyšuje napätie v prenosovej sústave',
        'čerpá vodu na chladenie tepelných elektrární',
      ],
      explanation: 'Prečerpávacia elektráreň uchováva energiu vo forme polohovej energie vody. Pomáha vyrovnávať rozdiel medzi výrobou a spotrebou.',
    },
    {
      lessonId: ID,
      prompt: 'Kde sa v sústave TN-C-S rozdeľuje vodič PEN?',
      options: [
        'v hlavnom (elektromerovom) rozvádzači budovy, potom pokračujú samostatné N a PE',
        'priamo v každej zásuvke',
        'v transformátore 22/0,4 kV',
        'nikde – PEN sa v TN-C-S nerozdeľuje',
      ],
      explanation: 'Distribučná sieť pracuje ako TN-C. V hlavnom rozvádzači budovy sa PEN rozdelí na N a PE a ďalej je inštalácia TN-S. N a PE sa za týmto bodom nesmú znova spojiť.',
    },
    {
      lessonId: ID,
      prompt: 'Akou farbou je označený ochranný vodič PE?',
      options: ['zelenožltou', 'modrou', 'hnedou', 'čiernou'],
      explanation: 'PE je zelenožltý a túto farbu nesmie mať žiadny iný vodič (okrem PEN, ktorý má navyše modré konce). Modrý je stredný vodič N.',
    },
    {
      lessonId: ID,
      prompt: 'Akým strojom sa vyrába elektrina v tepelných, jadrových aj vodných elektrárňach?',
      options: ['synchrónnym alternátorom', 'asynchrónnym motorom', 'transformátorom', 'jednosmerným dynamom'],
      explanation: 'Synchrónny alternátor má otáčky viazané s frekvenciou siete `$n = @f{60 · $f}{$p}`. Transformátor energiu nevyrába, len mení napätie.',
    },
  ],
  generators,
};

export default mod;
