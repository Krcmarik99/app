import type { MeasModule } from './types';
import siJednotky from './si-jednotky';
import meraciePristroje from './meracie-pristroje';
import triedaPresnosti from './trieda-presnosti';
import chybyMerania from './chyby-merania';
import chybyCmp from './chyby-cmp';

export type { MeasModule } from './types';

/** Lekcie kapitoly Elektrotechnické merania v poradí, v akom idú v kurze. */
export const MEAS_MODULES: readonly MeasModule[] = [
  siJednotky, meraciePristroje, triedaPresnosti, chybyMerania, chybyCmp,
  // Lekcie meranie-odporu a va-metoda sa dopĺňajú – zaradia sa sem, keď budú hotové.
];
