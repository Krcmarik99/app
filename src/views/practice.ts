import { CHAPTERS, LESSONS, lessonById } from '../content/lessons';
import { frag, h } from '../lib/dom';
import { recordAnswer, recordSession } from '../lib/progress';
import { createRng, randomSeed } from '../lib/random';
import { buildQuiz } from '../practice/session';
import type { Question } from '../practice/types';
import { icon } from '../ui/icons';
import { questionCard } from '../ui/question';
import { meter, pageHead } from './common';

const COUNTS = [5, 10, 20] as const;

interface Settings {
  topics: Set<string>;
  count: number;
}

let lastSettings: Settings | null = null;

export function practiceView(topic?: string): HTMLElement {
  const root = h('div', { class: 'view view-practice' });
  const preset = topic && lessonById(topic) ? topic : undefined;
  const settings: Settings = preset
    ? { topics: new Set([preset]), count: 5 }
    : lastSettings ?? { topics: new Set(LESSONS.map((l) => l.id)), count: 10 };

  function showSetup(): void {
    const startBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-lg' }, 'Začať cvičenie', icon('arrow', 18));
    const chips = new Map<string, HTMLButtonElement>();
    const sync = () => {
      chips.forEach((chip, id) => chip.setAttribute('aria-pressed', String(settings.topics.has(id))));
      startBtn.disabled = settings.topics.size === 0;
      summary.textContent = settings.topics.size === 0
        ? 'Vyber aspoň jednu tému.'
        : `Vybrané témy: ${settings.topics.size} z ${LESSONS.length}`;
    };
    const summary = h('p', { class: 'muted', 'aria-live': 'polite' });

    const topicGroups = CHAPTERS.filter((ch) => LESSONS.some((l) => l.chapter === ch.id)).map((ch) => h('div', { class: 'chip-group' },
      h('p', { class: 'chip-group-title' }, ch.title),
      h('div', { class: 'chips' }, LESSONS.filter((l) => l.chapter === ch.id).map((l) => {
        const chip = h('button', { type: 'button', class: 'chip-toggle', id: `topic-${l.id}` }, l.title);
        chip.addEventListener('click', () => {
          if (settings.topics.has(l.id)) settings.topics.delete(l.id);
          else settings.topics.add(l.id);
          sync();
        });
        chips.set(l.id, chip);
        return chip;
      })),
    ));

    const countGroup = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Počet otázok' },
      COUNTS.map((c) => h('label', { class: 'seg-item' },
        h('input', { type: 'radio', name: 'count', id: `count-${c}`, value: c, checked: settings.count === c, onChange: () => { settings.count = c; } }),
        h('span', null, String(c)),
      )),
    );

    root.replaceChildren(
      pageHead('Precvičovanie', 'Cvičenie', 'Vyber témy a počet otázok. Číselné príklady majú pri každom pokuse nové hodnoty, takže ich môžeš riešiť opakovane. Kalkulačka a papier sú dovolené.'),
      h('form', {
        class: 'setup',
        onSubmit: (e: Event) => {
          e.preventDefault();
          if (settings.topics.size) start();
        },
      },
        h('fieldset', { class: 'setup-block' },
          h('legend', null, 'Témy'),
          h('div', { class: 'setup-tools' },
            h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onClick: () => { LESSONS.forEach((l) => settings.topics.add(l.id)); sync(); } }, 'Vybrať všetky'),
            h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onClick: () => { settings.topics.clear(); sync(); } }, 'Zrušiť výber'),
          ),
          topicGroups,
        ),
        h('fieldset', { class: 'setup-block' },
          h('legend', null, 'Počet otázok'),
          countGroup,
        ),
        h('div', { class: 'setup-submit' }, startBtn, summary),
      ),
    );
    sync();
  }

  function start(): void {
    lastSettings = { topics: new Set(settings.topics), count: settings.count };
    const rng = createRng(randomSeed());
    const questions = buildQuiz([...settings.topics], settings.count, rng);
    run(questions);
  }

  function run(questions: Question[]): void {
    const results: boolean[] = [];
    let index = 0;
    const counter = h('span', { class: 'run-counter' });
    const scoreEl = h('span', { class: 'run-score' });
    const bar = h('div', { class: 'run-bar' });
    const stage = h('div', { class: 'run-stage' });
    const next = h('button', { type: 'button', class: 'btn btn-primary btn-lg run-next' });

    const header = h('div', { class: 'run-head' },
      h('div', { class: 'run-info' }, counter, scoreEl),
      bar,
      h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onClick: () => finish(true) }, 'Ukončiť'),
    );

    const showQuestion = () => {
      const q = questions[index];
      counter.textContent = `Otázka ${index + 1} z ${questions.length}`;
      scoreEl.textContent = `správne ${results.filter(Boolean).length}`;
      bar.replaceChildren(meter(index, questions.length, 'Priebeh cvičenia'));
      next.hidden = true;
      stage.replaceChildren(questionCard(q, {
        idPrefix: `pq-${index}`,
        onResult: (ok) => {
          results.push(ok);
          recordAnswer(q.lessonId, ok);
          scoreEl.textContent = `správne ${results.filter(Boolean).length}`;
          next.textContent = index + 1 < questions.length ? 'Ďalšia otázka' : 'Zobraziť výsledok';
          next.hidden = false;
          next.focus({ preventScroll: true });
        },
      }));
      const input = stage.querySelector<HTMLInputElement>('.answer-input');
      input?.focus({ preventScroll: true });
    };

    next.addEventListener('click', () => {
      index += 1;
      if (index < questions.length) {
        showQuestion();
        root.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      } else {
        finish(false);
      }
    });

    function finish(early: boolean): void {
      const answered = results.length;
      const correct = results.filter(Boolean).length;
      if (answered > 0) recordSession({ total: answered, correct, topics: [...new Set(questions.slice(0, answered).map((q) => q.lessonId))] });
      showSummary(questions.slice(0, answered), results, early);
    }

    root.replaceChildren(header, stage, h('div', { class: 'run-actions' }, next));
    showQuestion();
  }

  function showSummary(questions: Question[], results: boolean[], early: boolean): void {
    const correct = results.filter(Boolean).length;
    const total = results.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const message = total === 0
      ? 'Cvičenie skončilo skôr, než padla prvá odpoveď.'
      : pct === 100 ? 'Bez jedinej chyby. Skús ťažšiu kombináciu tém.'
        : pct >= 80 ? 'Výborne, látku ovládaš.'
          : pct >= 50 ? 'Dobrý základ. Pozri si postupy pri chybných odpovediach a skús to znova.'
            : 'Vráť sa k lekciám a prejdi si riešené príklady. Potom to skús znova.';
    const wrongTopics = [...new Set(questions.filter((_, i) => !results[i]).map((q) => q.lessonId))];

    root.replaceChildren(frag(
      pageHead(early ? 'Cvičenie ukončené' : 'Cvičenie dokončené', 'Výsledok'),
      h('div', { class: 'summary' },
        h('div', { class: 'summary-score' },
          h('p', { class: 'summary-big' }, `${correct} / ${total}`),
          h('p', { class: 'summary-pct' }, total ? `${pct} % správne` : ''),
          meter(correct, total || 1, 'Úspešnosť'),
        ),
        h('p', { class: 'summary-msg' }, message),
      ),
      total
        ? h('ol', { class: 'summary-list' }, questions.map((q, i) => h('li', { class: results[i] ? 'ok' : 'bad' },
          h('span', { class: 'summary-mark' }, results[i] ? icon('check', 16) : icon('close', 16)),
          h('span', { class: 'summary-topic' }, lessonById(q.lessonId)?.title ?? ''),
          h('span', { class: 'summary-kind' }, q.kind === 'numeric' ? 'výpočet' : 'otázka'),
        )))
        : null,
      wrongTopics.length
        ? h('p', { class: 'weak-note' }, 'Zopakuj si: ', wrongTopics.map((id, i) => [i ? ', ' : '', h('a', { href: `#lekcia-${id}` }, lessonById(id)?.title ?? id)]))
        : null,
      h('div', { class: 'summary-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onClick: start }, icon('shuffle', 18), 'Nové príklady z rovnakých tém'),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: showSetup }, 'Zmeniť nastavenie'),
      ),
    ));
  }

  if (preset) start();
  else showSetup();
  return root;
}
