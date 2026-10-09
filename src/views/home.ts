import { ALL_CARDS } from '../content/flashcards';
import { CHAPTERS, LESSONS, lessonById, lessonIndex } from '../content/lessons';
import { currentAccount } from '../lib/auth';
import { h } from '../lib/dom';
import { getProgress, resetProgress, streak, totals } from '../lib/progress';
import { navigate } from '../router';
import { heroCircuit } from '../ui/hero';
import { icon } from '../ui/icons';
import { CALCULATORS } from './calculators';
import { linkButton, meter, plural } from './common';

export function statsSection(): HTMLElement {
  const p = getProgress();
  const account = currentAccount();
  const done = p.lessonsDone.filter((id) => lessonById(id)).length;
  const t = totals(p);
  const accuracy = t.answered ? Math.round((t.correct / t.answered) * 100) : null;
  const days = streak(p.activeDays);
  const known = p.cardsKnown.filter((id) => ALL_CARDS.some((c) => c.id === id)).length;

  const stat = (label: string, value: string, detail: string, bar?: HTMLElement) =>
    h('div', { class: 'stat' },
      h('p', { class: 'stat-label' }, label),
      h('p', { class: 'stat-value' }, value),
      bar ?? null,
      h('p', { class: 'stat-detail' }, detail),
    );

  const topicRows = LESSONS.filter((l) => p.stats[l.id]?.answered).map((l) => {
    const st = p.stats[l.id];
    const pct = Math.round((st.correct / st.answered) * 100);
    return h('li', { class: `topic-row ${pct < 70 && st.answered >= 3 ? 'is-weak' : ''}` },
      h('a', { href: `#cvicenie-${l.id}`, class: 'topic-name' }, l.title),
      meter(st.correct, st.answered, `Úspešnosť v téme ${l.title}`),
      h('span', { class: 'topic-pct' }, `${pct} %`),
      h('span', { class: 'topic-count' }, `${st.correct}/${st.answered}`),
    );
  });

  const weak = LESSONS.filter((l) => {
    const st = p.stats[l.id];
    return st && st.answered >= 3 && st.correct / st.answered < 0.7;
  });

  return h('section', { class: 'section', 'aria-labelledby': 'progress-title' },
    h('div', { class: 'section-head' },
      h('h2', { id: 'progress-title' }, 'Tvoj pokrok'),
      account
        ? h('p', { class: 'muted' }, `Účet ${account.name} · ukladá sa v tomto prehliadači.`)
        : h('p', { class: 'muted' }, 'Ukladá sa iba v tomto prehliadači. ',
          h('a', { href: '#prihlasenie' }, 'Prihlás sa'), ' alebo si ', h('a', { href: '#registracia' }, 'vytvor účet'),
          ', aby mal každý vlastný pokrok.'),
    ),
    h('div', { class: 'stats' },
      stat('Lekcie', `${done} / ${LESSONS.length}`, done === LESSONS.length ? 'Celý kurz máš prejdený.' : 'preštudovaných lekcií', meter(done, LESSONS.length, 'Preštudované lekcie')),
      stat('Úspešnosť', accuracy === null ? '—' : `${accuracy} %`, t.answered ? `${t.answered} ${plural(t.answered, 'odpoveď', 'odpovede', 'odpovedí')} v cvičeniach` : 'zatiaľ bez odpovedí'),
      stat('Séria', `${days} ${plural(days, 'deň', 'dni', 'dní')}`, days ? 'učenia po sebe' : 'začni dnes a udrž ju'),
      stat('Kartičky', `${known} / ${ALL_CARDS.length}`, 'označených ako „viem“', meter(known, ALL_CARDS.length, 'Naučené kartičky')),
    ),
    topicRows.length
      ? h('div', { class: 'topics' },
        h('h3', null, 'Úspešnosť podľa tém'),
        weak.length ? h('p', { class: 'weak-note' }, 'Na zopakovanie: ', weak.map((l, i) => [i ? ', ' : '', h('a', { href: `#cvicenie-${l.id}` }, l.title)])) : null,
        h('ul', { class: 'topic-list' }, topicRows),
      )
      : h('p', { class: 'empty' }, 'Zatiaľ tu nie sú žiadne vyriešené príklady. Úspešnosť podľa tém sa zobrazí po prvom cvičení.'),
  );
}

function resetControl(): HTMLElement {
  const wrap = h('div', { class: 'reset' });
  const ask = () => {
    wrap.replaceChildren(
      h('span', null, 'Naozaj vymazať celý pokrok? Túto akciu nejde vrátiť.'),
      h('button', { type: 'button', class: 'btn btn-danger', onClick: () => { resetProgress(); navigate('#domov'); } }, 'Vymazať'),
      h('button', { type: 'button', class: 'btn btn-quiet', onClick: idle }, 'Zrušiť'),
    );
  };
  const idle = () => {
    wrap.replaceChildren(h('button', { type: 'button', class: 'btn btn-quiet', onClick: ask }, 'Vymazať pokrok'));
  };
  idle();
  return wrap;
}

export function homeView(): HTMLElement {
  const p = getProgress();
  const next = LESSONS.find((l) => !p.lessonsDone.includes(l.id));
  const last = p.lastLesson ? lessonById(p.lastLesson) : undefined;
  const target = last && !p.lessonsDone.includes(last.id) ? last : next ?? LESSONS[0];
  const started = p.lessonsDone.length > 0 || !!p.lastLesson;
  const account = currentAccount();

  const hero = h('section', { class: 'hero' },
    h('div', { class: 'hero-copy' },
      h('p', { class: 'eyebrow' }, account ? `Ahoj, ${account.name.split(' ')[0]}` : 'Základy elektrotechniky · stredná škola'),
      h('h1', { class: 'hero-title' }, 'Elektrotechnika krok za krokom'),
      h('p', { class: 'lead' }, `${LESSONS.length} lekcií od Ohmovho zákona po elektrotechnické merania. Ku každej téme riešené príklady, cvičenia s novými hodnotami pri každom pokuse, kalkulačky a kartičky na opakovanie.`),
      h('div', { class: 'hero-actions' },
        linkButton(`#lekcia-${target.id}`, started ? `Pokračovať: ${target.title}` : `Začať: ${target.title}`, 'primary', 'arrow'),
        linkButton('#cvicenie', 'Precvičovať príklady', 'secondary'),
      ),
      h('p', { class: 'hero-hint' }, icon('bolt', 16), 'Pohni posuvníkmi alebo napíš vlastné hodnoty a sleduj, ako Ohmov zákon mení prúd, zahrievanie rezistora aj svit LED.'),
    ),
    heroCircuit(),
  );

  const course = h('section', { class: 'section', 'aria-labelledby': 'course-title' },
    h('div', { class: 'section-head' },
      h('h2', { id: 'course-title' }, 'Obsah kurzu'),
      h('a', { href: '#lekcie', class: 'text-link' }, 'Všetky lekcie'),
    ),
    h('div', { class: 'chapters' },
      CHAPTERS.map((ch) => {
        const lessons = LESSONS.filter((l) => l.chapter === ch.id);
        return h('div', { class: 'chapter' },
          h('h3', null, ch.title),
          h('ol', { class: 'chapter-lessons', start: lessonIndex(lessons[0].id) + 1 },
            lessons.map((l) => h('li', { class: p.lessonsDone.includes(l.id) ? 'is-done' : '' },
              h('a', { href: `#lekcia-${l.id}` }, l.title),
              p.lessonsDone.includes(l.id) ? h('span', { class: 'done-mark', 'aria-label': 'preštudované' }, icon('check', 16)) : null,
            )),
          ),
        );
      }),
    ),
  );

  const tools = h('section', { class: 'section', 'aria-labelledby': 'tools-title' },
    h('div', { class: 'section-head' },
      h('h2', { id: 'tools-title' }, 'Kalkulačky'),
      h('a', { href: '#kalkulacky', class: 'text-link' }, 'Otvoriť všetky'),
    ),
    h('ul', { class: 'tool-links' },
      CALCULATORS.map((c) => h('li', null, h('a', { href: `#kalk-${c.id}` }, h('strong', null, c.title), h('span', null, c.short)))),
    ),
  );

  return h('div', { class: 'view view-home' }, hero, statsSection(), course, tools, resetControl());
}
