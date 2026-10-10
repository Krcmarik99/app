import type { LessonModule } from '../../module';
import { pick, shuffle } from '../../../lib/random';
import { fmt } from '../../../lib/units';
import { n, numeric, q, type Generator } from '../../../practice/helpers';
import { explorer } from '../../../ui/explorer';
import { currentZone, currentZonesChart, faultLoopFigure, protectionClassFigure, rcdFigure } from '../../../ui/fig-power';
import { choice, clean } from '../util';

const ID = 'ochrana-pred-urazom';

const ZONE_TEXT: Record<1 | 2 | 3 | 4, string> = {
  1: 'AC-1 – prúd zvyčajne nevnímaš.',
  2: 'AC-2 – prúd cítiť, môžu nastať mimovoľné svalové sťahy, ale zvyčajne bez škodlivých následkov.',
  3: 'AC-3 – silné kŕče svalov, ťažkosti s dýchaním, vratné poruchy srdcovej činnosti; predmet sa nedá pustiť.',
  4: 'AC-4 – hrozí fibrilácia srdcových komôr, zástava dýchania a ťažké popáleniny. Život ohrozujúci stav!',
};

/** Prúd telom pri dotykovom napätí a čase pôsobenia – bod v grafe pásiem účinkov. */
function touchExplorer(): HTMLElement {
  return explorer({
    title: 'Prúd telom a čas pôsobenia',
    params: [
      { key: 'U', label: 'Dotykové napätie `$U_{d}`', unit: 'V', min: 12, max: 400, value: 230, log: true },
      { key: 'R', label: 'Odpor tela `$R_{t}`', unit: 'Ω', min: 500, max: 5000, value: 1000, log: true },
      { key: 't', label: 'Čas pôsobenia `$t`', unit: 's', min: 0.01, max: 10, value: 0.2, log: true },
    ],
    draw: ({ U, R, t }) => {
      const iMa = (U / R) * 1000;
      const tMs = t * 1000;
      const zone = currentZone(iMa, tMs);
      return {
        chart: currentZonesChart({ iMa, tMs }),
        readouts: [
          ['Prúd telom `$I = @f{$U_{d}}{$R_{t}}`', `${fmt(iMa, 3)} mA`],
          ['Čas pôsobenia', q(t, 's')],
          ['Pásmo', `AC-${zone}`],
        ],
        note: `${ZONE_TEXT[zone]} Pásma sú zjednodušené; skutočný účinok závisí aj od dráhy prúdu a stavu organizmu.`,
      };
    },
  });
}

const BREAKER_MULT = { B: 5, C: 10, D: 20 } as const;
type Char = keyof typeof BREAKER_MULT;
const IN_LIST = [6, 10, 13, 16, 20, 25, 32];

const CLASSES: { cls: string; desc: string }[] = [
  { cls: 'trieda I', desc: 'Práčka má kovovú skriňu pripojenú na ochranný vodič PE cez ochranný kontakt vidlice.' },
  { cls: 'trieda II', desc: 'Vŕtačka má dvojitú izoláciu, nemá ochrannú svorku a na štítku má značku dvoch sústredných štvorcov.' },
  { cls: 'trieda III', desc: 'Ručné svietidlo na prácu v kotle sa napája z bezpečnostného transformátora malým napätím SELV a má značku kosoštvorca s číslom III.' },
  { cls: 'trieda 0', desc: 'Spotrebič má len základnú izoláciu a nemá žiadnu možnosť pripojenia ochranného vodiča.' },
  { cls: 'trieda I', desc: 'Kovové svietidlo má svorku označenú značkou ochranného uzemnenia (kružnica so značkou uzemnenia) a pripája sa trojžilovým káblom.' },
  { cls: 'trieda II', desc: 'Nabíjačka mobilu má plastový kryt, zosilnenú izoláciu a dvojpólovú vidlicu bez ochranného kontaktu.' },
];

const generators: Generator[] = [
  // Prúd telom pri dotykovom napätí.
  (rng) => {
    const combo = pick(rng, [
      { U: 230, R: [1000, 1200, 1500, 2000] },
      { U: 400, R: [800, 1000, 1200] },
      { U: 120, R: [1500, 2000, 2500] },
      { U: 50, R: [1500, 2000, 2500, 3000] },
      { U: 24, R: [2000, 3000, 4000] },
    ]);
    const R = pick(rng, combo.R);
    const I = combo.U / R;
    return numeric(ID, `Človek sa dotkne krytu spotrebiča, na ktorom je proti zemi dotykové napätie ${n(combo.U)} V. Odpor jeho tela spolu s prechodovým odporom je ${q(R, 'Ω')}. Aký prúd prejde telom?`, I, 'A', [
      `\`$I = @f{$U_{d}}{$R_{t}} = @f{${n(combo.U)}}{${n(R)}}\` = ${n(I, 4)} A = **${q(I, 'A')}**`,
      `Prah odpútania je asi 10 mA, takže tento prúd je ${I >= 0.01 ? `asi ${n(I / 0.01, 2)}-krát väčší` : 'menší'}. Nebezpečenstvo fibrilácie závisí od času pôsobenia.`,
    ]);
  },
  // Najväčšia impedancia slučky pre istič B, C (D).
  (rng) => {
    const ch = pick(rng, ['B', 'B', 'C', 'C', 'D'] as Char[]);
    const In = pick(rng, IN_LIST);
    const m = BREAKER_MULT[ch];
    const Ia = m * In;
    const Zs = 230 / Ia;
    return numeric(ID, `Koncový obvod v sieti TN-C-S (\`$U_{0}\` = 230 V) je istený ističom ${ch}${In}. Aká môže byť najväčšia impedancia poruchovej slučky \`$Z_{s}\`, aby ochrana samočinným odpojením vyhovovala?`, Zs, 'Ω', [
      `Istič s charakteristikou ${ch} vypne elektromagnetickou spúšťou zaručene pri \`$I_{a}\` = ${m} · \`$I_{n}\` = ${m} · ${In} = ${Ia} A.`,
      `Z podmienky \`$Z_{s} · $I_{a} ≤ $U_{0}\`: \`$Z_{s} ≤ @f{$U_{0}}{$I_{a}} = @f{230}{${Ia}}\` = **${n(Zs, 4)} Ω**`,
    ], { fixedUnit: true, tolerance: 0.01 });
  },
  // Poruchový prúd pri nameranej impedancii slučky.
  (rng) => {
    const Zs = pick(rng, [0.35, 0.5, 0.72, 0.9, 1.15, 1.4, 1.8, 2.3]);
    const Ik = 230 / Zs;
    return numeric(ID, `Revízny technik nameral v zásuvke impedanciu poruchovej slučky \`$Z_{s}\` = ${n(Zs)} Ω. Aký prúd by tiekol pri dokonalom spojení fázového vodiča s krytom spotrebiča (\`$U_{0}\` = 230 V)?`, Ik, 'A', [
      `\`$I_{k} = @f{$U_{0}}{$Z_{s}} = @f{230}{${n(Zs)}}\` = **${n(Ik, 4)} A**`,
      `Istič B16 vypne okamžite pri prúde aspoň 80 A, istič C16 pri 160 A – ${Ik >= 160 ? 'tu by okamžite vypli oba' : Ik >= 80 ? 'tu by okamžite vypol B16, ale C16 nie' : 'tu by okamžite nevypol ani jeden'}.`,
    ]);
  },
  // Vyhovuje / nevyhovuje.
  (rng) => {
    const ch = pick(rng, ['B', 'C'] as Char[]);
    const In = pick(rng, [10, 13, 16, 20, 25]);
    const Ia = BREAKER_MULT[ch] * In;
    const Zmax = 230 / Ia;
    const f = pick(rng, [0.45, 0.6, 0.75, 0.85, 1.15, 1.3, 1.6, 2]);
    const Zs = Number((Zmax * f).toPrecision(2));
    const okay = Zs <= Zmax;
    const yes = 'vyhovuje – nameraná impedancia je menšia ako najväčšia dovolená';
    const no = 'nevyhovuje – nameraná impedancia je väčšia ako najväčšia dovolená';
    return choice(ID, `Obvod v sieti TN (\`$U_{0}\` = 230 V) je istený ističom ${ch}${In}. Nameraná impedancia poruchovej slučky je ${n(Zs)} Ω. Vyhovuje ochrana samočinným odpojením napájania?`,
      [okay ? yes : no, okay ? no : yes, 'vyhovuje vždy, lebo istič má menovitý prúd väčší ako prevádzkový', 'nedá sa posúdiť bez merania izolačného odporu'],
      `\`$I_{a}\` = ${BREAKER_MULT[ch]} · ${In} = ${Ia} A, \`$Z_{s,max} = @f{230}{${Ia}}\` = ${n(Zmax, 3)} Ω. Nameraných ${n(Zs)} Ω je ${okay ? 'menej' : 'viac'}, poruchový prúd \`@f{230}{${n(Zs)}}\` = ${n(230 / Zs, 3)} A je ${okay ? 'aspoň' : 'menší ako'} ${Ia} A, preto ochrana ${okay ? 'vyhovuje – istič vypne okamžite' : 'nevyhovuje – istič by nevypol dosť rýchlo'}.`,
      rng);
  },
  // Unikajúci prúd a prúdový chránič.
  (rng) => {
    const In = pick(rng, [10, 30, 30, 100, 300]);
    const kind = pick(rng, ['must', 'never', 'maybe'] as const);
    const frac = kind === 'must' ? pick(rng, [1, 1.2, 1.5, 2, 3]) : kind === 'never' ? pick(rng, [0.2, 0.3, 0.4]) : pick(rng, [0.6, 0.7, 0.8, 0.9]);
    const leak = clean(In * frac);
    const must = 'chránič musí vypnúť';
    const never = 'chránič nesmie vypnúť';
    const maybe = 'chránič môže, ale nemusí vypnúť';
    const correct = kind === 'must' ? must : kind === 'never' ? never : maybe;
    const others = [must, never, maybe].filter((x) => x !== correct);
    return choice(ID, `Cez ochranný vodič uniká z obvodu prúd ${n(leak)} mA. Obvod chráni prúdový chránič s menovitým rozdielovým prúdom \`$I_{Δn}\` = ${In} mA. Čo platí?`,
      [correct, others[0], others[1], 'chránič zareaguje, až keď v obvode vznikne skrat'],
      `Chránič musí vypnúť pri rozdielovom prúde \`$I_{Δn}\` (a väčšom), nesmie vypnúť pod \`0,5 · $I_{Δn}\` = ${n(In / 2)} mA a medzi týmito hodnotami môže, ale nemusí. Unikajúcich ${n(leak)} mA je ${kind === 'must' ? `aspoň ${In} mA` : kind === 'never' ? `menej ako ${n(In / 2)} mA` : `medzi ${n(In / 2)} mA a ${In} mA`}.`,
      rng);
  },
  // Trieda ochrany.
  (rng) => {
    const item = pick(rng, CLASSES);
    const others = shuffle(rng, ['trieda 0', 'trieda I', 'trieda II', 'trieda III'].filter((c) => c !== item.cls));
    return choice(ID, `Do ktorej triedy ochrany patrí spotrebič? ${item.desc}`, [item.cls, others[0], others[1], others[2]],
      'Trieda 0 – len základná izolácia; trieda I – neživé časti pripojené na ochranný vodič PE; trieda II – dvojitá alebo zosilnená izolácia bez PE (značka dvoch štvorcov); trieda III – napájanie malým napätím SELV alebo PELV (kosoštvorec s III).',
      rng);
  },
  // Najdlhší čas odpojenia.
  (rng) => {
    const v = pick(rng, [
      { prompt: 'koncový obvod 230 V s ističom 16 A v sieti TN', a: '0,4 s', why: 'Pre koncové obvody do 32 A pri `$U_{0}` = 230 V v sieti TN je to 0,4 s.' },
      { prompt: 'distribučný obvod (prívod do podružného rozvádzača) v sieti TN', a: '5 s', why: 'Pre distribučné obvody a koncové obvody nad 32 A v sieti TN sa pripúšťa 5 s.' },
      { prompt: 'koncový obvod 230 V do 32 A v sieti TT', a: '0,2 s', why: 'V sieti TT je pre koncové obvody do 32 A pri 230 V predpísaných 0,2 s – poruchový prúd tečie cez zem a je menší.' },
    ]);
    const all = ['0,4 s', '5 s', '0,2 s', '1 min'];
    return choice(ID, `Aký je najdlhší dovolený čas samočinného odpojenia pre ${v.prompt}?`, [v.a, ...all.filter((x) => x !== v.a)] as [string, string, string, string], v.why, rng);
  },
];

const mod: LessonModule = {
  lesson: {
    id: ID,
    chapter: 'power',
    title: 'Ochrana pred úrazom elektrickým prúdom',
    summary: 'Účinky prúdu na človeka, dovolené dotykové napätie, základná ochrana a ochrana pri poruche, samočinné odpojenie v sieti TN, prúdový chránič, triedy ochrany, SELV a PELV a prvá pomoc.',
    minutes: 16,
    blocks: [
      { t: 'p', text: 'Úraz spôsobuje **prúd**, ktorý prechádza telom – napätie je len jeho príčinou. Účinok závisí od veľkosti prúdu, od **času pôsobenia**, od dráhy prúdu telom (najnebezpečnejšia je cez srdce, napr. ruka – nohy alebo ruka – ruka) a od frekvencie. Striedavý prúd 50 Hz je pri rovnakej hodnote nebezpečnejší ako jednosmerný.' },
      { t: 'h', text: 'Účinky prúdu na organizmus' },
      {
        t: 'table',
        head: ['Striedavý prúd 50 Hz', 'Účinok'],
        rows: [
          ['asi 0,5 mA', '**prah vnímania** – prúd začneš cítiť (mravčenie)'],
          ['asi 10 mA', '**prah odpútania** – svaly sa kŕčovito stiahnu a uchopený predmet pod napätím sa nedá pustiť'],
          ['desiatky mA pri pôsobení okolo sekundy, stovky mA už za zlomok sekundy', '**fibrilácia srdcových komôr** – srdce sa chaoticky chveje a prestane čerpať krv'],
          ['ampéry', 'ťažké popáleniny, zástava srdca, poškodenie tkanív a nervov'],
        ],
      },
      { t: 'figure', fig: () => currentZonesChart(), caption: 'Zjednodušené pásma účinkov striedavého prúdu (dráha ruka – nohy) podľa IEC 60479-1, obe osi sú logaritmické. AC-1 – prúd sa nevníma; AC-2 – vnímanie bez škodlivých účinkov; AC-3 – kŕče, ťažkosti s dýchaním, vratné poruchy srdca; AC-4 – nad krivkou `$c_{1}` hrozí fibrilácia komôr. Čím kratší čas, tým väčší prúd telo znesie.' },
      { t: 'p', text: 'Prúd telom určuje dotykové napätie a **odpor (impedancia) ľudského tela** spolu s prechodovými odpormi: `$I = @f{$U_{d}}{$R_{t}}`. Odpor tela tvorí najmä pokožka. Pri suchej pokožke a malom napätí je rádovo kiloohmy, pri vlhkej pokožke, väčšej ploche dotyku a väčšom napätí klesá. Pri výpočtoch sa počíta s hodnotou rádovo **1 000 Ω**.' },
      {
        t: 'example',
        title: 'Dotyk krytu pod napätím 230 V',
        given: ['dotykové napätie `$U_{d}` = 230 V', 'odpor tela `$R_{t}` = 1 000 Ω'],
        steps: [
          '`$I = @f{$U_{d}}{$R_{t}} = @f{230}{1 000}` = 0,23 A = 230 mA',
          'To je 23-násobok prahu odpútania. V grafe pásiem leží tento prúd v pásme AC-4 už pri pôsobení niekoľkých desatín sekundy.',
        ],
        result: '230 mA – život ohrozujúci prúd; ochrana musí poruchu odpojiť čo najrýchlejšie',
      },
      { t: 'explore', build: touchExplorer, caption: 'Zmeň dotykové napätie, odpor tela a čas pôsobenia a sleduj, do ktorého pásma sa bod dostane.' },
      { t: 'p', text: '**Dovolené dotykové napätie.** Dotykové napätie je napätie medzi časťami, ktorých sa človek môže súčasne dotknúť, napríklad medzi krytom spotrebiča a zemou. V bežných priestoroch je trvalo dovolené dotykové napätie **50 V striedavých a 120 V jednosmerných** (bez zvlnenia). V priestoroch so zvýšeným nebezpečenstvom – vlhkých a mokrých, v kovových nádobách a kotloch, pri bazénoch, v poľnohospodárskych objektoch – sú dovolené hodnoty nižšie (napríklad 25 V striedavých).' },
      { t: 'h', text: 'Ochranné opatrenia' },
      { t: 'p', text: 'Každé ochranné opatrenie podľa STN 33 2000-4-41 tvorí **základná ochrana** (predtým „ochrana pred priamym dotykom“) a **ochrana pri poruche** (predtým „ochrana pred nepriamym dotykom“). Najčastejším opatrením je **samočinné odpojenie napájania**. Dvojitá alebo zosilnená izolácia, elektrické oddelenie a malé napätie SELV a PELV sú samostatné ochranné opatrenia, ktoré zabezpečia obe zložky naraz. Prekážky a umiestnenie mimo dosahu sa smú použiť len v priestoroch prístupných znalým osobám.' },
      {
        t: 'table',
        head: ['Ochrana', 'Úloha', 'Prostriedky'],
        rows: [
          ['základná ochrana', 'zabrániť dotyku **živých častí** (vodičov pod napätím) v bežnom stave', 'základná izolácia, zábrany a kryty, prekážky, umiestnenie mimo dosahu'],
          ['ochrana pri poruche', 'zabrániť nebezpečnému napätiu na **neživých častiach** (kovových krytoch) pri poruche izolácie', 'samočinné odpojenie napájania spolu s ochranným pospájaním, dvojitá izolácia, elektrické oddelenie'],
          ['doplnková ochrana', 'chrániť, keď zlyhajú ostatné opatrenia alebo pri neopatrnosti', 'prúdový chránič s `$I_{Δn}` ≤ 30 mA, doplnkové ochranné pospájanie'],
        ],
      },
      { t: 'h', text: 'Samočinné odpojenie napájania v sieti TN' },
      { t: 'figure', fig: faultLoopFigure, caption: 'Pri poruche izolácie sa fázový vodič spojí s kovovým krytom. Poruchový prúd `$I_{k}` tečie slučkou: zdroj – fázový vodič – kryt – ochranný vodič PE – PEN – uzol zdroja. Veľký prúd spôsobí rýchle vypnutie ističa alebo poistky.' },
      {
        t: 'formula',
        tex: ['$Z_{s} · $I_{a} ≤ $U_{0}', '$Z_{s,max} = @f{$U_{0}}{$I_{a}}'],
        legend: [
          ['$Z_{s}', 'impedancia poruchovej slučky (zdroj, fázový vodič, ochranný vodič)', 'Ω'],
          ['$I_{a}', 'prúd, ktorý zaistí odpojenie v predpísanom čase – istič B: 5 · `$I_{n}`, C: 10 · `$I_{n}`, D: 20 · `$I_{n}`', 'A'],
          ['$U_{0}', 'menovité napätie fázového vodiča proti zemi', '230 V'],
        ],
      },
      {
        t: 'table',
        head: ['Sústava (`$U_{0}` = 230 V)', 'Koncové obvody do 32 A', 'Distribučné obvody a koncové nad 32 A'],
        rows: [
          ['TN', '0,4 s', '5 s'],
          ['TT', '0,2 s', '1 s'],
        ],
      },
      {
        t: 'example',
        title: 'Zásuvkový obvod s ističom B16',
        given: ['`$U_{0}` = 230 V, sieť TN-C-S', 'istič B16 (`$I_{n}` = 16 A)', 'nameraná impedancia slučky `$Z_{s}` = 1,2 Ω'],
        steps: [
          '`$I_{a}` = 5 · `$I_{n}` = 5 · 16 = 80 A',
          '`$Z_{s,max} = @f{$U_{0}}{$I_{a}} = @f{230}{80}` = 2,875 Ω',
          '1,2 Ω ≤ 2,875 Ω, poruchový prúd `$I_{k} = @f{230}{1,2}` = 191,7 A ≥ 80 A',
        ],
        result: 'vyhovuje – elektromagnetická spúšť ističa vypne poruchu okamžite',
      },
      { t: 'h', text: 'Prúdový chránič' },
      { t: 'figure', fig: rcdFigure, caption: 'Prúdový chránič: vodiče L a N prechádzajú súčtovým transformátorom. Pri poruche časť prúdu `$I_{Δ}` odteká cez PE, prúdy `$I_{L}` a `$I_{N}` sa nerovnajú a spúšť rozopne kontakty.' },
      { t: 'p', text: 'Všetky pracovné vodiče (L a N, pri trojfázovom chrániči L1, L2, L3 a N) prechádzajú **súčtovým transformátorom prúdu**. V bezporuchovom stave je súčet prúdov nulový a ich magnetické toky sa v jadre rušia. Keď časť prúdu uniká mimo – cez ochranný vodič alebo cez človeka do zeme –, vznikne **rozdielový prúd** `$I_{Δ}`, ten vybudí v jadre tok, ktorý indukuje napätie v snímacom vinutí, a spúšť rozopne kontakty. Chránič s menovitým rozdielovým prúdom `$I_{Δn}` musí vypnúť pri `$I_{Δn}` (do 0,3 s) a nesmie vypnúť pri prúde menšom ako `0,5 · $I_{Δn}`. Ako **doplnková ochrana** sa používa chránič s `$I_{Δn}` ≤ **30 mA** – predpisuje sa najmä pre zásuvkové obvody do 20 A, ktoré používajú laici, a pre prenosné spotrebiče používané vonku.' },
      { t: 'note', kind: 'remember', text: 'Chránič **nechráni** pri súčasnom dotyku dvoch pracovných vodičov (L a N) – prúd sa vracia cez N a súčet prúdov je nulový. Nechráni ani pred preťažením a skratom, preto sa dopĺňa ističom (alebo sa použije kombinovaný chránič s ističom). Jeho funkciu pravidelne over tlačidlom **TEST**.' },
      { t: 'h', text: 'Triedy ochrany, SELV a PELV' },
      { t: 'figure', fig: protectionClassFigure, caption: 'Značky tried ochrany spotrebičov podľa STN EN 61140 na štítkoch spotrebičov.' },
      {
        t: 'table',
        head: ['Trieda', 'Ochrana pri poruche', 'Príklady'],
        rows: [
          ['0', 'len základná izolácia, bez možnosti pripojiť ochranný vodič', 'v bežných inštaláciách sa nepoužíva'],
          ['I', 'základná izolácia a neživé časti pripojené na ochranný vodič PE (vidlica s ochranným kontaktom)', 'práčka, chladnička, sporák, kovové svietidlá'],
          ['II', 'dvojitá alebo zosilnená izolácia, ochranný vodič sa nepripája', 'vŕtačka, fén, nabíjačka, televízor'],
          ['III', 'napájanie malým napätím SELV alebo PELV', 'ručné svietidlo do kotla, hračky, LED pásik 12 V'],
        ],
      },
      { t: 'p', text: '**SELV** (bezpečné malé napätie) a **PELV** (ochranné malé napätie) sú obvody s napätím najviac 50 V striedavých alebo 120 V jednosmerných, napájané z bezpečného zdroja – **bezpečnostného transformátora** (jeho vinutia sú oddelené dvojitou alebo zosilnenou izoláciou), akumulátora alebo batérie. Obvod SELV nesmie byť spojený so zemou, obvod PELV môže byť uzemnený. Pri **elektrickom oddelení** napája jeden spotrebič oddeľovací transformátor 230/230 V; jeho sekundárny obvod nie je spojený so zemou, preto dotyk jedného vodiča nevytvorí uzavretý obvod cez telo do zeme.' },
      { t: 'h', text: 'Prvá pomoc pri úraze elektrickým prúdom' },
      {
        t: 'list',
        items: [
          '**Prerušiť prúd** – vypni istič, vytiahni vidlicu, vypni vypínač. Postihnutého sa nedotýkaj, kým je pod napätím. Pri nízkom napätí ho môžeš odsunúť suchým nevodivým predmetom, stojac na izolačnej podložke.',
          'Pri **vysokom napätí** sa k postihnutému nepribližuj – vyslobodiť ho smie len odborník po vypnutí a uzemnení zariadenia.',
          'Zavolaj záchrannú službu na **112** (alebo 155).',
          'Skontroluj vedomie a dýchanie. Ak postihnutý nedýcha normálne, začni **KPR**: 30 stlačení hrudníka (hĺbka 5 až 6 cm, 100 až 120 stlačení za minútu) a 2 vdychy. Ak je poruke **AED** (automatický externý defibrilátor), použi ho.',
          'Popáleniny prekry sterilným obväzom. Aj keď sa postihnutý cíti dobre, musí ho vyšetriť lekár – poruchy srdcového rytmu sa môžu prejaviť neskôr.',
        ],
      },
    ],
  },
  questions: [
    {
      lessonId: ID,
      prompt: 'Aký je približne prah odpútania pri striedavom prúde 50 Hz?',
      options: ['10 mA', '0,5 mA', '100 mA', '1 A'],
      explanation: 'Pri prúde okolo 10 mA sa svaly ruky kŕčovito stiahnu a uchopený predmet sa nedá pustiť. 0,5 mA je prah vnímania.',
    },
    {
      lessonId: ID,
      prompt: 'Aké je trvalo dovolené dotykové napätie v bežných priestoroch?',
      options: ['50 V striedavých a 120 V jednosmerných', '230 V striedavých', '12 V striedavých a 24 V jednosmerných', '400 V striedavých'],
      explanation: 'V bežných priestoroch je to 50 V AC a 120 V DC (bez zvlnenia). V nebezpečných priestoroch sú dovolené hodnoty nižšie.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorá podmienka musí byť splnená pri ochrane samočinným odpojením v sieti TN?',
      options: ['`$Z_{s} · $I_{a} ≤ $U_{0}`', '`$Z_{s} · $I_{a} ≥ $U_{0}`', '`$I_{B} ≤ $I_{n} ≤ $I_{z}`', '`$Z_{s} ≥ @f{$U_{0}}{$I_{n}}`'],
      explanation: 'Impedancia slučky musí byť taká malá, aby poruchový prúd `@f{$U_{0}}{$Z_{s}}` dosiahol aspoň vypínací prúd `$I_{a}`. `$I_{B} ≤ $I_{n} ≤ $I_{z}` je podmienka dimenzovania vedenia.',
    },
    {
      lessonId: ID,
      prompt: 'Aký najdlhší čas odpojenia je predpísaný pre koncový obvod 230 V do 32 A v sieti TN?',
      options: ['0,4 s', '5 s', '0,04 s', '1 min'],
      explanation: 'Pre koncové obvody do 32 A pri `$U_{0}` = 230 V v sieti TN je to 0,4 s. Pre distribučné obvody 5 s.',
    },
    {
      lessonId: ID,
      prompt: 'Aký prúdový chránič sa používa ako doplnková ochrana?',
      options: ['s menovitým rozdielovým prúdom najviac 30 mA', 's menovitým rozdielovým prúdom 300 mA', 's menovitým prúdom 30 A', 'akýkoľvek istič s charakteristikou B'],
      explanation: 'Doplnková ochrana pred úrazom vyžaduje chránič s `$I_{Δn}` ≤ 30 mA. Chrániče 300 mA sa používajú najmä ako ochrana pred požiarom.',
    },
    {
      lessonId: ID,
      prompt: 'Prečo prúdový chránič nevypne, keď sa človek súčasne dotkne vodiča L a vodiča N a nie je pritom spojený so zemou?',
      options: [
        'prúd sa vracia vodičom N, súčet prúdov v súčtovom transformátore je nulový',
        'prúd telom je vždy menší ako 30 mA',
        'chránič reaguje len na skrat',
        'chránič vypína iba pri prúde väčšom ako menovitý prúd ističa',
      ],
      explanation: 'Chránič meria rozdiel prúdov v pracovných vodičoch. Človek medzi L a N je pre chránič obyčajný spotrebič – nič neuniká mimo.',
    },
    {
      lessonId: ID,
      prompt: 'Ktorou značkou sa označujú spotrebiče triedy ochrany II?',
      options: ['dvoma sústrednými štvorcami', 'kružnicou so značkou uzemnenia', 'kosoštvorcom s číslom III', 'trojuholníkom s bleskom'],
      explanation: 'Trieda II – dvojitá alebo zosilnená izolácia – má značku dvoch sústredných štvorcov. Kružnica so značkou uzemnenia je ochranná svorka (trieda I), kosoštvorec s III je trieda III.',
    },
    {
      lessonId: ID,
      prompt: 'Čo urobíš ako prvé pri úraze elektrickým prúdom v domácnosti?',
      options: ['prerušíš prúd – vypneš istič alebo vytiahneš vidlicu', 'chytíš postihnutého za ruku a odtiahneš ho', 'polieš ho vodou', 'začneš hneď KPR, aj keď je ešte pod napätím'],
      explanation: 'Kým je postihnutý pod napätím, záchranca by sa stal ďalšou obeťou. Najprv prerušiť prúd, potom volať 112 a poskytnúť prvú pomoc.',
    },
  ],
  generators,
};

export default mod;
