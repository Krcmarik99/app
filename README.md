# ElektroLab

Webová aplikácia na učenie základov elektrotechniky pre stredné školy. Celá je v slovenčine,
funguje v prehliadači na počítači aj na mobile a nepotrebuje žiadny server ani prihlásenie.

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
  lib/          výpočty (electro), jednotky a predpony (units), farebný kód, vzorce, pokrok
  ui/           schémy, grafy, karta otázky, interaktívny obvod na úvodnej stránke
  views/        stránky: domov, lekcie, cvičenie, kalkulačky, kartičky
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
