import type { CompKind } from '../ui/schematic';

export interface Card {
  id: string;
  /** Text prednej strany (rich text) alebo schematická značka. */
  front: string;
  symbol?: CompKind | 'ground';
  back: string;
  note?: string;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  cards: Card[];
}

export const DECKS: readonly Deck[] = [
  {
    id: 'veliciny',
    title: 'Veličiny a jednotky',
    description: 'Značka veličiny a jej jednotka',
    cards: [
      { id: 'v-prud', front: 'Elektrický prúd', back: '`$I` · ampér [A]' },
      { id: 'v-napatie', front: 'Elektrické napätie', back: '`$U` · volt [V]' },
      { id: 'v-odpor', front: 'Elektrický odpor', back: '`$R` · ohm [Ω]' },
      { id: 'v-vodivost', front: 'Elektrická vodivosť', back: '`$G` · siemens [S]' },
      { id: 'v-naboj', front: 'Elektrický náboj', back: '`$Q` · coulomb [C]' },
      { id: 'v-vykon', front: 'Činný výkon', back: '`$P` · watt [W]' },
      { id: 'v-praca', front: 'Práca, energia', back: '`$W` · joule [J]', note: 'V praxi aj kWh: 1 kWh = 3,6 MJ.' },
      { id: 'v-kapacita', front: 'Kapacita', back: '`$C` · farad [F]' },
      { id: 'v-indukcnost', front: 'Indukčnosť', back: '`$L` · henry [H]' },
      { id: 'v-indukcia', front: 'Magnetická indukcia', back: '`$B` · tesla [T]' },
      { id: 'v-tok', front: 'Magnetický tok', back: '`$Φ` · weber [Wb]' },
      { id: 'v-frekvencia', front: 'Frekvencia', back: '`$f` · hertz [Hz]' },
      { id: 'v-rezistivita', front: 'Rezistivita (merný odpor)', back: '`$ρ` · Ω·mm²/m', note: 'V základných jednotkách Ω·m.' },
      { id: 'v-impedancia', front: 'Impedancia', back: '`$Z` · ohm [Ω]' },
      { id: 'v-jalovy', front: 'Jalový výkon', back: '`$Q` · var' },
      { id: 'v-zdanlivy', front: 'Zdanlivý výkon', back: '`$S` · voltampér [VA]' },
    ],
  },
  {
    id: 'vzorce',
    title: 'Vzorce',
    description: 'Najdôležitejšie vzťahy',
    cards: [
      { id: 'f-ohm', front: 'Ohmov zákon', back: '`$I = @f{$U}{$R}`' },
      { id: 'f-vykon', front: 'Elektrický výkon', back: '`$P = $U · $I`' },
      { id: 'f-vykon-r', front: 'Výkon na rezistore z prúdu', back: '`$P = $R · $I^{2}`' },
      { id: 'f-seria', front: 'Sériové zapojenie rezistorov', back: '`$R = $R_{1} + $R_{2} + …`' },
      { id: 'f-paralel', front: 'Dva rezistory paralelne', back: '`$R = @f{$R_{1} · $R_{2}}{$R_{1} + $R_{2}}`' },
      { id: 'f-delic', front: 'Delič napätia', back: '`$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}`' },
      { id: 'f-vodic', front: 'Odpor vodiča', back: '`$R = $ρ · @f{$l}{$S}`' },
      { id: 'f-zdroj', front: 'Svorkové napätie reálneho zdroja', back: '`$U = $U_{e} − $R_{i} · $I`' },
      { id: 'f-kapacita', front: 'Kapacita kondenzátora', back: '`$C = @f{$Q}{$U}`' },
      { id: 'f-tau', front: 'Časová konštanta RC', back: '`$τ = $R · $C`' },
      { id: 'f-energia-c', front: 'Energia kondenzátora', back: '`$W = @f{1}{2} · $C · $U^{2}`' },
      { id: 'f-sila', front: 'Sila na vodič v magnetickom poli', back: '`$F = $B · $I · $l`' },
      { id: 'f-xl', front: 'Induktívna reaktancia', back: '`$X_{L} = 2π$f$L`' },
      { id: 'f-xc', front: 'Kapacitná reaktancia', back: '`$X_{C} = @f{1}{2π$f$C}`' },
      { id: 'f-rezonancia', front: 'Rezonančná frekvencia', back: '`$f_{0} = @f{1}{2π@s{$L$C}}`' },
      { id: 'f-efektivna', front: 'Efektívna hodnota sínusového napätia', back: '`$U = @f{$U_{m}}{@s{2}}`' },
      { id: 'f-led', front: 'Predradný rezistor pre LED', back: '`$R = @f{$U − $U_{F}}{$I_{F}}`' },
    ],
  },
  {
    id: 'znacky',
    title: 'Schematické značky',
    description: 'Značky podľa STN EN 60617',
    cards: [
      { id: 's-rezistor', front: '', symbol: 'resistor', back: 'Rezistor' },
      { id: 's-varres', front: '', symbol: 'varres', back: 'Premenný rezistor (reostat)' },
      { id: 's-kondenzator', front: '', symbol: 'capacitor', back: 'Kondenzátor' },
      { id: 's-elektrolyt', front: '', symbol: 'ecap', back: 'Elektrolytický kondenzátor', note: 'Záleží na polarite – plus je pri dutej elektróde.' },
      { id: 's-cievka', front: '', symbol: 'inductor', back: 'Cievka (induktor)' },
      { id: 's-clanok', front: '', symbol: 'battery', back: 'Článok, zdroj jednosmerného napätia', note: 'Dlhšia čiara je kladný pól.' },
      { id: 's-ac', front: '', symbol: 'acsource', back: 'Zdroj striedavého napätia' },
      { id: 's-ziarovka', front: '', symbol: 'lamp', back: 'Žiarovka' },
      { id: 's-amp', front: '', symbol: 'ammeter', back: 'Ampérmeter', note: 'Zapája sa do série.' },
      { id: 's-volt', front: '', symbol: 'voltmeter', back: 'Voltmeter', note: 'Zapája sa paralelne.' },
      { id: 's-dioda', front: '', symbol: 'diode', back: 'Dióda', note: 'Prúd vedie v smere trojuholníka – od anódy ku katóde.' },
      { id: 's-led', front: '', symbol: 'led', back: 'LED – svetelná dióda' },
      { id: 's-spinac', front: '', symbol: 'switch', back: 'Spínač' },
      { id: 's-poistka', front: '', symbol: 'fuse', back: 'Poistka' },
      { id: 's-zem', front: '', symbol: 'ground', back: 'Uzemnenie' },
    ],
  },
  {
    id: 'predpony',
    title: 'Predpony SI',
    description: 'Násobky a diely jednotiek',
    cards: [
      { id: 'p-piko', front: 'piko (p)', back: '10⁻¹²', note: '22 pF' },
      { id: 'p-nano', front: 'nano (n)', back: '10⁻⁹', note: '100 nF' },
      { id: 'p-mikro', front: 'mikro (µ)', back: '10⁻⁶', note: '470 µF' },
      { id: 'p-mili', front: 'mili (m)', back: '10⁻³', note: '20 mA' },
      { id: 'p-kilo', front: 'kilo (k)', back: '10³', note: '4,7 kΩ' },
      { id: 'p-mega', front: 'mega (M)', back: '10⁶', note: '1 MΩ' },
      { id: 'p-giga', front: 'giga (G)', back: '10⁹', note: '2,4 GHz' },
      { id: 'p-tera', front: 'tera (T)', back: '10¹²', note: '1 TB' },
    ],
  },
];

export const ALL_CARDS: readonly Card[] = DECKS.flatMap((d) => d.cards);
