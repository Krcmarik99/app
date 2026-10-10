import type { LessonModule } from '../../module';
import asynchronnyMotor from './asynchronny-motor';
import jednosmerneStroje from './jednosmerne-stroje';
import transformator from './transformator';
import transformatorPrevadzka from './transformator-prevadzka';
import transformatorySpecialne from './transformatory-specialne';

/** Elektrické stroje: transformátory, asynchrónny motor, jednosmerné a synchrónne stroje. Poradie v poli je poradie lekcií v kapitole. */
export const MODULES: readonly LessonModule[] = [
  transformator,
  transformatorPrevadzka,
  transformatorySpecialne,
  asynchronnyMotor,
  jednosmerneStroje,
];
