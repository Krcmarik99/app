import type { MeasModule } from './types';
import siJednotky from './si-jednotky';
import meraciePristroje from './meracie-pristroje';
import triedaPresnosti from './trieda-presnosti';
import chybyMerania from './chyby-merania';
import chybyCmp from './chyby-cmp';
import meranieOdporu from './meranie-odporu';
import vaMetoda from './va-metoda';
import meranieVykonu from './meranie-vykonu';
import mostikoveMetody from './mostikove-metody';
import osciloskop from './osciloskop';

export type { MeasModule } from './types';

/** Lekcie kapitoly Elektrotechnické merania v poradí, v akom idú v kurze. */
export const MEAS_MODULES: readonly MeasModule[] = [
  siJednotky, meraciePristroje, triedaPresnosti, chybyMerania, chybyCmp, meranieOdporu, vaMetoda,
  meranieVykonu, mostikoveMetody, osciloskop,
];
