export type FigureFn = () => SVGSVGElement;

export interface NumericQuestion {
  kind: 'numeric';
  lessonId: string;
  prompt: string;
  figure?: FigureFn;
  /** Jednotka, v ktorej študent zadáva výsledok (napr. „mA“). */
  unit: string;
  /** Správny výsledok v jednotke `unit`. */
  answer: number;
  /** Povolená relatívna odchýlka (zaokrúhľovanie medzivýsledkov). */
  tolerance: number;
  solution: string[];
}

export interface ChoiceQuestion {
  kind: 'choice';
  lessonId: string;
  prompt: string;
  figure?: FigureFn;
  options: string[];
  correct: number;
  explanation: string;
}

export type Question = NumericQuestion | ChoiceQuestion;
