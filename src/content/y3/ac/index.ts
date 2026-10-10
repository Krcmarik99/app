import type { LessonModule } from '../../module';
import filtre from './filtre';
import paralelnaRezonancia from './paralelna-rezonancia';
import seriovaRezonancia from './seriova-rezonancia';
import trojfazovaSustava from './trojfazova-sustava';
import vykonStriedavy from './vykon-striedavy';

/** Striedavý prúd (3. ročník): výkon a účinník, rezonancia, filtre, trojfázová sústava. Poradie v poli je poradie lekcií v kapitole. */
export const MODULES: readonly LessonModule[] = [
  vykonStriedavy,
  seriovaRezonancia,
  paralelnaRezonancia,
  filtre,
  trojfazovaSustava,
];
