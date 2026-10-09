import { lessonById } from '../content/lessons';
import { h } from '../lib/dom';
import { rich } from '../lib/formula';
import { fmt } from '../lib/units';
import { checkNumeric } from '../practice/session';
import type { ChoiceQuestion, NumericQuestion, Question } from '../practice/types';
import { icon } from './icons';

export interface QuestionCardOptions {
  /** Popis nad otázkou, napr. „Otázka 3 z 10“. */
  label?: string;
  idPrefix: string;
  onResult: (correct: boolean) => void;
}

function figureBox(q: Question): HTMLElement | null {
  return q.figure ? h('div', { class: 'q-figure sch-panel' }, q.figure()) : null;
}

function answerText(q: NumericQuestion): string {
  const value = fmt(q.answer, 4);
  return q.unit ? `${value} ${q.unit}` : value;
}

function solutionList(steps: string[]): HTMLElement {
  return h('ol', { class: 'solution' }, steps.map((step) => h('li', null, rich(step))));
}

function numericBody(q: NumericQuestion, opts: QuestionCardOptions): HTMLElement {
  const inputId = `${opts.idPrefix}-answer`;
  const input = h('input', {
    id: inputId,
    class: 'answer-input',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'napr. 4,7',
    'aria-describedby': `${inputId}-hint`,
  });
  const hint = h('p', { class: 'answer-hint', id: `${inputId}-hint` }, q.unit ? `Výsledok zadaj v jednotkách ${q.unit}. Desatinná čiarka aj bodka sú v poriadku.` : 'Zadaj číslo. Desatinná čiarka aj bodka sú v poriadku.');
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const checkBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Skontrolovať');
  const giveUp = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Ukáž riešenie');
  let done = false;

  const finish = (correct: boolean, showSolution: boolean) => {
    done = true;
    input.readOnly = true;
    checkBtn.disabled = true;
    giveUp.disabled = true;
    form.classList.add(correct ? 'is-correct' : 'is-wrong');
    feedback.replaceChildren(
      h('p', { class: `verdict ${correct ? 'good' : 'bad'}` },
        correct ? icon('check', 18) : null,
        correct ? `Správne! Presný výsledok: ${answerText(q)}` : `Správna odpoveď je ${answerText(q)}.`),
      showSolution || !correct
        ? h('div', { class: 'solution-box' }, h('p', { class: 'eyebrow' }, 'Postup riešenia'), solutionList(q.solution))
        : h('details', { class: 'solution-box' }, h('summary', null, 'Pozrieť postup'), solutionList(q.solution)),
    );
    opts.onResult(correct);
  };

  const form = h('form', {
    class: 'numeric-form',
    novalidate: true,
    onSubmit: (e: Event) => {
      e.preventDefault();
      if (done) return;
      const result = checkNumeric(q, input.value);
      if (result === 'invalid') {
        feedback.replaceChildren(h('p', { class: 'verdict warn' }, input.value.trim() ? 'Toto nie je číslo. Zadaj napríklad 4,7 alebo 0,025.' : 'Najprv zadaj výsledok.'));
        input.focus();
        return;
      }
      finish(result === 'correct', false);
    },
  },
    h('label', { class: 'sr-only', for: inputId }, 'Tvoja odpoveď'),
    h('div', { class: 'answer-row' },
      h('div', { class: 'answer-field' }, input, q.unit ? h('span', { class: 'answer-unit' }, q.unit) : null),
      checkBtn,
      giveUp,
    ),
    hint,
    feedback,
  );
  giveUp.addEventListener('click', () => {
    if (!done) finish(false, true);
  });
  return form;
}

function choiceBody(q: ChoiceQuestion, opts: QuestionCardOptions): HTMLElement {
  const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const buttons: HTMLButtonElement[] = [];
  const letters = ['A', 'B', 'C', 'D', 'E'];
  q.options.forEach((option, i) => {
    const btn = h('button', { type: 'button', class: 'option', id: `${opts.idPrefix}-opt-${i}` },
      h('span', { class: 'option-key' }, letters[i]),
      h('span', { class: 'option-text' }, rich(option)),
    );
    btn.addEventListener('click', () => {
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (j === q.correct) b.classList.add('is-correct');
        else if (j === i) b.classList.add('is-wrong');
      });
      const correct = i === q.correct;
      feedback.replaceChildren(
        h('p', { class: `verdict ${correct ? 'good' : 'bad'}` }, correct ? icon('check', 18) : null, correct ? 'Správne!' : 'Nesprávne.'),
        h('p', { class: 'explanation' }, rich(q.explanation)),
      );
      opts.onResult(correct);
    });
    buttons.push(btn);
  });
  return h('div', { class: 'choice' }, h('div', { class: 'options' }, buttons), feedback);
}

export function questionCard(q: Question, opts: QuestionCardOptions): HTMLElement {
  const lesson = lessonById(q.lessonId);
  return h('article', { class: 'question' },
    h('header', { class: 'q-head' },
      opts.label ? h('span', { class: 'eyebrow' }, opts.label) : null,
      lesson ? h('span', { class: 'q-topic' }, lesson.title) : null,
    ),
    h('p', { class: 'q-prompt' }, rich(q.prompt)),
    figureBox(q),
    q.kind === 'numeric' ? numericBody(q, opts) : choiceBody(q, opts),
  );
}
