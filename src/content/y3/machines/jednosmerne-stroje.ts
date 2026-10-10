import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { commutatorFigure, dcConnectionsFigure, dcSpeedChart } from '../../../ui/fig-machines';
import { choice } from '../util';

const ID = 'jednosmerne-stroje';
const round2 = (x: number) => Number(x.toPrecision(2));

/** Cudzie budený (derivačný) motor 220 V: otáčková charakteristika pri zmene napätia kotvy a budenia. */
function dcMotorExplorer(): HTMLElement {
  const Ra = 0.5;
  const cPhiN = 0.14; // V/(ot/min) pri menovitom budení
  const In = 20;
  return explorer({
    title: 'Riadenie otáčok jednosmerného motora',
    params: [
      { key: 'u', label: 'Napätie kotvy `$U`', unit: 'V', min: 40, max: 240, value: 220 },
      { key: 'phi', label: 'Budenie `$Φ` (% menovitého)', unit: '%', min: 50, max: 110, value: 100, format: (v) => `${fmt(v, 3)} %` },
      { key: 'ml', label: 'Záťažný moment `$M`', unit: 'N·m', min: 0, max: 60, value: 27, format: (v) => `${fmt(v, 3)} N·m` },
    ],
    draw: ({ u, phi, ml }) => {
      const cPhi = (cPhiN * phi) / 100;
      const k = (60 / (2 * Math.PI)) * cPhi; // M = k · Ia
      const speed = (U: number, cp: number, M: number) => (U - (Ra * M) / ((60 / (2 * Math.PI)) * cp)) / cp;
      const Ia = ml / k;
      const nw = speed(u, cPhi, ml);
      const Ui = u - Ra * Ia;
      const line = (U: number, cp: number): [number, number][] => [[0, speed(U, cp, 0)], [60, speed(U, cp, 60)]];
      const markers = nw > 0 ? [{ x: ml, y: nw, label: 'pracovný bod', above: true }] : [];
      const chart = lineChart({
        ariaLabel: `Otáčková charakteristika: naprázdno ${fmt(speed(u, cPhi, 0), 4)} ot/min`,
        width: 460,
        height: 260,
        x: { min: 0, max: 60, ticks: [0, 10, 20, 30, 40, 50, 60], format: (v) => fmt(v), label: 'M [N·m]' },
        y: { min: 0, max: 3500, ticks: [0, 500, 1000, 1500, 2000, 2500, 3000, 3500], format: (v) => fmt(v), label: 'n [ot/min]' },
        series: [
          { points: line(220, cPhiN), className: 'dashed' },
          { points: line(u, cPhi) },
        ],
        markers,
        legend: [{ label: 'nastavené U a Φ' }, { label: 'menovité 220 V, 100 % Φ', className: 'dashed' }],
      });
      let note: string;
      if (nw <= 0) note = 'Pri takom malom napätí a veľkom zaťažení motor nevyvinie dosť momentu – kotva stojí a tečie ňou prúd `$I_{a} = @f{$U}{$R_{a}}`.';
      else if (Ia > 2 * In) note = `Prúd kotvy ${fmt(Ia, 3)} A je viac ako dvojnásobok menovitého (20 A) – motor by sa prehrieval.${phi < 99 ? ' Pri zoslabenom budení potrebuje na ten istý moment väčší prúd.' : ''}`;
      else if (phi < 99) note = 'Zoslabením budenia otáčky stúpnu nad menovité. Pri rovnakom momente však rastie prúd kotvy.';
      else if (u < 219) note = 'Znížením napätia kotvy sa charakteristika posunie nadol – otáčky klesnú, sklon charakteristiky sa nezmení.';
      else note = 'So zaťažením otáčky klesajú len o úbytok napätia na odpore kotvy – charakteristika je tvrdá.';
      return {
        chart,
        readouts: [
          ['Otáčky `$n`', nw > 0 ? `${fmt(nw, 4)} ot/min` : '0'],
          ['Prúd kotvy `$I_{a}`', `${fmt(nw > 0 ? Ia : u / Ra, 3)} A`],
          ['Indukované `$U_{i}`', `${fmt(nw > 0 ? Ui : 0, 3)} V`],
          ['Výkon `$P`', nw > 0 ? `${fmt((ml * 2 * Math.PI * nw) / 60 / 1000, 3)} kW` : '0'],
        ],
        note,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    if (rng() < 0.6) {
      const U = pick(rng, [110, 220, 440]);
      const Ia = pick(rng, [10, 12, 15, 20, 25, 32, 40, 50]);
      const Ra = round2((U * pick(rng, [0.03, 0.04, 0.05, 0.06, 0.08])) / Ia);
      const Ui = U - Ra * Ia;
      return numeric(ID, `Jednosmerný motor je pripojený na napätie ${q(U, 'V')}. Odpor obvodu kotvy je ${q(Ra, 'Ω')} a kotvou tečie prúd ${q(Ia, 'A')}. Aké napätie sa indukuje v kotve?`, Ui, 'V', [
      `\`$U = $U_{i} + $R_{a} · $I_{a}\`, preto \`$U_{i} = $U − $R_{a} · $I_{a}\` = ${n(U)} − ${n(Ra)} · ${n(Ia)} = ${res(Ui, 'V')}`,
      ]);
    }
    const Ui1 = pick(rng, [100, 120, 200, 210, 230]);
    const n1 = pick(rng, [1000, 1200, 1500, 2000]);
    const n2 = pick(rng, [600, 800, 900, 1100, 1300, 1800]);
    const Ui2 = (Ui1 * n2) / n1;
    return numeric(ID, `Dynamo s cudzím budením dáva pri ${n(n1)} ot/min indukované napätie ${q(Ui1, 'V')}. Aké napätie indukuje pri ${n(n2)} ot/min, ak sa budenie nezmení?`, Ui2, 'V', [
      'Pri stálom toku je `$U_{i} = $c · $Φ · $n` úmerné otáčkam.',
      `\`$U_{i2} = $U_{i1} · @f{$n_{2}}{$n_{1}} = ${n(Ui1)} · @f{${n(n2)}}{${n(n1)}}\` = ${res(Ui2, 'V')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [110, 220, 440]);
    const Ra = pick(rng, [0.2, 0.25, 0.4, 0.5, 0.8, 1, 1.2]);
    const Ia = U / Ra;
    return numeric(ID, `Jednosmerný motor ${q(U, 'V')} má odpor obvodu kotvy ${q(Ra, 'Ω')}. Aký prúd by tiekol kotvou v okamihu zapnutia bez spúšťača?`, Ia, 'A', [
      'Pri `$n` = 0 je indukované napätie `$U_{i}` = 0, prúd obmedzuje iba odpor kotvy.',
      `\`$I_{a} = @f{$U}{$R_{a}} = @f{${n(U)}}{${n(Ra)}}\` = ${res(Ia, 'A')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [110, 220, 440]);
    const In = pick(rng, [10, 16, 20, 25, 40]);
    const Ra = round2((U * pick(rng, [0.04, 0.05, 0.06])) / In);
    const k = pick(rng, [1.5, 2, 2.5]);
    const Imax = k * In;
    const Rs = U / Imax - Ra;
    return numeric(ID, `Motor ${q(U, 'V')} s odporom kotvy ${q(Ra, 'Ω')} má menovitý prúd ${q(In, 'A')}. Aký rozbehový odpor treba zapojiť do série s kotvou, aby prúd pri zapnutí neprekročil ${n(k)}-násobok menovitého prúdu?`, Rs, 'Ω', [
      `Najväčší dovolený prúd: \`$I_{max}\` = ${n(k)} · ${n(In)} = ${n(Imax)} A`,
      `\`$R_{a} + $R_{s} = @f{$U}{$I_{max}} = @f{${n(U)}}{${n(Imax)}}\` = ${n(U / Imax)} Ω`,
      `\`$R_{s}\` = ${n(U / Imax)} − ${n(Ra)} = ${res(Rs, 'Ω')}`,
    ]);
  },
  (rng) => {
    const U = 220;
    const Ra = pick(rng, [0.4, 0.5, 0.6, 0.8]);
    const Ia1 = pick(rng, [15, 20, 25]);
    const n1 = pick(rng, [1450, 1500, 1000, 2900]);
    if (rng() < 0.5) {
      const Ia2 = pick(rng, [0, 5, 2 * Ia1]);
      const n2 = (n1 * (U - Ra * Ia2)) / (U - Ra * Ia1);
      return numeric(ID, `Derivačný motor 220 V s odporom kotvy ${q(Ra, 'Ω')} sa pri prúde kotvy ${q(Ia1, 'A')} otáča rýchlosťou ${n(n1)} ot/min. Akými otáčkami sa bude otáčať pri prúde kotvy ${Ia2 === 0 ? '0 A (ideálne naprázdno)' : q(Ia2, 'A')}? Budenie sa nemení.`, n2, 'ot/min', [
        'Pri stálom toku sú otáčky úmerné indukovanému napätiu `$U_{i} = $U − $R_{a} · $I_{a}`.',
        `\`$U_{i1}\` = 220 − ${n(Ra)} · ${n(Ia1)} = ${n(U - Ra * Ia1)} V, \`$U_{i2}\` = 220 − ${n(Ra)} · ${n(Ia2)} = ${n(U - Ra * Ia2)} V`,
        `\`$n_{2} = $n_{1} · @f{$U_{i2}}{$U_{i1}} = ${n(n1)} · @f{${n(U - Ra * Ia2)}}{${n(U - Ra * Ia1)}}\` = **${n(n2)} ot/min**`,
      ], { fixedUnit: true, tolerance: 0.005 });
    }
    const f = pick(rng, [0.8, 0.85, 0.9]);
    const n2 = n1 / f;
    return numeric(ID, `Motor s cudzím budením sa otáča rýchlosťou ${n(n1)} ot/min. Budiaci prúd sa zníži tak, že magnetický tok klesne na ${n(f * 100)} %. Akými otáčkami sa bude motor otáčať, ak sa indukované napätie kotvy nezmení?`, n2, 'ot/min', [
      'Z `$U_{i} = $c · $Φ · $n` pri stálom `$U_{i}` platí `$n_{2} = $n_{1} · @f{$Φ_{1}}{$Φ_{2}}`.',
      `\`$n_{2} = ${n(n1)} · @f{1}{${n(f)}}\` = **${n(n2)} ot/min** – zoslabením budenia otáčky stúpnu.`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },
  (rng) => {
    const [p, nn] = pick(rng, [[1, 3000], [2, 1500], [2, 1800], [3, 1000], [4, 750], [6, 500], [1, 2400], [2, 1200], [4, 900], [12, 300], [24, 125], [20, 150], [3, 1200]] as [number, number][]);
    const f = (p * nn) / 60;
    return numeric(ID, `Rotor alternátora má ${2 * p} ${2 * p < 5 ? 'póly' : 'pólov'} a otáča sa rýchlosťou ${n(nn)} ot/min. Akú frekvenciu má indukované napätie?`, f, 'Hz', [
      `Počet pólových dvojíc \`$p\` = ${2 * p} / 2 = ${p}`,
      `\`$f = @f{$p · $n}{60} = @f{${p} · ${n(nn)}}{60}\` = **${n(f)} Hz**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const p = pick(rng, [4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 25, 30, 40, 48]);
    const nn = 3000 / p;
    return numeric(ID, `Hydroalternátor vodnej elektrárne dodáva napätie s frekvenciou 50 Hz. Turbína sa otáča rýchlosťou ${n(nn)} ot/min. Koľko pólov má rotor?`, 2 * p, '', [
      `\`$p = @f{60 · $f}{$n} = @f{60 · 50}{${n(nn)}}\` = ${p} pólových dvojíc`,
      `počet pólov 2\`$p\` = **${2 * p}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const poles = pick(rng, [2, 4, 6, 8, 12, 24]);
    const f = pick(rng, [50, 50, 60]);
    const ns = (120 * f) / poles;
    return numeric(ID, `Synchrónny motor má ${poles}-pólový rotor a je napájaný frekvenciou ${q(f, 'Hz')}. Akými otáčkami sa otáča pri menovitom zaťažení?`, ns, 'ot/min', [
      'Synchrónny motor sa otáča presne synchrónnymi otáčkami bez ohľadu na zaťaženie.',
      `\`$n = @f{60 · $f}{$p} = @f{60 · ${n(f)}}{${poles / 2}}\` = **${n(ns)} ot/min**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Prečo sériový jednosmerný motor nesmie bežať naprázdno?',
        ['pri malom prúde je slabé budenie a otáčky by rástli, až by sa motor zničil', 'nerozbehol by sa', 'prehrialo by sa budiace vinutie', 'komutátor by prestal usmerňovať'],
        'Pri sériovom budení tečie budiacim vinutím prúd kotvy. Naprázdno je prúd malý, tok slabý a otáčky `$n = @f{$U − $R$I}{$c$Φ}` nebezpečne rastú.'],
      ['Akú úlohu má komutátor jednosmerného motora?',
        ['prepína smer prúdu v závitoch kotvy, aby moment pôsobil stále rovnakým smerom', 'reguluje otáčky motora', 'chráni motor pred preťažením', 'vytvára budiace magnetické pole'],
        'Komutátor je mechanický prepínač: keď závit prejde neutrálnou osou, vymenia sa lamely pod kefami a prúd v závite zmení smer.'],
      ['Ako zmeníš smer otáčania derivačného jednosmerného motora?',
        ['prepóluješ len kotvu (alebo len budiace vinutie)', 'prepóluješ napájacie svorky motora', 'zameníš kefy', 'zväčšíš rozbehový odpor'],
        'Moment závisí od smeru toku aj prúdu kotvy. Prepólovaním celého napájania sa zmenia oba – smer otáčania ostane rovnaký.'],
      ['Prečo univerzálny komutátorový motor pracuje aj na striedavý prúd?',
        ['pri zmene polarity sa zmení prúd v kotve aj v budení súčasne, smer momentu ostáva', 'komutátor striedavý prúd usmerní', 'má permanentné magnety', 'pracuje ako asynchrónny motor'],
        'Je to sériový motor so statorom z plechov. Moment `$M ~ $Φ · $I` nemení znamienko, keď sa obe veličiny zmenia súčasne.'],
      ['Ako sa zmenia otáčky derivačného motora, keď zoslabíš budenie?',
        ['zvýšia sa', 'znížia sa', 'nezmenia sa', 'motor sa zastaví'],
        'Pri slabšom toku musí kotva na to isté indukované napätie bežať rýchlejšie: `$n = @f{$U_{i}}{$c · $Φ}`.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Ako sa menia otáčky synchrónneho motora so zaťažením?',
        ['nemenia sa – sú stále synchrónne, kým motor nevypadne zo synchronizmu', 'mierne klesajú ako pri asynchrónnom motore', 'prudko klesajú ako pri sériovom motore', 'so zaťažením rastú'],
        'Rotor synchrónneho motora sa otáča spolu s točivým poľom statora. Zaťaženie zmení len uhol medzi poľom rotora a statora.'],
      ['Prečo má hydroalternátor veľa pólov?',
        ['vodná turbína sa otáča pomaly a frekvencia 50 Hz vyžaduje pri malých otáčkach veľa pólov', 'aby mal menšiu hmotnosť', 'aby nepotreboval budenie', 'aby dával jednosmerné napätie'],
        'Z `$f = @f{$p · $n}{60}`: pri 125 ot/min treba `$p` = 24 pólových dvojíc, teda 48 pólov.'],
      ['Čím sa napája rotor synchrónneho alternátora?',
        ['jednosmerným budiacim prúdom', 'trojfázovým prúdom zo siete', 'striedavým prúdom s frekvenciou 50 Hz', 'nenapája sa, je to klietka'],
        'Rotor je elektromagnet napájaný jednosmerným prúdom (cez krúžky alebo z bezkefového budiča), pri malých strojoch permanentný magnet.'],
      ['Čím sa líši BLDC motor od klasického jednosmerného motora?',
        ['nemá kefy ani komutátor – prúd vo vinutí prepína elektronika podľa polohy rotora', 'nemá žiadne magnety', 'pracuje len na striedavý prúd 50 Hz', 'má vinutý rotor s krúžkami'],
        'Bezkefový motor má magnety na rotore a vinutie na statore. Komutáciu nahrádza elektronika so snímačmi polohy (napr. Hallovými sondami).'],
      ['Ako sa riadi krokový motor?',
        ['impulzmi – každý impulz ho pootočí o jeden krok, napríklad 1,8°', 'zmenou frekvencie siete 50 Hz', 'rozbehovým odporom v kotve', 'prepínaním hviezda – trojuholník'],
        'Krokový motor sa otáča po presných krokoch podľa impulzov z riadiacej elektroniky. Poloha sa dá riadiť bez snímača – 3D tlačiarne, CNC stroje.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'machines',
    title: 'Jednosmerné a synchrónne stroje',
    summary: 'Komutátor, indukované napätie a otáčky jednosmerného motora, rozbeh a druhy budenia, univerzálny motor, alternátor a synchrónny motor, krokový a BLDC motor.',
    minutes: 16,
    blocks: [
      { t: 'p', text: 'Jednosmerný stroj môže pracovať ako **dynamo** (generátor) aj ako **motor**. Jednosmerné motory sa dajú jednoducho a plynulo riadiť, preto dlho poháňali električky, valcovacie stolice či obrábacie stroje. Vo veľkých pohonoch ich dnes nahrádzajú asynchrónne motory s frekvenčnými meničmi, no komutátorové motory s permanentnými magnetmi nájdeš v autách (stierače, ventilátory, štartér), v hračkách a v akumulátorovom náradí.' },
      { t: 'h', text: 'Konštrukcia jednosmerného stroja' },
      {
        t: 'list',
        items: [
          '**Stator** (magnetový systém) – kostra s **hlavnými pólmi**, na ktorých je **budiace vinutie** napájané jednosmerným prúdom; pri malých motoroch ho nahrádzajú permanentné magnety. Väčšie stroje majú medzi hlavnými pólmi aj pomocné (komutačné) póly, ktoré zlepšujú komutáciu.',
          '**Kotva** (rotor) – zväzok plechov na hriadeli, v drážkach je vinutie kotvy.',
          '**Komutátor** – valec z medených lamiel navzájom izolovaných mikanitom (sľudou), na ktoré sú pripojené cievky kotvy.',
          '**Kefy** – uhlíkové (grafitové) bloky pritláčané pružinami na komutátor, privádzajú prúd do kotvy. Opotrebúvajú sa a iskria, preto stroj potrebuje údržbu.',
        ],
      },
      { t: 'figure', fig: commutatorFigure, caption: 'Princíp motora s jedným závitom: ľavá strana závitu je cez lamelu komutátora (medený polkruh) a kefu (tmavý obdĺžnik) pripojená na +, prúd ňou tečie do papiera (×), pravou stranou z papiera (•). Sily `$F` na strany závitu vytvoria moment a kotva sa otáča.' },
      { t: 'p', text: '**Komutátor** pracuje ako mechanický prepínač: vždy, keď strany závitu prechádzajú neutrálnou osou (uprostred medzi pólmi), lamely sa pod kefami vymenia a prúd v závite zmení smer. Pod každým pólom tak tečie prúd stále rovnakým smerom a moment pôsobí jedným smerom. V dyname naopak komutátor „usmerňuje“ striedavé napätie indukované v závitoch na jednosmerné napätie na kefách.' },
      { t: 'h', text: 'Indukované napätie, otáčky a rozbeh' },
      {
        t: 'formula',
        tex: ['$U_{i} = $c · $Φ · $n', '$M = $c_{M} · $Φ · $I_{a}'],
        legend: [
          ['$U_{i}', 'napätie indukované v kotve', 'V'],
          ['$c, $c_{M}', 'konštanty stroja (počet vodičov, pólov …)', '–'],
          ['$Φ', 'magnetický tok jedného pólu', 'Wb'],
          ['$n', 'otáčky', 'ot/min'],
          ['$I_{a}', 'prúd kotvy', 'A'],
        ],
      },
      {
        t: 'formula',
        tex: ['$U = $U_{i} + $R_{a} · $I_{a}', '$n = @f{$U − $R_{a} · $I_{a}}{$c · $Φ}'],
        legend: [['$U', 'napätie na svorkách kotvy', 'V'], ['$R_{a}', 'odpor obvodu kotvy (vinutie, kefy)', 'Ω']],
      },
      { t: 'p', text: 'V motore pôsobí indukované napätie proti napätiu zdroja (preto sa volá aj **protinapätie**) a kotvou tečie len taký prúd, aký treba na vytvorenie momentu. Otáčky rastú s napätím kotvy a klesajú so zväčšovaním toku. Pri rozbehu sa však kotva ešte netočí, `$U_{i}` = 0 a prúd obmedzuje iba malý odpor kotvy: `$I_{a} = @f{$U}{$R_{a}}` – mnohonásobne viac ako menovitý prúd. Preto sa do série s kotvou zapája **rozbehový (spúšťací) odpor** `$R_{s}`, ktorý sa so stúpajúcimi otáčkami postupne vyraďuje: `$I_{a} = @f{$U}{$R_{a} + $R_{s}}`.' },
      {
        t: 'example',
        title: 'Motor 220 V – indukované napätie, rozbeh a otáčky',
        given: ['`$U` = 220 V, `$R_{a}` = 0,5 Ω', 'menovite `$I_{a}` = 20 A, `$n` = 1 500 ot/min'],
        steps: [
          '`$U_{i} = $U − $R_{a} · $I_{a}` = 220 − 0,5 · 20 = 210 V',
          '`$c · $Φ = @f{$U_{i}}{$n} = @f{210}{1 500}` = 0,14 V/(ot/min)',
          'rozbeh bez spúšťača: `$I_{a} = @f{220}{0,5}` = 440 A – 22-násobok menovitého prúdu',
          'obmedzenie na 2 · `$I_{n}` = 40 A: `$R_{a} + $R_{s} = @f{220}{40}` = 5,5 Ω, teda `$R_{s}` = 5 Ω',
          'pri polovičnom zaťažení (`$I_{a}` = 10 A): `$n = @f{220 − 0,5 · 10}{0,14}` = 1 536 ot/min',
        ],
        result: '`$U_{i}` = 210 V, rozbehový odpor 5 Ω; pri odľahčení otáčky stúpnu len o 2,4 %',
      },
      { t: 'h', text: 'Druhy budenia' },
      { t: 'figure', fig: dcConnectionsFigure, caption: 'Derivačné budenie: budiace vinutie je paralelne ku kotve a tečie ním malý stály prúd `$I_{b}`. Sériové budenie: budiacim vinutím tečie celý prúd kotvy. `$R_{s}` je rozbehový odpor.' },
      {
        t: 'table',
        head: ['Budenie', 'Budiace vinutie', 'Otáčky pri zaťažení', 'Použitie'],
        rows: [
          ['cudzie', 'napájané z iného zdroja', 'takmer stále (tvrdá charakteristika)', 'regulované pohony, otáčky sa riadia napätím kotvy'],
          ['derivačné', 'paralelne ku kotve', 'takmer stále, mierne klesajú', 'obrábacie stroje, ventilátory'],
          ['sériové', 'v sérii s kotvou', 'so zaťažením výrazne klesajú (mäkká charakteristika), veľký záberový moment', 'trakcia (električky, lokomotívy), štartéry, žeriavy'],
          ['zložené', 'časť paralelne, časť v sérii', 'medzi derivačným a sériovým', 'pohony s nárazovým zaťažením (lisy)'],
        ],
      },
      { t: 'figure', fig: dcSpeedChart, caption: 'Otáčkové (mechanické) charakteristiky `$n = f($M)`: derivačný motor drží otáčky, sériový motor ich so zaťažením mení a pri malom zaťažení by sa nebezpečne roztočil.' },
      { t: 'note', kind: 'warn', text: 'Sériový motor **nesmie bežať naprázdno**. Pri malom prúde je slabé aj budenie a otáčky rastú, až by sa motor mechanicky zničil („rozbehol by sa“). Preto sa so záťažou spája pevne (prevodovkou, spojkou), nikdy nie remeňom, ktorý by mohol spadnúť.' },
      { t: 'explore', build: dcMotorExplorer, caption: 'Cudzie budený motor 220 V (`$R_{a}` = 0,5 Ω, menovitý prúd 20 A): znížením napätia kotvy otáčky klesajú, zoslabením budenia stúpajú. Pri zaťažení otáčky klesnú len o úbytok na odpore kotvy.' },
      { t: 'p', text: 'Otáčky jednosmerného motora sa riadia **napätím kotvy** (od nuly po menovité otáčky – dnes polovodičovými meničmi), **zoslabením budenia** (nad menovité otáčky) alebo stratovo **odporom v obvode kotvy**. Smer otáčania sa zmení prepólovaním **buď** kotvy, **alebo** budiaceho vinutia – nie oboch súčasne, prepólovanie celého napájania smer nezmení. Motor s permanentnými magnetmi stačí prepólovať.' },
      { t: 'p', text: '**Univerzálny komutátorový motor** je sériový motor so statorom z plechov. Pracuje na jednosmerný aj striedavý prúd: pri zmene polarity sa zmení smer prúdu v kotve aj v budení súčasne, takže moment pôsobí stále rovnakým smerom. Dosahuje vysoké otáčky (až desaťtisíce ot/min) a veľký moment pri malých rozmeroch – poháňa ručné vŕtačky, brúsky, vysávače a kuchynské roboty. Otáčky sa riadia triakovým regulátorom.' },
      { t: 'h', text: 'Synchrónne stroje' },
      { t: 'p', text: '**Synchrónny generátor (alternátor)** vyrába takmer všetku elektrickú energiu v elektrárňach. Stator má trojfázové vinutie ako asynchrónny motor. Rotor je elektromagnet napájaný jednosmerným **budiacim prúdom** (cez krúžky alebo z bezkefového budiča), pri malých strojoch permanentný magnet. Otáčajúce sa pole rotora indukuje v statore trojfázové napätie, ktorého frekvencia závisí od otáčok a počtu pólov. Budiacim prúdom sa riadi napätie a jalový výkon generátora.' },
      {
        t: 'formula',
        tex: ['$f = @f{$p · $n}{60}', '$n = @f{60 · $f}{$p}'],
        legend: [['$f', 'frekvencia indukovaného napätia', 'Hz'], ['$p', 'počet pólových dvojíc rotora', '–'], ['$n', 'otáčky rotora', 'ot/min']],
      },
      {
        t: 'table',
        head: ['Typ', 'Pohon', 'Otáčky pri 50 Hz', 'Rotor'],
        rows: [
          ['turboalternátor', 'parná alebo plynová turbína (tepelné a jadrové elektrárne)', 'zvyčajne 3 000 ot/min (`$p` = 1)', 'valcový s hladkým povrchom – dlhý a štíhly'],
          ['hydroalternátor', 'vodná turbína', 'desiatky až stovky ot/min', 's vyniknutými pólmi, veľa pólov, veľký priemer'],
        ],
      },
      {
        t: 'example',
        title: 'Počet pólov hydroalternátora',
        given: ['`$n` = 125 ot/min', '`$f` = 50 Hz'],
        steps: [
          '`$p = @f{60 · $f}{$n} = @f{60 · 50}{125}` = 24 pólových dvojíc',
          'počet pólov 2`$p` = 48',
        ],
        result: 'Rotor má 48 pólov.',
      },
      { t: 'p', text: '**Synchrónny motor** má rovnakú konštrukciu ako alternátor. Rotor sa otáča presne synchrónnymi otáčkami `$n_{s} = @f{60 · $f}{$p}` bez ohľadu na zaťaženie – pri preťažení „vypadne zo synchronizmu“ a zastaví sa. Sám sa nerozbehne; rozbieha sa pomocou rozbehovej klietky v póloch alebo frekvenčným meničom. Prebudený synchrónny motor dodáva do siete jalový výkon, a tak môže zlepšovať účinník.' },
      { t: 'p', text: '**Krokový motor** sa otáča po krokoch – každý impulz z riadiacej elektroniky ho pootočí o presný uhol (napr. 1,8°, teda 200 krokov na otáčku). Polohu možno riadiť bez snímača, preto je v tlačiarňach, 3D tlačiarňach a CNC strojoch. **BLDC** (bezkefový jednosmerný motor) má permanentné magnety na rotore a vinutie na statore; komutáciu namiesto komutátora zabezpečuje elektronika podľa polohy rotora (Hallove sondy). Je bez kief, tichý a s dlhou životnosťou – ventilátory počítačov, drony, elektrobicykle.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Akú úlohu má komutátor jednosmerného motora?',
      options: ['mení smer prúdu v závitoch kotvy tak, aby moment pôsobil stále rovnakým smerom', 'reguluje otáčky motora', 'chráni motor pred preťažením', 'vytvára budiace magnetické pole'],
      explanation: 'Komutátor s kefami je mechanický prepínač. V dyname naopak usmerňuje striedavé napätie indukované v závitoch.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sériový motor nesmie bežať naprázdno?',
      options: ['otáčky by stúpali, až by sa motor mechanicky zničil', 'motor by sa nerozbehol', 'prehrialo by sa budiace vinutie', 'komutátor by prestal fungovať'],
      explanation: 'Budiaci tok sériového motora vytvára prúd kotvy. Naprázdno je malý, a podľa `$n = @f{$U − $R · $I}{$c · $Φ}` otáčky prudko rastú.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo je prúd kotvy pri rozbehu bez spúšťača veľký?',
      options: ['indukované napätie je pri n = 0 nulové a prúd obmedzuje len malý odpor kotvy', 'budiace vinutie je pri rozbehu skratované', 'kefy majú pri rozbehu najmenší odpor', 'motor pri rozbehu pracuje ako dynamo'],
      explanation: 'Protinapätie `$U_{i} = $c · $Φ · $n` vzniká až pri otáčaní. V okamihu zapnutia je `$I_{a} = @f{$U}{$R_{a}}`.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa zmenia otáčky derivačného motora, keď zoslabíš budenie?',
      options: ['zvýšia sa', 'znížia sa', 'nezmenia sa', 'motor sa zastaví'],
      explanation: 'Pri slabšom toku musí kotva na to isté indukované napätie bežať rýchlejšie. Zoslabenie budenia sa používa na zvýšenie otáčok nad menovité.',
    },
    {
      lessonId: ID,
      prompt: 'Aké otáčky má turboalternátor s jednou pólovou dvojicou pri 50 Hz?',
      options: ['3 000 ot/min', '1 500 ot/min', '50 ot/min', '6 000 ot/min'],
      explanation: '`$n = @f{60 · $f}{$p} = @f{60 · 50}{1}` = 3 000 ot/min.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo univerzálny komutátorový motor pracuje aj na striedavý prúd?',
      options: ['pri zmene polarity sa mení prúd v kotve aj v budení súčasne, smer momentu sa nemení', 'komutátor striedavý prúd usmerní', 'má permanentné magnety', 'pracuje ako asynchrónny motor'],
      explanation: 'Je to sériový motor: tok aj prúd kotvy menia smer naraz, ich súčin (moment) má stále rovnaké znamienko.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa menia otáčky synchrónneho motora so zaťažením?',
      options: ['nemenia sa – sú stále synchrónne, kým motor nevypadne zo synchronizmu', 'mierne klesajú ako pri asynchrónnom motore', 'prudko klesajú ako pri sériovom motore', 'rastú'],
      explanation: 'Rotor synchrónneho motora sa otáča presne s točivým poľom statora. Pri preťažení vypadne zo synchronizmu a zastaví sa.',
    },
  ],
  generators,
};

export default mod;
