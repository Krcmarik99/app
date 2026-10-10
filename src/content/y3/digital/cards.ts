import type { Deck } from '../../flashcards';

/** Balíčky kartičiek k tejto kapitole. */
export const DECKS: readonly Deck[] = [
  {
    id: 'cislicova',
    title: 'Číslicová technika',
    description: 'Logické členy, Booleova algebra, kódy a sekvenčné obvody',
    cards: [
      { id: 'dg-not', front: 'Člen NOT (invertor)', back: '`$Y = @o{$A}`', note: 'Značka: obdĺžnik so symbolom 1 a krúžkom na výstupe.' },
      { id: 'dg-and', front: 'Člen AND', back: '`$Y = $A · $B` – výstup 1, len keď sú všetky vstupy 1', note: 'Značka: obdĺžnik so symbolom &.' },
      { id: 'dg-or', front: 'Člen OR', back: '`$Y = $A + $B` – výstup 1, keď je aspoň jeden vstup 1', note: 'Značka: obdĺžnik so symbolom ≥1.' },
      { id: 'dg-nand', front: 'Člen NAND', back: '`$Y = @o{$A · $B}` – výstup 0, len keď sú všetky vstupy 1', note: 'Univerzálny člen; 74HC00 obsahuje 4× NAND.' },
      { id: 'dg-nor', front: 'Člen NOR', back: '`$Y = @o{$A + $B}` – výstup 1, len keď sú všetky vstupy 0', note: 'Univerzálny člen.' },
      { id: 'dg-xor', front: 'Člen XOR (nonekvivalencia)', back: '`$Y = $A ⊕ $B = @o{$A} · $B + $A · @o{$B}` – výstup 1 pri rôznych vstupoch', note: 'Značka: obdĺžnik so symbolom =1. Súčet v polovičnej sčítačke.' },
      { id: 'dg-xnor', front: 'Člen XNOR (ekvivalencia)', back: '`$Y = @o{$A ⊕ $B}` – výstup 1 pri rovnakých vstupoch', note: 'Bitová rovnosť v komparátore.' },
      { id: 'dg-demorgan1', front: 'De Morganov zákon pre súčin', back: '`@o{$A · $B} = @o{$A} + @o{$B}`' },
      { id: 'dg-demorgan2', front: 'De Morganov zákon pre súčet', back: '`@o{$A + $B} = @o{$A} · @o{$B}`' },
      { id: 'dg-ttl', front: 'Úrovne vstupu TTL (5 V)', back: 'L: 0 až 0,8 V, H: 2 V až 5 V', note: 'Výstup TTL: L najviac 0,4 V, H aspoň 2,4 V.' },
      { id: 'dg-rozsah', front: 'Rozsah čísel v `$n` bitoch', back: 'bez znamienka 0 až `2^{$n} − 1`, v dvojkovom doplnku `−2^{$n−1}` až `2^{$n−1} − 1`', note: 'Bajt: 0 až 255 alebo −128 až 127.' },
      { id: 'dg-doplnok', front: 'Dvojkový doplnok čísla −x', back: 'invertuj všetky bity čísla x a pripočítaj 1', note: '−45 v 8 bitoch: 0010 1101 → 1101 0010 → 1101 0011.' },
      { id: 'dg-hex', front: 'Prevod dvojková ↔ šestnástková', back: 'bity rozdeľ sprava po štyroch, každá štvorica je jedna šestnástková číslica', note: '1101 0110 = D6 (osmičková: po troch bitoch).' },
      { id: 'dg-bcd', front: 'Kód BCD 8421', back: 'každá desiatková číslica samostatne štyrmi bitmi', note: '59 = 0101 1001; kombinácie 1010 až 1111 sa nepoužívajú.' },
      { id: 'dg-gray', front: 'Grayov kód', back: 'susedné hodnoty sa líšia iba v jednom bite', note: 'Snímače polohy, Karnaughove mapy (poradie 00, 01, 11, 10).' },
      { id: 'dg-mux', front: 'Multiplexor `$N` : 1', back: 'podľa adresy prepojí jeden z `$N` vstupov na výstup; adresových vstupov je `$n = log_{2} $N`', note: 'MUX 8 : 1 má 3 adresové vstupy.' },
      { id: 'dg-dekoder', front: 'Dekodér 1 z `$N`', back: '`$n` vstupov → `2^{$n}` výstupov, aktívny je ten, ktorého číslo je na vstupe', note: '74HC138: 1 z 8, výstupy aktívne v L.' },
      { id: 'dg-scitacka', front: 'Polovičná sčítačka', back: '`$S = $A ⊕ $B`, `$C = $A · $B`', note: 'Úplná sčítačka pripočíta aj prenos `$C_{in}`.' },
      { id: 'dg-rs', front: 'Klopný obvod RS (z NOR)', back: 'S = 1 nastaví, R = 1 vynuluje, 00 pamätá, 11 je zakázaný stav' },
      { id: 'dg-d', front: 'Hranový klopný obvod D', back: '`$Q_{n+1} = $D` – hodnota sa prevezme pri hrane hodín', note: 'Hladinový (latch) sleduje D počas C = 1.' },
      { id: 'dg-jk', front: 'Klopný obvod JK', back: '00 pamätá, 01 nuluje, 10 nastaví, 11 preklopí', note: '`$Q_{n+1} = $J · @o{$Q_{n}} + @o{$K} · $Q_{n}`' },
      { id: 'dg-citac', front: 'Asynchrónny binárny čítač s `$n` preklápačmi', back: 'modulo `2^{$n}`, na výstupe posledného `$f_{n} = @f{$f}{2^{$n}}`', note: 'Preklápač T delí frekvenciu dvoma.' },
    ],
  },
];
