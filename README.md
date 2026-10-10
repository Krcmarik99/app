# ElektroLab

Webová aplikácia na učenie základov elektrotechniky pre stredné školy. Celá je v slovenčine,
funguje v prehliadači na počítači aj na mobile a nepotrebuje žiadny server.

## Čo obsahuje

- **45 lekcií** v deviatich kapitolách, ktoré idú po ročníkoch strednej priemyselnej školy elektrotechnickej:
  - *1. ročník* – jednosmerný prúd (veličiny, Ohmov a Kirchhoffove zákony, reálny zdroj, výkon), elektrické
    a magnetické pole (kondenzátor, cievka), súčiastky v praxi (farebný kód, dióda a LED);
  - *2. a 3. ročník* – striedavý prúd (sínusové veličiny, obvody RLC, výkon a účinník s kompenzáciou,
    sériový a paralelný rezonančný obvod, filtre RC a RL a decibely, trojfázová sústava) a elektrotechnické
    merania (jednotky SI, meracie prístroje, trieda presnosti, chyby merania a číslicových prístrojov,
    meranie odporu, Ohmova metóda, meranie výkonu a energie, mostíkové metódy, osciloskop);
  - *3. ročník* – elektrické stroje (transformátor – princíp a prevod, prevádzkové stavy, straty a účinnosť,
    trojfázové a špeciálne transformátory; asynchrónny motor; jednosmerné a synchrónne stroje), elektronika
    (usmerňovače, stabilizátory, tranzistor a zosilňovač, operačný zosilňovač, oscilátory a časovač 555),
    číslicová technika (číselné sústavy, logické členy, kombinačné obvody, klopné obvody a čítače)
    a elektroenergetika a bezpečnosť (výroba a rozvod energie, ochrana pred úrazom elektrickým prúdom,
    istenie vedení).

  Každá lekcia má teóriu, vzorce s vysvetlením veličín, schémy, grafy, riešené príklady a krátky test.
  V 25 lekciách sú **interaktívne grafy** – posuvníkmi meníš súčiastky a hneď vidíš rezonančnú krivku,
  Bodeho diagram filtra, momentovú charakteristiku motora, účinnosť transformátora, priebehy usmerňovača
  či časovača 555, prúd stredným vodičom a podobne. Číslicová technika má klikateľné logické členy,
  prevodník bitov a klopné obvody s časovým diagramom.
- **Cvičenie** – vyberieš témy a počet otázok. Číselné príklady (vyše 280 typov) sa generujú
  s novými hodnotami pri každom pokuse a pri chybe ukážu celý postup riešenia. K tomu vyše 300 otázok
  s výberom odpovede.
- **Kalkulačky** – Ohmov zákon a výkon, sériové a paralelné spájanie rezistorov aj kondenzátorov,
  delič napätia (aj s návrhom rezistora z rady E24), farebný kód rezistorov oboma smermi,
  časová konštanta RC/RL s grafom, striedavý obvod RLC s trojuholníkom impedancií,
  predradný rezistor pre LED, odpor/úbytok napätia na vedení, chyba analógového a číslicového
  meracieho prístroja, Ohmova metóda (AV/VA), konštanta a spotreba prístroja, filter RC a RL,
  výkon a kompenzácia účinníka (1f aj 3f), transformátor, asynchrónny motor, časovač 555,
  stabilizátor napätia, prevod číselných sústav, ochrana samočinným odpojením a odčítanie z osciloskopu.
- **Kartičky** na opakovanie – veličiny a jednotky, vzorce, schematické značky, pojmy z meraní,
  základné jednotky SI a predpony, striedavé obvody, elektrické stroje, elektronika, číslicová technika
  a elektroenergetika a bezpečnosť.
- **Pokrok** – preštudované lekcie, úspešnosť podľa tém, séria dní učenia. Ukladá sa iba
  v prehliadači (localStorage).
- **Registrácia a prihlásenie** – online účty (Supabase): prihlásiš sa na hocijakom zariadení a pokrok
  v lekciách, cvičeniach a kartičkách aj zapojenia z laboratória sa synchronizujú (pri prihlásení sa
  zlúčia s tým, čo je v prehliadači). Prihlasuje sa používateľským menom a heslom. Keď server nie je
  dostupný, účet sa vytvorí v prehliadači (heslo len ako odtlačok PBKDF2-SHA-256) a na server sa
  prenesie pri najbližšom prihlásení.
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
- **Arduino UNO** v laboratóriu – doska s piny D0 až D13, A0 až A5, 5V, 3V3 a GND a moduly k nej:
  tlačidlo (drží sa myšou), potenciometer, fotorezistor, teplotný senzor TMP36, 7-segmentový displej,
  LCD 16×2 s prevodníkom I2C, RGB LED, bzučiak (zvuk cez Web Audio) a servomotor SG90. Program sa píše
  v editore pod schémou (zvýrazňovanie syntaxe, čísla riadkov, vzorové programy), nahrá sa tlačidlom
  a chyby prekladu sa ukážu po slovensky s číslom riadka. Sériový monitor zobrazuje `Serial.print`
  a posiela text do `Serial.read`. Dvanásť ukážok zapojenia s programami (blikanie, tlačidlo, PWM,
  potenciometer, semafor, 7-segmentový a LCD displej, servo, bzučiak, nočné svetlo, teplomer, RGB LED).

### Ako funguje Arduino

Program v jazyku Arduino (podmnožina C/C++) sa preloží do bajtkódu (`src/arduino/`) a vykonáva ho
virtuálny mikrokontrolér, ktorého čas beží spolu so simuláciou obvodu. Typy zodpovedajú ATmega328P –
`int` má 16 bitov a pretečie ako na skutočnej doske, `float` aj `double` majú 32 bitov. Podporované sú
premenné a konštanty, polia (aj dvojrozmerné), vlastné funkcie a rekurzia, `if`, `for`, `while`, `do`,
`switch`, `enum`, `#define`, typ `String`, funkcie `pinMode`, `digitalWrite/Read`, `analogRead/Write`,
`delay`, `millis`, `tone`, `map`, `constrain`, `random`, matematické funkcie, `Serial` a knižnice
`Servo` a `LiquidCrystal_I2C`. Pin je v obvode Nortonov zdroj (5 V cez 25 Ω, vstup s pull-up 35 kΩ),
PWM má 490 Hz (piny 5 a 6 976 Hz) a kroky simulácie končia presne na jeho hranách. Aplikácia upozorní
na prúd z pinu nad 40 mA, napätie mimo 0 až 5 V, nepripojený („plávajúci“) vstup, `analogWrite` na
pine bez PWM a podobne. Nepodporované sú ukazovatele, štruktúry, prerušenia a `pulseIn`.
- **Interaktívny obvod** na úvodnej stránke – napätie 0 až 500 V a odpor 0 Ω až 5 MΩ posuvníkom
  alebo zadaním hodnoty, schéma s rezistorom alebo s LED a predradným rezistorom.

Hodnoty v kalkulačkách môžeš písať s predponami tak, ako sú na schémach: `4k7`, `2,2µ`, `15m`, `1R5`.
Schematické značky sú podľa STN EN 60617 (rezistor ako obdĺžnik), veličiny sa sádzajú kurzívou
a jednotky vzpriamene.

## Online účty (Supabase)

Adresa projektu a *publishable* kľúč sú v `src/lib/config.ts` (sú určené na zverejnenie; tajný kľúč
do aplikácie nepatrí). Nastavenie projektu:

1. **SQL Editor** – spusti `supabase/schema.sql` (tabuľka `profiles` s pravidlami, aby každý videl len
   svoj profil, a funkcia na zmazanie vlastného účtu).
2. **Authentication → Sign In / Providers → Email** – vypni *Confirm email*. Aplikácia prihlasuje
   menom; e-mail sa z neho len zloží (`meno@ucty.elektrolab.sk`) a žiadne e-maily sa neposielajú.

## Zverejnenie (GitHub Pages)

Workflow `.github/workflows/pages.yml` pri každom odoslaní do hlavnej vetvy aplikáciu otestuje,
zostaví a zverejní na <https://krcmarik99.github.io/app/>. V nastaveniach repozitára treba raz
zapnúť **Settings → Pages → Source: GitHub Actions** (na bezplatnom pláne musí byť repozitár verejný).
Náhľad na claude.ai spojenie so serverom účtov blokuje – online účty fungujú na tejto adrese.

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
  content/y3/   učivo 3. ročníka po kapitolách (ac, machines, electronics, digital, power) – moduly lekcií,
                kartičky; pomocné obrázky v ui/fig-*.ts, kalkulačky vo views/calc-*.ts
  practice/     generátory číselných príkladov a zostavenie cvičenia
  lib/          výpočty (electro), jednotky a predpony (units), farebný kód, vzorce, pokrok, účty (auth)
  ui/           schémy, grafy, interaktívne grafy (explorer), fázorové diagramy, karta otázky,
                interaktívny obvod na úvodnej stránke
  lab/          zapájanie obvodov: súčiastky, uzly, simulácia, značky, osciloskop, ukážky
  views/        stránky: domov, lekcie, cvičenie, kalkulačky, kartičky, zapájanie, účet
  router.ts     navigácia cez #kotvy (funguje aj na statickom hostingu)
tests/          testy (Vitest)
```

### Ako pridať obsah

- **Lekcia:** vytvor modul v `src/content/y3/<kapitola>/` (vzor `ac/vykon-striedavy.ts`) – v jednom súbore
  je lekcia, otázky s výberom aj generátory príkladov – a pridaj ho do poľa `MODULES` v `index.ts`
  kapitoly. Text môže obsahovať vzorce v spätných apostrofoch: `` `$I = @f{$U}{$R}` `` – `$X` je veličina
  kurzívou, `_{1}` dolný index, `^{2}` horný index, `@f{a}{b}` zlomok, `@s{a}` odmocnina, `@o{a}` pruh
  (negácia). Blok `explore` vloží interaktívny graf (`src/ui/explorer.ts`).
- **Otázka s výberom:** pridaj ju do `QUESTIONS` v `src/content/questions.ts` (prvá možnosť je správna,
  pri zobrazení sa zamiešajú).
- **Typ číselného príkladu:** pridaj generátor do `src/practice/generators.ts`. Test v
  `tests/practice.test.ts` ho automaticky vyskúša s 60 rôznymi hodnotami.
