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
  /** Jednotka s predponou bola zvolená automaticky (výsledok je potom v rozsahu 1 až 999). */
  autoUnit?: boolean;
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
