import type { LessonModule } from '../../module';
import { pick } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { b, n, numeric, q, res, type Generator } from '../../../practice/helpers';
import { lineChart, sample } from '../../../ui/chart';
import { explorer } from '../../../ui/explorer';
import { compensationFigure, phasorDiagram } from '../../../ui/fig-ac';
import { impedanceTriangle } from '../../../ui/figures';
import { choice, rad } from '../util';

const ID = 'vykon-striedavy';

/** Okamžité hodnoty u, i a p pri fázovom posune φ (prúd zaostáva o φ). */
function powerExplorer(): HTMLElement {
  return explorer({
    title: 'Okamžitý výkon pri fázovom posune',
    params: [
      { key: 'phi', label: 'Fázový posun `$φ`', unit: '°', min: -90, max: 90, value: 37, format: (v) => `${fmt(v, 3)}°` },
    ],
    draw: ({ phi }) => {
      const U = 230;
      const I = 10;
      const p = rad(phi);
      const um = U * Math.SQRT2;
      const im = I * Math.SQRT2;
      const P = U * I * Math.cos(p);
      const w = 2 * Math.PI * 50;
      const t = (ms: number) => ms / 1000;
      // Prúd zaostáva za napätím o φ (kladné φ = induktívny charakter).
      const u = (ms: number) => um * Math.sin(w * t(ms)) / 100;
      const i = (ms: number) => im * Math.sin(w * t(ms) - p) / 5;
      const pw = (ms: number) => (um * Math.sin(w * t(ms)) * im * Math.sin(w * t(ms) - p)) / 1000;
      const chart = lineChart({
        ariaLabel: `Napätie, prúd a okamžitý výkon pri fázovom posune ${fmt(phi, 3)}°`,
        width: 460,
        height: 250,
        x: { min: 0, max: 40, ticks: [0, 10, 20, 30, 40], format: (v) => `${v}`, label: 't [ms]' },
        y: { min: -5, max: 7, ticks: [-4, -2, 0, 2, 4, 6], format: (v) => fmt(v), label: 'u/100 V · i/5 A · p [kW]' },
        series: [
          { points: sample(u, 0, 40, 240), className: 'thin' },
          { points: sample(i, 0, 40, 240), className: 'green thin' },
          { points: sample(pw, 0, 40, 240), className: 'copper' },
        ],
        hlines: [{ y: P / 1000, label: `P = ${fmt(P / 1000, 3)} kW` }],
        legend: [{ label: 'u', className: 'thin' }, { label: 'i', className: 'green' }, { label: 'p = u · i', className: 'copper' }],
      });
      const Q = U * I * Math.sin(p);
      return {
        chart,
        readouts: [
          ['`cos $φ`', fmt(Math.cos(p), 3)],
          ['Činný `$P`', `${fmt(P, 4)} W`],
          ['Jalový `$Q`', `${fmt(Q, 4)} var`],
          ['Zdanlivý `$S`', `${fmt(U * I, 4)} VA`],
        ],
        note: Math.abs(phi) > 85
          ? 'Pri posune 90° je výkon polovicu periódy kladný a polovicu záporný – energia sa len prelieva medzi zdrojom a poľom cievky alebo kondenzátora a činný výkon je nulový.'
          : `Napätie 230 V, prúd 10 A. Keď je výkon záporný, energia sa vracia zo spotrebiča do zdroja. Priemer výkonu (čiarkovaná čiara) je činný výkon.`,
      };
    },
  });
}

const generators: Generator[] = [
  (rng) => {
    const U = pick(rng, [230, 400, 120, 24]);
    const I = pick(rng, [0.5, 2, 4.5, 8, 12, 16]);
    const c = pick(rng, [0.6, 0.7, 0.8, 0.85, 0.9, 0.95]);
    const P = U * I * c;
    return numeric(ID, `Spotrebič na napätí ${q(U, 'V')} odoberá prúd ${q(I, 'A')} pri účinníku \`cos $φ\` = ${n(c)}. Aký je jeho činný výkon?`, P, 'W', [
      '`$P = $U · $I · cos $φ`',
      `\`$P\` = ${n(U)} · ${n(I)} · ${n(c)} = ${res(P, 'W')}`,
    ]);
  },
  (rng) => {
    const U = pick(rng, [230, 400]);
    const I = pick(rng, [2, 5, 6.3, 10, 16]);
    const c = pick(rng, [0.6, 0.7, 0.8, 0.85]);
    const S = U * I;
    const Q = S * Math.sqrt(1 - c * c);
    return numeric(ID, `Motor na napätí ${q(U, 'V')} odoberá ${q(I, 'A')} pri \`cos $φ\` = ${n(c)}. Aký jalový výkon odoberá zo siete?`, Q, 'var', [
      `\`$S = $U · $I\` = ${n(U)} · ${n(I)} = ${n(S)} VA`,
      `\`sin $φ = @s{1 − cos^{2} $φ} = @s{1 − ${n(c)}^{2}}\` = ${n(Math.sqrt(1 - c * c), 4)}`,
      `\`$Q = $S · sin $φ\` = ${n(S)} · ${n(Math.sqrt(1 - c * c), 4)} = ${res(Q, 'var')}`,
    ]);
  },
  (rng) => {
    const P = pick(rng, [800, 1500, 2200, 3000, 5500]);
    const c = pick(rng, [0.7, 0.75, 0.8, 0.85, 0.9]);
    const U = 230;
    const I = P / (U * c);
    return numeric(ID, `Jednofázový motor s príkonom (činným výkonom) ${q(P, 'W')} pracuje na sieti 230 V s účinníkom ${n(c)}. Aký prúd odoberá?`, I, 'A', [
      'Z `$P = $U · $I · cos $φ` vyjadríme prúd.',
      `\`$I = @f{$P}{$U · cos $φ} = @f{${n(P)}}{230 · ${n(c)}}\` = ${res(I, 'A')}`,
    ]);
  },
  (rng) => {
    const P = pick(rng, [1500, 3000, 5000, 7500]);
    const c1 = pick(rng, [0.6, 0.65, 0.7, 0.75]);
    const c2 = pick(rng, [0.9, 0.95]);
    const U = 230;
    const w = 2 * Math.PI * 50;
    const t1 = Math.tan(Math.acos(c1));
    const t2 = Math.tan(Math.acos(c2));
    const Qc = P * (t1 - t2);
    const C = Qc / (w * U * U);
    return numeric(ID, `Spotrebič s činným výkonom ${q(P, 'W')} pracuje na sieti 230 V, 50 Hz s účinníkom ${n(c1)}. Akú kapacitu musí mať kondenzátor pripojený paralelne, aby sa účinník zlepšil na ${n(c2)}?`, C, 'F', [
      `\`tg $φ_{1}\` = tg(arccos ${n(c1)}) = ${n(t1, 4)}, \`tg $φ_{2}\` = tg(arccos ${n(c2)}) = ${n(t2, 4)}`,
      `\`$Q_{C} = $P · (tg $φ_{1} − tg $φ_{2})\` = ${n(P)} · (${n(t1, 4)} − ${n(t2, 4)}) = ${n(Qc, 4)} var`,
      `\`$C = @f{$Q_{C}}{$ω · $U^{2}} = @f{${n(Qc, 4)}}{314,16 · 230^{2}}\` = ${res(C, 'F')}`,
    ], { tolerance: 0.03 });
  },
  (rng) => {
    const P = pick(rng, [400, 900, 1200, 2000, 3600]);
    const Q = pick(rng, [300, 500, 800, 1200, 1600]);
    const S = Math.hypot(P, Q);
    return numeric(ID, `Spotrebič má činný výkon ${q(P, 'W')} a jalový výkon ${q(Q, 'var')}. Aký je jeho zdanlivý výkon?`, S, 'VA', [
      'Výkony tvoria pravouhlý trojuholník: `$S^{2} = $P^{2} + $Q^{2}`.',
      `\`$S = @s{${n(P)}^{2} + ${n(Q)}^{2}}\` = ${res(S, 'VA')}`,
      `Účinník je \`cos $φ = @f{$P}{$S}\` = ${n(P / S, 3)}.`,
    ]);
  },
  (rng) => {
    const S = pick(rng, [1000, 2500, 4000, 6300]);
    const P = Math.round(S * pick(rng, [0.6, 0.72, 0.8, 0.88])) ;
    const c = P / S;
    return numeric(ID, `Zdanlivý výkon spotrebiča je ${q(S, 'VA')} a činný výkon ${b(P, 'W')}. Aký je účinník?`, c, '', [
      `\`cos $φ = @f{$P}{$S} = @f{${n(P)}}{${n(S)}}\` = **${n(c, 3)}**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  (rng) => choice(ID,
    'Ako sa zmení prúd odoberaný zo siete, keď kondenzátorom zlepšíš účinník motora z 0,7 na 0,95 (činný výkon motora ostane rovnaký)?',
    ['zmenší sa približne o štvrtinu', 'nezmení sa', 'zväčší sa približne o štvrtinu', 'klesne na nulu'],
    'Pri rovnakom činnom výkone je prúd nepriamo úmerný účinníku: `$I = @f{$P}{$U cos $φ}`. Pomer prúdov je 0,7 / 0,95 = 0,74, teda prúd klesne asi o 26 %. Prúd samotného motora sa nemení – kondenzátor dodáva jeho jalový prúd priamo na mieste.',
    rng),
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'ac',
    title: 'Výkon v striedavom obvode a účinník',
    summary: 'Okamžitý, činný, jalový a zdanlivý výkon, trojuholník výkonov, účinník a jeho kompenzácia kondenzátormi.',
    minutes: 12,
    blocks: [
      { t: 'p', text: 'V jednosmernom obvode je výkon jednoducho `$P = $U · $I`. V striedavom obvode sa napätie aj prúd neustále menia a navyše nemusia byť vo fáze – cievka a kondenzátor posúvajú prúd voči napätiu. Preto rozlišujeme tri výkony.' },
      { t: 'h', text: 'Okamžitý výkon' },
      { t: 'p', text: 'Okamžitý výkon je súčin okamžitých hodnôt `$p = $u · $i`. Mení sa s dvojnásobnou frekvenciou siete. Keď sú napätie a prúd vo fáze (rezistor), je stále kladný – energia tečie len do spotrebiča. Keď je prúd posunutý, výkon je časť periódy **záporný**: energia nahromadená v magnetickom poli cievky alebo v elektrickom poli kondenzátora sa vracia do zdroja.' },
      { t: 'explore', build: powerExplorer, caption: 'Posuň fázový posun: pri 0° je výkon stále kladný, pri ±90° je jeho priemer nulový.' },
      { t: 'h', text: 'Činný, jalový a zdanlivý výkon' },
      {
        t: 'formula',
        tex: ['$P = $U · $I · cos $φ', '$Q = $U · $I · sin $φ', '$S = $U · $I = @s{$P^{2} + $Q^{2}}'],
        legend: [
          ['$P', 'činný výkon – mení sa na teplo, svetlo a mechanickú prácu', 'W'],
          ['$Q', 'jalový výkon – prelieva sa medzi zdrojom a poľami', 'var'],
          ['$S', 'zdanlivý výkon – určuje dimenzovanie zdrojov a vedení', 'VA'],
          ['$φ', 'fázový posun prúdu voči napätiu', '°'],
        ],
      },
      { t: 'figure', fig: () => impedanceTriangle(4, 3, { r: 'P', x: 'Q', z: 'S' }), caption: 'Trojuholník výkonov: činný a jalový výkon sú odvesny, zdanlivý výkon prepona. Je podobný trojuholníku impedancií.' },
      {
        t: 'table',
        head: ['Prvok', 'Fázový posun', 'Činný výkon', 'Jalový výkon'],
        rows: [
          ['rezistor', '0°', '`$P = $I^{2} · $R`', '0'],
          ['ideálna cievka', 'prúd zaostáva o 90°', '0', '`$Q_{L} = $I^{2} · $X_{L}` (induktívny)'],
          ['ideálny kondenzátor', 'prúd predbieha o 90°', '0', '`$Q_{C} = $I^{2} · $X_{C}` (kapacitný)'],
        ],
      },
      { t: 'note', kind: 'remember', text: 'Wattmeter meria **činný** výkon a elektromer počíta činnú energiu v kWh. Transformátory a generátory sa dimenzujú na **zdanlivý** výkon v VA (kVA, MVA), lebo ich zahrieva celý prúd, nielen jeho činná zložka.' },
      { t: 'h', text: 'Účinník' },
      { t: 'p', text: 'Účinník `cos $φ = @f{$P}{$S}` udáva, aká časť zdanlivého výkonu je činná. Rezistor (ohrievač, žiarovka) má účinník 1, motory a transformátory pri malom zaťažení 0,6 až 0,85 (induktívny), počítačové zdroje bez korekcie ešte menej.' },
      { t: 'p', text: 'Pri malom účinníku tečie vedením pre ten istý činný výkon **väčší prúd**. Vedenia, transformátory aj generátory sa viac zahrievajú, rastú straty `$R · $I^{2}` a úbytky napätia. Preto distribučné spoločnosti požadujú od veľkoodberateľov účinník aspoň 0,95 a jalovú energiu im účtujú.' },
      {
        t: 'example',
        title: 'Činný, jalový a zdanlivý výkon motora',
        given: ['`$U` = 230 V', '`$I` = 8 A', '`cos $φ` = 0,8'],
        steps: [
          '`$S = $U · $I` = 230 · 8 = 1 840 VA',
          '`$P = $S · cos $φ` = 1 840 · 0,8 = 1 472 W',
          '`sin $φ = @s{1 − 0,8^{2}}` = 0,6, preto `$Q = $S · sin $φ` = 1 840 · 0,6 = 1 104 var',
        ],
        result: '`$P` = 1,47 kW, `$Q` = 1,10 kvar, `$S` = 1,84 kVA',
      },
      { t: 'h', text: 'Kompenzácia účinníka' },
      { t: 'p', text: 'Induktívny jalový výkon motora môže dodať kondenzátor zapojený **paralelne** priamo pri ňom. Kondenzátor odoberá kapacitný jalový prúd, ktorý je opačný ako induktívna zložka prúdu motora – obe sa navzájom vyrušia a zo siete tečie takmer len činný prúd.' },
      { t: 'figure', fig: compensationFigure, caption: 'Prúd zo siete `$I` je súčtom prúdu motora `$I_{Z}` a prúdu kondenzátora `$I_{C}`.' },
      {
        t: 'figure',
        fig: () => phasorDiagram([
          { x: 10, y: 0, label: 'U', cls: 'ink' },
          { x: 5.6, y: -5.7, label: 'I_Z', cls: 'trace' },
          { x: 0, y: 3.9, label: 'I_C', cls: 'copper' },
          { x: 5.6, y: -1.8, label: '', cls: 'copper', from: [5.6, -5.7], dashed: true },
          { x: 5.6, y: -1.8, label: 'I', cls: 'good' },
        ], 'Fázorový diagram kompenzácie: kapacitný prúd I_C zmenší posun aj veľkosť prúdu I'),
        caption: 'Fázorový diagram: kapacitný prúd `$I_{C}` predbieha napätie o 90°. Pripočítaný k prúdu motora `$I_{Z}` (čiarkovane) zmenší jeho jalovú zložku – výsledný prúd `$I` je menší a menej posunutý.',
      },
      {
        t: 'formula',
        tex: ['$Q_{C} = $P · (tg $φ_{1} − tg $φ_{2})', '$C = @f{$Q_{C}}{$ω · $U^{2}}'],
        legend: [['$φ_{1}', 'fázový posun pred kompenzáciou', '°'], ['$φ_{2}', 'požadovaný fázový posun po kompenzácii', '°'], ['$Q_{C}', 'jalový výkon kondenzátora', 'var']],
      },
      {
        t: 'example',
        title: 'Kondenzátor na kompenzáciu motora',
        given: ['`$P` = 5 kW', '`cos $φ_{1}` = 0,7 → 0,95', '`$U` = 230 V, `$f` = 50 Hz'],
        steps: [
          '`tg $φ_{1}` = tg(arccos 0,7) = 1,020, `tg $φ_{2}` = tg(arccos 0,95) = 0,329',
          '`$Q_{C}` = 5 000 · (1,020 − 0,329) = 3 457 var',
          '`$C = @f{3 457}{314,16 · 230^{2}}` = 208 µF',
          'Prúd zo siete klesne z `@f{5 000}{230 · 0,7}` = 31,1 A na `@f{5 000}{230 · 0,95}` = 22,9 A.',
        ],
        result: '`$C` ≈ 208 µF, prúd zo siete klesne o 26 %',
      },
      { t: 'note', kind: 'warn', text: 'Kompenzuje sa na účinník 0,95 až 0,98, nie na 1. Pri **prekompenzovaní** by mal obvod kapacitný charakter a pri malom zaťažení by v sieti stúpalo napätie. Vo veľkých podnikoch preto kondenzátorové batérie zapína automatický regulátor jalového výkonu podľa zaťaženia.' },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'V akých jednotkách sa udáva jalový výkon?',
      options: ['var (voltampér reaktančný)', 'W (watt)', 'VA (voltampér)', 'kWh (kilowatthodina)'],
      explanation: 'Činný výkon je vo wattoch, jalový vo varoch a zdanlivý vo voltampéroch. Kilowatthodina je jednotka energie.',
    },
    {
      lessonId: ID,
      prompt: 'Aký je priemerný (činný) výkon ideálnej cievky v striedavom obvode?',
      options: ['nulový – energia sa len prelieva medzi zdrojom a magnetickým poľom', 'rovná sa `$U · $I`', 'rovná sa `$I^{2} · $X_{L}`', 'je záporný'],
      explanation: 'Prúd ideálnej cievky zaostáva za napätím o 90°, cos 90° = 0. Polovicu periódy cievka energiu odoberá a polovicu ju vracia. `$I^{2} · $X_{L}` je jej jalový výkon.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo je nízky účinník odberu nevýhodný?',
      options: ['pre rovnaký činný výkon tečie vedením väčší prúd, rastú straty a úbytky napätia', 'spotrebič sa pri ňom nezapne', 'zvyšuje frekvenciu siete', 'elektromer pri ňom nemeria'],
      explanation: 'Prúd `$I = @f{$P}{$U cos $φ}` rastie, keď účinník klesá. Vedenia a transformátory sa zahrievajú celým prúdom, preto je jalový výkon pre sieť záťažou.',
    },
    {
      lessonId: ID,
      prompt: 'Ako sa kompenzuje induktívny charakter odberu (napríklad motorov)?',
      options: ['kondenzátormi zapojenými paralelne k spotrebiču', 'cievkou zapojenou do série', 'rezistorom zapojeným paralelne', 'zvýšením napätia siete'],
      explanation: 'Kondenzátor odoberá kapacitný jalový prúd, ktorý vyruší induktívnu zložku prúdu motora. Zapája sa paralelne, aby nemenil napätie na spotrebiči.',
    },
    {
      lessonId: ID,
      prompt: 'Na aký výkon sa dimenzuje transformátor?',
      options: ['na zdanlivý výkon (kVA)', 'na činný výkon (kW)', 'na jalový výkon (kvar)', 'na energiu (kWh)'],
      explanation: 'Vinutia zahrieva celý prúd bez ohľadu na to, či je činný alebo jalový. Preto sa na štítku transformátora uvádza zdanlivý výkon v kVA.',
    },
    {
      lessonId: ID,
      prompt: 'Zdanlivý výkon je 1 000 VA a činný 600 W. Aký je jalový výkon?',
      options: ['800 var', '400 var', '1 600 var', '1 166 var'],
      explanation: '`$Q = @s{$S^{2} − $P^{2}} = @s{1 000^{2} − 600^{2}}` = 800 var. Výkony sa nesčítavajú aritmeticky, ale ako strany pravouhlého trojuholníka.',
    },
  ],
  generators,
};

export default mod;
