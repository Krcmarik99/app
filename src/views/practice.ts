import { CHAPTERS, LESSONS, lessonById } from '../content/lessons';
import { frag, h } from '../lib/dom';
import { rich } from '../lib/formula';
import { recordAnswer, recordSession } from '../lib/progress';
import { createRng, randomSeed } from '../lib/random';
import { buildQuiz, theoryCount, type QuizMode } from '../practice/session';
import type { Question } from '../practice/types';
import { icon } from '../ui/icons';
import { questionCard } from '../ui/question';
import { meter, pageHead } from './common';

const COUNTS = [5, 10, 20, 30] as const;

const MODES: readonly [QuizMode, string, string][] = [
  ['mixed', 'Výpočty aj teória', 'Číselné príklady majú pri každom pokuse nové hodnoty, takže ich môžeš riešiť opakovane. Kalkulačka a papier sú dovolené.'],
  ['theory', 'Len teória', 'Preskúšanie bez počítania: pojmy, princípy, zapojenia, vlastnosti súčiastok a strojov a správne vzťahy. Žiadne čísla sa nedosadzujú.'],
];

interface Settings {
  topics: Set<string>;
  count: number;
  mode: QuizMode;
}

let lastSettings: Settings | null = null;

/** Orientačná známka podľa bežnej školskej stupnice (90 / 75 / 50 / 30 %). */
export function gradeFor(pct: number): [number, string] {
  if (pct >= 90) return [1, 'výborný'];
  if (pct >= 75) return [2, 'chválitebný'];
  if (pct >= 50) return [3, 'dobrý'];
  if (pct >= 30) return [4, 'dostatočný'];
  return [5, 'nedostatočný'];
}

export function practiceView(topic?: string, theory = false): HTMLElement {
  const root = h('div', { class: 'view view-practice' });
  const preset = topic && lessonById(topic) ? topic : undefined;
  const settings: Settings = preset
    ? { topics: new Set([preset]), count: theory ? 10 : 5, mode: theory ? 'theory' : 'mixed' }
    : lastSettings
      ? { topics: new Set(lastSettings.topics), count: lastSettings.count, mode: theory ? 'theory' : lastSettings.mode }
      : { topics: new Set(LESSONS.map((l) => l.id)), count: 10, mode: theory ? 'theory' : 'mixed' };

  function showSetup(): void {
    const startBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-lg' }, 'Začať cvičenie', icon('arrow', 18));
    const chips = new Map<string, HTMLButtonElement>();
    const modeHint = h('p', { class: 'setup-hint' });
    const sync = () => {
      chips.forEach((chip, id) => chip.setAttribute('aria-pressed', String(settings.topics.has(id))));
      modeHint.textContent = MODES.find(([m]) => m === settings.mode)![2];
      startBtn.replaceChildren(settings.mode === 'theory' ? 'Začať test z teórie' : 'Začať cvičenie', icon('arrow', 18));
      const available = settings.mode === 'theory' ? theoryCount([...settings.topics]) : Infinity;
      startBtn.disabled = settings.topics.size === 0 || available === 0;
      if (settings.topics.size === 0) {
        summary.textContent = 'Vyber aspoň jednu tému.';
      } else if (settings.mode === 'theory') {
        summary.textContent = `Vybrané témy: ${settings.topics.size} z ${LESSONS.length} · teoretických otázok: ${available}`
          + (available < settings.count ? ` – test bude mať ${available} ${plural(available)}` : '');
      } else {
        summary.textContent = `Vybrané témy: ${settings.topics.size} z ${LESSONS.length}`;
      }
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
        h('input', { type: 'radio', name: 'count', id: `count-${c}`, value: c, checked: settings.count === c, onChange: () => { settings.count = c; sync(); } }),
        h('span', null, String(c)),
      )),
    );

    const modeGroup = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Druh otázok' },
      MODES.map(([m, label]) => h('label', { class: 'seg-item' },
        h('input', { type: 'radio', name: 'mode', id: `mode-${m}`, value: m, checked: settings.mode === m, onChange: () => { settings.mode = m; sync(); } }),
        h('span', null, label),
      )),
    );

    root.replaceChildren(
      pageHead('Precvičovanie', 'Cvičenie', 'Vyber druh otázok, témy a počet otázok. Na výpočty sa precvičuj s novými hodnotami pri každom pokuse, teóriu si over testom bez počítania.'),
      h('form', {
        class: 'setup',
        onSubmit: (e: Event) => {
          e.preventDefault();
          if (settings.topics.size) start();
        },
      },
        h('fieldset', { class: 'setup-block' },
          h('legend', null, 'Druh otázok'),
          modeGroup,
          modeHint,
        ),
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
    lastSettings = { topics: new Set(settings.topics), count: settings.count, mode: settings.mode };
    const rng = createRng(randomSeed());
    const questions = buildQuiz([...settings.topics], settings.count, rng, settings.mode);
    if (questions.length === 0) {
      showSetup();
      return;
    }
    run(questions, settings.mode);
  }

  function run(questions: Question[], mode: QuizMode): void {
    const results: boolean[] = [];
    let index = 0;
    const counter = h('span', { class: 'run-counter' });
    const scoreEl = h('span', { class: 'run-score' });
    const bar = h('div', { class: 'run-bar' });
    const stage = h('div', { class: 'run-stage' });
    const next = h('button', { type: 'button', class: 'btn btn-primary btn-lg run-next' });

    const header = h('div', { class: 'run-head' },
      h('div', { class: 'run-info' }, mode === 'theory' ? h('span', { class: 'run-tag' }, 'Teória') : null, counter, scoreEl),
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
      const topics = [...new Set(questions.slice(0, answered).map((q) => q.lessonId))];
      if (answered > 0) recordSession({ total: answered, correct, topics, ...(mode === 'theory' ? { theory: true } : {}) });
      showSummary(questions.slice(0, answered), results, early, mode);
    }

    root.replaceChildren(header, stage, h('div', { class: 'run-actions' }, next));
    showQuestion();
  }

  function showSummary(questions: Question[], results: boolean[], early: boolean, mode: QuizMode): void {
    const theoryMode = mode === 'theory';
    const correct = results.filter(Boolean).length;
    const total = results.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const name = theoryMode ? 'Test z teórie' : 'Cvičenie';
    const message = total === 0
      ? `${name} skončil${theoryMode ? '' : 'o'} skôr, než padla prvá odpoveď.`
      : pct === 100 ? (theoryMode ? 'Bez jedinej chyby. Teóriu z týchto tém ovládaš.' : 'Bez jedinej chyby. Skús ťažšiu kombináciu tém.')
        : pct >= 80 ? 'Výborne, látku ovládaš.'
          : pct >= 50 ? (theoryMode ? 'Dobrý základ. Pozri si nižšie správne odpovede pri chybách a skús test znova.' : 'Dobrý základ. Pozri si postupy pri chybných odpovediach a skús to znova.')
            : theoryMode ? 'Vráť sa k lekciám a zopakuj si učivo. Potom si test zopakuj.' : 'Vráť sa k lekciám a prejdi si riešené príklady. Potom to skús znova.';
    const wrongTopics = [...new Set(questions.filter((_, i) => !results[i]).map((q) => q.lessonId))];
    const [grade, gradeName] = gradeFor(pct);

    const theoryItem = (q: Question, ok: boolean) => h('div', { class: 'summary-q' },
      h('span', { class: 'summary-topic' }, lessonById(q.lessonId)?.title ?? ''),
      h('span', { class: 'summary-prompt' }, rich(q.prompt)),
      !ok && q.kind === 'choice' ? h('span', { class: 'summary-answer' }, 'Správne:\u00a0', rich(q.options[q.correct])) : null,
    );

    root.replaceChildren(frag(
      pageHead(`${name} ${early ? 'ukončen' : 'dokončen'}${theoryMode ? 'ý' : 'é'}`, 'Výsledok'),
      h('div', { class: 'summary' },
        h('div', { class: 'summary-score' },
          h('p', { class: 'summary-big' }, `${correct} / ${total}`),
          h('p', { class: 'summary-pct' }, total ? `${pct} % správne` : ''),
          meter(correct, total || 1, 'Úspešnosť'),
        ),
        h('div', { class: 'summary-msg' },
          theoryMode && total
            ? h('p', { class: 'summary-grade' }, 'Orientačná známka ', h('strong', null, String(grade)), ` – ${gradeName}`)
            : null,
          h('p', null, message),
        ),
      ),
      total
        ? h('ol', { class: `summary-list${theoryMode ? ' summary-theory' : ''}` }, questions.map((q, i) => h('li', { class: results[i] ? 'ok' : 'bad' },
          h('span', { class: 'summary-mark' }, results[i] ? icon('check', 16) : icon('close', 16)),
          theoryMode ? theoryItem(q, results[i]) : h('span', { class: 'summary-topic' }, lessonById(q.lessonId)?.title ?? ''),
          theoryMode ? null : h('span', { class: 'summary-kind' }, q.kind === 'numeric' ? 'výpočet' : 'otázka'),
        )))
        : null,
      theoryMode && total ? h('p', { class: 'muted summary-scale' }, 'Známka podľa bežnej stupnice: 1 od 90 %, 2 od 75 %, 3 od 50 %, 4 od 30 %.') : null,
      wrongTopics.length
        ? h('p', { class: 'weak-note' }, 'Zopakuj si: ', wrongTopics.map((id, i) => [i ? ', ' : '', h('a', { href: `#lekcia-${id}` }, lessonById(id)?.title ?? id)]))
        : null,
      h('div', { class: 'summary-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onClick: start }, icon('shuffle', 18), theoryMode ? 'Nový test z rovnakých tém' : 'Nové príklady z rovnakých tém'),
        h('button', { type: 'button', class: 'btn btn-secondary', onClick: showSetup }, 'Zmeniť nastavenie'),
      ),
    ));
  }

  if (preset) start();
  else showSetup();
  return root;
}

const plural = (n: number) => (n === 1 ? 'otázku' : n >= 2 && n <= 4 ? 'otázky' : 'otázok');
