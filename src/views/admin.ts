/**
 * Správa aplikácie: zoznam online účtov s ich pokrokom a posledná aktivita (registrácie,
 * prihlásenia, otvorenia aplikácie, dokončené lekcie a cvičenia). Údaje databáza vráti len
 * správcovi – pravidlá sú v supabase/schema.sql, správca sa nastaví súborom supabase/spravca.sql.
 */
import { lessonById, LESSONS } from '../content/lessons';
import { currentAccount } from '../lib/auth';
import { CloudError, cloudIsAdmin, fetchActivity, fetchAdminUsers, type ActivityKind, type ActivityRow, type AdminUser } from '../lib/cloud';
import { h } from '../lib/dom';
import { normalize, totals, type Progress } from '../lib/progress';
import { avatar, backLink, meter, pageHead, plural } from './common';

const DAY = 86_400_000;
const timeFormat = new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric' });
const dateYearFormat = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Čas udalosti: „dnes 14:05“, „včera 9:30“, „7. 10. 18:12“. */
export function when(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  const t = timeFormat.format(d);
  if (days === 0) return `dnes ${t}`;
  if (days === 1) return `včera ${t}`;
  return `${(d.getFullYear() === now.getFullYear() ? dateFormat : dateYearFormat).format(d)} ${t}`;
}

const lessonTitle = (id: unknown) => lessonById(String(id))?.title ?? String(id);

/** Slovný opis udalosti pre správcu. */
export function describeActivity(a: Pick<ActivityRow, 'kind' | 'detail'>): string {
  const d = a.detail ?? {};
  switch (a.kind) {
    case 'register': return d.fromBrowser ? 'Registrácia (prenesený účet z prehliadača)' : 'Registrácia';
    case 'login': return 'Prihlásenie';
    case 'visit': return 'Otvorenie aplikácie';
    case 'lesson': return `Dokončená lekcia: ${lessonTitle(d.lesson)}`;
    case 'quiz': {
      const topics = Array.isArray(d.topics) ? d.topics.map(lessonTitle) : [];
      const list = topics.length ? ` · ${topics.slice(0, 3).join(', ')}${topics.length > 3 ? ` a ďalšie (${topics.length - 3})` : ''}` : '';
      return `Cvičenie: ${Number(d.correct) || 0} z ${Number(d.total) || 0} správne${list}`;
    }
    default: return String(a.kind);
  }
}

interface UserSummary {
  user: AdminUser;
  progress: Progress;
  lessons: number;
  answered: number;
  accuracy: number | null;
  days: number;
  /** Posledná známa aktivita (ms) – prihlásenie alebo udalosť v aplikácii. */
  lastActive: number;
}

function summarize(user: AdminUser): UserSummary {
  const progress = normalize(user.progress);
  const t = totals(progress);
  const times = [user.last_seen, user.last_sign_in_at].map((x) => (x ? new Date(x).getTime() : 0)).filter((x) => Number.isFinite(x));
  return {
    user,
    progress,
    lessons: progress.lessonsDone.filter((id) => lessonById(id)).length,
    answered: t.answered,
    accuracy: t.answered ? Math.round((t.correct / t.answered) * 100) : null,
    days: progress.activeDays.length,
    lastActive: Math.max(0, ...times),
  };
}

/** Bez diakritiky a veľkých písmen – na vyhľadávanie mien. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const stat = (label: string, value: string, detail: string) =>
  h('div', { class: 'stat' }, h('p', { class: 'stat-label' }, label), h('p', { class: 'stat-value' }, value), h('p', { class: 'stat-detail' }, detail));

const notice = (title: string, ...text: (string | HTMLElement)[]) =>
  h('aside', { class: 'note note-remember admin-notice' }, h('p', { class: 'note-label' }, title), h('p', null, ...text));

const FILTERS: [string, string, ActivityKind[]][] = [
  ['all', 'Všetko', ['register', 'login', 'visit', 'lesson', 'quiz']],
  ['login', 'Prihlásenia', ['register', 'login', 'visit']],
  ['lesson', 'Lekcie', ['lesson']],
  ['quiz', 'Cvičenia', ['quiz']],
];

function dashboard(users: AdminUser[], activity: ActivityRow[], reload: () => void): HTMLElement {
  const now = new Date();
  const summaries = users.map(summarize).sort((a, b) => b.lastActive - a.lastActive);
  const byId = new Map(summaries.map((s) => [s.user.id, s]));
  const today = startOfDay(now);
  const weekAgo = now.getTime() - 7 * DAY;
  const recent = activity.filter((a) => new Date(a.at).getTime() >= weekAgo);
  const count = (kinds: ActivityKind[]) => recent.filter((a) => kinds.includes(a.kind)).length;
  const activeToday = summaries.filter((s) => s.lastActive >= today).length;
  const activeWeek = summaries.filter((s) => s.lastActive >= weekAgo).length;
  const newWeek = users.filter((u) => new Date(u.created_at).getTime() >= weekAgo).length;
  const logins = count(['login', 'register']);

  const stats = h('div', { class: 'stats admin-stats' },
    stat('Účty', String(users.length), newWeek ? `${newWeek} ${plural(newWeek, 'nový', 'nové', 'nových')} za 7 dní` : 'za 7 dní žiadny nový'),
    stat('Aktívne dnes', String(activeToday), `${plural(activeToday, 'účet', 'účty', 'účtov')} s aktivitou dnes`),
    stat('Aktívne za 7 dní', String(activeWeek), `z ${users.length} ${plural(users.length, 'účtu', 'účtov', 'účtov')}`),
    stat('Prihlásenia za 7 dní', String(logins), `${count(['lesson'])} ${plural(count(['lesson']), 'lekcia', 'lekcie', 'lekcií')} · ${count(['quiz'])} ${plural(count(['quiz']), 'cvičenie', 'cvičenia', 'cvičení')}`),
  );

  // ------------------------------------------------------------------ detail používateľa
  const detail = h('section', { class: 'admin-detail', 'aria-live': 'polite', hidden: true });

  function showDetail(id: string): void {
    const s = byId.get(id);
    if (!s) return;
    const u = s.user;
    const events = activity.filter((a) => a.user_id === id).slice(0, 40);
    const topics = LESSONS.filter((l) => s.progress.stats[l.id]?.answered)
      .map((l) => ({ l, st: s.progress.stats[l.id] }))
      .sort((a, b) => b.st.answered - a.st.answered)
      .slice(0, 12);
    const close = h('button', { type: 'button', class: 'btn btn-sm btn-quiet' }, 'Zavrieť');
    close.addEventListener('click', () => {
      detail.hidden = true;
      detail.replaceChildren();
    });
    detail.replaceChildren(
      h('div', { class: 'admin-detail-head' },
        avatar(u.name || u.username, 'avatar-lg'),
        h('div', null,
          h('h3', null, u.name || u.username),
          h('p', { class: 'muted' }, `@${u.username} · registrácia ${when(u.created_at, now)} · posledné prihlásenie ${when(u.last_sign_in_at, now)}`),
        ),
        close,
      ),
      h('div', { class: 'stats admin-stats' },
        stat('Lekcie', `${s.lessons} / ${LESSONS.length}`, 'preštudovaných lekcií'),
        stat('Úspešnosť', s.accuracy === null ? '—' : `${s.accuracy} %`, `${s.answered} ${plural(s.answered, 'odpoveď', 'odpovede', 'odpovedí')} v cvičeniach`),
        stat('Dni učenia', String(s.days), s.progress.activeDays.length ? `naposledy ${s.progress.activeDays[s.progress.activeDays.length - 1].split('-').reverse().join('. ')}` : 'zatiaľ žiadny'),
        stat('Prihlásenia', String(u.login_count), `${s.progress.sessions.length} ${plural(s.progress.sessions.length, 'cvičenie', 'cvičenia', 'cvičení')} v histórii`),
      ),
      h('div', { class: 'admin-detail-cols' },
        h('div', null,
          h('h4', null, 'Preštudované lekcie'),
          s.lessons
            ? h('ul', { class: 'admin-chips' }, s.progress.lessonsDone.filter((x) => lessonById(x)).map((x) => h('li', null, lessonTitle(x))))
            : h('p', { class: 'muted' }, 'Zatiaľ žiadna.'),
          h('h4', null, 'Úspešnosť podľa tém'),
          topics.length
            ? h('ul', { class: 'admin-topics' }, topics.map(({ l, st }) => h('li', null,
              h('span', { class: 'admin-topic-name' }, l.title),
              meter(st.correct, st.answered, `Úspešnosť v téme ${l.title}`),
              h('span', { class: 'admin-topic-pct' }, `${Math.round((st.correct / st.answered) * 100)} % (${st.correct}/${st.answered})`),
            )))
            : h('p', { class: 'muted' }, 'Zatiaľ bez odpovedí v cvičeniach.'),
        ),
        h('div', null,
          h('h4', null, 'Posledná aktivita'),
          events.length
            ? h('ol', { class: 'admin-events' }, events.map((a) => h('li', null,
              h('span', { class: 'admin-event-time' }, when(a.at, now)),
              h('span', { class: 'admin-event-text' }, describeActivity(a)),
            )))
            : h('p', { class: 'muted' }, 'Žiadne zaznamenané udalosti.'),
        ),
      ),
    );
    detail.hidden = false;
    detail.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  const userButton = (id: string, label: string) => {
    const b = h('button', { type: 'button', class: 'admin-user-link' }, label);
    b.addEventListener('click', () => showDetail(id));
    return b;
  };

  // ------------------------------------------------------------------ tabuľka účtov
  const search = h('input', {
    type: 'search', class: 'field-input', id: 'admin-search', placeholder: 'Hľadať meno…', autocomplete: 'off', 'aria-label': 'Hľadať používateľa podľa mena',
  });
  const tbody = h('tbody');
  const shown = h('p', { class: 'muted admin-count' });
  const renderRows = () => {
    const qy = fold(search.value.trim());
    const rows = summaries.filter((s) => !qy || fold(`${s.user.name} ${s.user.username}`).includes(qy));
    shown.textContent = `${rows.length} z ${summaries.length} ${plural(summaries.length, 'účtu', 'účtov', 'účtov')}`;
    tbody.replaceChildren(...(rows.length
      ? rows.map((s) => h('tr', { class: s.lastActive >= today ? 'is-today' : null },
        h('td', null,
          h('div', { class: 'admin-user' },
            avatar(s.user.name || s.user.username),
            h('div', null, userButton(s.user.id, s.user.name || s.user.username), h('span', { class: 'admin-username' }, `@${s.user.username}`)),
          )),
        h('td', { class: 'num' }, when(s.user.created_at, now)),
        h('td', { class: 'num' }, when(s.user.last_sign_in_at, now)),
        h('td', { class: 'num' }, s.lastActive ? when(new Date(s.lastActive).toISOString(), now) : '—'),
        h('td', { class: 'num' }, String(s.user.login_count)),
        h('td', { class: 'num' }, `${s.lessons} / ${LESSONS.length}`),
        h('td', { class: 'num' }, s.accuracy === null ? '—' : `${s.accuracy} %`),
        h('td', { class: 'num' }, String(s.days)),
      ))
      : [h('tr', null, h('td', { colspan: 8, class: 'muted' }, summaries.length ? 'Nikto nezodpovedá hľadaniu.' : 'Zatiaľ žiadne účty.'))]));
  };
  search.addEventListener('input', renderRows);
  renderRows();

  const table = h('div', { class: 'table-wrap' },
    h('table', { class: 'data-table admin-table' },
      h('thead', null, h('tr', null, ['Používateľ', 'Registrácia', 'Posledné prihlásenie', 'Posledná aktivita', 'Prihlásenia', 'Lekcie', 'Úspešnosť', 'Dni učenia']
        .map((c) => h('th', { scope: 'col' }, c)))),
      tbody,
    ),
  );

  // ------------------------------------------------------------------ aktivita
  let filter = 'all';
  const feed = h('ol', { class: 'admin-events admin-feed' });
  const renderFeed = () => {
    const kinds = FILTERS.find(([id]) => id === filter)![2];
    const rows = activity.filter((a) => kinds.includes(a.kind)).slice(0, 150);
    feed.replaceChildren(...(rows.length
      ? rows.map((a) => {
        const s = byId.get(a.user_id);
        return h('li', null,
          h('span', { class: 'admin-event-time' }, when(a.at, now)),
          s ? userButton(a.user_id, s.user.name || s.user.username) : h('span', { class: 'muted' }, 'zmazaný účet'),
          h('span', { class: 'admin-event-text' }, describeActivity(a)),
        );
      })
      : [h('li', { class: 'muted' }, 'Žiadne udalosti.')]));
  };
  const filterSel = h('select', { class: 'field-input', id: 'admin-filter', 'aria-label': 'Druh udalostí' },
    FILTERS.map(([id, label]) => h('option', { value: id }, label)));
  filterSel.addEventListener('change', () => {
    filter = filterSel.value;
    renderFeed();
  });
  renderFeed();

  const refresh = h('button', { type: 'button', class: 'btn btn-sm btn-secondary' }, 'Obnoviť');
  refresh.addEventListener('click', reload);

  const view = h('div', { class: 'admin-dashboard' },
    h('div', { class: 'admin-toolbar' }, h('p', { class: 'muted' }, `Načítané ${when(now.toISOString(), now)}`), refresh),
    stats,
    detail,
    h('section', { class: 'section', 'aria-labelledby': 'admin-users-title' },
      h('div', { class: 'section-head admin-section-head' },
        h('h2', { id: 'admin-users-title' }, 'Používatelia'),
        h('div', { class: 'admin-search' }, h('div', { class: 'field-box' }, search), shown),
      ),
      table,
    ),
    h('section', { class: 'section', 'aria-labelledby': 'admin-activity-title' },
      h('div', { class: 'section-head admin-section-head' },
        h('h2', { id: 'admin-activity-title' }, 'Posledná aktivita'),
        h('div', { class: 'field-box admin-filter' }, filterSel),
      ),
      feed,
    ),
  );
  return view;
}

const SETUP_HELP = 'V Supabase spusti v SQL Editore aktuálny súbor supabase/schema.sql a potom supabase/spravca.sql so svojím používateľským menom.';

export function adminView(): HTMLElement {
  const account = currentAccount();
  const body = h('div', { class: 'admin-body' });
  const root = h('div', { class: 'view view-admin' },
    backLink('#ucet', 'Môj účet'),
    pageHead('Správa', 'Používatelia a aktivita', 'Kto sa prihlásil, posledná aktivita a pokrok všetkých online účtov.'),
    body,
  );
  if (!account?.cloud) {
    body.append(notice('Len pre správcu', 'Správa je dostupná po prihlásení online účtom správcu aplikácie.'));
    return root;
  }

  const load = async () => {
    body.replaceChildren(h('p', { class: 'muted', role: 'status' }, 'Načítavam údaje zo servera…'));
    try {
      if (!(await cloudIsAdmin())) {
        body.replaceChildren(notice('Len pre správcu', 'Tento účet nie je správcom aplikácie. ', SETUP_HELP));
        return;
      }
      const [users, activity] = await Promise.all([fetchAdminUsers(), fetchActivity({ limit: 1000 })]);
      body.replaceChildren(dashboard(users, activity, () => void load()));
    } catch (e) {
      const missing = e instanceof CloudError && e.status === 404;
      body.replaceChildren(missing
        ? notice('Databáza nemá správu', 'Chýbajú tabuľky alebo funkcie pre správu. ', SETUP_HELP)
        : notice('Údaje sa nepodarilo načítať', e instanceof Error ? e.message : 'Neznáma chyba.'));
    }
  };
  void load();
  return root;
}
