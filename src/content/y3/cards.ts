import type { Deck } from '../flashcards';
import { DECKS as AC } from './ac/cards';
import { DECKS as DIGITAL } from './digital/cards';
import { DECKS as ELECTRONICS } from './electronics/cards';
import { DECKS as MACHINES } from './machines/cards';
import { DECKS as POWER } from './power/cards';

/** Kartičky k učivu 3. ročníka. */
export const Y3_DECKS: readonly Deck[] = [...AC, ...MACHINES, ...ELECTRONICS, ...DIGITAL, ...POWER];
