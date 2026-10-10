/** Pomôcky pre moduly lekcií: otázka s výberom zo štyroch možností a čistenie čísel. */
import { shuffle, type Rng } from '../../lib/random';
import type { ChoiceQuestion } from '../../practice/types';

/** Otázka s výberom; prvá možnosť je správna, poradie sa zamieša. */
export function choice(lessonId: string, prompt: string, options: [string, string, string, string], explanation: string, rng: Rng): ChoiceQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { kind: 'choice', lessonId, prompt, options: order.map((i) => options[i]), correct: order.indexOf(0), explanation };
}

/** Odstráni šum binárnej aritmetiky. */
export const clean = (x: number) => Number(x.toPrecision(10));

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
