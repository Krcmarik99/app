import type { LessonModule } from '../../module';
import operacnyZosilnovac from './operacny-zosilnovac';
import oscilatory555 from './oscilatory-555';
import stabilizatory from './stabilizatory';
import tranzistorZosilnovac from './tranzistor-zosilnovac';
import usmernovace from './usmernovace';

/** Elektronika: usmerňovače, stabilizátory, zosilňovače, oscilátory. Poradie v poli je poradie lekcií v kapitole. */
export const MODULES: readonly LessonModule[] = [
  usmernovace,
  stabilizatory,
  tranzistorZosilnovac,
  operacnyZosilnovac,
  oscilatory555,
];
