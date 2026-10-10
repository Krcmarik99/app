import type { Deck } from '../../flashcards';

/** Balíčky kartičiek k tejto kapitole. */
export const DECKS: readonly Deck[] = [
  {
    id: 'bezpecnost',
    title: 'Elektroenergetika a bezpečnosť',
    description: 'Sieťové sústavy, ochrana pred úrazom, istenie a meranie výkonu',
    cards: [
      { id: 'bz-hladiny', front: 'Napäťové hladiny v SR', back: 'prenos 400 kV a 220 kV · distribúcia 110 kV a 22 kV · NN 400/230 V' },
      { id: 'bz-straty', front: 'Straty v trojfázovom vedení', back: '`Δ$P = 3 · $R · $I^{2}`', note: 'Pri rovnakom výkone klesajú s druhou mocninou napätia – 2× vyššie napätie, 4× menšie straty.' },
      { id: 'bz-pismena', front: 'Písmená v označení sústavy (TN, TT, IT)', back: '1. zdroj – T uzemnený, I izolovaný · 2. neživé časti – T vlastný uzemňovač, N spojené s uzlom zdroja', note: 'S – oddelené N a PE, C – spoločný vodič PEN.' },
      { id: 'bz-tns', front: 'Sústava TN-S', back: 'uzol zdroja priamo uzemnený, v celej sieti samostatný stredný vodič N a ochranný vodič PE' },
      { id: 'bz-tncs', front: 'Sústava TN-C-S', back: 'PEN sa v hlavnom rozvádzači rozdelí na N a PE', note: 'Za bodom rozdelenia sa N a PE nesmú znova spojiť.' },
      { id: 'bz-tt', front: 'Sústava TT', back: 'uzol zdroja uzemnený, neživé časti majú vlastný uzemňovač' },
      { id: 'bz-it', front: 'Sústava IT', back: 'zdroj izolovaný od zeme (alebo uzemnený cez impedanciu), neživé časti uzemnené', note: 'Prvá porucha nespôsobí odpojenie – nemocnice, bane.' },
      { id: 'bz-pen', front: 'Označenie vodiča PEN', back: 'zelenožltá izolácia s modrým označením na koncoch', note: 'PEN sa nesmie prerušiť ani istiť.' },
      { id: 'bz-prahy', front: 'Prah vnímania a prah odpútania (50 Hz)', back: 'asi 0,5 mA · asi 10 mA', note: 'Desiatky až stovky mA môžu podľa času pôsobenia spôsobiť fibriláciu komôr.' },
      { id: 'bz-dotyk', front: 'Dovolené dotykové napätie v bežných priestoroch', back: '50 V striedavých · 120 V jednosmerných', note: 'V nebezpečných priestoroch menej.' },
      { id: 'bz-zs', front: 'Podmienka samočinného odpojenia v sieti TN', back: '`$Z_{s} · $I_{a} ≤ $U_{0}`', note: 'Istič B16: `$I_{a}` = 80 A, `$Z_{s}` ≤ 2,875 Ω.' },
      { id: 'bz-cas', front: 'Najdlhší čas odpojenia: koncový obvod 230 V do 32 A v TN', back: '0,4 s', note: 'Distribučné obvody v TN 5 s; v sieti TT 0,2 s.' },
      { id: 'bz-chranic', front: 'Doplnková ochrana', back: 'prúdový chránič s `$I_{Δn}` ≤ 30 mA', note: 'Musí vypnúť pri `$I_{Δn}`, nesmie pod `0,5 · $I_{Δn}`.' },
      { id: 'bz-triedy', front: 'Triedy ochrany I, II, III', back: 'I – ochranný vodič PE · II – dvojitá izolácia (dva štvorce) · III – napájanie SELV/PELV (kosoštvorec)' },
      { id: 'bz-selv', front: 'SELV a PELV', back: 'malé napätie do 50 V AC / 120 V DC z bezpečného zdroja', note: 'SELV nesmie byť uzemnený, PELV môže byť.' },
      { id: 'bz-bcd', front: 'Okamžité vypnutie ističov B, C, D', back: 'B 3–5 · `$I_{n}` · C 5–10 · `$I_{n}` · D 10–20 · `$I_{n}`', note: 'B – zásuvky a svetlá, C – motory, D – transformátory a zváračky.' },
      { id: 'bz-dimenz', front: 'Dimenzovanie vedenia', back: '`$I_{B} ≤ $I_{n} ≤ $I_{z}`', note: 'Prevádzkový prúd ≤ menovitý prúd istiaceho prvku ≤ dovolené zaťaženie vodiča.' },
      { id: 'bz-ubytok', front: 'Úbytok napätia jednofázového vedenia', back: '`Δ$U = @f{2 · $l · $I · $ρ}{$S}`', note: 'Dovolené 3 % pre svetelné a 5 % pre ostatné obvody.' },
      { id: 'bz-wattmeter', front: 'Konštanta wattmetra', back: '`$K_{W} = @f{MR_{U} · MR_{I} · cos $φ_{n}}{$α_{max}}`', note: 'Nameraný výkon `$P = $α · $K_{W}`.' },
      { id: 'bz-aron', front: 'Aronovo zapojenie', back: 'dva wattmetre v trojvodičovej sústave: `$P = $P_{1} + $P_{2}`', note: 'Pri `cos $φ` < 0,5 jeden ukazuje opačne – prepóluj ho a jeho údaj odčítaj.' },
      { id: 'bz-most', front: 'Rovnováha Wheatstoneovho mostíka', back: '`$R_{1} · $R_{4} = $R_{2} · $R_{3}`', note: 'Súčiny protiľahlých ramien sa rovnajú; nezávisí od napätia zdroja.' },
      { id: 'bz-osc', front: 'Amplitúda a frekvencia z osciloskopu', back: '`$U_{m}` = dieliky · V/dielik · sonda · `$f = @f{1}{$T}`, `$T` = dieliky · čas/dielik' },
    ],
  },
];
