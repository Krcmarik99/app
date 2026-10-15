import { MODULES } from './all-modules';

/** Otázky s výberom odpovede. Prvá možnosť je vždy správna – pri zobrazení sa zamiešajú. */
export interface StaticQuestion {
  lessonId: string;
  prompt: string;
  /** Otázka vyžaduje výpočet so zadanými číslami – test „len teória“ ju vynechá. */
  calc?: boolean;
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
    calc: true,
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
  {
    lessonId: 'zaklady',
    prompt: 'Ako zapojíš voltmeter, keď meriaš napätie na spotrebiči?',
    options: ['paralelne k spotrebiču', 'do série so spotrebičom', 'do série s ampérmetrom', 'paralelne k ampérmetru'],
    explanation: 'Napätie je rozdiel potenciálov medzi dvoma bodmi, preto voltmeter pripájaš na svorky spotrebiča. Má veľký vnútorný odpor, v sérii by obvod takmer prerušil.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Čo je elektrický prúd?',
    options: ['usporiadaný pohyb nosičov náboja', 'neusporiadaný tepelný pohyb elektrónov', 'rozdiel potenciálov medzi dvoma bodmi', 'schopnosť látky brániť pohybu náboja'],
    explanation: 'Prúd je usporiadaný pohyb nosičov náboja, v kovoch elektrónov. Rozdiel potenciálov je napätie a bránenie prechodu prúdu vyjadruje odpor.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Ktorý vzťah vyjadruje prúd pomocou náboja a času?',
    options: ['`$I = @f{$Q}{$t}`', '`$I = $Q · $t`', '`$I = @f{$t}{$Q}`', '`$I = @f{$Q}{$U}`'],
    explanation: 'Prúd udáva, aký náboj prejde prierezom vodiča za jednotku času. Z toho vyplýva aj `$Q = $I · $t`.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Ako sa nazýva prevrátená hodnota odporu a aká je jej jednotka?',
    options: ['vodivosť, siemens (S)', 'rezistivita, Ω·m', 'vodivosť, coulomb (C)', 'impedancia, siemens (S)'],
    explanation: 'Vodivosť `$G = @f{1}{$R}` sa meria v siemensoch. Rezistivita (Ω·m) je vlastnosť materiálu a impedancia (Ω) je zdanlivý odpor v striedavom obvode.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Čo musí platiť, keď meriaš odpor rezistora ohmmetrom?',
    options: ['rezistor musí byť bez napätia', 'obvod musí byť pod napätím', 'ohmmeter zapojíš do série so zdrojom', 'meria sa len pri striedavom napätí'],
    explanation: 'Ohmmeter má vlastný zdroj a odpor určuje z prúdu, ktorý ním vyvolá. Cudzie napätie v obvode by meranie skreslilo a mohlo by prístroj poškodiť.',
  },
  {
    lessonId: 'zaklady',
    prompt: 'Ktorá predpona označuje násobok 10⁶?',
    options: ['mega (M)', 'mili (m)', 'mikro (µ)', 'giga (G)'],
    explanation: 'Mega (veľké M) je 10⁶, mili (malé m) je 10⁻³. Pri zápise jednotiek preto záleží na veľkosti písmena: MΩ a mΩ sú úplne odlišné hodnoty.',
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
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Ako znie Ohmov zákon?',
    options: ['prúd je priamo úmerný napätiu a nepriamo úmerný odporu', 'prúd je priamo úmerný odporu a nepriamo úmerný napätiu', 'napätie je nepriamo úmerné prúdu pri stálom odpore', 'odpor je priamo úmerný prúdu pri stálom napätí'],
    explanation: 'Zo vzťahu `$I = @f{$U}{$R}` vidíš, že prúd rastie s napätím a klesá s odporom. Odpor je vlastnosť vodiča, od prúdu nezávisí.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Čo sa stane s prúdom, keď odpor v obvode klesne takmer na nulu (skrat)?',
    options: ['prudko narastie', 'klesne na nulu', 'nezmení sa', 'zmení smer'],
    explanation: 'Podľa `$I = @f{$U}{$R}` pri veľmi malom odpore prúd prudko rastie. Preto obvody chránime poistkami a ističmi.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Ako sa zmení odpor rezistora, keď na ňom pri stálej teplote zdvojnásobíš napätie?',
    options: ['nezmení sa', 'zdvojnásobí sa', 'klesne na polovicu', 'zväčší sa štvornásobne'],
    explanation: 'Odpor závisí od materiálu a rozmerov rezistora, nie od napätia. Zdvojnásobí sa prúd a podiel `@f{$U}{$I}` zostane rovnaký.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'V grafe závislosti `$I` od `$U` máš priamky dvoch rezistorov. Ktorý z nich má väčší odpor?',
    options: ['ten, ktorého priamka je menej strmá', 'ten, ktorého priamka je strmšia', 'oba rovnaký, lebo idú cez začiatok', 'ten, ktorého priamka je dlhšia'],
    explanation: 'Strmosť priamky `$I($U)` je `@f{1}{$R}`. Pri väčšom odpore prúd s napätím rastie pomalšie, preto je priamka plochšia.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Prečo graf závislosti `$I` od `$U` pre žiarovku nie je priamka?',
    options: ['vlákno sa zahrieva a jeho odpor rastie', 'vlákno sa zahrieva a jeho odpor klesá', 'žiarovka vedie prúd len jedným smerom', 'napätie na žiarovke sa nedá meniť'],
    explanation: 'Kovové vlákno má kladný teplotný súčiniteľ odporu. S rastúcim prúdom sa zahrieva, jeho odpor rastie a prúd rastie pomalšie ako napätie.',
  },
  {
    lessonId: 'ohmov-zakon',
    prompt: 'Ktorej jednotke sa rovná podiel V/A?',
    options: ['ohm (Ω)', 'siemens (S)', 'watt (W)', 'coulomb (C)'],
    explanation: 'Z `$R = @f{$U}{$I}` vyplýva 1 Ω = 1 V/A. Siemens je A/V, watt je V·A a coulomb je A·s.',
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
  {
    lessonId: 'odpor-vodica',
    prompt: 'Akú praktickú jednotku má rezistivita, keď prierez dosádzaš v mm² a dĺžku v metroch?',
    options: ['Ω·mm²/m', 'Ω·m/mm²', 'Ω/mm²', 'Ω·m²'],
    explanation: 'Zo vzťahu `$ρ = @f{$R · $S}{$l}` vyjde jednotka Ω·mm²/m. V základných jednotkách SI je to Ω·m.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Ako sa mení odpor termistora NTC s rastúcou teplotou?',
    options: ['klesá', 'rastie', 'nemení sa', 'rastie skokom'],
    explanation: 'NTC znamená záporný (negatívny) teplotný súčiniteľ. Polovodiče a uhlík majú `$α` záporné, ich odpor s teplotou klesá.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Z ktorého materiálu sa vyrábajú vykurovacie špirály?',
    options: ['chrómnikel', 'meď', 'striebro', 'hliník'],
    explanation: 'Chrómnikel má veľkú rezistivitu a znesie vysokú teplotu bez oxidácie. Meď, striebro a hliník vedú veľmi dobre, preto sa hodia na vodiče.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Ako sa zmení odpor vodiča, ak zdvojnásobíš jeho priemer?',
    options: ['klesne na štvrtinu', 'klesne na polovicu', 'zdvojnásobí sa', 'zväčší sa štvornásobne'],
    explanation: 'Prierez kruhového vodiča rastie s druhou mocninou priemeru, `$S = @f{π$d^{2}}{4}`. Dvojnásobný priemer znamená štvornásobný prierez, a teda štvrtinový odpor.',
  },
  {
    lessonId: 'odpor-vodica',
    prompt: 'Čo vyjadruje teplotný súčiniteľ odporu `$α`?',
    options: ['pomernú zmenu odporu pri zmene teploty o 1 K', 'odpor vodiča dĺžky 1 m s prierezom 1 mm²', 'teplotu, pri ktorej vodič stratí odpor', 'predĺženie vodiča pri ohreve o 1 K'],
    explanation: 'Súčiniteľ `$α` má jednotku K⁻¹ a hovorí, o akú časť sa odpor zmení pri zmene teploty o 1 K. Odpor vodiča dĺžky 1 m s prierezom 1 mm² je rezistivita.',
  },

  // Spájanie rezistorov
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Tri rezistory po 300 Ω sú zapojené paralelne. Aký je výsledný odpor?',
    calc: true,
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
    calc: true,
    options: ['2 kΩ', '500 Ω', '1 kΩ', '1 MΩ'],
    explanation: 'V sérii sa odpory sčítajú: 1 kΩ + 1 kΩ = 2 kΩ.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Výsledný odpor sériového zapojenia je vždy…',
    options: ['väčší ako najväčší z odporov', 'menší ako najmenší z odporov', 'rovný ich priemeru', 'rovný najväčšiemu z odporov'],
    explanation: 'V sérii sa odpory sčítajú, takže každý ďalší rezistor výsledný odpor zväčší.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Na ktorom z dvoch sériovo zapojených rezistorov je väčšie napätie?',
    options: ['na rezistore s väčším odporom', 'na rezistore s menším odporom', 'na oboch je rovnaké napätie', 'na tom, ktorý je bližšie k + pólu'],
    explanation: 'Oboma tečie rovnaký prúd, takže podľa `$U = $R · $I` je väčšie napätie na väčšom odpore: `$U_{1} : $U_{2} = $R_{1} : $R_{2}`.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Ktorý vzťah platí pre výsledný odpor dvoch paralelne zapojených rezistorov?',
    options: ['`$R = @f{$R_{1} · $R_{2}}{$R_{1} + $R_{2}}`', '`$R = $R_{1} + $R_{2}`', '`$R = @f{$R_{1} + $R_{2}}{$R_{1} · $R_{2}}`', '`$R = @f{$R_{1} · $R_{2}}{$R_{1} − $R_{2}}`'],
    explanation: 'Pre dva paralelné rezistory platí „súčin lomeno súčet“. Výraz `@f{$R_{1} + $R_{2}}{$R_{1} · $R_{2}}` je prevrátená hodnota výsledného odporu a súčet odporov platí pre sériu.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Ako sa zmení celkový prúd zo zdroja, keď k spotrebiču pripojíš paralelne ďalší spotrebič?',
    options: ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: 'Pribudne ďalšia vetva, výsledný odpor klesne a zo zdroja sa odoberá väčší prúd. Prúd pôvodným spotrebičom sa pri ideálnom zdroji nezmení.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'V sériovom reťazci žiaroviek sa v jednej preruší vlákno. Čo sa stane?',
    options: ['zhasnú všetky žiarovky', 'zhasne len chybná žiarovka', 'ostatné budú svietiť jasnejšie', 'ostatné budú svietiť slabšie'],
    explanation: 'V sériovom zapojení má prúd jedinú cestu. Prerušením kdekoľvek sa obvod rozpojí a prúd netečie žiadnou žiarovkou.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Ako sú zapojené spotrebiče v zásuvkách domácej elektroinštalácie?',
    options: ['paralelne, každý má plné napätie siete', 'sériovo, všetkými tečie rovnaký prúd', 'sériovo, napätie siete sa medzi ne delí', 'zmiešane, vždy po dvoch v sérii'],
    explanation: 'Spotrebiče sú zapojené paralelne, takže každý dostane plné sieťové napätie a môžeš ich zapínať nezávisle od seba.',
  },
  {
    lessonId: 'spajanie-rezistorov',
    prompt: 'Aký je výsledný odpor dvoch rovnakých rezistorov zapojených paralelne?',
    options: ['polovica odporu jedného', 'dvojnásobok odporu jedného', 'rovnaký ako odpor jedného', 'štvrtina odporu jedného'],
    explanation: 'Dve rovnaké vetvy vedú dvakrát väčší prúd ako jedna, výsledný odpor je preto polovičný. Všeobecne `$n` rovnakých rezistorov paralelne dá `@f{$R}{$n}`.',
  },

  // Kirchhoffove zákony
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Do uzla vtekajú prúdy 2 A a 3 A a vyteká z neho jediný prúd. Aký veľký?',
    calc: true,
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
    calc: true,
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
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Čo hovorí 1. Kirchhoffov zákon?',
    options: ['súčet prúdov do uzla sa rovná súčtu prúdov z uzla', 'súčet napätí v uzavretej slučke sa rovná nule', 'do každej vetvy z uzla tečie rovnako veľký prúd', 'prúd vytekajúci z uzla je úmerný napätiu zdroja'],
    explanation: 'Prúdový (1.) Kirchhoffov zákon platí pre uzly: náboj sa v uzle nehromadí ani nestráca. Súčet napätí v slučke je obsahom 2. zákona.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Z ktorého fyzikálneho zákona vyplýva 2. Kirchhoffov zákon?',
    options: ['zo zákona zachovania energie', 'zo zákona zachovania náboja', 'z Lenzovho zákona', 'z Coulombovho zákona'],
    explanation: 'Náboj, ktorý obehne slučku, sa vráti na rovnaký potenciál, preto sa energia dodaná zdrojmi rovná energii spotrebovanej na úbytkoch. Zo zachovania náboja vyplýva 1. zákon.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Čo je uzol elektrického obvodu?',
    options: ['miesto, kde sa spájajú aspoň tri vetvy', 'každý vývod rezistora alebo zdroja', 'uzavretá dráha prúdu v obvode', 'úsek obvodu medzi zdrojom a spotrebičom'],
    explanation: 'V uzle sa prúd rozdeľuje alebo spája, preto sa v ňom musia stretnúť aspoň tri vetvy. Uzavretá dráha v obvode sa nazýva slučka.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Na čo sa používa delič napätia?',
    options: ['na získanie menšieho napätia z väčšieho', 'na získanie väčšieho napätia z menšieho', 'na usmernenie striedavého napätia', 'na stabilizáciu napätia pri zmene záťaže'],
    explanation: 'Delič z dvoch rezistorov dáva na výstupe časť vstupného napätia. Napätie nestabilizuje – pri zaťažení výstupné napätie klesá.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Ktorý vzťah platí pre výstupné napätie nezaťaženého deliča, ak výstup odoberáš z `$R_{2}`?',
    options: ['`$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}`', '`$U_{2} = $U · @f{$R_{1}}{$R_{1} + $R_{2}}`', '`$U_{2} = $U · @f{$R_{1} + $R_{2}}{$R_{2}}`', '`$U_{2} = $U · @f{$R_{2}}{$R_{1}}`'],
    explanation: 'Oboma rezistormi tečie prúd `@f{$U}{$R_{1} + $R_{2}}` a napätie na `$R_{2}` je jeho súčin s `$R_{2}`. Výstupné napätie je preto vždy menšie ako vstupné.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Ako sa zmení výstupné napätie nezaťaženého deliča, ak zväčšíš rezistor `$R_{2}`, na ktorom ho meriaš?',
    options: ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: 'Na väčšom odpore v sérii je väčšia časť napätia. Pomer `@f{$R_{2}}{$R_{1} + $R_{2}}` s rastúcim `$R_{2}` rastie.',
  },
  {
    lessonId: 'kirchhoffove-zakony',
    prompt: 'Ktorý vzťah platí pre prúd `$I_{1}` vetvou s rezistorom `$R_{1}` v deliči prúdu z dvoch paralelných rezistorov?',
    options: ['`$I_{1} = $I · @f{$R_{2}}{$R_{1} + $R_{2}}`', '`$I_{1} = $I · @f{$R_{1}}{$R_{1} + $R_{2}}`', '`$I_{1} = $I · @f{$R_{1} + $R_{2}}{$R_{1}}`', '`$I_{1} = $I · @f{$R_{1}}{$R_{2}}`'],
    explanation: 'V čitateli je odpor druhej vetvy, preto väčší prúd tečie vetvou s menším odporom. Pozor, pri deliči napätia je v čitateli vlastný odpor.',
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
  {
    lessonId: 'zdroj',
    prompt: 'Akým modelom nahrádzaš reálny zdroj napätia?',
    options: ['ideálny zdroj so sériovým vnútorným odporom', 'ideálny zdroj s paralelným vnútorným odporom', 'ideálny zdroj bez vnútorného odporu', 'rezistor so sériovým kondenzátorom'],
    explanation: 'Reálny zdroj napätia modelujeme ideálnym zdrojom `$U_{e}` a sériovým vnútorným odporom `$R_{i}`. Na ňom vzniká úbytok napätia, keď zo zdroja odoberáš prúd.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Aká je účinnosť prenosu energie pri výkonovom prispôsobení `$R_{z} = $R_{i}`?',
    options: ['50 %', '100 %', '25 %', '75 %'],
    explanation: 'Záťažou aj vnútorným odporom tečie rovnaký prúd a majú rovnaký odpor, takže polovica výkonu sa premení na teplo vo vnútri zdroja.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Ako vyzerá zaťažovacia charakteristika `$U = f($I)` reálneho zdroja?',
    options: ['klesajúca priamka', 'stúpajúca priamka', 'vodorovná priamka', 'parabola'],
    explanation: 'Podľa `$U = $U_{e} − $R_{i} · $I` napätie s prúdom lineárne klesá. Os napätia pretína v bode `$U_{e}` (naprázdno), os prúdu v bode `$I_{k}` (nakrátko).',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Ako zmeriaš elektromotorické napätie článku?',
    options: ['voltmetrom s veľkým odporom naprázdno', 'ampérmetrom pri skrate článku', 'voltmetrom pri plnom zaťažení', 'ohmmetrom pripojeným na svorky'],
    explanation: 'Voltmeter s veľkým vnútorným odporom odoberá zanedbateľný prúd, úbytok na `$R_{i}` je preto takmer nulový a svorkové napätie sa rovná `$U_{e}`.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Prečo je skrat autobatérie nebezpečný, hoci má len 12 V?',
    options: ['malý vnútorný odpor pripustí obrovský prúd', 'pri skrate sa jej napätie prudko zvýši', 'skrat obráti polaritu jej článkov', 'veľký vnútorný odpor sa prudko zahreje'],
    explanation: 'Skratový prúd `$I_{k} = @f{$U_{e}}{$R_{i}}` obmedzuje iba vnútorný odpor. Pri autobatérii je veľmi malý, prúd dosiahne stovky ampérov a vodiče sa prudko zahrejú.',
  },
  {
    lessonId: 'zdroj',
    prompt: 'Čo platí, keď zapojíš niekoľko rovnakých článkov do série?',
    options: ['sčíta sa napätie aj vnútorný odpor', 'sčíta sa napätie, vnútorný odpor klesne', 'napätie ostane, sčíta sa vnútorný odpor', 'napätie ostane, vnútorný odpor klesne'],
    explanation: 'V sérii sa sčítajú elektromotorické napätia aj vnútorné odpory článkov. Paralelné spojenie rovnakých článkov zachová napätie a vnútorný odpor zmenší.',
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
    calc: true,
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
    calc: true,
    options: ['80 %', '125 %', '60 %', '20 %'],
    explanation: '`$η = @f{1,6}{2}` · 100 % = 80 %. Účinnosť nikdy nemôže presiahnuť 100 %.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorý vzťah pre výkon NIE je správny?',
    options: ['`$P = @f{$R}{$I^{2}}`', '`$P = $U · $I`', '`$P = $R · $I^{2}`', '`$P = @f{$U^{2}}{$R}`'],
    explanation: 'Správne je `$P = $R · $I^{2}`, prúd v menovateli nebýva.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Čo vyjadruje elektrický výkon?',
    options: ['prácu vykonanú za jednotku času', 'celkovú energiu spotrebovanú za deň', 'náboj prenesený za jednotku času', 'odpor spotrebiča pri zaťažení'],
    explanation: 'Výkon hovorí, ako rýchlo spotrebič premieňa energiu, `$P = @f{$W}{$t}`. Náboj prenesený za jednotku času je prúd.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Dve žiarovky sú určené na rovnaké napätie, jedna má 40 W a druhá 100 W. Ktorá má väčší odpor vlákna?',
    options: ['žiarovka 40 W', 'žiarovka 100 W', 'obe majú rovnaký', 'závisí to od dĺžky svietenia'],
    explanation: 'Pri rovnakom napätí platí `$P = @f{$U^{2}}{$R}`, takže menší výkon znamená väčší odpor.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Čo označujeme ako príkon spotrebiča?',
    options: ['výkon, ktorý spotrebič odoberá zo zdroja', 'užitočný výkon, ktorý spotrebič odovzdá', 'výkon, ktorý sa v spotrebiči stratí', 'energiu spotrebovanú za jednu hodinu'],
    explanation: 'Príkon `$P_{1}` je odoberaný výkon, výkon `$P_{2}` je užitočný. Ich rozdiel tvoria straty, najčastejšie teplo.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorý vzťah vyjadruje účinnosť?',
    options: ['`$η = @f{$P_{2}}{$P_{1}}`', '`$η = @f{$P_{1}}{$P_{2}}`', '`$η = $P_{1} − $P_{2}`', '`$η = $P_{1} · $P_{2}`'],
    explanation: 'Účinnosť je pomer užitočného výkonu `$P_{2}` k príkonu `$P_{1}`. Výkon je vždy menší ako príkon, preto je účinnosť menšia ako 1 (100 %).',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorý parameter rezistora musíš okrem odporu sledovať, aby sa rezistor neprehrial?',
    options: ['dovolené výkonové zaťaženie', 'toleranciu odporu', 'teplotný súčiniteľ odporu', 'počet farebných prúžkov'],
    explanation: 'Rezistor premieňa výkon `$R · $I^{2}` na teplo. Bežné malé rezistory znesú 0,25 W alebo 0,6 W, pri väčšom výkone treba väčší typ.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorá jednotka je rovnaká ako joule?',
    options: ['W·s', 'W/s', 'A·s', 'V/A'],
    explanation: 'Z `$W = $P · $t` vyplýva 1 J = 1 W · 1 s. A·s je coulomb a V/A je ohm.',
  },
  {
    lessonId: 'vykon-a-praca',
    prompt: 'Ktorá súčiastka využíva tepelné účinky prúdu?',
    options: ['tavná poistka', 'transformátor', 'elektromagnetické relé', 'reproduktor'],
    explanation: 'Pri prechode prúdu odporom vzniká Joulovo teplo. Pri nadprúde sa tavný vodič poistky roztaví a obvod preruší, ostatné súčiastky využívajú magnetické účinky prúdu.',
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
    calc: true,
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
  {
    lessonId: 'kondenzator',
    prompt: 'Z čoho sa skladá kondenzátor?',
    options: ['z dvoch elektród oddelených dielektrikom', 'z vodiča navinutého na feromagnetickom jadre', 'z priechodu medzi polovodičmi P a N', 'z dvoch izolantov spojených vodičom'],
    explanation: 'Dve vodivé elektródy oddeľuje izolant (dielektrikum). Po pripojení napätia sa na nich nahromadí náboj a energia sa uloží v elektrickom poli.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Čo je rovnaké pre všetky kondenzátory v sériovom zapojení?',
    options: ['náboj', 'napätie', 'kapacita', 'energia'],
    explanation: 'Sériovo zapojenými kondenzátormi prejde ten istý nabíjací prúd, preto majú rovnaký náboj. Napätie sa medzi ne rozdelí.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Ako sa zmení kapacita kondenzátora, ak medzi elektródy vložíš dielektrikum s väčšou relatívnou permitivitou?',
    options: ['zväčší sa', 'zmenší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: 'Kapacita je priamo úmerná relatívnej permitivite: `$C = $ε_{0} · $ε_{r} · @f{$S}{$d}`.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Na čo musíš dávať pozor pri zapájaní elektrolytického kondenzátora?',
    options: ['na správnu polaritu vývodov', 'na smer navinutia elektród', 'na poradie farebných prúžkov', 'na frekvenciu sieťového napätia'],
    explanation: 'Elektrolytický kondenzátor je polarizovaný. Pri prepólovaní sa poškodí jeho dielektrikum a kondenzátor sa môže prehriať alebo vybuchnúť.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Za aký čas sa kondenzátor v obvode RC prakticky úplne nabije?',
    options: ['približne za `5$τ`', 'presne za `$τ`', 'približne za `2$τ`', 'približne za `0,5$τ`'],
    explanation: 'Za čas `$τ` sa nabije na 63 %, za `5$τ` na viac ako 99 % napätia zdroja. Preto sa v praxi počíta s piatimi časovými konštantami.',
  },
  {
    lessonId: 'kondenzator',
    prompt: 'Kedy je nabíjací prúd kondenzátora cez rezistor najväčší?',
    options: ['hneď po pripojení zdroja', 'keď je kondenzátor takmer nabitý', 'presne v čase `$τ`', 'počas celého nabíjania je rovnaký'],
    explanation: 'Na začiatku je kondenzátor vybitý a celé napätie zdroja je na rezistore. S nabíjaním napätie na rezistore klesá, a tým aj prúd.',
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
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Ako určíš smer magnetických indukčných čiar okolo priameho vodiča s prúdom?',
    options: ['pravou rukou: palec v smere prúdu, prsty ukazujú čiary', 'pravou rukou: prsty v smere prúdu, palec ukazuje čiary', 'ľavou rukou: palec v smere prúdu, prsty ukazujú čiary', 'čiary smerujú vždy kolmo od vodiča von'],
    explanation: 'Podľa pravidla pravej ruky uchopíš vodič tak, aby palec ukazoval smer prúdu. Zahnuté prsty ukazujú smer indukčných čiar, ktoré tvoria sústredné kružnice.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Prečo sa do cievky vkladá jadro z feromagnetického materiálu?',
    options: ['zväčší magnetickú indukciu aj indukčnosť', 'zmenší odpor vinutia cievky', 'zabráni vzniku indukovaného napätia', 'zmenší magnetický tok cievkou'],
    explanation: 'Železo má relatívnu permeabilitu `$μ_{r}` stovky až tisíce, preto pri rovnakom prúde vznikne oveľa silnejšie pole a indukčnosť vzrastie.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Kedy pôsobí magnetické pole na vodič s prúdom najväčšou silou?',
    options: ['keď je vodič kolmý na indukčné čiary', 'keď je vodič rovnobežný s indukčnými čiarami', 'keď zviera s čiarami uhol 45°', 'sila nezávisí od polohy vodiča'],
    explanation: 'Vzťah `$F = $B · $I · $l` platí pre vodič kolmý na indukčné čiary, vtedy je sila najväčšia. Na vodič rovnobežný s čiarami sila nepôsobí.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Magnetický tok cievkou sa zmení o rovnakú hodnotu, ale za polovičný čas. Ako sa zmení indukované napätie?',
    options: ['zdvojnásobí sa', 'klesne na polovicu', 'nezmení sa', 'zväčší sa štvornásobne'],
    explanation: 'Podľa Faradayovho zákona `$u_{i} = −$N · @f{Δ$Φ}{Δ$t}` je indukované napätie úmerné rýchlosti zmeny toku. Rýchlejšia zmena indukuje väčšie napätie.',
  },
  {
    lessonId: 'magnetizmus-cievka',
    prompt: 'Čo vyjadruje indukčnosť cievky?',
    options: ['ako veľmi cievka bráni zmene prúdu', 'aký odpor má drôt vinutia', 'aký náboj cievka uchová na závitoch', 'ako rýchlo sa cievka zahrieva'],
    explanation: 'Indukčnosť `$L` udáva, aké napätie sa v cievke indukuje pri danej rýchlosti zmeny prúdu, `$u = $L · @f{Δ$i}{Δ$t}`. Jednotkou je henry (H).',
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
    calc: true,
    options: ['20 ms', '50 ms', '2 ms', '0,5 s'],
    explanation: '`$T = @f{1}{$f} = @f{1}{50}` = 0,02 s = 20 ms.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Aký je vzťah medzi amplitúdou a efektívnou hodnotou sínusového napätia?',
    options: ['`$U = @f{$U_{m}}{@s{2}}`', '`$U = $U_{m} · @s{2}`', '`$U = @f{$U_{m}}{2}`', '`$U = $U_{m}`'],
    explanation: 'Efektívna hodnota je približne 0,707-násobok amplitúdy.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Čo je perióda striedavého napätia?',
    options: ['čas, za ktorý prebehne jeden celý kmit', 'počet kmitov za jednu sekundu', 'najväčšia hodnota napätia', 'čas od nuly po najväčšiu hodnotu'],
    explanation: 'Perióda `$T` je doba jedného celého kmitu v sekundách. Počet kmitov za sekundu je frekvencia `$f = @f{1}{$T}`.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Čo vyjadruje efektívna hodnota striedavého prúdu?',
    options: ['jednosmerný prúd s rovnakým tepelným účinkom', 'najväčšiu hodnotu prúdu počas periódy', 'priemer prúdu za celú periódu', 'okamžitú hodnotu prúdu v polovici periódy'],
    explanation: 'Efektívna hodnota je taký jednosmerný prúd, ktorý by v rezistore vyvinul rovnaké teplo. Priemer sínusového prúdu za celú periódu je nulový.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Ktorý vzťah platí pre uhlovú frekvenciu?',
    options: ['`$ω = 2π$f`', '`$ω = @f{2π}{$f}`', '`$ω = π$f`', '`$ω = @f{$f}{2π}`'],
    explanation: 'Za jednu periódu prejde uhol 2π rad, preto `$ω = @f{2π}{$T} = 2π$f`. Jednotkou je rad/s.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Ako sa zmení perióda striedavého napätia, ak zdvojnásobíš frekvenciu?',
    options: ['klesne na polovicu', 'zdvojnásobí sa', 'nezmení sa', 'klesne na štvrtinu'],
    explanation: 'Perióda a frekvencia sú navzájom prevrátené hodnoty, `$T = @f{1}{$f}`.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Čo je amplitúda sínusového napätia?',
    options: ['najväčšia okamžitá hodnota napätia', 'rozdiel kladného a záporného vrcholu', 'hodnota s rovnakým tepelným účinkom', 'okamžitá hodnota v čase nula'],
    explanation: 'Amplitúda `$U_{m}` je maximálna hodnota. Rozdiel kladného a záporného vrcholu je rozkmit (dvojnásobok amplitúdy) a rovnaký tepelný účinok má efektívna hodnota.',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Ako sa označuje okamžitá hodnota striedavého napätia?',
    options: ['malým písmenom `$u`', 'veľkým písmenom `$U`', 'veľkým písmenom s indexom `$U_{m}`', 'gréckym písmenom `$ω`'],
    explanation: 'Okamžité hodnoty píšeme malými písmenami (`$u`, `$i`), efektívne hodnoty veľkými (`$U`, `$I`) a amplitúdy s indexom m (`$U_{m}`).',
  },
  {
    lessonId: 'striedavy-prud',
    prompt: 'Prečo sa elektrická energia rozvádza najmä striedavým prúdom?',
    options: ['napätie sa dá jednoducho meniť transformátorom', 'striedavý prúd nespôsobuje straty vo vedení', 'striedavý prúd je pre človeka bezpečnejší', 'striedavý prúd sa dá ukladať v akumulátoroch'],
    explanation: 'Transformátor dokáže napätie zvýšiť na prenos (menší prúd, menšie straty) a znova znížiť pre spotrebiteľa. S jednosmerným napätím to tak jednoducho nejde.',
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
  {
    lessonId: 'obvody-rlc',
    prompt: 'Ako sa správa cievka v obvode s jednosmerným prúdom v ustálenom stave?',
    options: ['prepustí ho, obmedzuje ho len odpor vinutia', 'neprepustí ho, správa sa ako prerušenie', 'prepustí ho len krátko, potom ho zastaví', 'obmedzuje ho svojou reaktanciou `$X_{L}`'],
    explanation: 'Pri jednosmernom prúde je `$f` = 0, takže aj `$X_{L}` = 0. Cievka bráni len zmenám prúdu, ustálený jednosmerný prúd prepustí.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Ktorý vzťah platí pre impedanciu sériového obvodu RLC?',
    options: ['`$Z = @s{$R^{2} + ($X_{L} − $X_{C})^{2}}`', '`$Z = $R + $X_{L} + $X_{C}`', '`$Z = @s{$R^{2} + $X_{L}^{2} + $X_{C}^{2}}`', '`$Z = $R + $X_{L} − $X_{C}`'],
    explanation: 'Reaktancie cievky a kondenzátora pôsobia proti sebe, preto sa odčítajú. Odpor a výsledná reaktancia sa skladajú ako odvesny pravouhlého trojuholníka.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Čo vyjadruje účinník `cos $φ`?',
    options: ['podiel činného a zdanlivého výkonu', 'podiel jalového a činného výkonu', 'podiel zdanlivého a činného výkonu', 'súčin činného a jalového výkonu'],
    explanation: 'Platí `cos $φ = @f{$P}{$S} = @f{$R}{$Z}`. Pri čisto činnej záťaži je účinník 1, s rastúcim fázovým posunom klesá.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Aký charakter má sériový obvod RLC, keď `$X_{L} > $X_{C}`?',
    options: ['induktívny – prúd zaostáva za napätím', 'kapacitný – prúd predbieha napätie', 'činný – prúd je s napätím vo fáze', 'induktívny – prúd predbieha napätie'],
    explanation: 'Prevláda reaktancia cievky, obvod sa správa ako cievka s odporom a prúd zaostáva za napätím o uhol menší ako 90°.',
  },
  {
    lessonId: 'obvody-rlc',
    prompt: 'Ako sa zmení rezonančná frekvencia obvodu LC, ak zväčšíš kapacitu kondenzátora?',
    options: ['zmenší sa', 'zväčší sa', 'nezmení sa', 'klesne na nulu'],
    explanation: 'Podľa Thomsonovho vzťahu `$f_{0} = @f{1}{2π@s{$L$C}}` je kapacita v menovateli, s jej rastom rezonančná frekvencia klesá.',
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
  {
    lessonId: 'farebny-kod',
    prompt: 'Od ktorého okraja rezistora čítaš farebné prúžky?',
    options: ['od okraja, ku ktorému sú prúžky bližšie', 'od okraja so zlatým alebo strieborným prúžkom', 'od okraja s najtmavším prúžkom', 'na smere čítania nezáleží, výsledok je rovnaký'],
    explanation: 'Prvý prúžok je bližšie k okraju. Prúžok tolerancie (často zlatý alebo strieborný) býva na druhej strane, oddelený väčšou medzerou.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Čo znamená tretí prúžok na rezistore so štyrmi prúžkami?',
    options: ['násobiteľ', 'tretiu číslicu', 'toleranciu', 'teplotný súčiniteľ'],
    explanation: 'Pri štyroch prúžkoch sú prvé dva číslice, tretí je násobiteľ (mocnina desiatich) a štvrtý tolerancia. Tri číslice majú až rezistory s piatimi prúžkami.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Ktorej tolerancii zodpovedá normalizovaná rada E12?',
    options: ['±10 %', '±5 %', '±20 %', '±1 %'],
    explanation: 'Hodnoty v rade sú odstupňované tak, aby rozsahy susedných hodnôt s toleranciou na seba nadväzovali: E6 ±20 %, E12 ±10 %, E24 ±5 %, E96 ±1 %.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Čo znamená posledná číslica v trojmiestnom kóde SMD rezistora, napríklad 472?',
    options: ['počet núl za prvými dvoma číslicami', 'tretiu platnú číslicu hodnoty', 'toleranciu v percentách', 'dovolený výkon vo wattoch'],
    explanation: 'Prvé dve číslice sú platné, tretia je exponent násobiteľa 10 (počet núl). Kód 472 teda znamená 47 a dve nuly, čiže 4,7 kΩ.',
  },
  {
    lessonId: 'farebny-kod',
    prompt: 'Čo znamená údaj tolerancie ±5 % na rezistore?',
    options: ['skutočný odpor sa môže líšiť od menovitého najviac o 5 %', 'odpor sa pri ohreve o 1 °C zmení najviac o 5 %', 'rezistor znesie krátkodobo o 5 % väčší výkon', 'odpor sa počas životnosti zmenší najviac o 5 %'],
    explanation: 'Tolerancia udáva dovolenú výrobnú odchýlku skutočnej hodnoty od menovitej hodnoty vyznačenej na rezistore.',
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
  {
    lessonId: 'polovodice',
    prompt: 'Ktorý vývod diódy označuje na schematickej značke priečna čiarka?',
    options: ['katódu', 'anódu', 'bázu', 'emitor'],
    explanation: 'Trojuholník ukazuje smer prúdu od anódy ku katóde a končí pri čiarke katódy. Na puzdre diódy býva katóda označená prúžkom.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Ako sa správa kremíková dióda v závernom smere?',
    options: ['nevedie, kým sa neprekročí prierazné napätie', 'vedie, keď napätie na nej prekročí asi 0,7 V', 'vedie prúd úmerný napätiu, podobne ako rezistor', 'vedie, ale iba pri striedavom napätí zdroja'],
    explanation: 'V závernom smere tečie len zanedbateľný záverný prúd. Až pri prekročení prierazného napätia prúd prudko narastie a bežná dióda sa môže zničiť.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Ktorá z uvedených LED má najväčšie napätie v priepustnom smere?',
    options: ['modrá', 'červená', 'žltá', 'oranžová'],
    explanation: 'Napätie LED závisí od materiálu, a teda od farby svetla. Červená má približne 2 V, modrá a biela približne 3 V a viac.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Na čo sa používa usmerňovacia dióda?',
    options: ['na premenu striedavého prúdu na jednosmerný', 'na zosilnenie slabého signálu', 'na zvýšenie napätia zdroja', 'na uchovanie elektrického náboja'],
    explanation: 'Dióda prepustí prúd len jedným smerom, preto zo striedavého prúdu prejdú len polvlny jednej polarity. Zosilňuje tranzistor a náboj uchováva kondenzátor.',
  },
  {
    lessonId: 'polovodice',
    prompt: 'Bežnú kremíkovú diódu tvorí priechod medzi polovodičmi typu…',
    options: ['P a N', 'P a P', 'N a N', 'P, N a P'],
    explanation: 'Dióda je priechod PN: anóda je oblasť typu P, katóda oblasť typu N. Tri vrstvy (PNP alebo NPN) má bipolárny tranzistor.',
  },
];

export const QUESTIONS: readonly StaticQuestion[] = [...BASE_QUESTIONS, ...MODULES.flatMap((m) => m.questions)];
