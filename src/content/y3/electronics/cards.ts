import type { Deck } from '../../flashcards';

/** Balíčky kartičiek k tejto kapitole. */
export const DECKS: readonly Deck[] = [
  {
    id: 'elektronika',
    title: 'Elektronika',
    description: 'Usmerňovače, stabilizátory, tranzistor, operačný zosilňovač a oscilátory',
    cards: [
      { id: 'el-um', front: 'Vrcholová hodnota striedavého napätia z efektívnej', back: '`$U_{m} = @s{2} · $U` ≈ 1,414 · `$U`', note: 'Zo siete 230 V je vrchol asi 325 V.' },
      { id: 'el-jednocestny', front: 'Stredná hodnota napätia za jednocestným usmerňovačom (bez filtra)', back: '`$U_{d} = @f{$U_{m}}{π} ≈ 0,45 · $U`', note: 'Zvlnenie má frekvenciu 50 Hz.' },
      { id: 'el-dvojcestny', front: 'Stredná hodnota napätia za dvojcestným usmerňovačom (bez filtra)', back: '`$U_{d} = @f{2 · $U_{m}}{π} ≈ 0,9 · $U`', note: 'Zvlnenie má frekvenciu 100 Hz.' },
      { id: 'el-graetz', front: 'Graetzov (mostíkový) usmerňovač', back: 'štyri diódy, naraz vedú dve v sérii – úbytok asi 1,4 V; záverné napätie diódy `$U_{m}`', note: 'Výstupy ~, ~, +, −.' },
      { id: 'el-zvlnenie', front: 'Zvlnenie za filtračným kondenzátorom', back: '`Δ$U ≈ @f{$I}{$f_{z} · $C}`', note: '`$f_{z}` = 50 Hz pri jednocestnom, 100 Hz pri dvojcestnom usmerňovači.' },
      { id: 'el-naprazdno', front: 'Napätie na filtračnom kondenzátore naprázdno', back: '`$U_{0} ≈ $U_{m} − $U_{F}`', note: 'Za mostíkom `$U_{F}` ≈ 1,4 V (dve diódy).' },
      { id: 'el-zener', front: 'Zenerova dióda', back: 'pracuje v **závernom smere** v oblasti prierazu, napätie `$U_{Z}` sa pri zmene prúdu takmer nemení', note: 'Prúd musí byť medzi `$I_{Z min}` a `$I_{Z max} = $P_{Z max}/$U_{Z}`.' },
      { id: 'el-param-r', front: 'Predradný rezistor parametrického stabilizátora', back: '`$R = @f{$U_{1} − $U_{Z}}{$I_{Z} + $I_{L}}`', note: 'Výkon diódy kontroluj pri najvyššom `$U_{1}` a odpojenej záťaži.' },
      { id: 'el-78xx', front: 'Stabilizátory 78xx a 79xx', back: '78xx kladné, 79xx záporné napätie; posledné dvojčíslie = napätie (7805 → +5 V)', note: 'Strata `$P = ($U_{1} − $U_{2}) · $I`.' },
      { id: 'el-lm317', front: 'Výstupné napätie stabilizátora LM317', back: '`$U_{2} = 1,25 · (1 + @f{$R_{2}}{$R_{1}})`', note: '`$R_{1}` (OUT – ADJ) býva 240 Ω.' },
      { id: 'el-ic', front: 'Prúdy bipolárneho tranzistora', back: '`$I_{C} = $β · $I_{B}`, `$I_{E} = $I_{B} + $I_{C}`', note: 'V aktívnom režime, `$U_{BE}` ≈ 0,7 V.' },
      { id: 'el-rezimy', front: 'Režimy bipolárneho tranzistora', back: 'zatvorený (vypnutý spínač), aktívny (zosilňovač), nasýtený (zopnutý spínač, `$U_{CE sat}` ≈ 0,2 V)' },
      { id: 'el-rb', front: 'Rezistor v báze tranzistorového spínača', back: '`$R_{B} = @f{$U_{1} − $U_{BE}}{$I_{B}}`, kde `$I_{B} = $k · @f{$I_{C}}{$β}`', note: 'Činiteľ presýtenia `$k` = 2 až 5.' },
      { id: 'el-priamka', front: 'Zaťažovacia priamka zosilňovača so spoločným emitorom', back: '`$U_{CE} = $U_{CC} − $R_{C} · $I_{C}`', note: 'Pracovný bod je jej priesečník s výstupnou charakteristikou.' },
      { id: 'el-db', front: 'Zosilnenie v decibeloch', back: '`$A_{u} [dB] = 20 · log $A_{u}`, `$A_{p} [dB] = 10 · log $A_{p}`', note: 'Napätie 10× = 20 dB, 100× = 40 dB; výkon 2× = 3 dB.' },
      { id: 'el-oz-ideal', front: 'Ideálny operačný zosilňovač', back: 'nekonečné zosilnenie a vstupný odpor, nulový výstupný odpor', note: 'So zápornou spätnou väzbou: `$U_{+} = $U_{−}` a do vstupov netečie prúd.' },
      { id: 'el-invert', front: 'Zosilnenie invertujúceho zosilňovača', back: '`$A_{u} = −@f{$R_{2}}{$R_{1}}`', note: 'Otáča fázu o 180°, vstupný odpor je `$R_{1}`.' },
      { id: 'el-neinvert', front: 'Zosilnenie neinvertujúceho zosilňovača', back: '`$A_{u} = 1 + @f{$R_{2}}{$R_{1}}`', note: 'Sledovač: `$A_{u}` = 1.' },
      { id: 'el-komparator', front: 'Komparátor s operačným zosilňovačom', back: 'bez spätnej väzby; výstup je v kladnej saturácii, keď `$U_{+} > $U_{−}`, inak v zápornej', note: 'Výstup nikdy neprekročí napájacie napätie.' },
      { id: 'el-oscilacie', front: 'Podmienky oscilácií', back: 'amplitúdová `$β · $A` = 1, fázová – celkový posun v slučke 0° (kladná spätná väzba)' },
      { id: 'el-wien-lc', front: 'Frekvencia Wienovho a LC oscilátora', back: '`$f_{0} = @f{1}{2π$R$C}`, `$f_{0} = @f{1}{2π@s{$L$C}}`', note: 'Kryštál v hodinkách: 32 768 Hz = 2¹⁵.' },
      { id: 'el-555', front: 'Astabilný a monostabilný obvod 555', back: '`$f ≈ @f{1,44}{($R_{1} + 2$R_{2}) · $C}`; monostabilný `$t = 1,1 · $R · $C`', note: '`$t_{1} = 0,693 · ($R_{1} + $R_{2}) · $C`, `$t_{2} = 0,693 · $R_{2} · $C`.' },
    ],
  },
];
