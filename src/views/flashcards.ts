import { DECKS, type Card, type Deck } from '../content/flashcards';
import { h } from '../lib/dom';
import { rich } from '../lib/formula';
import { getProgress, setCardKnown } from '../lib/progress';
import { createRng, randomSeed, shuffle } from '../lib/random';
import { groundSymbol, symbolFigure } from '../ui/figures';
import { icon } from '../ui/icons';
import { meter, pageHead } from './common';

function cardFront(card: Card): HTMLElement {
  if (card.symbol) {
    const svg = card.symbol === 'ground' ? groundSymbol() : symbolFigure(card.symbol, 'Schematická značka');
    return h('div', { class: 'card-symbol' }, svg, h('p', { class: 'card-ask' }, 'Čo znamená táto značka?'));
  }
  return h('p', { class: 'card-term' }, rich(card.front));
}

export function flashcardsView(deckId?: string): HTMLElement {
  const deck: Deck = DECKS.find((d) => d.id === deckId) ?? DECKS[0];
  const root = h('div', { class: 'view view-cards' });
  const rng = createRng(randomSeed());
  const known = () => new Set(getProgress().cardsKnown);
  // Najprv karty, ktoré ešte nevieš.
  let queue: Card[] = [];
  let pos = 0;
  let flipped = false;

  const deckTabs = h('nav', { class: 'deck-tabs', 'aria-label': 'Balíčky kartičiek' },
    DECKS.map((d) => {
      const k = d.cards.filter((c) => known().has(c.id)).length;
      return h('a', { href: `#karticky-${d.id}`, class: 'deck-tab', 'aria-current': d.id === deck.id ? 'page' : null },
        h('span', { class: 'deck-tab-title' }, d.title),
        h('span', { class: 'deck-tab-count' }, `${k}/${d.cards.length}`),
      );
    }),
  );

  const stage = h('div', { class: 'card-stage' });
  const status = h('p', { class: 'card-status', 'aria-live': 'polite' });
  const bar = h('div');

  const rebuild = (all: boolean) => {
    const kn = known();
    const unknown = deck.cards.filter((c) => !kn.has(c.id));
    queue = shuffle(rng, all || unknown.length === 0 ? deck.cards : unknown);
    pos = 0;
    show();
  };

  const show = () => {
    const kn = known();
    const knownCount = deck.cards.filter((c) => kn.has(c.id)).length;
    bar.replaceChildren(meter(knownCount, deck.cards.length, 'Naučené kartičky'));
    if (pos >= queue.length) {
      stage.replaceChildren(h('div', { class: 'card-done' },
        h('p', { class: 'card-done-title' }, knownCount === deck.cards.length ? 'Celý balíček vieš.' : 'Kolo je za tebou.'),
        h('p', { class: 'muted' }, `Vieš ${knownCount} z ${deck.cards.length} kartičiek.`),
        h('div', { class: 'card-done-actions' },
          knownCount < deck.cards.length ? h('button', { type: 'button', class: 'btn btn-primary', onClick: () => rebuild(false) }, 'Opakovať neznáme') : null,
          h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => rebuild(true) }, icon('shuffle', 18), 'Prejsť všetky znova'),
        ),
      ));
      status.textContent = '';
      return;
    }
    const card = queue[pos];
    flipped = false;
    const inner = h('div', { class: 'flip-inner' },
      h('div', { class: 'flip-face flip-front' }, h('span', { class: 'face-label' }, deck.title), cardFront(card)),
      h('div', { class: 'flip-face flip-back', 'aria-hidden': 'true' },
        h('span', { class: 'face-label' }, 'Odpoveď'),
        h('p', { class: 'card-answer' }, rich(card.back)),
        card.note ? h('p', { class: 'card-note' }, rich(card.note)) : null,
      ),
    );
    const cardBtn = h('button', { type: 'button', class: 'flip-card', 'aria-label': 'Otočiť kartičku', 'aria-pressed': 'false' }, inner);
    const answerBtns = h('div', { class: 'card-answers' },
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => mark(false) }, 'Ešte neviem'),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: () => mark(true) }, icon('check', 18), 'Viem'),
    );
    answerBtns.hidden = true;
    const flip = () => {
      flipped = !flipped;
      cardBtn.classList.toggle('is-flipped', flipped);
      cardBtn.setAttribute('aria-pressed', String(flipped));
      inner.children[0].setAttribute('aria-hidden', String(flipped));
      inner.children[1].setAttribute('aria-hidden', String(!flipped));
      answerBtns.hidden = !flipped;
    };
    cardBtn.addEventListener('click', flip);
    const mark = (ok: boolean) => {
      setCardKnown(card.id, ok);
      if (!ok) queue.push(card);
      pos += 1;
      show();
    };
    stage.replaceChildren(cardBtn, h('p', { class: 'card-hint' }, 'Klikni na kartičku alebo stlač medzerník a over si odpoveď.'), answerBtns);
    status.textContent = `Kartička ${pos + 1} z ${queue.length}`;
  };

  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    const card = stage.querySelector<HTMLButtonElement>('.flip-card');
    if (!card) return;
    if (e.key === ' ' && target.tagName !== 'BUTTON') {
      e.preventDefault();
      card.click();
    }
  };
  document.addEventListener('keydown', onKey);

  root.append(
    pageHead('Opakovanie', 'Kartičky', 'Pozri sa na pojem, skús si odpoveď povedať a potom kartičku otoč. Kartičky, ktoré ešte nevieš, sa vrátia na koniec kola.'),
    deckTabs,
    h('div', { class: 'deck-head' },
      h('div', null, h('h2', null, deck.title), h('p', { class: 'muted' }, deck.description)),
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onClick: () => rebuild(true) }, icon('shuffle', 18), 'Zamiešať všetky'),
    ),
    bar,
    stage,
    status,
  );
  rebuild(false);
  return root;
}
