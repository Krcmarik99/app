import type { Generator } from '../../practice/helpers';
import type { Lesson } from '../lessons';
import type { StaticQuestion } from '../questions';

/**
 * Jedna lekcia kapitoly Elektrotechnické merania spolu s otázkami a generátormi príkladov.
 * Modul nesmie importovať hodnoty z lessons.ts, questions.ts ani generators.ts (iba typy) –
 * tie si moduly načítavajú samy a vznikol by kruhový import.
 */
export interface MeasModule {
  lesson: Lesson;
  questions: StaticQuestion[];
  generators: Generator[];
}
