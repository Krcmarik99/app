import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { b, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { lossesChart, outputCharacteristicChart, transformerTestFigure } from '../../../ui/fig-machines';
import { choice } from '../util';

const ID = 'transformator-prevadzka';

/** Typické údaje trojfázových distribučných transformátorov: Sn [kVA], ΔP0 [kW], ΔPk [kW]. */
const RATINGS: [number, number, number][] = [
  [50, 0.19, 1.1], [100, 0.32, 1.75], [160, 0.46, 2.35], [250, 0.65, 3.25], [400, 0.93, 4.6], [630, 1.3, 6.5],
];

const round4 = (x: number) => Number(x.toPrecision(4));

/** Účinnosť transformátora 100 kVA v závislosti od zaťaženia, s vyznačeným maximom. */
function efficiencyExplorer(): HTMLElement {
  const Sn = 100;
  return explorer({
    title: 'Účinnosť transformátora 100 kVA',
    params: [
      { key: 'p0', label: 'Straty naprázdno `Δ$P_{0}`', unit: 'W', min: 100, max: 1000, value: 250 },
      { key: 'pk', label: 'Straty nakrátko `Δ$P_{k}`', unit: 'W', min: 500, max: 5000, value: 1750 },
      { key: 'cos', label: 'Účinník záťaže `cos $φ`', unit: '', min: 0.5, max: 1, value: 0.9, format: (v) => fmt(v, 2) },
    ],
    draw: ({ p0, pk, cos }) => {
      const P0 = p0 / 1000;
      const Pk = pk / 1000;
      const eta = (bt: number) => (bt <= 0 ? 0 : (100 * bt * Sn * cos) / (bt * Sn * cos + P0 + bt * bt * Pk));
      const bOpt = Math.sqrt(P0 / Pk);
      const etaMax = eta(bOpt);
      let lo = 100;
      for (let bt = 0.15; bt <= 1.5; bt += 0.05) lo = Math.min(lo, eta(bt));
      const ymin = [98, 97, 96, 95, 94, 92, 90, 85, 80].find((c) => c <= lo - 0.2) ?? 80;
      const span = 100 - ymin;
      const step = span <= 3 ? 0.5 : span <= 6 ? 1 : span <= 10 ? 2 : 5;
      const ticks: number[] = [];
      for (let t = ymin; t <= 100.001; t += step) ticks.push(Number(t.toFixed(1)));
      const chart = lineChart({
        ariaLabel: `Účinnosť v závislosti od zaťaženia, maximum ${fmt(etaMax, 4)} % pri β = ${fmt(bOpt, 2)}`,
        width: 460,
        height: 250,
        x: { min: 0, max: 1.5, ticks: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5], format: (v) => fmt(v), label: 'β [–]' },
        y: { min: ymin, max: 100, ticks, format: (v) => fmt(v), label: 'η [%]' },
        series: [{ points: sample(eta, 0.005, 1.5, 300) }],
        vlines: [{ x: 1, label: 'menovité' }],
        markers: [{ x: bOpt, y: etaMax, label: `ηmax = ${fmt(etaMax, 4)} %`, above: true }],
      });
      return {
        chart,
        readouts: [
          ['`$β_{opt}`', fmt(bOpt, 3)],
          ['`$η_{max}`', `${fmt(etaMax, 4)} %`],
          ['`$η` pri `$β` = 1', `${fmt(eta(1), 4)} %`],
          ['straty pri `$β` = 1', `${fmt(p0 + pk, 4)} W`],
        ],
        note: `Najväčšia účinnosť je pri zaťažení ${fmt(bOpt * 100, 2)} % menovitého výkonu – vtedy sú straty vo vinutí (\`$β^{2} · Δ$P_{k}\`) rovnaké ako straty v železe (${fmt(p0, 3)} W).`,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const [S, P0, Pk] = pick(rng, RATINGS);
    const bt = pick(rng, [0.25, 0.5, 0.75, 1]);
    const c = pick(rng, [0.8, 0.85, 0.9, 0.95, 1]);
    const P2 = bt * S * c;
    const Pcu = round4(bt * bt * Pk);
    const eta = (100 * P2) / (P2 + P0 + Pcu);
    return numeric(ID, `Transformátor ${n(S)} kVA má straty naprázdno ${q(P0 * 1000, 'W')} a straty nakrátko ${q(Pk * 1000, 'W')}. Aká je jeho účinnosť pri zaťažení ${n(bt * 100)} % menovitého výkonu a účinníku ${n(c)}?`, eta, '%', [
      `\`$P_{2} = $β · $S_{n} · cos $φ\` = ${n(bt)} · ${n(S)} · ${n(c)} = ${n(P2, 6)} kW`,
      `\`Δ$P_{Cu} = $β^{2} · Δ$P_{k} = ${n(bt)}^{2} · ${n(Pk)}\` = ${n(Pcu)} kW`,
      `\`$η = @f{$P_{2}}{$P_{2} + Δ$P_{0} + Δ$P_{Cu}} = @f{${n(P2, 6)}}{${n(P2, 6)} + ${n(P0)} + ${n(Pcu)}}\` = **${n(eta, 4)} %**`,
    ], { fixedUnit: true, tolerance: 0.005 });
  },
  (rng) => {
    const [S, P0, Pk] = pick(rng, RATINGS);
    const bt = Math.sqrt(P0 / Pk);
    return numeric(ID, `Transformátor ${n(S)} kVA má straty naprázdno ${q(P0 * 1000, 'W')} a straty nakrátko ${q(Pk * 1000, 'W')}. Pri akom činiteli zaťaženia \`$β\` má najväčšiu účinnosť?`, bt, '', [
      'Účinnosť je najväčšia, keď sa straty vo vinutí rovnajú stratám v železe: `$β^{2} · Δ$P_{k} = Δ$P_{0}`.',
      `\`$β_{opt} = @s{@f{Δ$P_{0}}{Δ$P_{k}}} = @s{@f{${n(P0)}}{${n(Pk)}}}\` = **${n(bt, 3)}**, teda pri zaťažení asi ${n(bt * 100, 2)} %.`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const [S, U2, uk] = pick(rng, [[1, 24, 8], [2.5, 48, 6], [4, 230, 5], [6.3, 230, 5], [10, 230, 4.5], [16, 400, 4], [25, 400, 4]] as [number, number, number][]);
    const In = round4((S * 1000) / U2);
    const Ik = (In * 100) / uk;
    return numeric(ID, `Jednofázový transformátor ${n(S)} kVA má sekundárne napätie ${q(U2, 'V')} a napätie nakrátko ${n(uk)} %. Aký ustálený prúd tečie pri skrate na sekundárnych svorkách?`, Ik, 'A', [
      `\`$I_{n} = @f{$S_{n}}{$U_{2}} = @f{${n(S * 1000)}}{${n(U2)}}\` = ${n(In)} A`,
      `\`$I_{k} = $I_{n} · @f{100}{$u_{k}} = ${n(In)} · @f{100}{${n(uk)}}\` = ${res(Ik, 'A')}`,
    ]);
  },
  (rng) => {
    const [S, U1, U2] = pick(rng, [[400, 230, 24], [1000, 230, 12], [1600, 230, 48], [2500, 400, 230], [4000, 230, 24], [630, 230, 24], [250, 230, 12]] as [number, number, number][]);
    const prim = rng() < 0.4;
    const U = prim ? U1 : U2;
    const I = S / U;
    return numeric(ID, `Jednofázový transformátor má na štítku ${q(S, 'VA')}, ${n(U1)} V / ${n(U2)} V. Aký je menovitý prúd ${prim ? 'primárneho' : 'sekundárneho'} vinutia?`, I, 'A', [
      `\`$I_{n} = @f{$S_{n}}{$U_{n}} = @f{${n(S)}}{${n(U)}}\` = ${res(I, 'A')}`,
      prim ? 'Primárny prúd je menší ako sekundárny v pomere prevodu.' : 'Sekundárny prúd je väčší ako primárny v pomere prevodu.',
    ]);
  },
  (rng) => {
    const [S, , Pk] = pick(rng, RATINGS);
    const bt = pick(rng, [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.1, 1.2]);
    const Pcu = bt * bt * Pk * 1000;
    return numeric(ID, `Straty nakrátko transformátora ${n(S)} kVA sú ${q(Pk * 1000, 'W')}. Aké sú straty vo vinutiach, keď je transformátor zaťažený prúdom ${n(bt * 100)} % menovitého?`, Pcu, 'W', [
      'Straty nakrátko sú straty vo vinutiach pri menovitom prúde; rastú s druhou mocninou prúdu.',
      `\`Δ$P_{Cu} = $β^{2} · Δ$P_{k} = ${n(bt)}^{2} · ${n(Pk * 1000)}\` = ${res(Pcu, 'W')}`,
    ]);
  },
  (rng) => {
    const U1 = pick(rng, [230, 400, 6000, 22000]);
    const uk = pick(rng, [4, 4.5, 5, 6, 8]);
    const Uk = (U1 * uk) / 100;
    return numeric(ID, `Pri meraní nakrátko transformátora s menovitým primárnym napätím ${b(U1, 'V')} tiekol vinutiami menovitý prúd pri napätí ${b(Uk, 'V')}. Aké je napätie nakrátko v percentách?`, uk, '%', [
      `\`$u_{k} = @f{$U_{k}}{$U_{1n}} · 100 % = @f{${n(Uk)}}{${n(U1)}} · 100 %\` = **${n(uk)} %**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Čo meria wattmeter pri meraní transformátora naprázdno?',
        ['straty v železe (hysterézne a vírivými prúdmi)', 'straty vo vinutiach pri menovitom prúde', 'výkon odovzdaný záťaži', 'mechanické straty'],
        'Naprázdno tečie primárom len malý prúd `$I_{0}`, straty vo vinutí sú zanedbateľné. Napätie je menovité, takže tok v jadre a straty v železe sú také ako v prevádzke.'],
      ['Prečo sa pri meraní nakrátko takmer neprejavia straty v železe?',
        ['napätie na primári je malé, preto je malý aj tok v jadre', 'skratovaný sekundár odvedie tok mimo jadra', 'jadro sa pri skrate presýti a prestane viesť tok', 'wattmeter pri malom napätí nemeria'],
        'Napätie nakrátko je len niekoľko percent menovitého napätia. Tok v jadre je úmerný napätiu, a straty v železe sú preto zanedbateľné – wattmeter meria straty vo vinutiach.'],
      ['Ako sa pri meraní nakrátko nastavuje napätie zdroja?',
        ['zvyšuje sa od nuly, kým vinutiami netečie menovitý prúd', 'pripojí sa hneď menovité napätie', 'nastaví sa na polovicu menovitého napätia', 'nastaví sa tak, aby wattmeter ukazoval menovitý výkon'],
        'Pri skratovanom sekundári by menovité napätie spôsobilo skratový prúd. Napätie sa preto zvyšuje od nuly; to, pri ktorom tečie menovitý prúd, je napätie nakrátko `$U_{k}`.'],
      ['Ktorý údaj sa určuje z merania naprázdno?',
        ['prevod transformátora a prúd naprázdno', 'napätie nakrátko', 'straty vo vinutiach', 'ustálený skratový prúd'],
        'Naprázdno sa merajú napätia `$U_{1n}` a `$U_{20}` (prevod), prúd `$I_{0}` a príkon `$P_{0}` (straty v železe).'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Pri akom zaťažení má transformátor najväčšiu účinnosť?',
        ['keď sa straty vo vinutiach rovnajú stratám v železe', 'vždy pri menovitom zaťažení', 'naprázdno', 'pri dvojnásobnom preťažení'],
        'Straty v železe sú stále, straty vo vinutiach rastú s `$β^{2}`. Pomer užitočného výkonu k stratám je najlepší pri `$β_{opt} = @s{Δ$P_{0} / Δ$P_{k}}`.'],
      ['Ako sa zmenia straty vo vinutiach, keď prúd transformátora klesne na polovicu?',
        ['klesnú na štvrtinu', 'klesnú na polovicu', 'nezmenia sa', 'klesnú na osminu'],
        'Straty vo vinutí sú `$R · $I^{2}`. Pri polovičnom prúde sú `0,5^{2}` = 0,25-násobné.'],
      ['Transformátory A a B majú rovnaký výkon, A má `$u_{k}` = 4 % a B `$u_{k}` = 8 %. Ktorý dodá pri skrate väčší prúd?',
        ['A – dvojnásobný oproti B', 'B – dvojnásobný oproti A', 'oba rovnaký', 'A – štvornásobný oproti B'],
        '`$I_{k} = $I_{n} · @f{100}{$u_{k}}`: transformátor A dodá 25-násobok, B 12,5-násobok menovitého prúdu.'],
      ['Ako sa zmenia straty v železe transformátora, keď sa zaťaženie zníži na polovicu?',
        ['nezmenia sa – závisia od napätia, nie od zaťaženia', 'klesnú na štvrtinu', 'klesnú na polovicu', 'zväčšia sa'],
        'Straty v železe určuje magnetický tok, ten závisí od napätia a frekvencie. Pri stálom napätí sú rovnaké naprázdno aj pri plnom zaťažení.'],
      ['Pri akej záťaži môže sekundárne napätie transformátora so zaťažením stúpnuť?',
        ['pri kapacitnej', 'pri induktívnej', 'pri odporovej', 'pri žiadnej, napätie vždy klesá'],
        'Pri kapacitnej záťaži je úbytok na rozptylovej reaktancii vinutí fázovo posunutý tak, že sa napätie zväčšuje. Pri induktívnej záťaži je úbytok najväčší.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'machines',
    title: 'Prevádzkové stavy, straty a účinnosť transformátora',
    summary: 'Stav naprázdno a nakrátko, straty v železe a vo vinutí, napätie nakrátko, skratový prúd, účinnosť a štítok transformátora.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Skutočný transformátor má straty – časť príkonu sa mení na teplo v jadre a vo vinutiach. Ich veľkosť sa zisťuje dvoma základnými meraniami: **naprázdno** a **nakrátko**. Výsledky (prúd naprázdno, napätie nakrátko a straty) uvádza výrobca na štítku a v katalógu a dá sa z nich vypočítať účinnosť pri akomkoľvek zaťažení.' },
      { t: 'h', text: 'Stav naprázdno' },
      { t: 'p', text: 'Sekundárne vinutie nie je zaťažené (`$I_{2}` = 0) a primár je na menovitom napätí. Primárom tečie len **prúd naprázdno** `$I_{0}`, ktorý vytvára magnetický tok v jadre a kryje straty v železe. Je malý – zvyčajne 1 až 10 % menovitého prúdu (veľké transformátory majú menej ako malé) – a má výrazne induktívny charakter.' },
      { t: 'figure', fig: () => transformerTestFigure('open'), caption: 'Meranie naprázdno: wattmeter meria príkon naprázdno `$P_{0}`, ktorý sa takmer celý mení na straty v železe. Z napätí `$U_{1n}` a `$U_{20}` sa určí prevod.' },
      {
        t: 'list',
        items: [
          '**Straty naprázdno** `Δ$P_{0}` ≈ `Δ$P_{Fe}` – straty v železe. Straty vo vinutí sú pri malom prúde `$I_{0}` zanedbateľné.',
          '**Hysterézne straty** vznikajú pri neustálom premagnetovaní jadra, sú úmerné frekvencii.',
          '**Straty vírivými prúdmi** sú úmerné druhej mocnine frekvencie aj hrúbky plechu – preto sa jadro skladá z tenkých izolovaných plechov.',
          'Straty v železe závisia od napätia (indukcie v jadre), **nie od zaťaženia** – pri menovitom napätí sú stále rovnaké, aj keď transformátor nič nenapája.',
          '**Prevod** sa meria naprázdno: `$p = @f{$U_{1n}}{$U_{20}}`; prúd naprázdno v percentách je `$i_{0} = @f{$I_{0}}{$I_{1n}} · 100 %`.',
        ],
      },
      { t: 'h', text: 'Stav nakrátko' },
      { t: 'p', text: 'Pri meraní nakrátko je sekundár spojený nakrátko cez ampérmeter. Napätie na primári zvyšujeme od nuly, kým vinutiami netečie **menovitý prúd**. Toto napätie je **napätie nakrátko** `$U_{k}` a udáva sa v percentách menovitého napätia. Distribučné transformátory majú zvyčajne `$u_{k}` = 4 až 6 %. Tok v jadre je pri takom malom napätí slabý, preto sú straty v železe zanedbateľné a príkon nakrátko sa rovná **stratám vo vinutiach** pri menovitom prúde.' },
      { t: 'figure', fig: () => transformerTestFigure('short'), caption: 'Meranie nakrátko: napätie regulovateľného zdroja sa zvyšuje, kým oboma vinutiami netečú menovité prúdy. Wattmeter potom meria straty nakrátko `$P_{k}`.' },
      {
        t: 'formula',
        tex: ['$u_{k} = @f{$U_{k}}{$U_{1n}} · 100 %', '$I_{k} = $I_{n} · @f{100}{$u_{k}}'],
        legend: [
          ['$u_{k}', 'napätie nakrátko', '%'],
          ['$U_{k}', 'napätie, pri ktorom pri skratovanom sekundári tečie menovitý prúd', 'V'],
          ['$I_{k}', 'ustálený skratový prúd pri skrate na svorkách a menovitom napätí', 'A'],
          ['Δ$P_{k}', 'straty nakrátko ≈ straty vo vinutiach pri menovitom prúde', 'W'],
        ],
      },
      { t: 'note', kind: 'warn', text: 'Pri skrate na svorkách počas prevádzky je na primári plné napätie – `@f{100}{$u_{k}}`-krát väčšie ako pri meraní nakrátko. Rovnako veľakrát väčší je aj prúd: transformátor s `$u_{k}` = 4 % dodá do skratu 25-násobok menovitého prúdu. Podľa skratového prúdu sa volí vypínacia schopnosť ističov a skratová odolnosť rozvádzačov.' },
      {
        t: 'example',
        title: 'Menovitý a skratový prúd',
        given: ['jednofázový transformátor `$S_{n}` = 10 kVA', '400 V / 230 V', '`$u_{k}` = 5 %'],
        steps: [
          '`$I_{2n} = @f{$S_{n}}{$U_{2n}} = @f{10 000}{230}` = 43,5 A',
          '`$I_{k} = $I_{2n} · @f{100}{$u_{k}} = 43,5 · @f{100}{5}` = 870 A',
          'Pri meraní nakrátko stačí na primári `$U_{k}` = 0,05 · 400 = 20 V.',
        ],
        result: '`$I_{2n}` ≈ 43,5 A, `$I_{k}` ≈ 870 A',
      },
      { t: 'h', text: 'Zaťaženie a účinnosť' },
      { t: 'p', text: 'Pri zaťažení sa straty v železe nemenia (`Δ$P_{0}`), ale straty vo vinutiach rastú s druhou mocninou prúdu. Zaťaženie vyjadruje **činiteľ zaťaženia** `$β = @f{$I}{$I_{n}} ≈ @f{$S}{$S_{n}}`. Pri polovičnom zaťažení (`$β` = 0,5) sú straty vo vinutí len štvrtinové: `Δ$P_{Cu} = $β^{2} · Δ$P_{k}`.' },
      { t: 'figure', fig: lossesChart, caption: 'Straty transformátora 100 kVA s `Δ$P_{0}` = 0,25 kW a `Δ$P_{k}` = 1,75 kW. Pri `$β_{opt}` sa straty vo vinutí rovnajú stratám v železe.' },
      {
        t: 'formula',
        tex: ['$η = @f{$P_{2}}{$P_{1}} = @f{$β · $S_{n} · cos $φ}{$β · $S_{n} · cos $φ + Δ$P_{0} + $β^{2} · Δ$P_{k}}', '$β_{opt} = @s{@f{Δ$P_{0}}{Δ$P_{k}}}'],
        legend: [
          ['$β', 'činiteľ zaťaženia', '–'],
          ['$S_{n}', 'menovitý zdanlivý výkon', 'VA'],
          ['cos $φ', 'účinník záťaže', '–'],
          ['Δ$P_{0}', 'straty naprázdno (v železe)', 'W'],
          ['Δ$P_{k}', 'straty nakrátko (vo vinutiach pri menovitom prúde)', 'W'],
        ],
      },
      { t: 'p', text: 'Účinnosť je najväčšia pri zaťažení `$β_{opt}`, keď sa **straty vo vinutiach rovnajú stratám v železe**. Distribučné transformátory sú pripojené nepretržite a väčšinu času nie sú plne zaťažené, preto sa navrhujú s malými stratami v železe – maximum účinnosti majú pri zaťažení menšom ako menovité.' },
      { t: 'explore', build: efficiencyExplorer, caption: 'Zmeň straty a účinník. Väčšie straty naprázdno posunú maximum účinnosti k väčšiemu zaťaženiu, pri menšom účinníku je účinnosť menšia.' },
      {
        t: 'example',
        title: 'Účinnosť distribučného transformátora',
        given: ['`$S_{n}` = 100 kVA', '`Δ$P_{0}` = 0,25 kW, `Δ$P_{k}` = 1,75 kW', '`$β` = 0,75, `cos $φ` = 0,9'],
        steps: [
          '`$P_{2} = $β · $S_{n} · cos $φ` = 0,75 · 100 · 0,9 = 67,5 kW',
          '`Δ$P_{Cu} = $β^{2} · Δ$P_{k} = 0,75^{2} · 1,75` = 0,984 kW',
          '`$η = @f{67,5}{67,5 + 0,25 + 0,984}` = 0,982 = 98,2 %',
          '`$β_{opt} = @s{@f{0,25}{1,75}}` = 0,378 – najväčšia účinnosť je pri zaťažení asi 38 %.',
        ],
        result: '`$η` ≈ 98,2 %, `$β_{opt}` ≈ 0,38',
      },
      { t: 'h', text: 'Úbytok napätia pri zaťažení' },
      { t: 'p', text: 'So zaťažením sekundárne napätie klesá – prúd vytvára úbytky na odpore vinutí a na ich rozptylovej reaktancii. Zjednodušene platí `Δ$u ≈ $β · ($u_{R} · cos $φ + $u_{X} · sin $φ)`, kde `$u_{R} = @f{Δ$P_{k}}{$S_{n}} · 100 %` a `$u_{X} = @s{$u_{k}^{2} − $u_{R}^{2}}`. Pri menovitom zaťažení je úbytok najviac rovný napätiu nakrátko `$u_{k}`. Pri kapacitnej záťaži môže napätie dokonca stúpnuť.' },
      { t: 'figure', fig: outputCharacteristicChart, caption: 'Vonkajšia (zaťažovacia) charakteristika transformátora s `$u_{k}` = 6 % a `$u_{R}` = 1,5 %: pri induktívnej záťaži napätie klesá najviac, pri kapacitnej stúpa.' },
      { t: 'h', text: 'Štítok transformátora' },
      {
        t: 'table',
        head: ['Údaj', 'Príklad', 'Význam'],
        rows: [
          ['menovitý výkon `$S_{n}`', '250 kVA', 'zdanlivý výkon pri trvalom zaťažení'],
          ['menovité napätia', '22 000 / 420 V', 'združené napätia vinutí VN a NN naprázdno'],
          ['odbočky', '± 2 × 2,5 %', 'úprava prevodu prepínačom odbočiek na strane VN (bez napätia)'],
          ['menovité prúdy', '6,56 / 344 A', 'prúdy vo vodičoch VN a NN pri menovitom výkone'],
          ['frekvencia', '50 Hz', 'menovitá frekvencia siete'],
          ['skupina spojenia', 'Dyn1', 'zapojenie vinutí a hodinový uhol (ďalšia lekcia)'],
          ['napätie nakrátko `$u_{k}`', '4 %', 'určuje skratový prúd a úbytok napätia'],
          ['straty naprázdno `Δ$P_{0}`', '425 W', 'straty v železe'],
          ['straty nakrátko `Δ$P_{k}`', '3 250 W', 'straty vo vinutiach pri menovitom prúde'],
          ['chladenie', 'ONAN', 'olej a vzduch, oba s prirodzeným prúdením'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Straty naprázdno ≈ straty v **železe** (stále, závisia od napätia), straty nakrátko ≈ straty vo **vinutiach** (rastú s `$β^{2}`). Malé `$u_{k}` znamená malý úbytok napätia pri zaťažení, ale veľký skratový prúd.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čomu sa približne rovnajú straty naprázdno transformátora?',
      options: ['stratám v železe', 'stratám vo vinutiach pri menovitom prúde', 'súčtu všetkých strát pri menovitom zaťažení', 'mechanickým stratám'],
      explanation: 'Naprázdno tečie primárom len malý prúd `$I_{0}`, takže straty vo vinutí sú zanedbateľné. Jadro je však magnetované menovitým napätím.',
    },
    {
      lessonId: ID,
      prompt: 'Čo je napätie nakrátko transformátora?',
      options: ['napätie, pri ktorom pri skratovanom sekundári tečie vinutiami menovitý prúd', 'napätie na sekundári pri skrate v sieti', 'najmenšie napätie, pri ktorom transformátor ešte pracuje', 'úbytok napätia pri chode naprázdno'],
      explanation: 'Napätie nakrátko sa meria pri skratovanom sekundári a udáva sa v percentách menovitého napätia. Určuje skratový prúd aj úbytok napätia pri zaťažení.',
    },
    {
      lessonId: ID,
      prompt: 'Transformátor má menovitý prúd 100 A a napätie nakrátko 5 %. Aký je ustálený skratový prúd pri skrate na svorkách?',
      options: ['2 000 A', '500 A', '5 000 A', '105 A'],
      explanation: '`$I_{k} = $I_{n} · @f{100}{$u_{k}}` = 100 · 20 = 2 000 A.',
    },
    {
      lessonId: ID,
      prompt: 'Ako závisia straty v železe od zaťaženia transformátora?',
      options: ['nezávisia – pri stálom napätí sú konštantné', 'rastú s druhou mocninou prúdu', 'rastú priamo úmerne prúdu', 'sú najväčšie naprázdno a so zaťažením klesajú na nulu'],
      explanation: 'Straty v železe závisia od magnetického toku, teda od napätia a frekvencie. S druhou mocninou prúdu rastú straty vo vinutí.',
    },
    {
      lessonId: ID,
      prompt: 'Aký veľký je obvykle prúd naprázdno transformátora?',
      options: ['asi 1 až 10 % menovitého prúdu', 'asi 50 % menovitého prúdu', 'rovná sa menovitému prúdu', 'je presne nulový'],
      explanation: 'Prúd naprázdno len magnetuje jadro a kryje straty v železe. Vďaka jadru s veľkou permeabilitou je malý, pri veľkých transformátoroch aj pod 1 %.',
    },
    {
      lessonId: ID,
      prompt: 'Straty naprázdno sú 0,4 kW a straty nakrátko 1,6 kW. Pri akom činiteli zaťaženia je účinnosť najväčšia?',
      options: ['0,5', '0,25', '1', '4'],
      explanation: '`$β_{opt} = @s{@f{0,4}{1,6}} = @s{0,25}` = 0,5. Pri polovičnom zaťažení sú straty vo vinutí 0,25 · 1,6 = 0,4 kW – rovnaké ako v železe.',
    },
    {
      lessonId: ID,
      prompt: 'Pri ktorej záťaži sekundárne napätie transformátora so zaťažením klesá najviac?',
      options: ['pri induktívnej', 'pri odporovej', 'pri kapacitnej', 'pri všetkých rovnako'],
      explanation: 'Úbytok `Δ$u ≈ $β · ($u_{R} cos $φ + $u_{X} sin $φ)` je najväčší pri induktívnom charaktere záťaže. Pri kapacitnej záťaži môže napätie dokonca stúpnuť.',
    },
  ],
  generators,
};

export default mod;
