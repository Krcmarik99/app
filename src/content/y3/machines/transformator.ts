import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt, formatSI } from '../../../lib/units';
import { n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import {
  coreTypesFigure, niceMax, transformerConstructionFigure, transformerSymbolsFigure,
} from '../../../ui/fig-machines';
import { choice } from '../util';

const ID = 'transformator';

/** Ideálny transformátor so záťažou: časové priebehy u1, u2 a odčítané prúdy. */
function transformerExplorer(): HTMLElement {
  const turns = (v: number) => `${fmt(Math.round(v), 4)} z`;
  return explorer({
    title: 'Ideálny transformátor so záťažou',
    params: [
      { key: 'u1', label: 'Primárne napätie `$U_{1}`', unit: 'V', min: 12, max: 400, value: 230 },
      { key: 'n1', label: 'Závity primáru `$N_{1}`', unit: '', min: 100, max: 2000, value: 1150, format: turns },
      { key: 'n2', label: 'Závity sekundáru `$N_{2}`', unit: '', min: 20, max: 2000, value: 120, log: true, format: turns },
      { key: 'r', label: 'Odpor záťaže `$R`', unit: 'Ω', min: 1, max: 1000, value: 12, log: true },
    ],
    draw: ({ u1, n1, n2, r }) => {
      const N1 = Math.round(n1);
      const N2 = Math.round(n2);
      const p = N1 / N2;
      const U2 = u1 / p;
      const I2 = U2 / r;
      const I1 = I2 / p;
      const w = 2 * Math.PI * 50;
      const top = niceMax(Math.max(u1, U2) * Math.SQRT2 * 1.08);
      const chart = lineChart({
        ariaLabel: `Primárne napätie ${fmt(u1, 3)} V a sekundárne napätie ${fmt(U2, 3)} V pri prevode ${fmt(p, 3)}`,
        width: 460,
        height: 250,
        x: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40], format: (v) => `${v}`, label: 't [ms]' },
        y: { min: -top, max: top, ticks: [-top, -top / 2, 0, top / 2, top], format: (v) => fmt(v, 3), label: 'u [V]' },
        series: [
          { points: sample((t) => u1 * Math.SQRT2 * Math.sin((w * t) / 1000), 0, 40, 240), className: 'thin' },
          { points: sample((t) => U2 * Math.SQRT2 * Math.sin((w * t) / 1000), 0, 40, 240), className: 'copper' },
        ],
        legend: [{ label: 'u₁ (primár)', className: 'thin' }, { label: 'u₂ (sekundár)', className: 'copper' }],
      });
      const kind = p > 1.02 ? 'Znižovací transformátor' : p < 0.98 ? 'Zvyšovací transformátor' : 'Prevod je približne 1 – oddeľovací transformátor';
      return {
        chart,
        readouts: [
          ['Prevod `$p`', fmt(p, 3)],
          ['`$U_{2}`', formatSI(U2, 'V', 3)],
          ['`$I_{2}`', formatSI(I2, 'A', 3)],
          ['`$I_{1}`', formatSI(I1, 'A', 3)],
          ['`$S_{1} = $S_{2}`', formatSI(U2 * I2, 'VA', 3)],
        ],
        note: `${kind}: napätie sa zmení ${fmt(p >= 1 ? p : 1 / p, 3)}-krát, prúd v opačnom pomere. Zmena záťaže mení prúdy, ale nie napätie \`$U_{2}\`.`,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const U1 = pick(rng, [230, 400, 230, 120]);
    const N1 = pick(rng, [460, 690, 920, 1150, 1380]);
    const N2 = Math.round(N1 * pick(rng, [0.05, 0.1, 0.2, 0.25, 0.5, 2, 4]));
    const U2 = (U1 * N2) / N1;
    return numeric(ID, `Primárne vinutie transformátora má ${n(N1)} závitov a sekundárne ${n(N2)} závitov. Aké napätie je naprázdno na sekundári, keď je primár pripojený na ${q(U1, 'V')}?`, U2, 'V', [
      `\`$p = @f{$N_{1}}{$N_{2}} = @f{${n(N1)}}{${n(N2)}}\` = ${n(N1 / N2)} – transformátor je ${N1 > N2 ? 'znižovací' : 'zvyšovací'}.`,
      `\`$U_{2} = $U_{1} · @f{$N_{2}}{$N_{1}} = ${n(U1)} · @f{${n(N2)}}{${n(N1)}}\` = ${res(U2, 'V')}`,
    ]);
  },
  (rng) => {
    const w = pick(rng, [2, 3, 4, 5, 6]);
    const U2 = pick(rng, [6, 9, 12, 15, 18, 24, 48]);
    const N1 = w * 230;
    const N2 = w * U2;
    return numeric(ID, `Primárne vinutie transformátora pre sieť 230 V má ${n(N1)} závitov. Koľko závitov musí mať sekundárne vinutie, aby dávalo naprázdno napätie ${q(U2, 'V')}?`, N2, '', [
      'Napätia sú v rovnakom pomere ako počty závitov: `@f{$N_{2}}{$N_{1}} = @f{$U_{2}}{$U_{1}}`.',
      `\`$N_{2} = $N_{1} · @f{$U_{2}}{$U_{1}} = ${n(N1)} · @f{${n(U2)}}{230}\` = **${n(N2)}** závitov (na 1 V pripadajú ${n(w)} ${w < 5 ? 'závity' : 'závitov'}).`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => {
    const U2 = pick(rng, [6, 12, 24, 48]);
    const I2 = pick(rng, [0.5, 1, 2, 2.5, 4, 5, 8, 10]);
    const I1 = (I2 * U2) / 230;
    return numeric(ID, `Ideálny transformátor 230 V / ${q(U2, 'V')} napája spotrebič, ktorý odoberá prúd ${q(I2, 'A')}. Aký prúd tečie primárnym vinutím?`, I1, 'A', [
      `Prevod \`$p = @f{230}{${n(U2)}}\` = ${n(230 / U2)}; prúdy sú v obrátenom pomere ako napätia.`,
      `Zo \`$U_{1} · $I_{1} = $U_{2} · $I_{2}\`: \`$I_{1} = @f{$U_{2} · $I_{2}}{$U_{1}} = @f{${n(U2)} · ${n(I2)}}{230}\` = ${res(I1, 'A')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [230, 230, 400]);
    const S = pick(rng, [6, 8, 10, 12, 15, 20, 25]);
    const B = pick(rng, [1, 1.1, 1.2, 1.3]);
    const phi = Number((B * S * 1e-4).toPrecision(6));
    const N = U / (4.44 * 50 * phi);
    return numeric(ID, `Navrhuješ primárne vinutie transformátora pre ${q(U, 'V')}, 50 Hz. Jadro má prierez ${n(S)} cm² a magnetická indukcia v ňom má byť ${n(B)} T. Koľko závitov musí mať primárne vinutie?`, N, '', [
      `\`$S_{Fe}\` = ${n(S)} cm² = ${n(S * 1e-4)} m²`,
      `\`$Φ_{m} = $B_{m} · $S_{Fe}\` = ${n(B)} · ${n(S * 1e-4)} = ${n(phi)} Wb`,
      `\`$N_{1} = @f{$U_{1}}{4,44 · $f · $Φ_{m}} = @f{${n(U)}}{4,44 · 50 · ${n(phi)}}\` = **${n(N, 4)}** závitov (prakticky ${n(Math.ceil(N))})`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const S = pick(rng, [8, 10, 12, 16, 20]);
    const Bt = pick(rng, [1, 1.1, 1.2, 1.3, 1.4]);
    const N = Math.round(230 / (4.44 * 50 * Bt * S * 1e-4) / 10) * 10;
    const B = 230 / (4.44 * 50 * N * S * 1e-4);
    return numeric(ID, `Primárne vinutie transformátora 230 V, 50 Hz má ${n(N)} závitov a jadro má prierez ${n(S)} cm². Aká je maximálna magnetická indukcia v jadre?`, B, 'T', [
      'Z `$U = 4,44 · $f · $N · $B_{m} · $S_{Fe}` vyjadríme indukciu.',
      `\`$B_{m} = @f{$U}{4,44 · $f · $N · $S_{Fe}} = @f{230}{4,44 · 50 · ${n(N)} · ${n(S * 1e-4)}}\` = **${n(B, 3)} T**`,
      B > 1.62 ? 'Taká indukcia je už veľká – jadro by sa presycovalo a rástol by prúd naprázdno.' : 'Je to bežná hodnota pre transformátorové plechy.',
    ], { fixedUnit: true });
  },
  (rng) => {
    const Z2 = pick(rng, [4, 8, 16]);
    const p = pick(rng, [5, 8, 10, 12, 15, 20, 25]);
    const Z1 = p * p * Z2;
    if (rng() < 0.5) {
      return numeric(ID, `Reproduktor s impedanciou ${q(Z2, 'Ω')} je pripojený cez transformátor s prevodom ${n(p)}. Akú impedanciu „vidí“ zdroj na primárnej strane?`, Z1, 'Ω', [
        `\`$Z_{1} = $p^{2} · $Z_{2} = ${n(p)}^{2} · ${n(Z2)}\` = ${res(Z1, 'Ω')}`,
      ]);
    }
    return numeric(ID, `Zosilňovač potrebuje záťaž ${q(Z1, 'Ω')}, reproduktor má impedanciu ${q(Z2, 'Ω')}. Aký prevod musí mať prispôsobovací transformátor?`, p, '', [
      `\`$p = @s{@f{$Z_{1}}{$Z_{2}}} = @s{@f{${n(Z1)}}{${n(Z2)}}} = @s{${n(p * p)}}\` = **${n(p)}**`,
    ], { fixedUnit: true });
  },
  (rng) => {
    const N1 = pick(rng, [200, 300, 500, 1000, 1200, 2000]);
    const N2 = pick(rng, [50, 100, 2400, 4000, 6000]);
    const p = N1 / N2;
    const pt = n(p, 3);
    const inv = n(1 / p, 3);
    const up = p < 1;
    return choice(ID, `Transformátor má na primári ${n(N1)} závitov a na sekundári ${n(N2)} závitov. Aký je to transformátor?`,
      up
        ? [`zvyšovací s prevodom ${pt}`, `znižovací s prevodom ${pt}`, `zvyšovací s prevodom ${inv}`, `znižovací s prevodom ${inv}`]
        : [`znižovací s prevodom ${pt}`, `zvyšovací s prevodom ${pt}`, `znižovací s prevodom ${inv}`, `zvyšovací s prevodom ${inv}`],
      `Prevod \`$p = @f{$N_{1}}{$N_{2}} = @f{${n(N1)}}{${n(N2)}}\` = ${pt}. ${up ? 'Sekundár má viac závitov, napätie sa zvýši (p < 1).' : 'Sekundár má menej závitov, napätie sa zníži (p > 1).'}`,
      rng);
  },
  (rng) => {
    const variants: [string, [string, string, string, string], string][] = [
      ['Prečo transformátor nepracuje na jednosmerné napätie?',
        ['stály prúd vytvorí stály magnetický tok, ktorý neindukuje napätie', 'jednosmerný prúd neprejde cez vinutie z lakovaného drôtu', 'jadro z plechov jednosmerný tok nevedie', 'jednosmerné napätie by sa transformovalo len v pomere 1 : 1'],
        'Napätie sa indukuje len pri **zmene** magnetického toku. Na jednosmernom napätí by tok bol stály, sekundár by nemal napätie a primárny prúd by obmedzoval iba malý odpor vinutia – vinutie by sa prehrialo.'],
      ['Prečo je jadro transformátora z navzájom izolovaných plechov, a nie z plného železa?',
        ['izolované plechy obmedzia vírivé prúdy, a tým straty a zahrievanie jadra', 'plechy majú väčšiu permeabilitu ako plné železo', 'aby sa zväčšil rozptylový tok', 'aby jadro nebolo vodivo spojené s vinutím'],
        'Striedavý tok indukuje napätie aj v samotnom jadre. V plnom železe by tiekli veľké vírivé prúdy; izolácia medzi plechmi ich dráhy preruší.'],
      ['Na ktorej strane znižovacieho transformátora 230 V / 12 V je vinutie z hrubšieho drôtu?',
        ['na sekundárnej – tečie ňou väčší prúd', 'na primárnej – je na nej väčšie napätie', 'na oboch je rovnaký drôt, líšia sa len počtom závitov', 'na primárnej – tečie ňou väčší prúd'],
        'Prúdy sú v obrátenom pomere ako napätia. Sekundárom 12 V tečie asi 19-krát väčší prúd ako primárom, preto potrebuje väčší prierez drôtu.'],
      ['Akú frekvenciu má sekundárne napätie transformátora pripojeného na sieť 230 V / 50 Hz?',
        ['50 Hz – rovnakú ako primárne napätie', 'menšiu v pomere prevodu', 'väčšiu v pomere prevodu', '100 Hz'],
        'Obe vinutia sú na tom istom striedavom toku, preto má sekundárne napätie rovnakú frekvenciu. Transformátor mení len veľkosť napätia a prúdu.'],
      ['Čo sa stane s prúdom primárneho vinutia, keď sa zväčší odber zo sekundára?',
        ['zväčší sa – primár odoberá zo siete toľko výkonu, koľko odovzdá sekundár (plus straty)', 'nezmení sa, primár odoberá stále len prúd naprázdno', 'zmenší sa', 'zmení sa len jeho frekvencia'],
        'Sekundárny prúd vytvára tok, ktorý pôsobí proti toku primáru. Primár preto odoberá väčší prúd, aby sa výkony vyrovnali: `$U_{1} · $I_{1} ≈ $U_{2} · $I_{2}`.'],
    ];
    const [prompt, opts, expl] = pick(rng, variants);
    return choice(ID, prompt, opts, expl, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'machines',
    title: 'Transformátor: princíp a prevod',
    summary: 'Konštrukcia transformátora, vzájomná indukcia, indukované napätie 4,44 · f · N · Φm, prevod napätí, prúdov a impedancií.',
    minutes: 15,
    blocks: [
      { t: 'p', text: 'Transformátor je netočivý elektrický stroj, ktorý mení striedavé napätie jednej veľkosti na striedavé napätie inej veľkosti **pri rovnakej frekvencii**. Energiu neprenáša vodivým spojením, ale striedavým magnetickým tokom v spoločnom jadre. Bez transformátorov by nebol možný hospodárny prenos elektrickej energie: generátory v elektrárňach vyrábajú napätie rádovo 10 až 25 kV, prenosová sústava pracuje s napätím 220 a 400 kV, distribučné siete so 110 kV a 22 kV a spotrebiče s 230/400 V.' },
      { t: 'h', text: 'Konštrukcia transformátora' },
      { t: 'figure', fig: transformerConstructionFigure, caption: 'Primárne vinutie pripojené na napätie `$U_{1}` vytvorí v jadre striedavý magnetický tok `$Φ`, ktorý prechádza aj sekundárnym vinutím a indukuje v ňom napätie `$U_{2}`. Na obrázku sú vinutia pre prehľadnosť na rôznych stĺpoch – v skutočnosti sa navíjajú na seba, aby bol rozptylový tok čo najmenší.' },
      {
        t: 'list',
        items: [
          '**Jadro** (magnetický obvod) je zložené z tenkých plechov z transformátorovej (elektrotechnickej) ocele s prímesou kremíka, hrubých približne 0,3 až 0,5 mm a navzájom izolovaných. Vedie magnetický tok z jedného vinutia do druhého.',
          '**Primárne vinutie** (`$N_{1}` závitov) sa pripája na zdroj – energiu odoberá.',
          '**Sekundárne vinutie** (`$N_{2}` závitov) napája spotrebič – energiu odovzdáva.',
          'Vinutia sú z medeného (pri veľkých transformátoroch aj hliníkového) vodiča izolovaného lakom alebo papierom. Veľké transformátory sú v nádobe s transformátorovým olejom, ktorý izoluje a chladí.',
        ],
      },
      { t: 'note', kind: 'tip', text: 'Prečo plechy? Striedavý magnetický tok indukuje napätie aj v samotnom železe jadra. V plnom jadre by tiekli veľké **vírivé prúdy**, ktoré by ho zahrievali. Izolované plechy dráhy vírivých prúdov prerušia a kremík zväčšuje rezistivitu ocele – straty vírivými prúdmi tak výrazne klesnú.' },
      { t: 'figure', fig: coreTypesFigure, caption: 'Jadrový (stĺpový) typ má vinutia na dvoch stĺpoch, plášťový typ na strednom stĺpe, ktorého tok sa vracia oboma bočnými stĺpmi (plechy tvaru E a I – malé sieťové transformátory). Vinutie nižšieho napätia (NN) je bližšie pri jadre, vinutie vyššieho napätia (VN) navonok.' },
      { t: 'h', text: 'Princíp činnosti' },
      { t: 'p', text: 'Primárne vinutie pripojené na striedavé napätie `$U_{1}` odoberá malý magnetizačný prúd, ktorý v jadre vytvorí striedavý magnetický tok `$Φ`. Tok sa uzatvára jadrom a prechádza aj sekundárnym vinutím. Podľa zákona elektromagnetickej indukcie sa v **každom závite oboch vinutí indukuje rovnaké napätie** – napätie vinutia je preto úmerné jeho počtu závitov. Po pripojení záťaže tečie sekundárnym vinutím prúd `$I_{2}` a primár odoberá zo zdroja zodpovedajúci prúd `$I_{1}`. Tento jav sa nazýva **vzájomná indukcia**.' },
      { t: 'note', kind: 'warn', text: 'Transformátor pracuje **iba so striedavým prúdom**. Jednosmerný prúd vytvorí stály magnetický tok, ktorý neindukuje žiadne napätie. Prúd primárneho vinutia by navyše obmedzoval len malý činný odpor vinutia – tiekol by veľký prúd a vinutie by sa prehrialo a zničilo.' },
      { t: 'h', text: 'Indukované napätie vinutia' },
      {
        t: 'formula',
        tex: ['$U = 4,44 · $f · $N · $Φ_{m}', '$Φ_{m} = $B_{m} · $S_{Fe}'],
        legend: [
          ['$U', 'efektívna hodnota napätia indukovaného vo vinutí', 'V'],
          ['$f', 'frekvencia', 'Hz'],
          ['$N', 'počet závitov vinutia', '–'],
          ['$Φ_{m}', 'maximálna hodnota (amplitúda) magnetického toku', 'Wb'],
          ['$B_{m}', 'maximálna magnetická indukcia v jadre', 'T'],
          ['$S_{Fe}', 'prierez jadra (železa)', 'm²'],
        ],
      },
      { t: 'p', text: 'Číslo 4,44 vzniklo ako `@f{2π}{@s{2}}` – tok sa mení sínusovo a počítame efektívnu hodnotu napätia. Indukcia v jadre z transformátorových plechov sa volí približne 1 až 1,6 T; pri väčšej by sa jadro presycovalo a prudko by rástol magnetizačný prúd. Zo vzťahu tiež vyplýva, že na jeden volt pripadá v oboch vinutiach rovnaký počet závitov `@f{$N}{$U} = @f{1}{4,44 · $f · $Φ_{m}}`.' },
      {
        t: 'example',
        title: 'Počet závitov sieťového transformátora',
        given: ['`$U_{1}` = 230 V, `$U_{2}` = 12 V, `$f` = 50 Hz', '`$S_{Fe}` = 10 cm² = 0,001 m²', '`$B_{m}` = 1,2 T'],
        steps: [
          '`$Φ_{m} = $B_{m} · $S_{Fe}` = 1,2 · 0,001 = 0,0012 Wb',
          '`$N_{1} = @f{$U_{1}}{4,44 · $f · $Φ_{m}} = @f{230}{4,44 · 50 · 0,0012}` = 863 závitov',
          'Závitov na volt: `@f{863}{230}` = 3,75, preto `$N_{2}` = 3,75 · 12 = 45 závitov',
        ],
        result: '`$N_{1}` ≈ 863 závitov, `$N_{2}` ≈ 45 závitov (sekundár sa v praxi navinie o niekoľko percent viac, aby sa vyrovnal úbytok napätia pri zaťažení)',
      },
      { t: 'h', text: 'Prevod transformátora' },
      {
        t: 'formula',
        tex: '$p = @f{$N_{1}}{$N_{2}} = @f{$U_{1}}{$U_{2}} = @f{$I_{2}}{$I_{1}}',
        legend: [
          ['$p', 'prevod transformátora', '–'],
          ['$N_{1}, $N_{2}', 'počty závitov primárneho a sekundárneho vinutia', '–'],
          ['$U_{1}, $U_{2}', 'primárne a sekundárne napätie', 'V'],
          ['$I_{1}, $I_{2}', 'primárny a sekundárny prúd', 'A'],
        ],
      },
      { t: 'p', text: 'Vzťahy presne platia pre **ideálny transformátor** – bez strát a bez rozptylového toku. Taký transformátor odoberá zo siete rovnaký výkon, aký dodáva spotrebiču: `$S_{1} = $S_{2}`, teda `$U_{1} · $I_{1} = $U_{2} · $I_{2}`. Napätie aj prúd sa menia, ale v obrátenom pomere: **na strane nižšieho napätia tečie väčší prúd**, a preto má táto strana vinutie z hrubšieho drôtu. Veľké transformátory majú účinnosť nad 98 %, takže ideálny transformátor je dobrým priblížením.' },
      {
        t: 'list',
        items: [
          '`$p` > 1 – **znižovací** transformátor (`$U_{2}` < `$U_{1}`), napríklad 230 V / 12 V alebo distribučný 22 kV / 0,4 kV,',
          '`$p` < 1 – **zvyšovací** transformátor (`$U_{2}` > `$U_{1}`), napríklad blokový transformátor v elektrárni,',
          '`$p` = 1 – **oddeľovací** transformátor 230 V / 230 V, ktorý galvanicky oddelí spotrebič od siete.',
        ],
      },
      { t: 'figure', fig: transformerSymbolsFigure, caption: 'Schematické značky transformátora: a) dve cievky so železným jadrom (dve rovnobežné čiary), b) značka podľa STN EN 60617 – každé vinutie je jedna kružnica.' },
      {
        t: 'example',
        title: 'Prúdy znižovacieho transformátora',
        given: ['`$U_{1}` = 230 V, `$U_{2}` = 24 V', '`$N_{1}` = 1 150 závitov', 'záťaž `$R` = 12 Ω'],
        steps: [
          '`$p = @f{$U_{1}}{$U_{2}} = @f{230}{24}` = 9,583',
          '`$N_{2} = @f{$N_{1}}{$p} = @f{1 150 · 24}{230}` = 120 závitov',
          '`$I_{2} = @f{$U_{2}}{$R} = @f{24}{12}` = 2 A',
          '`$I_{1} = @f{$I_{2}}{$p} = @f{2}{9,583}` = 0,209 A',
          'Kontrola: `$S_{1}` = 230 · 0,209 = 48 VA, `$S_{2}` = 24 · 2 = 48 VA',
        ],
        result: '`$N_{2}` = 120 závitov, `$I_{2}` = 2 A, `$I_{1}` ≈ 0,21 A',
      },
      { t: 'explore', build: transformerExplorer, caption: 'Zmeň počty závitov a odpor záťaže. Napätie `$u_{2}` je v ideálnom transformátore vo fáze s `$u_{1}` a jeho veľkosť určuje iba prevod; záťaž mení len prúdy.' },
      { t: 'h', text: 'Impedančný prevod' },
      { t: 'p', text: 'Spotrebič s impedanciou `$Z_{2}` pripojený na sekundár sa zo strany primáru javí ako impedancia `$Z_{1}`. Dosadením `$U_{1} = $p · $U_{2}` a `$I_{1} = @f{$I_{2}}{$p}` dostaneme vzťah nižšie. Transformátor tak môže **prispôsobiť impedanciu** záťaže zdroju – napríklad pripojiť reproduktor s impedanciou 4 až 8 Ω k elektrónkovému zosilňovaču, ktorý potrebuje záťaž niekoľko kiloohmov. Zdroj odovzdá najväčší výkon, keď sa impedancia záťaže rovná jeho vnútornej impedancii.' },
      {
        t: 'formula',
        tex: ['$Z_{1} = @f{$U_{1}}{$I_{1}} = $p^{2} · $Z_{2}', '$p = @s{@f{$Z_{1}}{$Z_{2}}}'],
        legend: [['$Z_{1}', 'impedancia prepočítaná na primárnu stranu', 'Ω'], ['$Z_{2}', 'impedancia záťaže na sekundári', 'Ω']],
      },
      {
        t: 'example',
        title: 'Výstupný transformátor zosilňovača',
        given: ['reproduktor `$Z_{2}` = 8 Ω', 'požadovaná záťaž zosilňovača `$Z_{1}` = 5 kΩ', 'primár `$N_{1}` = 2 500 závitov'],
        steps: [
          '`$p = @s{@f{$Z_{1}}{$Z_{2}}} = @s{@f{5 000}{8}} = @s{625}` = 25',
          '`$N_{2} = @f{$N_{1}}{$p} = @f{2 500}{25}` = 100 závitov',
        ],
        result: '`$p` = 25, sekundár má 100 závitov',
      },
      { t: 'note', kind: 'remember', text: 'Napätia sú v **priamom** pomere počtov závitov, prúdy v **obrátenom** pomere a impedancie v pomere **druhej mocniny** prevodu. Frekvencia sa transformáciou nemení.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Prečo je jadro transformátora zložené z navzájom izolovaných plechov?',
      options: ['aby sa obmedzili vírivé prúdy a straty v železe', 'aby sa jadro dalo ľahšie ohýbať', 'aby sa zväčšil odpor vinutia', 'aby jadro nebolo magnetické'],
      explanation: 'Striedavý tok indukuje v jadre vírivé prúdy. Izolované plechy prerušia ich dráhy, takže sa jadro menej zahrieva.',
    },
    {
      lessonId: ID,
      prompt: 'Čo sa stane, keď transformátor 230 V / 12 V pripojíš na jednosmerné napätie 230 V?',
      options: ['netransformuje; primárom tečie veľký prúd obmedzený len odporom vinutia a vinutie sa môže zničiť', 'na sekundári bude jednosmerné napätie 12 V', 'pracuje normálne, len s menšou účinnosťou', 'na sekundári bude dvojnásobné napätie'],
      explanation: 'Stály prúd vytvorí stály tok, ktorý neindukuje napätie – nevzniká ani sekundárne napätie, ani indukované protinapätie v primári. Prúd obmedzuje iba malý odpor vinutia.',
    },
    {
      lessonId: ID,
      prompt: 'Transformátor má `$N_{1}` = 1 000 a `$N_{2}` = 50 závitov. Aké napätie je na sekundári pri `$U_{1}` = 230 V?',
      options: ['11,5 V', '4 600 V', '23 V', '46 V'],
      explanation: 'Prevod je `$p` = 1 000 / 50 = 20, teda `$U_{2}` = 230 / 20 = 11,5 V. Hodnota 4 600 V by vyšla pri zámene vinutí.',
    },
    {
      lessonId: ID,
      prompt: 'Ktoré vinutie znižovacieho transformátora má väčší prierez drôtu?',
      options: ['sekundárne, lebo ním tečie väčší prúd', 'primárne, lebo je na ňom väčšie napätie', 'obe rovnaký, líšia sa len počtom závitov', 'primárne, lebo ním tečie väčší prúd'],
      explanation: 'Pri rovnakom výkone je na strane nižšieho napätia väčší prúd: `$I_{2} = $p · $I_{1}`. Hrubší drôt má menší odpor a menej sa zahrieva.',
    },
    {
      lessonId: ID,
      prompt: 'Reproduktor 4 Ω je pripojený cez transformátor s prevodom 10. Akú impedanciu „vidí“ zdroj na primári?',
      options: ['400 Ω', '40 Ω', '0,4 Ω', '0,04 Ω'],
      explanation: 'Impedancia sa prepočíta druhou mocninou prevodu: `$Z_{1} = $p^{2} · $Z_{2}` = 100 · 4 = 400 Ω.',
    },
    {
      lessonId: ID,
      prompt: 'Čo vyjadruje vzťah `$U = 4,44 · $f · $N · $Φ_{m}`?',
      options: ['efektívnu hodnotu napätia indukovaného vo vinutí', 'maximálnu hodnotu prúdu naprázdno', 'výkon transformátora', 'straty v železe'],
      explanation: 'Je to transformátorová rovnica: napätie vinutia je úmerné frekvencii, počtu závitov a amplitúde toku. Konštanta 4,44 = 2π / √2.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je ideálny transformátor?',
      options: ['bez strát a bez rozptylového toku, takže `$S_{1} = $S_{2}`', 's prevodom presne 1', 'pracujúci na jednosmerné napätie', 'bez železného jadra'],
      explanation: 'Ideálny transformátor nemá straty v železe ani vo vinutí a celý tok prechádza oboma vinutiami. Skutočné veľké transformátory sa mu blížia – majú účinnosť nad 98 %.',
    },
  ],
  generators,
};

export default mod;
