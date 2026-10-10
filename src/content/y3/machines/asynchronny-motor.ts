import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample, type ChartOptions } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { chartNote, motorCrossSectionFigure, terminalBoxFigure, torqueCharacteristicChart } from '../../../ui/fig-machines';
import { choice } from '../util';

const ID = 'asynchronny-motor';
const SQ3 = Math.sqrt(3);

/** Štítkové údaje motorov: P [kW], I [A] pri 400 V, cos φ, n [ot/min], počet pólov. */
const MOTORS: [number, number, number, number, number][] = [
  [1.5, 3.4, 0.8, 1420, 4], [2.2, 4.7, 0.82, 1430, 4], [4, 8.2, 0.83, 1440, 4], [5.5, 11, 0.84, 1450, 4],
  [7.5, 15, 0.84, 1450, 4], [11, 21.5, 0.85, 1460, 4], [15, 29, 0.85, 1460, 4], [22, 41, 0.86, 1470, 4],
  [3, 6, 0.86, 2880, 2], [4, 7.9, 0.87, 2890, 2], [5.5, 11.5, 0.8, 960, 6],
];

/** Momentová charakteristika podľa Klossovho vzťahu s posuvníkmi pre kritický sklz, záťaž a napätie. */
function klossExplorer(): HTMLElement {
  const ns = 1500;
  const Mmax100 = 123;
  return explorer({
    title: 'Momentová charakteristika a pracovný bod',
    params: [
      { key: 'sk', label: 'Kritický sklz `$s_{k}`', unit: '', min: 0.08, max: 1, value: 0.25, format: (v) => fmt(v, 2) },
      { key: 'ml', label: 'Záťažný moment `$M_{L}`', unit: 'N·m', min: 0, max: 140, value: 50, format: (v) => `${fmt(v, 3)} N·m` },
      { key: 'u', label: 'Napätie `$U` (% menovitého)', unit: '%', min: 70, max: 100, value: 100, format: (v) => `${fmt(v, 3)} %` },
    ],
    draw: ({ sk, ml, u }) => {
      const Mmax = Mmax100 * (u / 100) ** 2;
      const kloss = (mx: number, sl: number) => (sl <= 0 ? 0 : (2 * mx) / (sl / sk + sk / sl));
      const M = (nn: number) => kloss(Mmax, (ns - nn) / ns);
      const Mz = kloss(Mmax, 1);
      const nk = ns * (1 - Math.min(sk, 1));
      let nw: number | null = ns;
      if (ml > 0 && ml <= Mmax) {
        const a = (2 * Mmax) / ml;
        nw = ns * (1 - sk * ((a - Math.sqrt(a * a - 4)) / 2));
      } else if (ml > Mmax) {
        nw = null;
      }
      const series = [{ points: sample(M, 0, ns, 300), className: '' }];
      if (u < 99.5) series.unshift({ points: sample((nn) => kloss(Mmax100, (ns - nn) / ns), 0, ns, 300), className: 'dashed' });
      const markers = nk > 150
        ? [{ x: 0, y: Mz, label: 'Mz', above: true }, { x: nk, y: Mmax, label: 'Mmax', above: true }]
        : [{ x: nk, y: Mmax, label: 'Mz ≈ Mmax', above: true }];
      if (nw !== null && ml > 0) markers.push({ x: nw, y: ml, label: 'pracovný bod', above: false });
      const chartOpts: ChartOptions = {
        ariaLabel: `Momentová charakteristika: maximálny moment ${fmt(Mmax, 3)} N·m pri ${fmt(nk, 3)} ot/min`,
        width: 460,
        height: 260,
        x: { min: 0, max: ns, ticks: [0, 300, 600, 900, 1200, 1500], format: (v) => fmt(v), label: 'n [ot/min]' },
        y: { min: 0, max: 140, ticks: [0, 20, 40, 60, 80, 100, 120, 140], format: (v) => fmt(v), label: 'M [N·m]' },
        series,
        hlines: ml > 0 ? [{ y: ml, label: '' }] : [],
        markers,
        legend: u < 99.5 ? [{ label: `pri ${fmt(u, 3)} % U` }, { label: 'pri 100 % U', className: 'dashed' }] : undefined,
      };
      const chart = lineChart(chartOpts);
      if (ml > 0) chart.append(chartNote(chartOpts, 450, ml + 3, `ML = ${fmt(ml, 3)} N·m`, 'start', 'mch-copper'));
      const sw = nw === null ? null : (ns - nw) / ns;
      let note: string;
      if (nw === null) note = 'Záťažný moment je väčší ako zvratový moment – motor sa „zvrhne“, otáčky prudko klesnú a motor sa zastaví. Ochrana ho musí odpojiť.';
      else if (ml > Mz) note = 'Motor by v chode záťaž utiahol, ale z pokoja sa nerozbehne: záťažný moment je väčší ako záberový. Pomôže väčší kritický sklz (odpor v rotore) alebo frekvenčný menič.';
      else if (sw !== null && sw > sk * 0.999) note = 'Pracovný bod je pri kritickom sklze – na hranici stability.';
      else note = u < 99.5
        ? `Pracovný bod leží na stabilnej časti charakteristiky. Moment klesá s druhou mocninou napätia – pri ${fmt(u, 3)} % napätia je maximálny moment len ${fmt((u / 100) ** 2 * 100, 3)} % pôvodného.`
        : 'Pracovný bod leží na strmej, stabilnej časti charakteristiky. Skús znížiť napätie alebo zväčšiť záťaž až po zvratový moment.';
      return {
        chart,
        readouts: [
          ['Otáčky `$n`', nw === null ? '—' : `${fmt(nw, 4)} ot/min`],
          ['Sklz `$s`', sw === null ? '—' : `${fmt(sw * 100, 3)} %`],
          ['Výkon `$P = $M · $ω`', nw === null ? '—' : `${fmt((ml * 2 * Math.PI * nw) / 60 / 1000, 3)} kW`],
          ['Záberový `$M_{z}`', `${fmt(Mz, 3)} N·m`],
          ['Zvratový `$M_{max}`', `${fmt(Mmax, 3)} N·m`],
        ],
        note,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const poles = pick(rng, [2, 4, 6, 8, 10, 12]);
    const f = pick(rng, [50, 50, 50, 60, 40, 25]);
    const p = poles / 2;
    const ns = (60 * f) / p;
    return numeric(ID, `Aké sú synchrónne otáčky ${poles}-pólového asynchrónneho motora napájaného frekvenciou ${q(f, 'Hz')}?`, ns, 'ot/min', [
      `${poles} ${poles < 5 ? 'póly tvoria' : 'pólov tvorí'} \`$p\` = ${p} ${p === 1 ? 'pólovú dvojicu' : p < 5 ? 'pólové dvojice' : 'pólových dvojíc'}.`,
      `\`$n_{s} = @f{60 · $f}{$p} = @f{60 · ${n(f)}}{${p}}\` = **${n(ns)} ot/min**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const poles = pick(rng, [2, 4, 6, 8]);
    const ns = 6000 / poles;
    const nn = Math.round((ns * (1 - pick(rng, [0.02, 0.03, 0.04, 0.05, 0.06]))) / 5) * 5;
    const sl = ((ns - nn) / ns) * 100;
    return numeric(ID, `${poles}-pólový asynchrónny motor napájaný zo siete 50 Hz má menovité otáčky ${n(nn)} ot/min. Aký je jeho menovitý sklz?`, sl, '%', [
      `\`$n_{s} = @f{60 · 50}{${poles / 2}}\` = ${n(ns)} ot/min`,
      `\`$s = @f{$n_{s} − $n}{$n_{s}} · 100 % = @f{${n(ns)} − ${n(nn)}}{${n(ns)}} · 100 %\` = **${n(sl, 3)} %**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const poles = pick(rng, [2, 4, 6, 8]);
    const ns = 6000 / poles;
    const sl = pick(rng, [2, 2.5, 3, 3.5, 4, 5, 6]);
    const nn = ns * (1 - sl / 100);
    return numeric(ID, `${poles}-pólový motor pracuje na sieti 50 Hz so sklzom ${n(sl)} %. Akými otáčkami sa otáča?`, nn, 'ot/min', [
      `\`$n_{s}\` = ${n(ns)} ot/min`,
      `\`$n = $n_{s} · (1 − $s) = ${n(ns)} · (1 − ${n(sl / 100)})\` = **${n(nn)} ot/min**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const [P, , , nn] = pick(rng, MOTORS);
    const M = (9550 * P) / nn;
    return numeric(ID, `Motor má na štítku výkon ${n(P)} kW a otáčky ${n(nn)} ot/min. Aký je jeho menovitý moment?`, M, 'N·m', [
      `\`$M = 9 550 · @f{$P}{$n} = 9 550 · @f{${n(P)}}{${n(nn)}}\` = **${n(M, 3)} N·m**`,
      'Rovnako `$M = @f{$P}{$ω}`, kde `$ω = @f{2π$n}{60}`.',
    ], { fixedUnit: true });
  },
  (rng) => {
    const [P, I, c] = pick(rng, MOTORS);
    const P1 = SQ3 * 400 * I * c;
    const P1r = Number(P1.toPrecision(4));
    if (rng() < 0.5) {
      return numeric(ID, `Trojfázový motor odoberá zo siete 400 V prúd ${q(I, 'A')} pri účinníku ${n(c)}. Aký je jeho príkon?`, P1, 'W', [
        `\`$P_{1} = @s{3} · $U · $I · cos $φ = 1,732 · 400 · ${n(I)} · ${n(c)}\` = ${res(P1, 'W')}`,
      ]);
    }
    const eta = ((P * 1000) / P1r) * 100;
    return numeric(ID, `Motor ${n(P)} kW odoberá pri menovitom zaťažení zo siete 400 V prúd ${q(I, 'A')} pri účinníku ${n(c)}. Aká je jeho účinnosť?`, eta, '%', [
      `\`$P_{1} = @s{3} · $U · $I · cos $φ = 1,732 · 400 · ${n(I)} · ${n(c)}\` = ${n(P1r)} W`,
      `\`$η = @f{$P}{$P_{1}} = @f{${n(P * 1000)}}{${n(P1r)}}\` = **${n(eta, 3)} %**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const [, I] = pick(rng, MOTORS);
    const k = pick(rng, [5, 6, 7]);
    const Iz = k * I;
    const IzY = Iz / 3;
    return numeric(ID, `Motor zapojený do trojuholníka má menovitý prúd ${q(I, 'A')} a pri priamom rozbehu záberový prúd ${k}-násobok menovitého. Aký prúd odoberá zo siete pri rozbehu prepínačom hviezda – trojuholník?`, IzY, 'A', [
      `Priamy rozbeh: \`$I_{z}\` = ${k} · ${n(I)} = ${n(Iz)} A`,
      `V hviezde je na vinutí \`@s{3}\`-krát menšie napätie, prúd zo siete klesne na tretinu: \`$I_{zY} = @f{$I_{z}}{3} = @f{${n(Iz)}}{3}\` = ${res(IzY, 'A')}`,
    ]);
  },
  (rng) => {
    const nn = pick(rng, [2900, 2870, 2850, 1440, 1460, 1420, 1450, 960, 970, 940, 720, 730, 710]);
    const ns = [3000, 1500, 1000, 750].find((x) => x > nn && x - nn < x * 0.1)!;
    const poles = 6000 / ns;
    return numeric(ID, `Asynchrónny motor pre sieť 50 Hz má na štítku otáčky ${n(nn)} ot/min. Koľko pólov má jeho statorové vinutie?`, poles, '', [
      'Otáčky sú o niekoľko percent menšie ako synchrónne. Najbližšie vyššie synchrónne otáčky pri 50 Hz (3 000, 1 500, 1 000, 750 ot/min) sú ' + `${n(ns)} ot/min.`,
      `\`$p = @f{60 · $f}{$n_{s}} = @f{3 000}{${n(ns)}}\` = ${poles / 2} → počet pólov 2\`$p\` = **${poles}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const poles = pick(rng, [2, 4, 6]);
    const ns = 6000 / poles;
    const nn = Math.round((ns * (1 - pick(rng, [0.03, 0.04, 0.05]))) / 10) * 10;
    const sl = (ns - nn) / ns;
    const f2 = sl * 50;
    return numeric(ID, `${poles}-pólový motor na sieti 50 Hz sa otáča rýchlosťou ${n(nn)} ot/min. Akú frekvenciu má prúd v tyčiach rotora?`, f2, 'Hz', [
      `\`$s = @f{${n(ns)} − ${n(nn)}}{${n(ns)}}\` = ${n(sl, 4)}`,
      `\`$f_{2} = $s · $f\` = ${n(sl, 4)} · 50 = ${res(f2, 'Hz')}`,
    ]);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Ako zmeníš smer otáčania trojfázového asynchrónneho motora?',
        ['zameníš dva fázové vodiče', 'posunieš všetky tri fázy (L1 → L2 → L3 → L1)', 'prepojíš motor z hviezdy do trojuholníka', 'zameníš stredný a ochranný vodič'],
        'Zámenou dvoch fáz sa zmení sled fáz a točivé pole sa otáča opačne. Cyklický posun všetkých troch fáz sled nezmení.'],
      ['Motor má na štítku 230/400 V Δ/Y. Ako ho zapojíš do siete 3 × 400 V?',
        ['do hviezdy', 'do trojuholníka', 'najprv do hviezdy, po rozbehu do trojuholníka', 'nedá sa do nej pripojiť'],
        'Vinutie jednej fázy je na 230 V. V hviezde je na ňom 400 / √3 = 230 V. V trojuholníku by bolo na 400 V a motor by sa prehrial.'],
      ['Prečo sa rotor asynchrónneho motora nemôže otáčať synchrónnymi otáčkami?',
        ['pole by rotor nepretínalo, neindukoval by sa prúd a nevznikol by moment', 'rotor by sa prehrial', 'zabránia tomu ložiská', 'kefy by na komutátore iskrili'],
        'Moment vzniká len z prúdov indukovaných v rotore. Tie vznikajú iba pri rozdiele otáčok poľa a rotora – pri sklze.'],
      ['Ktorý motor sa dá spúšťať prepínačom hviezda – trojuholník v sieti 3 × 400 V?',
        ['motor so štítkom 400/690 V Δ/Y', 'motor so štítkom 230/400 V Δ/Y', 'každý trojfázový motor', 'iba jednofázový motor'],
        'Po rozbehu musí motor pracovať v trojuholníku pri 400 V, teda vinutie fázy musí byť na 400 V. To platí pre štítok 400/690 V Δ/Y.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Ako sa pri rozbehu hviezda – trojuholník zmení záberový moment oproti priamemu rozbehu?',
        ['klesne na tretinu', 'klesne na polovicu', 'zväčší sa trikrát', 'nezmení sa, zmení sa len prúd'],
        'Moment je úmerný druhej mocnine napätia na vinutí. V hviezde je napätie √3-krát menšie, moment teda (√3)² = 3-krát menší.'],
      ['Čo sa stane, keď záťažný moment prekročí maximálny (zvratový) moment motora?',
        ['motor sa zvrhne – otáčky prudko klesnú a motor sa zastaví', 'otáčky stúpnu nad synchrónne', 'motor prejde do generátorového chodu', 'nič, moment motora sa ďalej zväčší'],
        'Za maximom momentovej charakteristiky moment s klesajúcimi otáčkami klesá – chod je nestabilný a motor sa zastaví. Tečie pritom veľký prúd.'],
      ['Prečo frekvenčný menič pri znižovaní frekvencie znižuje aj napätie?',
        ['aby magnetický tok v motore ostal stály (U/f = konšt.)', 'aby sa zmenil smer otáčania', 'aby sa zväčšil sklz', 'aby motor nepotreboval chladenie'],
        'Tok je úmerný podielu U/f (podobne ako pri transformátore). Pri nižšej frekvencii a plnom napätí by sa jadro presýtilo a rástol by prúd.'],
      ['Na čo slúži kondenzátor jednofázového asynchrónneho motora?',
        ['posunie prúd pomocného vinutia, aby vzniklo točivé pole', 'vyhladzuje napätie ako v usmerňovači', 'kompenzuje účinník siete', 'chráni motor pred prepätím'],
        'Hlavné vinutie samo vytvorí len pulzujúce pole. Pomocné vinutie s kondenzátorom má fázovo posunutý prúd a spolu vytvoria točivé pole.'],
      ['Ako sa zmení maximálny moment asynchrónneho motora, keď napätie klesne o 10 %?',
        ['klesne asi o 19 %', 'klesne o 10 %', 'nezmení sa', 'zväčší sa o 10 %'],
        'Moment je úmerný druhej mocnine napätia: 0,9² = 0,81, teda pokles asi o 19 %.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'machines',
    title: 'Asynchrónny motor',
    summary: 'Točivé magnetické pole, synchrónne otáčky a sklz, moment a príkon, momentová charakteristika, rozbeh, zapojenie svorkovnice a jednofázový motor.',
    minutes: 18,
    blocks: [
      { t: 'p', text: 'Asynchrónny motor je najrozšírenejší elektrický motor – poháňa čerpadlá, ventilátory, kompresory, dopravníky aj obrábacie stroje. Je jednoduchý, lacný, spoľahlivý a takmer nepotrebuje údržbu. Názov **asynchrónny** (nesúbežný) znamená, že rotor sa otáča o niečo pomalšie ako magnetické pole statora.' },
      { t: 'h', text: 'Konštrukcia' },
      {
        t: 'list',
        items: [
          '**Stator** – kostra s pätkami alebo prírubou, v nej zväzok izolovaných plechov s drážkami. V drážkach je **trojfázové vinutie** – tri fázy U1–U2, V1–V2, W1–W2 posunuté o 120° a vyvedené na svorkovnicu.',
          '**Rotor nakrátko (klietkový)** – zväzok plechov na hriadeli, v drážkach sú hliníkové alebo medené tyče spojené na oboch koncoch kruhmi nakrátko. Tvarom pripomína klietku. Je najjednoduchší a najpoužívanejší.',
          '**Vinutý (krúžkový) rotor** – má trojfázové vinutie vyvedené na tri zberné krúžky. Cez kefy sa k nemu pripája rozbehový odpor. Používa sa pri veľkých motoroch s ťažkým rozbehom (žeriavy, mlyny).',
          'Medzi statorom a rotorom je čo najmenšia **vzduchová medzera** (rádovo desatiny milimetra), aby bol malý magnetizačný prúd.',
        ],
      },
      { t: 'figure', fig: motorCrossSectionFigure, caption: 'Prierez dvojpólového motora (`$p` = 1): strany cievok troch fáz sú v drážkach statora posunuté o 120°. Pole, ktoré vytvoria, sa otáča a strháva so sebou klietkový rotor.' },
      { t: 'h', text: 'Točivé magnetické pole a sklz' },
      { t: 'p', text: 'Tri cievky statora posunuté o 120° napájané trojfázovým prúdom vytvoria **točivé magnetické pole** – pole stálej veľkosti, ktoré sa otáča **synchrónnymi otáčkami** `$n_{s}`. Pole pretína tyče rotora a indukuje v nich napätie; keďže sú spojené nakrátko, tečie nimi prúd. Na vodiče s prúdom v magnetickom poli pôsobí sila a rotor sa roztočí v smere poľa. Keby rotor dosiahol synchrónne otáčky, pole by ho nepretínalo, neindukoval by sa prúd a nevznikol by moment – rotor sa preto vždy otáča pomalšie. Pomerný rozdiel otáčok je **sklz** `$s`.' },
      {
        t: 'formula',
        tex: ['$n_{s} = @f{60 · $f}{$p}', '$s = @f{$n_{s} − $n}{$n_{s}} · 100 %', '$n = $n_{s} · (1 − $s)', '$f_{2} = $s · $f'],
        legend: [
          ['$n_{s}', 'synchrónne otáčky (otáčky poľa)', 'ot/min'],
          ['$f', 'frekvencia napájacieho napätia', 'Hz'],
          ['$p', 'počet pólových dvojíc (počet pólov je 2p)', '–'],
          ['$n', 'skutočné otáčky rotora', 'ot/min'],
          ['$s', 'sklz – pri menovitom zaťažení bežne 2 až 6 %', '–, %'],
          ['$f_{2}', 'frekvencia prúdu v rotore', 'Hz'],
        ],
      },
      {
        t: 'table',
        head: ['`$p`', 'Počet pólov', '`$n_{s}` pri 50 Hz', 'Typické menovité otáčky'],
        rows: [
          ['1', '2', '3 000 ot/min', '2 850 – 2 950 ot/min'],
          ['2', '4', '1 500 ot/min', '1 400 – 1 470 ot/min'],
          ['3', '6', '1 000 ot/min', '920 – 970 ot/min'],
          ['4', '8', '750 ot/min', '700 – 730 ot/min'],
        ],
      },
      {
        t: 'example',
        title: 'Synchrónne otáčky a sklz',
        given: ['štvorpólový motor: `$p` = 2', '`$f` = 50 Hz', '`$n` = 1 440 ot/min'],
        steps: [
          '`$n_{s} = @f{60 · 50}{2}` = 1 500 ot/min',
          '`$s = @f{1 500 − 1 440}{1 500}` = 0,04 = 4 %',
          '`$f_{2} = $s · $f` = 0,04 · 50 = 2 Hz',
        ],
        result: '`$n_{s}` = 1 500 ot/min, `$s` = 4 %, `$f_{2}` = 2 Hz',
      },
      { t: 'h', text: 'Výkon, príkon a moment' },
      {
        t: 'formula',
        tex: ['$M = @f{$P}{$ω} = 9 550 · @f{$P}{$n}', '$P_{1} = @s{3} · $U · $I · cos $φ', '$η = @f{$P}{$P_{1}}'],
        legend: [
          ['$M', 'moment na hriadeli', 'N·m'],
          ['$P', 'výkon na hriadeli (vo vzťahu s 9 550 dosadzuj v kW)', 'W, kW'],
          ['$n', 'otáčky', 'ot/min'],
          ['$ω', 'uhlová rýchlosť ω = 2πn / 60', 'rad/s'],
          ['$P_{1}', 'príkon zo siete', 'W'],
          ['$U, $I', 'združené napätie a prúd vo vodiči', 'V, A'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Na štítku motora je uvedený **výkon na hriadeli** (mechanický výkon), nie príkon. Príkon zo siete je väčší o straty: `$P_{1} = @f{$P}{$η}`.' },
      {
        t: 'example',
        title: 'Údaje zo štítka motora',
        given: ['`$P` = 7,5 kW, `$n` = 1 450 ot/min', '`$U` = 400 V, `$I` = 15 A', '`cos $φ` = 0,84'],
        steps: [
          '`$M = 9 550 · @f{7,5}{1 450}` = 49,4 N·m',
          '`$P_{1} = @s{3} · 400 · 15 · 0,84` = 8 730 W',
          '`$η = @f{7 500}{8 730}` = 0,859 = 85,9 %',
        ],
        result: '`$M` ≈ 49,4 N·m, `$P_{1}` ≈ 8,73 kW, `$η` ≈ 86 %',
      },
      { t: 'h', text: 'Momentová charakteristika' },
      { t: 'p', text: 'Momentová charakteristika ukazuje, aký moment motor vyvinie pri daných otáčkach. Pri rozbehu (`$n` = 0, `$s` = 1) vyvinie **záberový moment** `$M_{z}`, pri kritickom sklze `$s_{k}` dosiahne **maximálny (zvratový) moment** `$M_{max}` a v pracovnej oblasti blízko `$n_{s}` leží **menovitý moment** `$M_{n}`. Medzi `$M_{max}` a `$n_{s}` je charakteristika strmá a **stabilná**: keď sa zaťaženie zväčší, otáčky trochu klesnú a moment motora stúpne. Ak záťažný moment prekročí `$M_{max}`, motor sa „zvrhne“ a zastaví. Bežne je `@f{$M_{max}}{$M_{n}}` = 2 až 3 a `@f{$M_{z}}{$M_{n}}` = 1,5 až 2,5.' },
      { t: 'figure', fig: torqueCharacteristicChart, caption: 'Typická momentová charakteristika štvorpólového klietkového motora (`$n_{s}` = 1 500 ot/min).' },
      {
        t: 'formula',
        tex: '$M = @f{2 · $M_{max}}{@f{$s}{$s_{k}} + @f{$s_{k}}{$s}}',
        legend: [['$M_{max}', 'maximálny (zvratový) moment', 'N·m'], ['$s_{k}', 'kritický sklz – sklz pri maximálnom momente, úmerný odporu rotora', '–']],
      },
      { t: 'explore', build: klossExplorer, caption: 'Klossov vzťah pre motor 7,5 kW. Väčší odpor rotora (vinutý rotor s rozbehovým odporom) zväčší kritický sklz – maximum sa posunie k nižším otáčkam, ale jeho veľkosť sa nezmení. Moment je úmerný druhej mocnine napätia. Vzťah nezahŕňa vytláčanie prúdu v tyčiach rotora, preto pri malom `$s_{k}` vychádza záberový moment menší ako pri skutočných klietkových motoroch.' },
      { t: 'h', text: 'Rozbeh a riadenie otáčok' },
      {
        t: 'list',
        items: [
          '**Priamy rozbeh** – motor sa pripojí priamo na sieť. Záberový prúd je 4- až 8-násobok menovitého prúdu. Používa sa pri menších motoroch, kde prúdový náraz sieti neprekáža.',
          '**Rozbeh hviezda – trojuholník (Y/D)** – motor, ktorý pracuje zapojený do trojuholníka, sa rozbehne zapojený do hviezdy. Na vinutí je `@s{3}`-krát menšie napätie, preto **prúd zo siete aj moment klesnú na tretinu**. Po rozbehu sa motor prepne do trojuholníka. Hodí sa na rozbeh s malou záťažou (ventilátory, čerpadlá).',
          '**Softštartér** – polovodičový spúšťač (tyristory), ktorý pri rozbehu plynulo zvyšuje napätie.',
          '**Frekvenčný menič** – mení frekvenciu aj napätie, a tak plynulo riadi otáčky od nuly až nad menovité. Aby magnetický tok ostal stály, udržiava pomer `@f{$U}{$f}` = konšt. Rozbeh je plynulý s malým prúdom.',
          '**Vinutý rotor** – rozbehový odpor v obvode rotora zmenší záberový prúd a zväčší záberový moment.',
        ],
      },
      {
        t: 'example',
        title: 'Prúd pri rozbehu hviezda – trojuholník',
        given: ['`$I_{n}` = 15 A', 'pri priamom rozbehu `$I_{z}` = 6 · `$I_{n}`'],
        steps: [
          'priamy rozbeh: `$I_{z}` = 6 · 15 = 90 A',
          'rozbeh Y/D: `$I_{zY} = @f{$I_{z}}{3} = @f{90}{3}` = 30 A',
          'Aj záberový moment klesne na tretinu – napr. z 2 `$M_{n}` na 0,67 `$M_{n}`, preto sa motor rozbieha len s malou záťažou.',
        ],
        result: 'Záberový prúd klesne z 90 A na 30 A.',
      },
      { t: 'h', text: 'Štítok, svorkovnica a smer otáčania' },
      { t: 'p', text: 'Na štítku je napríklad údaj **230/400 V Δ/Y**. Znamená, že vinutie jednej fázy je navrhnuté na 230 V: v sieti 3 × 400 V sa motor zapojí **do hviezdy** (na fázu pripadne 400 / √3 = 230 V), v sieti 3 × 230 V by sa zapojil do trojuholníka. Motor so štítkom **400/690 V Δ/Y** sa v našej sieti zapája do trojuholníka – a iba taký motor sa dá spúšťať prepínačom hviezda – trojuholník.' },
      { t: 'figure', fig: terminalBoxFigure, caption: 'Svorkovnica: horný rad U1, V1, W1 (prívod L1, L2, L3), dolný rad W2, U2, V2 – posunutý tak, aby spojky pre trojuholník boli zvislé. Čiarkovane sú naznačené vinutia fáz.' },
      { t: 'p', text: 'Smer otáčania sa zmení **zámenou dvoch fázových vodičov** (napríklad L1 a L2) – zmení sa sled fáz a točivé pole sa otáča opačne. Na reverzáciu sa používajú dva stýkače so vzájomným blokovaním, aby nemohli zopnúť súčasne.' },
      { t: 'p', text: '**Jednofázový asynchrónny motor** má v statore hlavné a pomocné vinutie. Samotné hlavné vinutie vytvára len pulzujúce pole a motor by sa sám nerozbehol. Pomocné vinutie má v sérii **kondenzátor**, ktorý posunie jeho prúd, takže obe vinutia spolu vytvoria točivé pole. Rozbehový kondenzátor sa po rozbehu odpojí (odstredivým vypínačom alebo relé), prevádzkový kondenzátor ostáva pripojený trvale. Smer otáčania sa mení prepólovaním pomocného vinutia. Takéto motory poháňajú práčky, čerpadlá, kompresory chladničiek a ventilátory.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aké sú synchrónne otáčky štvorpólového motora pri 50 Hz?',
      options: ['1 500 ot/min', '3 000 ot/min', '750 ot/min', '1 440 ot/min'],
      explanation: 'Štyri póly sú dve pólové dvojice: `$n_{s} = @f{60 · 50}{2}` = 1 500 ot/min. Hodnota 1 440 ot/min sú typické skutočné otáčky so sklzom.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je bežný sklz asynchrónneho motora pri menovitom zaťažení?',
      options: ['2 až 6 %', '0 %', '20 až 30 %', '50 %'],
      explanation: 'Rotor sa otáča len o niekoľko percent pomalšie ako pole. Väčšie motory majú sklz menší, malé motory väčší.',
    },
    {
      lessonId: ID,
      prompt: 'Aký výkon je uvedený na štítku asynchrónneho motora?',
      options: ['mechanický výkon na hriadeli', 'príkon zo siete', 'zdanlivý výkon v kVA', 'jalový výkon motora'],
      explanation: 'Štítkový výkon je výkon, ktorý motor odovzdá na hriadeli. Príkon je väčší o straty, `$P_{1} = @f{$P}{$η}`.',
    },
    {
      lessonId: ID,
      prompt: 'Koľkokrát klesne prúd zo siete pri rozbehu hviezda – trojuholník oproti priamemu rozbehu?',
      options: ['trikrát', '√3-krát', 'dvakrát', 'nezmení sa'],
      explanation: 'Napätie na vinutí klesne √3-krát, prúd vinutia tiež √3-krát. V trojuholníku je prúd vo vodiči √3-krát väčší ako vo vinutí, v hviezde rovnaký – spolu tretina.',
    },
    {
      lessonId: ID,
      prompt: 'Z čoho je rotor nakrátko (klietka)?',
      options: ['z hliníkových alebo medených tyčí spojených kruhmi nakrátko', 'z trojfázového vinutia vyvedeného na krúžky', 'z permanentných magnetov', 'z kotvy s komutátorom'],
      explanation: 'Klietkový rotor nemá žiadne vyvedené vinutie ani krúžky – tyče sú na koncoch spojené kruhmi nakrátko, preto je motor taký spoľahlivý.',
    },
    {
      lessonId: ID,
      prompt: 'Akú frekvenciu má prúd v rotore pri sklze 4 % a frekvencii siete 50 Hz?',
      options: ['2 Hz', '50 Hz', '48 Hz', '0 Hz'],
      explanation: '`$f_{2} = $s · $f` = 0,04 · 50 = 2 Hz. Pole sa voči rotoru otáča len rozdielom otáčok.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo frekvenčný menič udržiava pomer `@f{$U}{$f}` stály?',
      options: ['aby magnetický tok v motore ostal stály', 'aby bol sklz nulový', 'aby sa nemenil smer otáčania', 'aby bol prúd vždy menovitý'],
      explanation: 'Podobne ako pri transformátore je tok úmerný `@f{$U}{$f}`. Pri nízkej frekvencii a plnom napätí by sa jadro presýtilo.',
    },
  ],
  generators,
};

export default mod;
