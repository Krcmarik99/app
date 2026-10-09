import { MEAS_MODULES } from './meas';

/** Otázky s výberom odpovede. Prvá možnosť je vždy správna – pri zobrazení sa zamiešajú. */
export interface StaticQuestion {
  lessonId: string;
  prompt: string;
  options: [string, string, string, string];
  explanation: string;
}

const BASE_QUESTIONS: readonly StaticQuestion[] = [
  // Elektrické veličiny a jednotky
  {
    lessonId: 'zaklady',
    prompt: 'Akou jednotkou meriame elektrický prúd?',
    options: ['ampér (A)', 'volt (V)', 'ohm (Ω)', 'coulomb (C)'],
    explanation: 'Prúd meriame v ampéroch, napätie vo voltoch, odpor v ohmoch a náboj v coulomboch.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Ako zapojíš ampérmeter do obvodu?',
    options: ['do série so spotrebičom', 'paralelne k spotrebiču', 'priamo na svorky zdroja', 'nijako, prúd sa meria ohmmetrom'],
    explanation: 'Ampérmetrom musí prechádzať ten istý prúd ako spotrebičom, preto ho zapájame do série. Má veľmi malý odpor – paralelne k zdroju by urobil skrat.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Koľko ohmov je 4,7 kΩ?',
    options: ['4 700 Ω', '470 Ω', '47 000 Ω', '0,0047 Ω'],
    explanation: 'Predpona kilo znamená 10³, teda 4,7 · 1 000 = 4 700 Ω.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Čo vyjadruje predpona mikro (µ)?',
    options: ['10⁻⁶', '10⁻³', '10⁻⁹', '10⁶'],
    explanation: 'mili = 10⁻³, mikro = 10⁻⁶, nano = 10⁻⁹, piko = 10⁻¹².',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Aký je dohodnutý (technický) smer prúdu?',
    options: ['od kladného pólu zdroja cez spotrebič k zápornému', 'od záporného pólu k kladnému', 'vždy zľava doprava', 'smer sa nedá určiť'],
    explanation: 'Technický smer prúdu je od + k −. Elektróny sa vo vodiči pohybujú opačne, od − k +.',
  },

  // Ohmov zákon
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Ako sa zmení prúd, ak pri rovnakom napätí zdvojnásobíš odpor?',
    options: ['klesne na polovicu', 'zdvojnásobí sa', 'nezmení sa', 'klesne na štvrtinu'],
    explanation: 'Podľa `$I = @f{$U}{$R}` je prúd nepriamo úmerný odporu.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Ktorý vzťah je správny?',
    options: ['`$R = @f{$U}{$I}`', '`$R = $U · $I`', '`$I = $U · $R`', '`$U = @f{$I}{$R}`'],
    explanation: 'Z Ohmovho zákona `$U = $R · $I` vyjadríme odpor ako podiel napätia a prúdu.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Napätie na rezistore vzrastie trojnásobne. Čo sa stane s prúdom?',
    options: ['vzrastie trojnásobne', 'klesne na tretinu', 'vzrastie deväťnásobne', 'nezmení sa'],
    explanation: 'Pri stálom odpore je prúd priamo úmerný napätiu.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Graf závislosti prúdu od napätia pre rezistor so stálym odporom je…',
    options: ['priamka prechádzajúca začiatkom', 'parabola', 'hyperbola', 'vodorovná priamka'],
    explanation: '`$I = @f{1}{$R} · $U` je lineárna funkcia – jej grafom je priamka cez bod [0; 0].',
  },

  // Odpor vodiča
  {
    lessonId: 'odpor-vodica',
    prompt: 'Ako sa zmení odpor vodiča, ak zdvojnásobíš jeho dĺžku?',
    options: ['zdvojnásobí sa', 'klesne na polovicu', 'zväčší sa štvornásobne', 'nezmení sa'],
    explanation: 'Odpor je priamo úmerný dĺžke: `$R = $ρ · @f{$l}{$S}`.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Ako sa zmení odpor vodiča, ak zdvojnásobíš jeho prierez?',
    options: ['klesne na polovicu', 'zdvojnásobí sa', 'klesne na štvrtinu', 'nezmení sa'],
    explanation: 'Odpor je nepriamo úmerný prierezu – hrubší vodič vedie lepšie.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Ktorý materiál má najmenšiu rezistivitu?',
    options: ['striebro', 'meď', 'hliník', 'konštantán'],
    explanation: 'Striebro (0,016) vedie najlepšie, tesne za ním je meď (0,0178 Ω·mm²/m). Meď sa používa častejšie, lebo je oveľa lacnejšia.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Čo sa stane s odporom medeného vodiča pri zahriatí?',
    options: ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: 'Kovy majú kladný teplotný súčiniteľ odporu, ich odpor s teplotou rastie.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Prečo sa konštantán používa na presné rezistory?',
    options: ['má takmer nulový teplotný súčiniteľ odporu', 'má najmenšiu rezistivitu', 'je najlacnejší kov', 'je supravodivý'],
    explanation: 'Odpor konštantánu sa s teplotou takmer nemení, preto je hodnota rezistora stabilná.',
  },

  // Spájanie rezistorov
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Tri rezistory po 300 Ω sú zapojené paralelne. Aký je výsledný odpor?',
    options: ['100 Ω', '900 Ω', '300 Ω', '150 Ω'],
    explanation: '`$n` rovnakých rezistorov paralelne má odpor `@f{$R}{$n}` = 300 / 3 = 100 Ω.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Čo je rovnaké pre všetky rezistory v sériovom zapojení?',
    options: ['prúd', 'napätie', 'výkon', 'nič'],
    explanation: 'V sériovom zapojení má prúd len jednu cestu, preto je všade rovnaký.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Čo je rovnaké pre všetky rezistory v paralelnom zapojení?',
    options: ['napätie', 'prúd', 'výkon', 'odpor'],
    explanation: 'Paralelné rezistory sú pripojené k tým istým dvom uzlom, majú teda rovnaké napätie.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Výsledný odpor paralelného zapojenia je vždy…',
    options: ['menší ako najmenší z odporov', 'väčší ako najväčší z odporov', 'rovný ich priemeru', 'rovný ich súčtu'],
    explanation: 'Každá ďalšia paralelná vetva otvára prúdu novú cestu, takže celkový odpor klesá.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Rezistory 1 kΩ a 1 kΩ sú zapojené sériovo. Výsledný odpor je…',
    options: ['2 kΩ', '500 Ω', '1 kΩ', '1 MΩ'],
    explanation: 'V sérii sa odpory sčítajú: 1 kΩ + 1 kΩ = 2 kΩ.',
  },

  // Kirchhoffove zákony
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Do uzla vtekajú prúdy 2 A a 3 A a vyteká z neho jediný prúd. Aký veľký?',
    options: ['5 A', '1 A', '6 A', '1,5 A'],
    explanation: 'Podľa 1. Kirchhoffovho zákona je súčet vtekajúcich prúdov rovný súčtu vytekajúcich: 2 + 3 = 5 A.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Čo hovorí 2. Kirchhoffov zákon?',
    options: ['súčet napätí v uzavretej slučke je nulový', 'súčet prúdov v uzle je nulový', 'prúd je úmerný napätiu', 'výkon je súčin napätia a prúdu'],
    explanation: 'Napäťový (2.) Kirchhoffov zákon platí pre slučky, prúdový (1.) pre uzly.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Delič z dvoch rovnakých rezistorov pripojíš na 10 V. Aké je výstupné napätie naprázdno?',
    options: ['5 V', '10 V', '2,5 V', '20 V'],
    explanation: 'Rovnaké rezistory rozdelia napätie na polovicu.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Čo sa stane s výstupným napätím deliča, keď naň pripojíš záťaž?',
    options: ['klesne', 'stúpne', 'nezmení sa', 'zmení polaritu'],
    explanation: 'Záťaž je paralelne k dolnému rezistoru, zmenší jeho výsledný odpor, a tým aj výstupné napätie.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Ktorou vetvou dvoch paralelných rezistorov tečie väčší prúd?',
    options: ['vetvou s menším odporom', 'vetvou s väčším odporom', 'oboma rovnaký', 'závisí to od poradia zapojenia'],
    explanation: 'Obe vetvy majú rovnaké napätie, takže podľa `$I = @f{$U}{$R}` tečie väčší prúd menším odporom.',
  },

  // Reálny zdroj
  {
    lessonId: 'zdroj',
    prompt: 'Kedy sa svorkové napätie zdroja rovná jeho elektromotorickému napätiu?',
    options: ['naprázdno, keď neodoberáme prúd', 'pri skrate', 'pri najväčšom výkone', 'nikdy'],
    explanation: 'Pri nulovom prúde je úbytok na vnútornom odpore `$R_{i} · $I` nulový.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Čo spôsobí väčší vnútorný odpor zdroja pri rovnakej záťaži?',
    options: ['väčší pokles svorkového napätia', 'väčší prúd do záťaže', 'vyššie svorkové napätie', 'nič sa nezmení'],
    explanation: 'Úbytok napätia vo vnútri zdroja `$R_{i} · $I` rastie s vnútorným odporom.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Kedy odovzdá zdroj do záťaže najväčší výkon?',
    options: ['keď sa odpor záťaže rovná vnútornému odporu', 'pri skrate', 'naprázdno', 'keď je odpor záťaže nekonečný'],
    explanation: 'Ide o výkonové prispôsobenie `$R_{z} = $R_{i}`. Pri skrate aj naprázdno je výkon v záťaži nulový.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Aký prúd tečie pri skrate zdroja?',
    options: ['`$I_{k} = @f{$U_{e}}{$R_{i}}`', 'nulový', '`$I_{k} = $U_{e} · $R_{i}`', 'rovnaký ako pri bežnom zaťažení'],
    explanation: 'Pri skrate obmedzuje prúd iba vnútorný odpor zdroja.',
  },

  // Výkon a práca
  {
    lessonId: 'vykon-a-praca',
    prompt: 'V akých jednotkách sa účtuje spotreba elektriny v domácnosti?',
    options: ['kWh', 'kW', 'V·A', 'A·h'],
    explanation: 'Platíš za energiu, nie za výkon. Energia sa účtuje v kilowatthodinách.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Koľko joulov je 1 kWh?',
    options: ['3,6 MJ', '1 000 J', '3 600 J', '360 kJ'],
    explanation: '1 kWh = 1 000 W · 3 600 s = 3 600 000 J = 3,6 MJ.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Prúd rezistorom sa zdvojnásobí. Ako sa zmení výkon na ňom?',
    options: ['zväčší sa štvornásobne', 'zdvojnásobí sa', 'nezmení sa', 'klesne na polovicu'],
    explanation: '`$P = $R · $I^{2}` – prúd je v druhej mocnine, takže 2² = 4.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Motor má príkon 2 kW a výkon 1,6 kW. Aká je jeho účinnosť?',
    options: ['80 %', '125 %', '60 %', '20 %'],
    explanation: '`$η = @f{1,6}{2}` · 100 % = 80 %. Účinnosť nikdy nemôže presiahnuť 100 %.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorý vzťah pre výkon NIE je správny?',
    options: ['`$P = @f{$R}{$I^{2}}`', '`$P = $U · $I`', '`$P = $R · $I^{2}`', '`$P = @f{$U^{2}}{$R}`'],
    explanation: 'Správne je `$P = $R · $I^{2}`, prúd v menovateli nebýva.',
  },

  // Kondenzátor
  {
    lessonId: 'kondenzator',
    prompt: 'Ako sa zmení kapacita doskového kondenzátora, ak zmenšíš vzdialenosť dosiek na polovicu?',
    options: ['zdvojnásobí sa', 'klesne na polovicu', 'nezmení sa', 'zväčší sa štvornásobne'],
    explanation: 'Kapacita je nepriamo úmerná vzdialenosti dosiek `$d`.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Dva kondenzátory 10 µF zapojíš paralelne. Výsledná kapacita je…',
    options: ['20 µF', '5 µF', '10 µF', '100 µF'],
    explanation: 'Paralelné kapacity sa sčítajú – presne naopak ako pri rezistoroch.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Na koľko percent napätia zdroja sa nabije kondenzátor za čas τ?',
    options: ['približne 63 %', '50 %', 'približne 37 %', '100 %'],
    explanation: '`1 − e^{−1}` ≈ 0,632. Na 37 % klesne napätie za čas τ pri vybíjaní.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Ako sa správa nabitý kondenzátor v jednosmernom obvode?',
    options: ['nevedie prúd', 'ako skrat', 'ako rezistor 1 Ω', 'mení napätie na striedavé'],
    explanation: 'Po nabití už náboj neprúdi – dielektrikum je izolant.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Ako sa zmení časová konštanta RC obvodu, ak zdvojnásobíš odpor?',
    options: ['zdvojnásobí sa', 'klesne na polovicu', 'nezmení sa', 'zväčší sa štvornásobne'],
    explanation: '`$τ = $R · $C` – časová konštanta je úmerná odporu aj kapacite.',
  },

  // Magnetizmus a cievka
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Akou jednotkou meriame magnetickú indukciu?',
    options: ['tesla (T)', 'weber (Wb)', 'henry (H)', 'ampér na meter (A/m)'],
    explanation: 'Weber je jednotka magnetického toku, henry indukčnosti a A/m intenzity magnetického poľa.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Kedy sa v cievke indukuje napätie?',
    options: ['keď sa mení magnetický tok cievkou', 'keď je cievka v stálom magnetickom poli', 'iba keď ňou tečie jednosmerný prúd', 'nikdy bez pripojeného zdroja'],
    explanation: 'Podľa Faradayovho zákona je indukované napätie úmerné rýchlosti zmeny toku. Stály tok napätie neindukuje.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Čo hovorí Lenzov zákon?',
    options: ['indukovaný prúd pôsobí proti zmene, ktorá ho vyvolala', 'indukované napätie je úmerné počtu závitov', 'sila na vodič je B · I · l', 'magnetický tok je B · S'],
    explanation: 'Lenzov zákon určuje smer indukovaného prúdu, preto je vo Faradayovom zákone znamienko mínus.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Prečo sa ku cievke relé pripája nulová dióda?',
    options: ['chráni obvod pred napäťovou špičkou pri vypnutí', 'zvyšuje silu relé', 'usmerňuje striedavý prúd', 'znižuje odber prúdu'],
    explanation: 'Pri vypnutí cievka indukuje veľké napätie. Dióda mu umožní uzavrieť sa cez cievku a ochráni tranzistor.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Ako sa zmení energia v cievke, ak sa prúd zdvojnásobí?',
    options: ['zväčší sa štvornásobne', 'zdvojnásobí sa', 'nezmení sa', 'klesne na polovicu'],
    explanation: '`$W = @f{1}{2} · $L · $I^{2}` – prúd je v druhej mocnine.',
  },

  // Striedavý prúd
  {
    lessonId: 'striedavy-prud',
    prompt: 'Aká je frekvencia elektrickej siete na Slovensku?',
    options: ['50 Hz', '60 Hz', '230 Hz', '400 Hz'],
    explanation: 'V Európe má sieť 50 Hz, v USA 60 Hz.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Sieťové napätie 230 V je hodnota…',
    options: ['efektívna', 'maximálna (amplitúda)', 'stredná', 'okamžitá'],
    explanation: 'Amplitúda je 230 · √2 ≈ 325 V.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Aká je perióda napätia s frekvenciou 50 Hz?',
    options: ['20 ms', '50 ms', '2 ms', '0,5 s'],
    explanation: '`$T = @f{1}{$f} = @f{1}{50}` = 0,02 s = 20 ms.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Aký je vzťah medzi amplitúdou a efektívnou hodnotou sínusového napätia?',
    options: ['`$U = @f{$U_{m}}{@s{2}}`', '`$U = $U_{m} · @s{2}`', '`$U = @f{$U_{m}}{2}`', '`$U = $U_{m}`'],
    explanation: 'Efektívna hodnota je približne 0,707-násobok amplitúdy.',
  },

  // Obvody RLC
  {
    lessonId: 'obvody-rlc',
    prompt: 'Ako sa zmení reaktancia cievky, ak zvýšiš frekvenciu?',
    options: ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: '`$X_{L} = 2π$f$L` je priamo úmerná frekvencii.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Ako sa zmení reaktancia kondenzátora, ak zvýšiš frekvenciu?',
    options: ['zmenší sa', 'zväčší sa', 'nezmení sa', 'bude nekonečná'],
    explanation: '`$X_{C} = @f{1}{2π$f$C}` je nepriamo úmerná frekvencii.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Čo platí pri rezonancii sériového obvodu RLC?',
    options: ['`$X_{L} = $X_{C}` a impedancia je najmenšia', '`$X_{L}` = 0', 'prúd je nulový', '`$Z = $X_{L} + $X_{C}`'],
    explanation: 'Reaktancie sa vyrušia, zostane len odpor `$R` a prúd je najväčší.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'V obvode s ideálnou cievkou prúd voči napätiu…',
    options: ['zaostáva o 90°', 'predbieha o 90°', 'je vo fáze', 'je posunutý o 180°'],
    explanation: 'Cievka bráni zmene prúdu, preto prúd za napätím zaostáva. Pri kondenzátore prúd predbieha.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'V akej jednotke sa udáva jalový výkon?',
    options: ['var', 'W', 'VA', 'Wh'],
    explanation: 'Činný výkon je vo W, jalový vo var a zdanlivý vo VA.',
  },

  // Farebný kód
  {
    lessonId: 'farebny-kod',
    prompt: 'Ktorá farba znamená číslicu 4?',
    options: ['žltá', 'oranžová', 'zelená', 'fialová'],
    explanation: 'Poradie: čierna 0, hnedá 1, červená 2, oranžová 3, žltá 4, zelená 5, modrá 6, fialová 7, sivá 8, biela 9.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Aký odpor má rezistor s prúžkami červená – červená – hnedá – zlatá?',
    options: ['220 Ω ±5 %', '22 Ω ±5 %', '2,2 kΩ ±5 %', '221 Ω ±1 %'],
    explanation: 'červená 2, červená 2, hnedá = násobiteľ 10 → 22 · 10 = 220 Ω, zlatá ±5 %.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Čo znamená zlatý prúžok na mieste tolerancie?',
    options: ['±5 %', '±10 %', '±1 %', '±2 %'],
    explanation: 'Zlatá ±5 %, strieborná ±10 %, hnedá ±1 %, červená ±2 %.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Ako sa na schéme zapíše 4,7 kΩ v kóde bez desatinnej čiarky?',
    options: ['4k7', '47k', '4K70', 'k47'],
    explanation: 'Písmeno predpony nahrádza desatinnú čiarku: 4k7 = 4,7 kΩ.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Ktorá hodnota NEPATRÍ do rady E12?',
    options: ['5,0', '4,7', '3,3', '6,8'],
    explanation: 'E12: 1,0 1,2 1,5 1,8 2,2 2,7 3,3 3,9 4,7 5,6 6,8 8,2.',
  },

  // Dióda a LED
  {
    lessonId: 'polovodice',
    prompt: 'Kedy dióda vedie prúd?',
    options: ['v priepustnom smere po prekročení prahového napätia', 'vždy', 'iba v závernom smere', 'iba pri striedavom napätí'],
    explanation: 'V priepustnom smere je anóda kladnejšia ako katóda a napätie musí prekročiť prahovú hodnotu.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Aké je približné prahové napätie kremíkovej diódy?',
    options: ['0,7 V', '0,07 V', '7 V', '3,3 V'],
    explanation: 'Kremík ≈ 0,7 V, germánium ≈ 0,3 V, LED podľa farby približne 1,8 až 3,4 V.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Prečo zapájame k LED predradný rezistor?',
    options: ['obmedzuje prúd LED', 'zvyšuje napätie na LED', 'mení farbu svetla', 'chráni zdroj pred prepätím'],
    explanation: 'LED má po otvorení veľmi malý dynamický odpor. Bez rezistora by prúd narástol a LED by sa zničila.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Ako spoznáš katódu LED?',
    options: ['kratší vývod a zrezaná hrana puzdra', 'dlhší vývod', 'je vždy vľavo', 'katóda sa nedá spoznať'],
    explanation: 'Anóda má dlhší vývod, katóda kratší a na jej strane je puzdro zrezané.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Vypočítaný predradný rezistor vyšiel 196 Ω. Ktorú hodnotu z rady E12 vyberieš?',
    options: ['220 Ω', '180 Ω', '150 Ω', '100 Ω'],
    explanation: 'Zaokrúhľujeme nahor, aby prúd LED neprekročil povolenú hodnotu.',
  },
];

export const QUESTIONS: readonly StaticQuestion[] = [...BASE_QUESTIONS, ...MEAS_MODULES.flatMap((m) => m.questions)];
