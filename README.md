# ElektroLab

Webová aplikácia na učenie základov elektrotechniky pre stredné školy. Celá je v slovenčine,
funguje v prehliadači na počítači aj na mobile a nepotrebuje žiadny server.

## Čo obsahuje

- **20 lekcií** v piatich kapitolách – od elektrických veličín cez Ohmov a Kirchhoffove zákony,
  kondenzátor, cievku a striedavý prúd, farebný kód rezistorov a LED až po **elektrotechnické merania**
  (zákonné jednotky SI, meracie prístroje, trieda presnosti, chyby a neistota merania, chyby číslicových
  prístrojov, meranie odporu ohmmetrom a Ohmovou metódou). Každá lekcia má teóriu, vzorce s vysvetlením
  veličín, schémy, riešené príklady a krátky test na konci.
- **Cvičenie** – vyberieš témy a počet otázok. Číselné príklady (vyše 90 typov) sa generujú
  s novými hodnotami pri každom pokuse a pri chybe ukážu celý postup riešenia. K tomu viac ako 110 otázok
  s výberom odpovede.
- **11 kalkulačiek** – Ohmov zákon a výkon, sériové a paralelné spájanie rezistorov aj kondenzátorov,
  delič napätia (aj s návrhom rezistora z rady E24), farebný kód rezistorov oboma smermi,
  časová konštanta RC/RL s grafom, striedavý obvod RLC s trojuholníkom impedancií,
  predradný rezistor pre LED, odpor/úbytok napätia na vedení, chyba analógového a číslicového
  meracieho prístroja, Ohmova metóda (AV/VA) a konštanta a spotreba prístroja.
- **Kartičky** na opakovanie – veličiny a jednotky, vzorce, schematické značky, pojmy z meraní,
  základné jednotky SI a predpony.
- **Pokrok** – preštudované lekcie, úspešnosť podľa tém, séria dní učenia. Ukladá sa iba
  v prehliadači (localStorage).
- **Registrácia a prihlásenie** – každý, kto sa učí v tom istom prehliadači, môže mať vlastný účet
  a vlastný pokrok. Pri registrácii sa dá doterajší pokrok preniesť do nového účtu. Účty sa ukladajú
  len v danom prehliadači (žiadny server); heslo sa neukladá, len jeho odtlačok PBKDF2-SHA-256
  s náhodnou soľou. Na inom zariadení treba účet vytvoriť znova.
- **Zapájanie obvodov** (laboratórium) – súčiastky (rezistor, žiarovka, kondenzátor, elektrolytický kondenzátor,
  cievka, dióda, LED, tranzistor NPN/PNP, MOSFET N/P), zdroje (DC, AC), spínač a meracie prístroje
  (ampérmeter, voltmeter, multimeter, wattmeter, dvojkanálový osciloskop) sa vkladajú do mriežky
  a spájajú vodičmi. Obvod sa simuluje priebežne uzlovou metódou: nelineárne prvky Newtonovou iteráciou,
  kondenzátory a cievky metódou BDF2. Merače ukazujú stredné aj efektívne hodnoty, aplikácia upozorní
  na preťaženie, opačne zapojený elektrolyt či ampérmeter zapojený paralelne. Štrnásť hotových ukážok –
  každá súčiastka a prístroj má svoju ukážku zapojenia: pri výbere sa zobrazí náhľad schémy so zvýraznenou
  súčiastkou a nameranými hodnotami a jedným tlačidlom sa ukážka otvorí na doske.
  Vodič sa kreslí od svorky so zlommi a dokončí sa až na svorke alebo inom vodiči; pravé tlačidlo myši
  (alebo Esc) kreslenie zruší. Tlačidlo Stop zastaví čas obvodu a merače ukazujú posledné hodnoty.
- **Interaktívny obvod** na úvodnej stránke – napätie 0 až 500 V a odpor 0 Ω až 5 MΩ posuvníkom
  alebo zadaním hodnoty, schéma s rezistorom alebo s LED a predradným rezistorom.

Hodnoty v kalkulačkách môžeš písať s predponami tak, ako sú na schémach: `4k7`, `2,2µ`, `15m`, `1R5`.
Schematické značky sú podľa STN EN 60617 (rezistor ako obdĺžnik), veličiny sa sádzajú kurzívou
a jednotky vzpriamene.

## Spustenie

Potrebuješ [Node.js](https://nodejs.org/) 20 alebo novší.

```bash
npm install
npm run dev        # vývojový server na http://localhost:5173
```

### Jeden súbor bez servera

```bash
npm run build
```

Okrem bežného buildu v `dist/` vznikne aj `dist/elektrolab.html` – celá aplikácia v jednom súbore.
Stačí ho otvoriť dvojklikom alebo poslať spolužiakom. (Písma sa načítajú z Google Fonts;
bez internetu sa použijú systémové písma.)

### Testy

```bash
npm test           # jednotky, vzorce, farebný kód, generátory príkladov a vykreslenie stránok
npm run typecheck
```

## Štruktúra

```
src/
  content/      lekcie, otázky s výberom, kartičky (len dáta)
  content/meas/ kapitola Elektrotechnické merania – každá lekcia s otázkami a generátormi v jednom súbore
  practice/     generátory číselných príkladov a zostavenie cvičenia
  lib/          výpočty (electro), jednotky a predpony (units), farebný kód, vzorce, pokrok, účty (auth)
  ui/           schémy, grafy, karta otázky, interaktívny obvod na úvodnej stránke
  lab/          zapájanie obvodov: súčiastky, uzly, simulácia, značky, osciloskop, ukážky
  views/        stránky: domov, lekcie, cvičenie, kalkulačky, kartičky, zapájanie, účet
  router.ts     navigácia cez #kotvy (funguje aj na statickom hostingu)
tests/          testy (Vitest)
```

### Ako pridať obsah

- **Lekcia:** doplň objekt do `LESSONS` v `src/content/lessons.ts`. Text môže obsahovať vzorce
  v spätných apostrofoch: `` `$I = @f{$U}{$R}` `` – `$X` je veličina kurzívou, `_{1}` dolný index,
  `^{2}` horný index, `@f{a}{b}` zlomok, `@s{a}` odmocnina.
- **Otázka s výberom:** pridaj ju do `QUESTIONS` v `src/content/questions.ts` (prvá možnosť je správna,
  pri zobrazení sa zamiešajú).
- **Typ číselného príkladu:** pridaj generátor do `src/practice/generators.ts`. Test v
  `tests/practice.test.ts` ho automaticky vyskúša s 60 rôznymi hodnotami.
