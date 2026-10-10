import { CHAPTERS, LESSONS, lessonById, lessonIndex, type Block, type Lesson } from '../content/lessons';
import { QUESTIONS } from '../content/questions';
import { BAND_COLORS } from '../lib/colorcode';
import { h } from '../lib/dom';
import { formula, rich } from '../lib/formula';
import { getProgress, recordAnswer, setLastLesson, setLessonDone } from '../lib/progress';
import { pick, randomSeed, createRng, shuffle } from '../lib/random';
import { fmt, superscript } from '../lib/units';
import { GENERATORS } from '../practice/generators';
import { fromStatic } from '../practice/session';
import type { Question } from '../practice/types';
import { FIGURES } from '../ui/figures';
import { icon } from '../ui/icons';
import { questionCard } from '../ui/question';
import { backLink, linkButton, pageHead } from './common';

const pad = (n: number) => String(n).padStart(2, '0');

export function lessonsView(): HTMLElement {
  const p = getProgress();
  return h('div', { class: 'view view-lessons' },
    pageHead('Kurz', 'Lekcie', 'Lekcie idú za sebou od základných veličín cez striedavé obvody, elektrické stroje, elektroniku a číslicovú techniku až po elektroenergetiku a merania. Každá obsahuje teóriu, vzorce, schémy a grafy, riešené príklady a krátky test.'),
    CHAPTERS.filter((ch) => LESSONS.some((l) => l.chapter === ch.id)).map((ch) =>
      h('section', { class: 'chapter-block', 'aria-labelledby': `ch-${ch.id}` },
        h('div', { class: 'chapter-block-head' },
          h('h2', { id: `ch-${ch.id}` }, ch.title, ' ', h('span', { class: 'chip chapter-grade' }, ch.grade)),
          h('p', { class: 'muted' }, ch.blurb),
        ),
        h('ol', { class: 'lesson-list' },
          LESSONS.filter((l) => l.chapter === ch.id).map((l) => {
            const done = p.lessonsDone.includes(l.id);
            return h('li', null,
              h('a', { href: `#lekcia-${l.id}`, class: `lesson-row ${done ? 'is-done' : ''}` },
                h('span', { class: 'lesson-num' }, pad(lessonIndex(l.id) + 1)),
                h('span', { class: 'lesson-text' },
                  h('span', { class: 'lesson-title' }, l.title),
                  h('span', { class: 'lesson-summary' }, l.summary),
                ),
                h('span', { class: 'lesson-meta' },
                  done ? h('span', { class: 'chip chip-good' }, icon('check', 14), 'preštudované') : h('span', { class: 'lesson-min' }, `${l.minutes} min`),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );
}

const NOTE_LABEL = { tip: 'Tip', warn: 'Pozor', remember: 'Zapamätaj si' } as const;

function formulaBlock(tex: string | string[], legend?: [string, string, string][]): HTMLElement {
  const list = Array.isArray(tex) ? tex : [tex];
  return h('div', { class: 'formula' },
    h('div', { class: 'formula-main' }, list.map((t) => h('span', { class: 'fx fx-display' }, formula(t)))),
    legend
      ? h('table', { class: 'legend' },
        h('tbody', null, legend.map(([sym, meaning, unit]) => h('tr', null,
          h('td', { class: 'fx legend-sym' }, formula(sym)),
          h('td', null, meaning),
          h('td', { class: 'legend-unit' }, unit),
        ))),
      )
      : null,
  );
}

function colorTable(): HTMLElement {
  const mult = (exp?: number) => (exp === undefined ? '—' : exp >= 0 && exp <= 3 ? `× ${fmt(10 ** exp)}` : `× 10${superscript(exp)}`);
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'data-table color-table' },
      h('thead', null, h('tr', null, ['Farba', 'Číslica', 'Násobiteľ', 'Tolerancia'].map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', null, BAND_COLORS.map((c) => h('tr', null,
        h('td', null, h('span', { class: 'swatch', style: { background: c.hex } }), c.name),
        h('td', { class: 'num' }, c.digit === undefined ? '—' : String(c.digit)),
        h('td', { class: 'num' }, mult(c.exp)),
        h('td', { class: 'num' }, c.tolerance === undefined ? '—' : `±${fmt(c.tolerance)} %`),
      ))),
    ),
  );
}

function renderBlock(b: Block): HTMLElement {
  switch (b.t) {
    case 'p':
      return h('p', null, rich(b.text));
    case 'h':
      return h('h2', { class: 'lesson-h' }, b.text);
    case 'formula':
      return formulaBlock(b.tex, b.legend);
    case 'list':
      return h('ul', { class: 'bullets' }, b.items.map((i) => h('li', null, rich(i))));
    case 'note':
      return h('aside', { class: `note note-${b.kind}` }, h('p', { class: 'note-label' }, NOTE_LABEL[b.kind]), h('p', null, rich(b.text)));
    case 'example':
      return h('section', { class: 'example' },
        h('p', { class: 'eyebrow' }, 'Riešený príklad'),
        h('h3', null, b.title),
        h('div', { class: 'example-grid' },
          h('div', null, h('p', { class: 'example-k' }, 'Zadané'), h('ul', { class: 'given' }, b.given.map((g) => h('li', null, rich(g))))),
          h('div', null, h('p', { class: 'example-k' }, 'Riešenie'), h('ol', { class: 'steps' }, b.steps.map((s) => h('li', null, rich(s))))),
        ),
        h('p', { class: 'example-result' }, h('span', { class: 'example-k' }, 'Výsledok'), h('span', null, rich(b.result))),
      );
    case 'table':
      return h('div', { class: 'table-wrap' },
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, b.head.map((c) => h('th', { scope: 'col' }, rich(c))))),
          h('tbody', null, b.rows.map((r) => h('tr', null, r.map((c) => h('td', null, rich(c)))))),
        ),
      );
    case 'figure':
      return h('figure', { class: 'fig' },
        h('div', { class: 'sch-panel' }, typeof b.fig === 'function' ? b.fig() : FIGURES[b.fig]()),
        b.caption ? h('figcaption', null, rich(b.caption)) : null,
      );
    case 'explore':
      return h('figure', { class: 'fig fig-explore' },
        b.build(),
        b.caption ? h('figcaption', null, rich(b.caption)) : null,
      );
    case 'colortable':
      return colorTable();
  }
}

function lessonQuiz(lesson: Lesson): HTMLElement {
  const box = h('section', { class: 'lesson-quiz', 'aria-labelledby': 'quiz-title' });
  const build = () => {
    const rng = createRng(randomSeed());
    const statics = shuffle(rng, QUESTIONS.filter((q) => q.lessonId === lesson.id)).slice(0, 2).map((q) => fromStatic(q, rng));
    const gens = GENERATORS[lesson.id] ?? [];
    const questions: Question[] = gens.length ? [...statics, pick(rng, gens)(rng)] : statics;
    let answered = 0;
    let correct = 0;
    const score = h('p', { class: 'quiz-score', 'aria-live': 'polite' });
    const updateScore = () => {
      score.textContent = answered === questions.length
        ? `Výsledok: ${correct} z ${questions.length} správne.`
        : `Zodpovedané ${answered} z ${questions.length}.`;
    };
    updateScore();
    box.replaceChildren(
      h('div', { class: 'section-head' },
        h('h2', { id: 'quiz-title' }, 'Over si, čo vieš'),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: build }, icon('shuffle', 18), 'Nové otázky'),
      ),
      h('div', { class: 'quiz-list' }, questions.map((q, i) => questionCard(q, {
        label: `Otázka ${i + 1}`,
        idPrefix: `lq-${i}`,
        onResult: (ok) => {
          answered += 1;
          if (ok) correct += 1;
          recordAnswer(q.lessonId, ok);
          updateScore();
        },
      }))),
      score,
    );
  };
  build();
  return box;
}

export function lessonView(id: string): HTMLElement {
  const lesson = lessonById(id);
  if (!lesson) {
    return h('div', { class: 'view' },
      pageHead(null, 'Lekcia sa nenašla', 'Odkaz je pravdepodobne neplatný.'),
      linkButton('#lekcie', 'Prejsť na zoznam lekcií'),
    );
  }
  setLastLesson(lesson.id);
  const idx = lessonIndex(lesson.id);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];
  const chapter = CHAPTERS.find((c) => c.id === lesson.chapter)!;

  const doneBtn = h('button', { type: 'button', class: 'btn' });
  const renderDone = () => {
    const done = getProgress().lessonsDone.includes(lesson.id);
    doneBtn.className = `btn ${done ? 'btn-done' : 'btn-primary'}`;
    doneBtn.setAttribute('aria-pressed', String(done));
    doneBtn.replaceChildren(icon('check', 18), done ? 'Preštudované' : 'Označiť ako preštudované');
  };
  doneBtn.addEventListener('click', () => {
    setLessonDone(lesson.id, !getProgress().lessonsDone.includes(lesson.id));
    renderDone();
  });
  renderDone();

  return h('div', { class: 'view view-lesson' },
    backLink('#lekcie', 'Lekcie'),
    h('article', { class: 'lesson' },
      pageHead(`Lekcia ${pad(idx + 1)} · ${chapter.title} · ${lesson.minutes} min`, lesson.title, lesson.summary),
      h('div', { class: 'lesson-body' }, lesson.blocks.map(renderBlock)),
    ),
    lessonQuiz(lesson),
    h('div', { class: 'lesson-actions' },
      doneBtn,
      linkButton(`#cvicenie-${lesson.id}`, 'Precvičiť tému', 'secondary'),
    ),
    h('nav', { class: 'lesson-nav', 'aria-label': 'Ďalšie lekcie' },
      prev ? h('a', { href: `#lekcia-${prev.id}`, class: 'lesson-nav-link prev' }, h('span', { class: 'eyebrow' }, 'Predchádzajúca'), h('span', null, prev.title)) : h('span', null),
      next ? h('a', { href: `#lekcia-${next.id}`, class: 'lesson-nav-link next' }, h('span', { class: 'eyebrow' }, 'Ďalšia'), h('span', null, next.title)) : h('span', null),
    ),
  );
}
