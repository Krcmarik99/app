import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, formatSI } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { explorer } from '../../../ui/explorer';
import { monostableFigure, ne555Figure, oscillatorBlockFigure, timer555Chart, wienFigure } from '../../../ui/fig-electronics';
import { choice } from '../util';

const ID = 'oscilatory-555';

/** Malé číslo vo vedeckom zápise ako vzorec: `2,953 · 10^{−4}`. */
function sci(x: number, sig = 4): string {
  if (x >= 1e-3) return n(x, sig);
  let e = Math.floor(Math.log10(x));
  let m = Number((x / 10 ** e).toPrecision(sig));
  if (m >= 10) {
    m /= 10;
    e += 1;
  }
  return `\`${n(m, sig)} · 10^{−${-e}}\``;
}

function timerExplorer(): HTMLElement {
  return explorer({
    title: 'Astabilný klopný obvod 555',
    params: [
      { key: 'R1', label: 'Rezistor `$R_{1}`', unit: 'Ω', min: 1e3, max: 100e3, value: 10e3, log: true },
      { key: 'R2', label: 'Rezistor `$R_{2}`', unit: 'Ω', min: 1e3, max: 100e3, value: 47e3, log: true },
      { key: 'C', label: 'Kapacita `$C`', unit: 'F', min: 1e-9, max: 100e-6, value: 10e-6, log: true },
    ],
    draw: ({ R1, R2, C }) => {
      const t1 = 0.693 * (R1 + R2) * C;
      const t2 = 0.693 * R2 * C;
      const T = t1 + t2;
      return {
        chart: timer555Chart(R1, R2, C),
        readouts: [
          ['Frekvencia `$f`', formatSI(1 / T, 'Hz', 3)],
          ['Perióda `$T`', formatSI(T, 's', 3)],
          ['`$t_{1}` (výstup H)', formatSI(t1, 's', 3)],
          ['`$t_{2}` (výstup L)', formatSI(t2, 's', 3)],
          ['Striedavosť `$D`', `${fmt((t1 / T) * 100, 3)} %`],
        ],
        note: R1 > R2
          ? 'Keď je R1 väčší ako R2, výstup je väčšinu periódy v stave H – striedavosť sa blíži k 100 %.'
          : 'Napájanie 9 V. Prvý impulz je dlhší, lebo kondenzátor sa na začiatku nabíja od nuly, nie od tretiny napájacieho napätia.',
      };
    },
  });
}

const R1S = [1e3, 2.2e3, 4.7e3, 10e3];
const R2S = [4.7e3, 10e3, 22e3, 47e3, 68e3, 100e3];
const CS = [10e-9, 100e-9, 1e-6, 10e-6, 100e-6];

const generators: Generator[] = [
  (rng) => {
    const R1 = pick(rng, R1S);
    const R2 = pick(rng, R2S);
    const C = pick(rng, CS);
    const f = 1.44 / ((R1 + 2 * R2) * C);
    return numeric(ID, `Časovač 555 v astabilnom zapojení má \`$R_{1}\` = ${q(R1, 'Ω')}, \`$R_{2}\` = ${q(R2, 'Ω')} a \`$C\` = ${q(C, 'F')}. Aká je frekvencia výstupného signálu?`, f, 'Hz', [
      '`$f ≈ @f{1,44}{($R_{1} + 2 · $R_{2}) · $C}`',
      `\`$f\` = 1,44 / ((${q(R1, 'Ω')} + 2 · ${q(R2, 'Ω')}) · ${q(C, 'F')}) = 1,44 / ${sci((R1 + 2 * R2) * C)} s = ${res(f, 'Hz')}`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, R1S);
    const R2 = pick(rng, R2S);
    const C = pick(rng, CS);
    const t1 = 0.693 * (R1 + R2) * C;
    return numeric(ID, `Astabilný 555 má \`$R_{1}\` = ${q(R1, 'Ω')}, \`$R_{2}\` = ${q(R2, 'Ω')} a \`$C\` = ${q(C, 'F')}. Ako dlho trvá stav H na výstupe (\`$t_{1}\`)?`, t1, 's', [
      'Počas `$t_{1}` sa kondenzátor nabíja cez `$R_{1}` aj `$R_{2}`.',
      `\`$t_{1} = 0,693 · ($R_{1} + $R_{2}) · $C\` = 0,693 · ${q(R1 + R2, 'Ω', 4)} · ${q(C, 'F')} = ${res(t1, 's')}`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, R1S);
    const R2 = pick(rng, R2S);
    const C = pick(rng, CS);
    const t2 = 0.693 * R2 * C;
    return numeric(ID, `Astabilný 555 má \`$R_{1}\` = ${q(R1, 'Ω')}, \`$R_{2}\` = ${q(R2, 'Ω')} a \`$C\` = ${q(C, 'F')}. Ako dlho trvá stav L na výstupe (\`$t_{2}\`)?`, t2, 's', [
      'Počas `$t_{2}` sa kondenzátor vybíja len cez `$R_{2}` do vývodu 7.',
      `\`$t_{2} = 0,693 · $R_{2} · $C\` = 0,693 · ${q(R2, 'Ω')} · ${q(C, 'F')} = ${res(t2, 's')}`,
    ]);
  },
  (rng) => {
    const R1 = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3, 22e3, 47e3]);
    const R2 = pick(rng, [1e3, 4.7e3, 10e3, 22e3, 47e3, 100e3]);
    const D = ((R1 + R2) / (R1 + 2 * R2)) * 100;
    return numeric(ID, `Astabilný 555 má \`$R_{1}\` = ${q(R1, 'Ω')} a \`$R_{2}\` = ${q(R2, 'Ω')}. Aká je striedavosť výstupného signálu (podiel stavu H z periódy) v percentách?`, D, '%', [
      '`$D = @f{$t_{1}}{$t_{1} + $t_{2}} = @f{$R_{1} + $R_{2}}{$R_{1} + 2 · $R_{2}}` (kapacita sa vykráti)',
      `\`$D\` = ${n(R1 + R2)} / ${n(R1 + 2 * R2)} = ${n(D / 100, 3)} = **${n(D, 3)} %**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const R = pick(rng, [1e3, 2.2e3, 4.7e3, 10e3, 22e3, 47e3]);
    const C = pick(rng, [1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 100e-9]);
    const f = 1 / (2 * Math.PI * R * C);
    return numeric(ID, `RC oscilátor s Wienovým mostíkom má v oboch vetvách \`$R\` = ${q(R, 'Ω')} a \`$C\` = ${q(C, 'F')}. Akú frekvenciu vyrába?`, f, 'Hz', [
      '`$f_{0} = @f{1}{2π · $R · $C}`',
      `\`$f_{0}\` = 1 / (2π · ${q(R, 'Ω')} · ${q(C, 'F')}) = 1 / ${sci(2 * Math.PI * R * C)} s = ${res(f, 'Hz')}`,
    ]);
  },
  (rng) => {
    const L = pick(rng, [10e-6, 47e-6, 100e-6, 220e-6, 1e-3]);
    const C = pick(rng, [100e-12, 220e-12, 470e-12, 1e-9, 10e-9]);
    const f = 1 / (2 * Math.PI * Math.sqrt(L * C));
    return numeric(ID, `LC oscilátor má rezonančný obvod s indukčnosťou ${q(L, 'H')} a kapacitou ${q(C, 'F')}. Akú frekvenciu vyrába?`, f, 'Hz', [
      '`$f_{0} = @f{1}{2π@s{$L · $C}}`',
      `\`@s{$L · $C} = @s{${q(L, 'H')} · ${q(C, 'F')}}\` = ${sci(Math.sqrt(L * C))} s`,
      `\`$f_{0}\` = 1 / (2π · ${sci(Math.sqrt(L * C))} s) = ${res(f, 'Hz')}`,
    ]);
  },
  (rng) => {
    const R = pick(rng, [10e3, 47e3, 100e3, 220e3, 470e3, 1e6]);
    const C = pick(rng, [1e-6, 10e-6, 47e-6, 100e-6]);
    const t = 1.1 * R * C;
    return numeric(ID, `Časovač 555 v monostabilnom zapojení má \`$R\` = ${q(R, 'Ω')} a \`$C\` = ${q(C, 'F')}. Ako dlho trvá výstupný impulz po spustení?`, t, 's', [
      '`$t = 1,1 · $R · $C`',
      `\`$t\` = 1,1 · ${q(R, 'Ω')} · ${q(C, 'F')} = ${res(t, 's')}`,
    ]);
  },
  (rng) => {
    const up = rng() < 0.5;
    return choice(ID, up
      ? 'Astabilný 555 bliká s frekvenciou 1 Hz. Ako dosiahneš frekvenciu 2 Hz (pri rovnakej striedavosti)?'
      : 'Astabilný 555 vyrába tón 1 kHz. Ako znížiš frekvenciu na 500 Hz (pri rovnakej striedavosti)?',
    up
      ? ['zmenšíš kapacitu C na polovicu', 'zväčšíš kapacitu C na dvojnásobok', 'zvýšiš napájacie napätie na dvojnásobok', 'zväčšíš R1 aj R2 na dvojnásobok']
      : ['zväčšíš kapacitu C na dvojnásobok', 'zmenšíš kapacitu C na polovicu', 'znížiš napájacie napätie na polovicu', 'zmenšíš R1 aj R2 na polovicu'],
    'Frekvencia `$f ≈ @f{1,44}{($R_{1} + 2$R_{2}) · $C}` je nepriamo úmerná kapacite aj odporom. Od napájacieho napätia nezávisí, lebo prahy ⅓ a ⅔ sa menia spolu s ním.',
    rng);
  },
  (rng) => {
    const A = pick(rng, [3, 5, 8, 10, 20, 29, 50]);
    const v = (x: number) => fmt(x, 3);
    return choice(ID, `Zosilňovač oscilátora má zosilnenie \`$A\` = ${A}. Aký musí byť prenos spätnoväzbového člena \`$β\`, aby oscilátor kmital so stálou amplitúdou?`,
      [v(1 / A), v(A), '1', v(1 / (2 * A))],
      `Amplitúdová podmienka \`$β · $A\` = 1 dáva \`$β = @f{1}{$A}\` = 1/${A} = ${v(1 / A)}. Pri väčšom súčine by amplitúda rástla, pri menšom by kmity zanikli.`,
      rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'electronics',
    title: 'Oscilátory a časovač 555',
    summary: 'Podmienky oscilácií, RC oscilátor s Wienovým mostíkom, LC a kryštálový oscilátor, astabilný a monostabilný klopný obvod s časovačom 555.',
    minutes: 15,
    blocks: [
      { t: 'p', text: '**Oscilátor** vyrába periodický signál bez vstupného signálu – mení jednosmernú energiu napájania na striedavú. **Harmonické** oscilátory dávajú sínusový priebeh (RC, LC, kryštálové), **klopné obvody** obdĺžnikový. Oscilátor je v každých hodinách, mikrokontroléri, vysielačke aj v blikači.' },
      { t: 'figure', fig: oscillatorBlockFigure, caption: 'Oscilátor: výstup zosilňovača `$A` sa cez člen spätnej väzby `$β` vracia na jeho vstup. Slučka si sama udržiava kmity.' },
      { t: 'formula', tex: ['$β · $A = 1', '$φ_{A} + $φ_{β} = 0° (k · 360°)'], legend: [['$A', 'zosilnenie zosilňovača', '–'], ['$β', 'prenos člena spätnej väzby', '–'], ['$φ', 'fázový posun v zosilňovači a v spätnej väzbe', '°']] },
      { t: 'p', text: '**Amplitúdová podmienka:** spätná väzba musí presne nahradiť straty – súčin `$β · $A` = 1. **Fázová podmienka:** signál sa po obehu slučkou musí vrátiť vo fáze, spätná väzba je **kladná**. Kmitá sa len na frekvencii, pri ktorej sú obe podmienky splnené. Na rozbeh je `$β · $A` o niečo väčší ako 1 a amplitúdu potom obmedzí nelinearita alebo regulácia zosilnenia.' },
      { t: 'h', text: 'RC oscilátor s Wienovým mostíkom' },
      { t: 'figure', fig: wienFigure, caption: 'Wienov oscilátor: sériový a paralelný člen `$R$C` tvoria kladnú spätnú väzbu na neinvertujúci vstup, delič `$R_{2}`, `$R_{1}` zápornú spätnú väzbu, ktorá nastaví zosilnenie 3.' },
      { t: 'p', text: 'Wienov člen má pri frekvencii `$f_{0}` nulový fázový posun a prenos `$β` = 1/3. Neinvertujúci zosilňovač preto musí mať zosilnenie `$A` = 3, teda `$R_{2} = 2 · $R_{1}`. V praxi sa zosilnenie stabilizuje automaticky (žiarovka, termistor, diódy), aby bol sínusový priebeh čistý. RC oscilátory sa používajú do stoviek kHz – napríklad v tónových generátoroch.' },
      { t: 'formula', tex: ['$f_{0} = @f{1}{2π · $R · $C}', '$A = 1 + @f{$R_{2}}{$R_{1}} = 3'], legend: [['$f_{0}', 'frekvencia oscilácií', 'Hz'], ['$R, $C', 'súčiastky Wienovho člena (v oboch vetvách rovnaké)', 'Ω, F']] },
      {
        t: 'example',
        title: 'Frekvencia Wienovho oscilátora',
        given: ['`$R` = 10 kΩ', '`$C` = 10 nF'],
        steps: [
          '`2π · $R · $C = 2π · 10^{4} · 10^{−8}` = `6,283 · 10^{−4}` s',
          '`$f_{0} = @f{1}{6,283 · 10^{−4}}` = 1 592 Hz',
          'Zosilňovač: pri `$R_{1}` = 10 kΩ potrebuješ `$R_{2}` = 20 kΩ.',
        ],
        result: '`$f_{0}` ≈ 1,59 kHz',
      },
      { t: 'h', text: 'LC oscilátor' },
      { t: 'p', text: 'Frekvenciu LC oscilátora určuje **paralelný rezonančný obvod** – energia sa v ňom prelieva medzi cievkou a kondenzátorom a tranzistor alebo OZ len dopĺňa straty. Spätná väzba sa odoberá z kapacitného deliča (Colpittsov oscilátor) alebo z odbočky cievky (Hartleyho oscilátor). LC oscilátory sa používajú na vysokých frekvenciách – stovky kHz až stovky MHz, napríklad vo vysielačoch. Pri `$L` = 100 µH a `$C` = 1 nF vyjde `$f_{0}` ≈ 503 kHz.' },
      { t: 'formula', tex: '$f_{0} = @f{1}{2π@s{$L · $C}}', legend: [['$L', 'indukčnosť cievky', 'H'], ['$C', 'kapacita kondenzátora', 'F']] },
      { t: 'h', text: 'Kryštálový oscilátor' },
      { t: 'p', text: 'Kremenný výbrus (kryštál) sa vďaka **piezoelektrickému javu** správa ako rezonančný obvod s veľmi vysokou akosťou. Frekvencia je preto mimoriadne stabilná – odchýlka býva len jednotky až desiatky milióntin (ppm). Hodinky používajú kryštál **32 768 Hz** = 2¹⁵: po 15 deleniach dvoma vznikne presne 1 Hz na posun sekundy. Mikrokontroléry majú kryštály rádovo MHz (Arduino UNO 16 MHz).' },
      { t: 'h', text: 'Časovač 555' },
      { t: 'p', text: 'Integrovaný obvod **555** obsahuje delič z troch rovnakých rezistorov (5 kΩ), ktorý vytvorí napätia ⅓ a ⅔ `$U_{CC}`, dva komparátory, klopný obvod RS, vybíjací tranzistor (vývod 7) a výkonový výstup (vývod 3, do asi 200 mA). Bipolárna verzia NE555 pracuje pri napájaní 4,5 až 16 V. Podľa vonkajšieho zapojenia je z neho **astabilný** klopný obvod (generátor impulzov) alebo **monostabilný** (časovač).' },
      { t: 'figure', fig: () => ne555Figure(), caption: 'Astabilné zapojenie 555. Vývody 2 a 6 sledujú napätie kondenzátora, vývod 7 ho vybíja, vývod 5 je cez 10 nF blokovaný proti rušeniu, vývod 4 (RESET) je na napájaní.' },
      { t: 'p', text: 'Po zapnutí sa kondenzátor nabíja cez `$R_{1}` a `$R_{2}`, výstup je v stave H. Keď `$u_{C}` dosiahne ⅔ `$U_{CC}`, horný komparátor preklopí obvod: výstup prejde do L a vývod 7 začne kondenzátor vybíjať cez `$R_{2}`. Pri ⅓ `$U_{CC}` dolný komparátor obvod preklopí späť a dej sa opakuje.' },
      { t: 'explore', build: timerExplorer, caption: 'Zmeň `$R_{1}`, `$R_{2}` a `$C` a sleduj frekvenciu aj striedavosť. Kapacita mení obe časti periódy rovnako, `$R_{1}` predlžuje len stav H.' },
      {
        t: 'formula',
        tex: ['$t_{1} = 0,693 · ($R_{1} + $R_{2}) · $C', '$t_{2} = 0,693 · $R_{2} · $C', '$f = @f{1}{$t_{1} + $t_{2}} ≈ @f{1,44}{($R_{1} + 2 · $R_{2}) · $C}', '$D = @f{$t_{1}}{$t_{1} + $t_{2}}'],
        legend: [
          ['$t_{1}', 'čas stavu H (nabíjanie cez R1 + R2)', 's'],
          ['$t_{2}', 'čas stavu L (vybíjanie cez R2)', 's'],
          ['$D', 'striedavosť (činiteľ plnenia)', '%'],
          ['0,693', '= ln 2 – nabitie z ⅓ na ⅔ trvá 0,693 τ', '–'],
        ],
      },
      {
        t: 'example',
        title: 'Blikač s periódou asi 1 s',
        given: ['`$R_{1}` = 10 kΩ', '`$R_{2}` = 68 kΩ', '`$C` = 10 µF'],
        steps: [
          '`($R_{1} + $R_{2}) · $C` = 78 kΩ · 10 µF = 0,78 s, `$t_{1}` = 0,693 · 0,78 = 0,541 s',
          '`$R_{2} · $C` = 68 kΩ · 10 µF = 0,68 s, `$t_{2}` = 0,693 · 0,68 = 0,471 s',
          '`$T` = 0,541 + 0,471 = 1,012 s, `$f = @f{1}{$T}` = 0,988 Hz',
          '`$D = @f{$R_{1} + $R_{2}}{$R_{1} + 2 · $R_{2}} = @f{78}{146}` = 0,534 = 53,4 %',
        ],
        result: '`$f` ≈ 0,99 Hz, LED svieti 0,54 s a nesvieti 0,47 s',
      },
      { t: 'note', kind: 'tip', text: 'V základnom zapojení je striedavosť vždy viac ako 50 %, lebo nabíjanie ide cez `$R_{1} + $R_{2}`, ale vybíjanie len cez `$R_{2}`. Pre takmer 50 % zvolíš `$R_{2} ≫ $R_{1}`, alebo premostíš `$R_{2}` diódou, aby sa nabíjalo len cez `$R_{1}`.' },
      { t: 'h', text: 'Monostabilný klopný obvod' },
      { t: 'p', text: 'V monostabilnom zapojení je kondenzátor v kľude vybitý a výstup v stave L. Krátky impulz s úrovňou L na spúšťacom vstupe 2 (pod ⅓ `$U_{CC}`) preklopí výstup do H a kondenzátor sa začne nabíjať cez rezistor `$R`. Keď jeho napätie dosiahne ⅔ `$U_{CC}`, obvod sa vráti do kľudu. Dĺžka impulzu nezávisí od dĺžky spúšťacieho impulzu ani od napájacieho napätia – napríklad oneskorené zhasnutie svetla na chodbe.' },
      { t: 'figure', fig: monostableFigure, caption: 'Časový diagram monostabilného 555: krátky spúšťací impulz, nabíjanie kondenzátora na ⅔ `$U_{CC}` a výstupný impulz s dĺžkou `$t`.' },
      { t: 'formula', tex: '$t = 1,1 · $R · $C', legend: [['$t', 'dĺžka výstupného impulzu', 's'], ['1,1', '= ln 3 – nabitie z 0 na ⅔ trvá 1,1 τ', '–']] },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aké dve podmienky musí splniť oscilátor, aby kmital so stálou amplitúdou?',
      options: ['`$β · $A` = 1 a celkový fázový posun v slučke 0° (360°)', '`$β · $A` = 0 a fázový posun 90°', '`$β · $A` = 1 a záporná spätná väzba s posunom 180°', 'veľký vstupný signál a nulová spätná väzba'],
      explanation: 'Amplitúdová podmienka hovorí, že spätná väzba musí nahradiť straty, fázová, že signál sa musí vrátiť vo fáze – spätná väzba je kladná.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo sa v hodinkách používa kryštál s frekvenciou 32 768 Hz?',
      options: ['32 768 = 2¹⁵, po 15 deleniach dvoma vznikne presne 1 Hz', 'je to násobok frekvencie siete 50 Hz', 'kryštál s inou frekvenciou sa nedá vyrobiť', 'pri tejto frekvencii nespotrebúva žiadnu energiu'],
      explanation: 'Delička dvoma je najjednoduchší číslicový obvod (klopný obvod T). Pätnásť deličiek za sebou zmení 32 768 Hz na 1 Hz.',
    },
    {
      lessonId: ID,
      prompt: 'Medzi akými napätiami sa nabíja a vybíja kondenzátor v astabilnom zapojení 555?',
      options: ['medzi ⅓ a ⅔ napájacieho napätia', 'medzi 0 V a napájacím napätím', 'medzi 0,7 V a napájacím napätím', 'medzi −`$U_{CC}` a +`$U_{CC}`'],
      explanation: 'Prahy určuje vnútorný delič z troch rovnakých rezistorov. Dolný komparátor reaguje na ⅓, horný na ⅔ `$U_{CC}`.',
    },
    {
      lessonId: ID,
      prompt: 'Cez ktorý rezistor sa vybíja kondenzátor v astabilnom zapojení 555?',
      options: ['len cez `$R_{2}` do vývodu 7', 'cez `$R_{1}` aj `$R_{2}`', 'len cez `$R_{1}`', 'cez výstup 3'],
      explanation: 'Vybíjací tranzistor na vývode 7 spojí uzol medzi `$R_{1}` a `$R_{2}` so zemou. Kondenzátor sa vybíja cez `$R_{2}`, `$R_{1}` vtedy len zbytočne odoberá prúd zo zdroja.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo je striedavosť základného astabilného zapojenia 555 vždy väčšia ako 50 %?',
      options: ['nabíja sa cez `$R_{1} + $R_{2}`, vybíja len cez `$R_{2}`, takže `$t_{1} > $t_{2}`', 'výstup je stále v stave H', 'kondenzátor sa vybíja pomalšie, ako sa nabíja', 'kvôli kondenzátoru na vývode 5'],
      explanation: '`$t_{1} = 0,693 · ($R_{1} + $R_{2}) · $C` je vždy dlhší ako `$t_{2} = 0,693 · $R_{2} · $C`.',
    },
    {
      lessonId: ID,
      prompt: 'Monostabilný 555 má `$R` = 100 kΩ a `$C` = 10 µF. Ako dlho trvá výstupný impulz?',
      options: ['1,1 s', '0,69 s', '1 s', '11 s'],
      explanation: '`$t = 1,1 · $R · $C` = 1,1 · 100 kΩ · 10 µF = 1,1 · 1 s = 1,1 s.',
    },
    {
      lessonId: ID,
      prompt: 'Aký oscilátor sa používa na vysoké frekvencie (rádovo MHz až stovky MHz)?',
      options: ['LC oscilátor', 'RC oscilátor s Wienovým mostíkom', 'astabilný časovač 555', 'Graetzov mostík'],
      explanation: 'Pri vysokých frekvenciách stačí malá indukčnosť a kapacita, LC obvod má vysokú akosť. RC oscilátory a 555 sa používajú na nižších frekvenciách.',
    },
  ],
  generators,
};

export default mod;
