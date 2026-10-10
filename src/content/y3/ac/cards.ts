import type { Deck } from '../../flashcards';

/** Balíčky kartičiek k tejto kapitole. */
export const DECKS: readonly Deck[] = [
  {
    id: 'striedave',
    title: 'Striedavé obvody',
    description: 'Výkon, rezonancia, filtre a trojfázová sústava',
    cards: [
      { id: 'ac-cinny', front: 'Činný výkon v striedavom obvode', back: '`$P = $U · $I · cos $φ` [W]', note: 'Mení sa na teplo, svetlo a prácu; meria ho wattmeter.' },
      { id: 'ac-jalovy', front: 'Jalový výkon', back: '`$Q = $U · $I · sin $φ` [var]', note: 'Prelieva sa medzi zdrojom a poľom cievky alebo kondenzátora.' },
      { id: 'ac-zdanlivy', front: 'Zdanlivý výkon', back: '`$S = $U · $I = @s{$P^{2} + $Q^{2}}` [VA]', note: 'Na zdanlivý výkon sa dimenzujú transformátory a vedenia.' },
      { id: 'ac-ucinnik', front: 'Účinník', back: '`cos $φ = @f{$P}{$S}`', note: 'Odberatelia musia dodržať aspoň 0,95.' },
      { id: 'ac-kompenzacia', front: 'Kompenzácia induktívneho odberu', back: 'kondenzátory paralelne k spotrebiču: `$Q_{C} = $P · (tg $φ_{1} − tg $φ_{2})`', note: '`$C = @f{$Q_{C}}{$ω · $U^{2}}`' },
      { id: 'ac-thomson', front: 'Thomsonov vzťah (rezonančná frekvencia)', back: '`$f_{0} = @f{1}{2π@s{$L · $C}}`', note: 'Pri rezonancii `$X_{L} = $X_{C}`.' },
      { id: 'ac-akost', front: 'Činiteľ akosti sériového obvodu', back: '`$Q = @f{$Z_{0}}{$R} = @f{1}{$R}@s{@f{$L}{$C}}`', note: 'Napätie na `$L` a `$C` je pri rezonancii `$Q`-krát väčšie ako napätie zdroja.' },
      { id: 'ac-pasmo', front: 'Šírka pásma rezonančného obvodu', back: '`$B = @f{$f_{0}}{$Q}`', note: 'Medzi frekvenciami, kde prúd klesne na 0,707 (−3 dB).' },
      { id: 'ac-seriova', front: 'Sériová rezonancia – impedancia a prúd', back: 'impedancia **najmenšia** (`$Z = $R`), prúd **najväčší**', note: 'Rezonancia napätí.' },
      { id: 'ac-paralelna', front: 'Paralelná rezonancia – impedancia a prúd', back: 'impedancia **najväčšia** (`$R_{d} = @f{$L}{$R$C}`), prúd zo zdroja **najmenší**', note: 'Rezonancia prúdov.' },
      { id: 'ac-fm-rc', front: 'Medzná frekvencia filtra RC', back: '`$f_{m} = @f{1}{2π$R$C}`', note: 'Pri nej je prenos 0,707 (−3 dB) a posun 45°.' },
      { id: 'ac-fm-rl', front: 'Medzná frekvencia filtra RL', back: '`$f_{m} = @f{$R}{2π$L}`' },
      { id: 'ac-db', front: 'Napäťový prenos v decibeloch', back: '`$A = 20 · log @f{$U_{2}}{$U_{1}}` [dB]', note: '0,5 → −6 dB, 0,1 → −20 dB, 10 → +20 dB' },
      { id: 'ac-strmost', front: 'Strmosť filtra 1. rádu', back: '20 dB na dekádu (6 dB na oktávu)' },
      { id: 'ac-zdruzene', front: 'Združené a fázové napätie', back: '`$U = @s{3} · $U_{f}` (400 V = 1,732 · 230 V)' },
      { id: 'ac-hviezda', front: 'Zapojenie do hviezdy (Y)', back: '`$U = @s{3} · $U_{f}`, `$I = $I_{f}`', note: 'Pri súmernej záťaži netečie stredným vodičom prúd.' },
      { id: 'ac-trojuholnik', front: 'Zapojenie do trojuholníka (D)', back: '`$U = $U_{f}`, `$I = @s{3} · $I_{f}`', note: 'Rovnaké rezistory majú v trojuholníku 3× väčší výkon ako v hviezde.' },
      { id: 'ac-3f-vykon', front: 'Výkon trojfázového spotrebiča', back: '`$P = @s{3} · $U · $I · cos $φ`', note: 'U a I sú združené napätie a prúd vo vodiči.' },
      { id: 'ac-farby', front: 'Farby vodičov L, N, PE', back: 'L1 hnedá, L2 čierna, L3 sivá · N modrá · PE zelenožltá' },
    ],
  },
];
