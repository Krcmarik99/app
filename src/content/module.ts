import type { Generator } from '../practice/helpers';
import type { Lesson } from './lessons';
import type { StaticQuestion } from './questions';

/**
 * Jedna lekcia spolu s otázkami a generátormi príkladov. Modul nesmie importovať hodnoty
 * z lessons.ts, questions.ts ani generators.ts (iba typy) – vznikol by kruhový import.
 */
export interface LessonModule {
  lesson: Lesson;
  questions: StaticQuestion[];
  generators: Generator[];
}
