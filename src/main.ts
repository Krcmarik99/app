import './styles.css';
import { lessonById } from './content/lessons';
import { h } from './lib/dom';
import { sectionOf, startRouter, type Route, type Section } from './router';
import { icon, logo, type IconName } from './ui/icons';
import { calculatorView, calculatorsView, CALCULATORS } from './views/calculators';
import { flashcardsView } from './views/flashcards';
import { homeView } from './views/home';
import { lessonView, lessonsView } from './views/lessons';
import { practiceView } from './views/practice';

const NAV: { section: Section; href: string; label: string; icon: IconName }[] = [
  { section: 'home', href: '#domov', label: 'Domov', icon: 'home' },
  { section: 'lessons', href: '#lekcie', label: 'Lekcie', icon: 'lessons' },
  { section: 'practice', href: '#cvicenie', label: 'Cvičenie', icon: 'practice' },
  { section: 'calcs', href: '#kalkulacky', label: 'Kalkulačky', icon: 'calc' },
  { section: 'cards', href: '#karticky', label: 'Kartičky', icon: 'cards' },
];

function view(route: Route): HTMLElement {
  switch (route.name) {
    case 'home': return homeView();
    case 'lessons': return lessonsView();
    case 'lesson': return lessonView(route.id);
    case 'practice': return practiceView(route.topic);
    case 'calcs': return calculatorsView();
    case 'calc': return calculatorView(route.id);
    case 'cards': return flashcardsView(route.deck);
  }
}

function pageTitle(route: Route): string {
  const base = 'ElektroLab';
  switch (route.name) {
    case 'home': return base;
    case 'lessons': return `Lekcie · ${base}`;
    case 'lesson': return `${lessonById(route.id)?.title ?? 'Lekcia'} · ${base}`;
    case 'practice': return `Cvičenie · ${base}`;
    case 'calcs': return `Kalkulačky · ${base}`;
    case 'calc': return `${CALCULATORS.find((c) => c.id === route.id)?.title ?? 'Kalkulačka'} · ${base}`;
    case 'cards': return `Kartičky · ${base}`;
  }
}

function navLinks(cls: string): { el: HTMLElement; links: Map<Section, HTMLAnchorElement> } {
  const links = new Map<Section, HTMLAnchorElement>();
  const el = h('ul', { class: cls }, NAV.map((item) => {
    const a = h('a', { href: item.href, class: 'nav-link' }, icon(item.icon, 22), h('span', null, item.label));
    links.set(item.section, a);
    return h('li', null, a);
  }));
  return { el, links };
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;
  const top = navLinks('top-nav-list');
  const bottom = navLinks('tab-bar-list');
  const main = h('main', { id: 'main', class: 'main', tabindex: '-1' });

  app.replaceChildren(
    h('a', { href: '#main', class: 'skip-link', onClick: (e: Event) => { e.preventDefault(); main.focus(); } }, 'Preskočiť na obsah'),
    h('header', { class: 'site-header' },
      h('div', { class: 'wrap header-inner' },
        h('a', { href: '#domov', class: 'brand', 'aria-label': 'ElektroLab – domov' }, logo(17), h('span', { class: 'brand-name' }, 'Elektro', h('b', null, 'Lab'))),
        h('nav', { class: 'top-nav', 'aria-label': 'Hlavná navigácia' }, top.el),
      ),
    ),
    main,
    h('footer', { class: 'site-footer wrap' },
      h('p', null, 'ElektroLab · učebná pomôcka zo základov elektrotechniky. Značky podľa STN EN 60617, veličiny a jednotky podľa sústavy SI.'),
    ),
    h('nav', { class: 'tab-bar', 'aria-label': 'Navigácia' }, bottom.el),
  );

  let first = true;
  startRouter((route) => {
    const section = sectionOf(route);
    for (const nav of [top, bottom]) {
      nav.links.forEach((a, key) => {
        if (key === section) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    }
    main.replaceChildren(h('div', { class: 'wrap' }, view(route)));
    document.title = pageTitle(route);
    if (!first) {
      window.scrollTo({ top: 0 });
      main.focus({ preventScroll: true });
    }
    first = false;
  });
}

boot();
