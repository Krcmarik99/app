import type { Deck } from '../../flashcards';

/** Balíčky kartičiek k tejto kapitole. */
export const DECKS: readonly Deck[] = [
  {
    id: 'stroje',
    title: 'Elektrické stroje',
    description: 'Transformátory, asynchrónny motor, jednosmerné a synchrónne stroje – vzorce, pravidlá a pojmy.',
    cards: [
      { id: 'st-prevod', front: 'Prevod transformátora', back: '`$p = @f{$N_{1}}{$N_{2}} = @f{$U_{1}}{$U_{2}} = @f{$I_{2}}{$I_{1}}`', note: 'Napätia v priamom, prúdy v obrátenom pomere počtov závitov. `$p` > 1 – znižovací.' },
      { id: 'st-444', front: 'Napätie indukované vo vinutí transformátora', back: '`$U = 4,44 · $f · $N · $Φ_{m}`, kde `$Φ_{m} = $B_{m} · $S_{Fe}`', note: '4,44 = 2π / √2. Indukcia v jadre zvyčajne 1 až 1,6 T.' },
      { id: 'st-plechy', front: 'Prečo je jadro transformátora z izolovaných plechov?', back: 'Aby sa obmedzili **vírivé prúdy** a tým straty a zahrievanie jadra.', note: 'Kremík v oceli zväčšuje jej rezistivitu.' },
      { id: 'st-dc', front: 'Prečo transformátor nepracuje na jednosmerné napätie?', back: 'Stály prúd vytvorí stály tok, ktorý **neindukuje napätie**; primárny prúd obmedzí len malý odpor vinutia.' },
      { id: 'st-impedancia', front: 'Impedančný prevod transformátora', back: '`$Z_{1} = $p^{2} · $Z_{2}`', note: 'Prispôsobenie záťaže zdroju, napr. reproduktora zosilňovaču.' },
      { id: 'st-naprazdno', front: 'Straty naprázdno `Δ$P_{0}`', back: '≈ straty v **železe** (hysterézne a vírivými prúdmi) – stále, nezávisia od zaťaženia.', note: 'Prúd naprázdno `$I_{0}` ≈ 1 až 10 % `$I_{n}`.' },
      { id: 'st-nakratko', front: 'Straty nakrátko `Δ$P_{k}`', back: '≈ straty vo **vinutiach** pri menovitom prúde; pri zaťažení `$β` sú `$β^{2} · Δ$P_{k}`.' },
      { id: 'st-uk', front: 'Napätie nakrátko `$u_{k}`', back: '`$u_{k} = @f{$U_{k}}{$U_{1n}} · 100 %` – napätie, pri ktorom pri skratovanom sekundári tečie menovitý prúd.', note: 'Distribučné transformátory 4 až 6 %.' },
      { id: 'st-ik', front: 'Ustálený skratový prúd transformátora', back: '`$I_{k} = $I_{n} · @f{100}{$u_{k}}`', note: 'Pri `$u_{k}` = 4 % je to 25-násobok menovitého prúdu.' },
      { id: 'st-eta', front: 'Kedy má transformátor najväčšiu účinnosť?', back: 'Keď sa straty vo vinutí rovnajú stratám v železe: `$β_{opt} = @s{@f{Δ$P_{0}}{Δ$P_{k}}}`' },
      { id: 'st-in3f', front: 'Menovitý prúd trojfázového transformátora', back: '`$I_{n} = @f{$S_{n}}{@s{3} · $U_{n}}`', note: '`$U_{n}` je združené napätie danej strany.' },
      { id: 'st-dyn1', front: 'Skupina spojenia Dyn1', back: 'VN do **trojuholníka**, NN do **hviezdy** s vyvedeným uzlom, napätie NN oneskorené o 1 · 30° = 30°.' },
      { id: 'st-auto', front: 'Autotransformátor', back: 'Jedno vinutie s odbočkou, časť výkonu prenáša **galvanicky**. Typový výkon `$S_{t} = $S · (1 − @f{$U_{2}}{$U_{1}})`.', note: 'Nesmie byť oddeľovacím ani bezpečnostným transformátorom.' },
      { id: 'st-mtp', front: 'Merací transformátor prúdu (MTP)', back: 'Primár v sérii, sekundár **5 A alebo 1 A**. Sekundár sa **nesmie rozpojiť**.', note: 'Pred odpojením ampérmetra sa svorky S1 – S2 skratujú.' },
      { id: 'st-mtn', front: 'Merací transformátor napätia (MTN)', back: 'Primár paralelne, sekundár **100 V**. Sekundár sa **nesmie skratovať**.', note: 'Sekundár sa istí poistkami.' },
      { id: 'st-ns', front: 'Synchrónne otáčky', back: '`$n_{s} = @f{60 · $f}{$p}`', note: 'Pri 50 Hz: 3 000, 1 500, 1 000, 750 ot/min pre `$p` = 1, 2, 3, 4.' },
      { id: 'st-sklz', front: 'Sklz asynchrónneho motora', back: '`$s = @f{$n_{s} − $n}{$n_{s}}`, bežne 2 až 6 %', note: 'Frekvencia v rotore `$f_{2} = $s · $f`.' },
      { id: 'st-moment', front: 'Moment z výkonu a otáčok', back: '`$M = 9 550 · @f{$P}{$n}` (P v kW, n v ot/min)', note: 'Presne `$M = @f{$P}{$ω}`, `$ω = @f{2π$n}{60}`.' },
      { id: 'st-yd', front: 'Rozbeh hviezda – trojuholník', back: 'Prúd zo siete aj záberový moment klesnú na **tretinu**.', note: 'Len pre motor, ktorý v sieti 400 V pracuje v trojuholníku (štítok 400/690 V Δ/Y).' },
      { id: 'st-smer', front: 'Zmena smeru otáčania trojfázového motora', back: 'Zámena **dvoch fázových vodičov** (napr. L1 a L2).', note: 'Jednosmerný motor: prepólovať kotvu alebo budenie, nie oboje.' },
      { id: 'st-dcmotor', front: 'Jednosmerný motor – napätie a otáčky', back: '`$U_{i} = $c · $Φ · $n`, `$U = $U_{i} + $R_{a} · $I_{a}`, `$n = @f{$U − $R_{a}$I_{a}}{$c · $Φ}`', note: 'Pri rozbehu `$U_{i}` = 0, preto treba rozbehový odpor.' },
      { id: 'st-seriovy', front: 'Sériový jednosmerný motor', back: 'Veľký záberový moment, mäkká charakteristika. **Nesmie bežať naprázdno** – otáčky by neobmedzene rástli.' },
    ],
  },
];
