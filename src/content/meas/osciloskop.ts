import type { MeasModule } from './types';
import { pick } from '../../lib/random';
import { formatSI } from '../../lib/units';
import { n, numeric, q, type Generator } from '../../practice/helpers';
import { explorer } from '../../ui/explorer';
import { ellipseFigure, lissajousFigure, scopeScreen } from '../../ui/fig-power';
import { choice, clean } from '../y3/util';

/*
 * Lekcia – osciloskop: princíp, ovládanie, sonda, meranie amplitúdy, periódy, frekvencie
 * a fázového posunu, režim XY a Lissajousove obrazce.
 */

const ID = 'osciloskop';

const VDIV = [0.1, 0.2, 0.5, 1, 2, 5, 10];
const TDIV = [50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3];

const SIGNALS: Record<string, { Um: number; f: number; label: string }> = {
  a: { Um: 3, f: 1000, label: 'sínus 3 V, 1 kHz' },
  b: { Um: 0.8, f: 5000, label: 'sínus 0,8 V, 5 kHz' },
  c: { Um: 12, f: 200, label: 'sínus 12 V, 200 Hz' },
};

/** Slovo „dielik“ v správnom tvare: 1 dielik, 2 dieliky, 5 dielikov, 2,4 dielika. */
const dv = (x: number) => {
  const s = n(x);
  if (!Number.isInteger(x)) return `${s} dielika`;
  if (x === 1) return `${s} dielik`;
  if (x >= 2 && x <= 4) return `${s} dieliky`;
  return `${s} dielikov`;
};

const idx = (v: number, arr: number[]) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(v)))];

/** Obraz signálu pri rôznom nastavení V/dielik a čas/dielik. */
function scopeExplorer(): HTMLElement {
  return explorer({
    title: 'Nastavenie osciloskopu',
    params: [
      { key: 'v', label: 'Vertikálne vychyľovanie', unit: '', min: 0, max: VDIV.length - 1, value: 3, format: (v) => `${formatSI(idx(v, VDIV), 'V', 3)}/dielik` },
      { key: 't', label: 'Časová základňa', unit: '', min: 0, max: TDIV.length - 1, value: 2, format: (v) => `${formatSI(idx(v, TDIV), 's', 3)}/dielik` },
    ],
    choices: [
      { key: 'sig', label: 'Meraný signál', options: Object.entries(SIGNALS).map(([k, s]) => [k, s.label] as [string, string]), value: 'a' },
      { key: 'probe', label: 'Sonda', options: [['1', '1:1'], ['10', '10:1']], value: '1' },
    ],
    draw: ({ v, t }, { sig, probe }) => {
      const s = SIGNALS[sig];
      const p = Number(probe);
      const vd = idx(v, VDIV);
      const td = idx(t, TDIV);
      const amp = s.Um / p / vd;
      const per = 1 / s.f / td;
      const notes: string[] = [];
      if (amp > 4) notes.push('Signál presahuje obrazovku – zväčši V/dielik.');
      else if (amp < 1) notes.push('Obraz je príliš malý a odčítanie nepresné – zmenši V/dielik.');
      if (per > 10) notes.push('Na obrazovke nie je ani celá perióda – zväčši čas/dielik.');
      else if (per < 1) notes.push('Na obrazovke je priveľa periód – zmenši čas/dielik.');
      if (!notes.length) notes.push('Dobré nastavenie: amplitúda zaberá 2 až 4 dieliky a na obrazovke sú 1 až 5 periód.');
      if (p === 10) notes.push('So sondou 10:1 prichádza na vstup desatina napätia – údaj vynásob desiatimi.');
      return {
        chart: scopeScreen({ voltsPerDiv: vd, timePerDiv: td, amplitudeDiv: amp, periodDiv: per, probe: p }),
        readouts: [
          ['Amplitúda na obrazovke', dv(Number(amp.toPrecision(3)))],
          ['Perióda na obrazovke', dv(Number(per.toPrecision(3)))],
          ['`$U_{m}` = dieliky · V/dielik · sonda', formatSI(amp * vd * p, 'V', 3)],
          ['`$f = @f{1}{$T}`', formatSI(1 / (per * td), 'Hz', 3)],
        ],
        note: notes.join(' '),
      };
    },
  });
}

const AMP_DIV = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6];
const V_LIST = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const T_LIST = [10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3];
const PER_DIV = [2, 2.4, 3, 4, 5, 6, 8];

const vText = (v: number) => `${formatSI(v, 'V', 3)}/dielik`;
const tText = (t: number) => `${formatSI(t, 's', 3)}/dielik`;

const generators: Generator[] = [
  // Amplitúda z obrazovky.
  (rng) => {
    const vd = pick(rng, V_LIST);
    const a = pick(rng, AMP_DIV);
    const per = pick(rng, [2, 4, 5]);
    const td = pick(rng, [100e-6, 200e-6, 500e-6, 1e-3]);
    const Um = clean(a * vd);
    return numeric(ID, `Na obrazovke osciloskopu je sínusové napätie (obrázok, vertikálne vychyľovanie ${vText(vd)}). Odčítaj amplitúdu napätia \`$U_{m}\`.`, Um, 'V', [
      `Vrchol sínusovky je ${dv(a)} nad stredovou čiarou (jemné delenie stredovej osi je po 0,2 dielika).`,
      `\`$U_{m}\` = ${dv(a)} · ${vText(vd)} = **${q(Um, 'V')}**`,
    ], { figure: () => scopeScreen({ voltsPerDiv: vd, timePerDiv: td, amplitudeDiv: a, periodDiv: per }) });
  },
  // Frekvencia z obrazovky.
  (rng) => {
    const td = pick(rng, T_LIST);
    const per = pick(rng, PER_DIV);
    const T = clean(per * td);
    const f = 1 / T;
    return numeric(ID, `Na obrazovke osciloskopu je sínusový signál (obrázok, časová základňa ${tText(td)}). Odčítaj periódu a vypočítaj frekvenciu signálu.`, f, 'Hz', [
      `Jedna perióda zaberá ${dv(per)} (od jedného prechodu nulou nahor po ďalší).`,
      `\`$T\` = ${n(per)} · ${formatSI(td, 's', 3)} = ${q(T, 's')}`,
      `\`$f = @f{1}{$T} = @f{1}{${n(T, 4)}}\` = **${q(f, 'Hz')}**`,
    ], { figure: () => scopeScreen({ voltsPerDiv: 1, timePerDiv: td, amplitudeDiv: 2.6, periodDiv: per }) });
  },
  // Efektívna hodnota.
  (rng) => {
    const vd = pick(rng, [0.5, 1, 2, 5]);
    const a = pick(rng, AMP_DIV);
    const Um = clean(a * vd);
    const U = Um / Math.SQRT2;
    return numeric(ID, `Osciloskop ukazuje sínusové napätie (obrázok, ${vText(vd)}). Aká je jeho efektívna hodnota – akú hodnotu by ukázal voltmeter?`, U, 'V', [
      `\`$U_{m}\` = ${dv(a)} · ${vText(vd)} = ${q(Um, 'V')}`,
      `\`$U = @f{$U_{m}}{@s{2}} = @f{${n(Um)}}{1,414}\` = **${q(U, 'V')}**`,
    ], { figure: () => scopeScreen({ voltsPerDiv: vd, timePerDiv: 1e-3, amplitudeDiv: a, periodDiv: 4 }) });
  },
  // Fázový posun z dvoch kanálov.
  (rng) => {
    const per = pick(rng, [4, 5, 6, 8, 10]);
    const shifts = [0.4, 0.5, 0.6, 0.8, 1, 1.2, 1.5, 2].filter((d) => d < per / 2 && Math.abs((d / per) * 360 - Math.round((d / per) * 360)) < 1e-9);
    const d = pick(rng, shifts);
    const phi = clean((d / per) * 360);
    const td = pick(rng, [50e-6, 100e-6, 200e-6, 500e-6, 1e-3]);
    return numeric(ID, `Na obrazovke sú dva sínusové signály rovnakej frekvencie (obrázok, ${tText(td)}): CH1 (medený) a CH2 (modrý). O koľko stupňov sa CH2 oneskoruje za CH1?`, phi, '°', [
      `Perióda zaberá ${dv(per)}, posun prechodov nulou nahor je ${dv(d)}.`,
      `\`$φ = @f{Δ$t}{$T} · 360° = @f{${n(d)}}{${n(per)}} · 360°\` = **${n(phi, 4)}°**`,
      `Časovo: \`Δ$t\` = ${n(d)} · ${formatSI(td, 's', 3)} = ${q(d * td, 's')}, \`$T\` = ${q(per * td, 's')}.`,
    ], { fixedUnit: true, tolerance: 0.03, figure: () => scopeScreen({ voltsPerDiv: 1, timePerDiv: td, amplitudeDiv: 3, periodDiv: per, second: { amplitudeDiv: 2, phaseDiv: d } }) });
  },
  // Sonda 10:1.
  (rng) => {
    const vd = pick(rng, [0.1, 0.2, 0.5, 1, 2]);
    const a = pick(rng, AMP_DIV);
    const Um = clean(a * vd * 10);
    return numeric(ID, `Signál meriaš sondou 10:1, osciloskop je nastavený na ${vText(vd)} a sondu nezohľadňuje (obrázok). Aká je skutočná amplitúda meraného napätia?`, Um, 'V', [
      `Na obrazovke: ${dv(a)} · ${vText(vd)} = ${q(a * vd, 'V')}`,
      `Sonda 10:1 delí napätie desiatimi, preto \`$U_{m}\` = 10 · ${q(a * vd, 'V')} = **${q(Um, 'V')}**`,
    ], { figure: () => scopeScreen({ voltsPerDiv: vd, timePerDiv: 200e-6, amplitudeDiv: a, periodDiv: 5, probe: 10 }) });
  },
  // Lissajousove obrazce.
  (rng) => {
    const [nx, ny] = pick(rng, [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]] as [number, number][]);
    const fx = pick(rng, [100, 200, 500, 1000]);
    const fy = (fx * ny) / nx;
    const cands = [fy, (fx * nx) / ny, fx, fx * (nx + ny), fx * 4, fx / 4].map((v) => clean(v));
    const uniq = [...new Set(cands)].slice(0, 4);
    const opts = uniq.map((v) => q(v, 'Hz')) as [string, string, string, string];
    const base = choice(ID, `Osciloskop je v režime XY. Na vstup X je privedený signál s frekvenciou \`$f_{x}\` = ${q(fx, 'Hz')}, na vstup Y neznámy signál. Na obrazovke je obrazec z obrázka. Aká je frekvencia \`$f_{y}\`?`, opts,
      `Obrazec sa dotýka vodorovnej strany ${ny}-krát a zvislej strany ${nx}-krát: \`@f{$f_{y}}{$f_{x}} = @f{$n_{h}}{$n_{v}} = @f{${ny}}{${nx}}\`, teda \`$f_{y}\` = ${q(fx, 'Hz')} · ${n(ny / nx, 3)} = ${q(fy, 'Hz')}.`,
      rng);
    return { ...base, figure: () => lissajousFigure(nx, ny, 30) };
  },
  // Ovládanie (výber).
  (rng) => {
    const v = pick(rng, [
      {
        prompt: 'Signál je jednosmerné napätie 12 V so zvlnením 50 mV. Ako zobrazíš samotné zvlnenie s veľkým rozlíšením?',
        options: ['väzbu prepneš na AC a zvolíš malé V/dielik, napr. 20 mV/dielik', 'väzbu prepneš na GND', 'zväčšíš časovú základňu na 1 s/dielik', 'použiješ režim XY'],
        why: 'Väzba AC oddelí jednosmernú zložku kondenzátorom, takže na obrazovke ostane len zvlnenie, ktoré môžeš zväčšiť citlivým rozsahom.',
      },
      {
        prompt: 'Obraz periodického signálu na obrazovke „uteká“ a nestojí. Čo upravíš?',
        options: ['spúšťanie – zdroj a úroveň spúšťania (trigger level)', 'vertikálne vychyľovanie V/dielik', 'väzbu na GND', 'kompenzáciu sondy'],
        why: 'Spúšťanie zabezpečí, že každý priebeh časovej základne začne v rovnakom bode signálu (pri rovnakej úrovni a hrane). Úroveň musí ležať v rozsahu signálu.',
      },
      {
        prompt: 'Na čo slúži poloha väzby GND?',
        options: ['vstup sa odpojí od signálu a uzemní – zobrazí sa nulová čiara, ktorú nastavíš na referenčnú polohu', 'na uzemnenie meraného obvodu', 'na meranie prúdu v ochrannom vodiči', 'na zapnutie režimu XY'],
        why: 'V polohe GND vidíš, kde je na obrazovke nulové napätie. Potom prepneš na DC a odčítaš napätie od tejto čiary.',
      },
      {
        prompt: 'Potrebuješ zachytiť jednorazový prechodový dej pri zapnutí zdroja. Aký režim spúšťania zvolíš?',
        options: ['SINGLE – osciloskop zaznamená jeden priebeh po splnení podmienky spúšťania', 'AUTO – obraz sa obnovuje aj bez spúšťania', 'režim XY', 'väzbu AC'],
        why: 'V režime SINGLE digitálny osciloskop čaká na spúšťaciu udalosť, zaznamená ju do pamäte a zastaví sa.',
      },
    ]);
    return choice(ID, v.prompt, v.options as [string, string, string, string], v.why, rng);
  },
];

const mod: MeasModule = {
  lesson: {
    id: ID,
    chapter: 'meas',
    title: 'Osciloskop',
    summary: 'Analógový a digitálny osciloskop, vertikálne vychyľovanie, časová základňa, spúšťanie, väzba a sonda; meranie amplitúdy, frekvencie a fázového posunu, režim XY a Lissajousove obrazce.',
    minutes: 14,
    blocks: [
      { t: 'p', text: '**Osciloskop** zobrazuje časový priebeh napätia – na obrazovke vidíš, ako sa napätie mení v čase. Z obrazu odčítaš amplitúdu, periódu, frekvenciu, fázový posun aj tvar signálu (skreslenie, zákmity, rušenie). Vodorovná os je čas, zvislá os napätie. Obrazovka je rozdelená mriežkou na **10 dielikov** vodorovne a **8 dielikov** zvislo.' },
      { t: 'h', text: 'Princíp' },
      { t: 'p', text: '**Analógový osciloskop** má obrazovku (katódovú trubicu), v ktorej elektrónový lúč kreslí stopu na tienidle. Meraný signál po zosilnení vychyľuje lúč **zvislo**, **pílovité napätie časovej základne** ho rovnomerne posúva **vodorovne** zľava doprava. Aby obraz stál, každý priebeh pílovitého napätia musí začať v rovnakom bode signálu – to zabezpečí **spúšťanie**.' },
      { t: 'p', text: '**Digitálny (pamäťový) osciloskop** signál **vzorkuje** – analógovo-číslicový prevodník ho veľakrát za sekundu zmeria (vzorkovacia frekvencia až GS/s) a vzorky uloží do **pamäte**. Obraz vykreslí na displeji, vie ho zastaviť, uložiť, zachytiť jednorazový dej a automaticky zmerať amplitúdu, frekvenciu či efektívnu hodnotu. Dôležité parametre sú **šírka pásma** (MHz) – mala by byť aspoň 3- až 5-krát väčšia ako frekvencia meraného signálu –, vzorkovacia frekvencia a počet kanálov.' },
      { t: 'h', text: 'Ovládacie prvky' },
      {
        t: 'table',
        head: ['Ovládanie', 'Funkcia'],
        rows: [
          ['vertikálne vychyľovanie (VOLTS/DIV)', 'koľko voltov pripadá na jeden dielik zvislo, napr. 2 V/dielik'],
          ['časová základňa (TIME/DIV)', 'koľko času pripadá na jeden dielik vodorovne, napr. 1 ms/dielik'],
          ['POSITION', 'posun obrazu zvislo alebo vodorovne'],
          ['väzba DC / AC / GND', 'DC – celý signál aj s jednosmernou zložkou; AC – len striedavá zložka (cez kondenzátor); GND – vstup uzemnený, zobrazí nulovú čiaru'],
          ['spúšťanie (TRIGGER)', 'zdroj (CH1, CH2, externý), úroveň (LEVEL) a hrana (nábežná alebo dobežná), pri ktorej začne priebeh'],
          ['režim spúšťania', 'AUTO – obraz sa kreslí aj bez spúšťania; NORMAL – len po spustení; SINGLE – zachytí jeden priebeh a zastaví sa'],
        ],
      },
      { t: 'figure', fig: () => scopeScreen({ voltsPerDiv: 2, timePerDiv: 0.5e-3, amplitudeDiv: 3, periodDiv: 4 }), caption: 'Obrazovka osciloskopu: 2 V/dielik, 0,5 ms/dielik. Vrchol sínusovky je 3 dieliky nad stredom, perióda zaberá 4 dieliky. Stredové osi majú jemné delenie po 0,2 dielika.' },
      { t: 'h', text: 'Meranie napätia a frekvencie' },
      {
        t: 'formula',
        tex: ['$U_{m} = $y · $k_{y} · $p', '$U_{pp} = 2 · $U_{m}', '$U = @f{$U_{m}}{@s{2}}', '$T = $x · $k_{x}', '$f = @f{1}{$T}'],
        legend: [
          ['$y', 'výška vrcholu nad stredom', 'dielik'],
          ['$k_{y}', 'vertikálne vychyľovanie', 'V/dielik'],
          ['$p', 'delič sondy (1 alebo 10)', '–'],
          ['$U_{pp}', 'napätie špička – špička', 'V'],
          ['$U', 'efektívna hodnota (len pre sínusový priebeh)', 'V'],
          ['$x', 'dĺžka periódy', 'dielik'],
          ['$k_{x}', 'časová základňa', 's/dielik'],
        ],
      },
      {
        t: 'example',
        title: 'Odčítanie z obrazovky',
        given: ['2 V/dielik, 0,5 ms/dielik, sonda 1:1', 'vrchol 3 dieliky nad stredom', 'perióda 4 dieliky'],
        steps: [
          '`$U_{m}` = 3 · 2 = 6 V, `$U_{pp}` = 2 · 6 = 12 V',
          '`$U = @f{6}{1,414}` = 4,24 V',
          '`$T` = 4 · 0,5 = 2 ms, `$f = @f{1}{0,002}` = 500 Hz',
        ],
        result: '`$U_{m}` = 6 V, `$U` = 4,24 V, `$f` = 500 Hz',
      },
      { t: 'explore', build: scopeExplorer, caption: 'Meň V/dielik a čas/dielik a sleduj, ako sa obraz zväčšuje a zhusťuje. Nameraná amplitúda a frekvencia vychádzajú vždy rovnako.' },
      { t: 'h', text: 'Sonda 1:1 a 10:1' },
      { t: 'p', text: 'Signál sa privádza tienenou **sondou**. Sonda **10:1** má v hrote rezistor 9 MΩ, ktorý so vstupným odporom osciloskopu 1 MΩ tvorí delič 10 : 1. Meraný obvod potom zaťažuje odpor 10 MΩ a menšia kapacita, a sonda má väčšiu šírku pásma. Na obrazovku sa však dostane **desatina** napätia – ak osciloskop sondu nezohľadňuje sám, údaj vynásob desiatimi. Sonda **1:1** je citlivejšia na malé signály, ale viac zaťažuje obvod a má šírku pásma len niekoľko MHz.' },
      { t: 'note', kind: 'tip', text: '**Kompenzácia sondy:** sondu 10:1 pripoj na výstup kalibrátora osciloskopu (obdĺžnikový signál, obvykle 1 kHz) a malým skrutkovačom nastav kapacitný trimer v sonde tak, aby hrany obdĺžnika boli ostré a vodorovné časti rovné – bez prekmitov (prekompenzovaná sonda) a bez zaoblenia (podkompenzovaná sonda).' },
      { t: 'h', text: 'Fázový posun dvoch signálov' },
      { t: 'figure', fig: () => scopeScreen({ voltsPerDiv: 1, timePerDiv: 0.1e-3, amplitudeDiv: 3, periodDiv: 8, second: { amplitudeDiv: 2, phaseDiv: 1 } }), caption: 'Dva kanály: perióda zaberá 8 dielikov, priebeh CH2 (modrý) prechádza nulou nahor o 1 dielik neskôr ako CH1.' },
      {
        t: 'formula',
        tex: '$φ = @f{Δ$t}{$T} · 360° = @f{Δ$x}{$x} · 360°',
        legend: [['Δ$x', 'vzdialenosť rovnakých bodov (napr. prechodov nulou nahor) oboch priebehov', 'dielik'], ['$x', 'dĺžka periódy', 'dielik']],
      },
      {
        t: 'example',
        title: 'Fázový posun z obrazovky',
        given: ['0,1 ms/dielik', 'perióda 8 dielikov', 'posun prechodov nulou 1 dielik'],
        steps: [
          '`$T` = 8 · 0,1 = 0,8 ms, `$f = @f{1}{0,0008}` = 1 250 Hz',
          '`Δ$t` = 1 · 0,1 = 0,1 ms',
          '`$φ = @f{0,1}{0,8} · 360°` = 45°',
        ],
        result: 'CH2 sa oneskoruje za CH1 o 45°',
      },
      { t: 'h', text: 'Režim XY a Lissajousove obrazce' },
      { t: 'p', text: 'V režime **XY** sa časová základňa vypne: signál kanála 1 vychyľuje stopu **vodorovne**, signál kanála 2 **zvislo**. Ak sú frekvencie v pomere malých celých čísel, vznikne nehybný **Lissajousov obrazec**. Pomer frekvencií zistíš z počtu dotykov obrazca so stranami obdĺžnika, do ktorého je vpísaný: `@f{$f_{y}}{$f_{x}} = @f{$n_{h}}{$n_{v}}`, kde `$n_{h}` je počet dotykov s vodorovnou stranou a `$n_{v}` so zvislou stranou. Pri **rovnakých frekvenciách** vznikne elipsa a z nej určíš fázový posun: `sin $φ = @f{$Y_{0}}{$Y_{m}}`.' },
      { t: 'figure', fig: () => lissajousFigure(1, 2, 30), caption: 'Pomer `$f_{y} : $f_{x}` = 2 : 1 – obrazec sa dotýka hornej strany dvakrát a bočnej strany raz. Ak má `$f_{x}` 1 kHz, `$f_{y}` = 2 kHz.' },
      { t: 'figure', fig: () => ellipseFigure(30), caption: 'Rovnaké frekvencie, fázový posun 30°: úsek na zvislej osi `2$Y_{0}` je polovicou celkovej výšky `2$Y_{m}`, teda `sin $φ` = 0,5 a `$φ` = 30°. Pri 0° je obrazec úsečka, pri 90° (a rovnakých amplitúdach) kružnica.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Čo nastavuješ prepínačom VOLTS/DIV?',
      options: ['koľko voltov pripadá na jeden dielik vo zvislom smere', 'koľko času pripadá na jeden dielik', 'úroveň spúšťania', 'delič sondy'],
      explanation: 'VOLTS/DIV je citlivosť vertikálneho vychyľovania. Čas na dielik nastavuje časová základňa (TIME/DIV).',
    },
    {
      lessonId: ID,
      prompt: 'Na čo slúži spúšťanie (trigger) osciloskopu?',
      options: ['aby každý priebeh začal v rovnakom bode signálu a obraz stál', 'na zapnutie osciloskopu', 'na zväčšenie amplitúdy', 'na odstránenie jednosmernej zložky'],
      explanation: 'Spúšťanie spustí časovú základňu, keď signál prejde zvolenou úrovňou na zvolenej hrane. Jednosmernú zložku odstraňuje väzba AC.',
    },
    {
      lessonId: ID,
      prompt: 'Signál meriaš sondou 10:1, osciloskop ju nezohľadňuje. Na obrazovke odčítaš amplitúdu 0,6 V. Aká je skutočná amplitúda?',
      options: ['6 V', '0,06 V', '0,6 V', '60 V'],
      explanation: 'Sonda 10:1 privedie na vstup desatinu napätia, preto treba údaj vynásobiť desiatimi.',
    },
    {
      lessonId: ID,
      prompt: 'Čo spôsobí väzba AC?',
      options: ['na obrazovke sa zobrazí len striedavá zložka signálu, jednosmerná sa odfiltruje', 'osciloskop meria len striedavé signály s frekvenciou 50 Hz', 'zobrazí sa efektívna hodnota', 'vstup sa uzemní'],
      explanation: 'Pri väzbe AC je na vstupe zapojený oddeľovací kondenzátor. Hodí sa napríklad na zobrazenie zvlnenia jednosmerného napätia.',
    },
    {
      lessonId: ID,
      prompt: 'Perióda zaberá na obrazovke 5 dielikov pri časovej základni 0,2 ms/dielik. Aká je frekvencia?',
      options: ['1 kHz', '200 Hz', '5 kHz', '100 Hz'],
      explanation: '`$T` = 5 · 0,2 ms = 1 ms, `$f = @f{1}{$T}` = 1 kHz.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa kompenzuje sonda 10:1?',
      options: ['pripojí sa na obdĺžnikový signál kalibrátora a trimrom sa nastavia ostré hrany bez prekmitov', 'nastaví sa na nej menší odpor hrotu', 'prepne sa väzba na GND', 'sonda 10:1 sa nekompenzuje'],
      explanation: 'Kapacitný trimer v sonde vyrovná delič tak, aby delil rovnako pri všetkých frekvenciách. Pri zlej kompenzácii sú hrany obdĺžnika zaoblené alebo prekmitávajú.',
    },
    {
      lessonId: ID,
      prompt: 'Aký obrazec vznikne v režime XY pri dvoch sínusových signáloch rovnakej frekvencie a amplitúdy, posunutých o 90°?',
      options: ['kružnica', 'šikmá úsečka', 'osmička', 'vodorovná čiara'],
      explanation: '`$x = sin $ωt`, `$y = cos $ωt` – body ležia na kružnici. Pri posune 0° vznikne úsečka, pri inom posune elipsa.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je vzťah medzi amplitúdou a napätím špička – špička sínusového signálu?',
      options: ['`$U_{pp} = 2 · $U_{m}`', '`$U_{pp} = @f{$U_{m}}{@s{2}}`', '`$U_{pp} = $U_{m}`', '`$U_{pp} = @s{2} · $U_{m}`'],
      explanation: 'Napätie špička – špička je rozdiel medzi kladným a záporným vrcholom, pri symetrickom sínusovom priebehu dvojnásobok amplitúdy.',
    },
  ],
  generators,
};

export default mod;
