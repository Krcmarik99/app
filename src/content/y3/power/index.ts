import type { LessonModule } from '../../module';
import prenosEnergie from './prenos-energie';
import ochranaPredUrazom from './ochrana-pred-urazom';
import istenie from './istenie';

/** Elektroenergetika a bezpečnosť: rozvod energie, ochrana pred úrazom, istenie. Poradie v poli je poradie lekcií v kapitole. */
export const MODULES: readonly LessonModule[] = [
  prenosEnergie, ochranaPredUrazom, istenie,
];
