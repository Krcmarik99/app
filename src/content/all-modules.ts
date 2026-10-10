import { MEAS_MODULES } from './meas';
import type { LessonModule } from './module';
import { Y3_MODULES } from './y3';

/** Všetky lekcie, ktoré majú vlastný modul (lekcia, otázky a generátory príkladov spolu). */
export const MODULES: readonly LessonModule[] = [...Y3_MODULES, ...MEAS_MODULES];
