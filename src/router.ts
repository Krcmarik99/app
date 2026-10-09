/**
 * Smerovanie cez kotvu v adrese (#lekcia-ohmov-zakon). Kotvy obsahujú len písmená,
 * číslice a pomlčky, takže fungujú aj na statickom hostingu bez servera.
 */
export type Route =
  | { name: 'home' }
  | { name: 'lessons' }
  | { name: 'lesson'; id: string }
  | { name: 'practice'; topic?: string }
  | { name: 'calcs' }
  | { name: 'calc'; id: string }
  | { name: 'cards'; deck?: string }
  | { name: 'account'; mode?: 'login' | 'register' }
  | { name: 'premium' };

export type Section = 'home' | 'lessons' | 'practice' | 'calcs' | 'cards' | 'account' | 'premium';

export function parseHash(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#/, ''));
  if (h === 'lekcie') return { name: 'lessons' };
  if (h.startsWith('lekcia-')) return { name: 'lesson', id: h.slice(7) };
  if (h === 'cvicenie') return { name: 'practice' };
  if (h.startsWith('cvicenie-')) return { name: 'practice', topic: h.slice(9) };
  if (h === 'kalkulacky') return { name: 'calcs' };
  if (h.startsWith('kalk-')) return { name: 'calc', id: h.slice(5) };
  if (h === 'karticky') return { name: 'cards' };
  if (h.startsWith('karticky-')) return { name: 'cards', deck: h.slice(9) };
  if (h === 'ucet') return { name: 'account' };
  if (h === 'prihlasenie') return { name: 'account', mode: 'login' };
  if (h === 'registracia') return { name: 'account', mode: 'register' };
  if (h === 'predplatne') return { name: 'premium' };
  return { name: 'home' };
}

export function routeHash(r: Route): string {
  switch (r.name) {
    case 'home': return '#domov';
    case 'lessons': return '#lekcie';
    case 'lesson': return `#lekcia-${r.id}`;
    case 'practice': return r.topic ? `#cvicenie-${r.topic}` : '#cvicenie';
    case 'calcs': return '#kalkulacky';
    case 'calc': return `#kalk-${r.id}`;
    case 'cards': return r.deck ? `#karticky-${r.deck}` : '#karticky';
    case 'account': return r.mode === 'login' ? '#prihlasenie' : r.mode === 'register' ? '#registracia' : '#ucet';
    case 'premium': return '#predplatne';
  }
}

export function sectionOf(r: Route): Section {
  switch (r.name) {
    case 'home': return 'home';
    case 'lessons':
    case 'lesson': return 'lessons';
    case 'practice': return 'practice';
    case 'calcs':
    case 'calc': return 'calcs';
    case 'cards': return 'cards';
    case 'account': return 'account';
    case 'premium': return 'premium';
  }
}

type Render = (route: Route) => void;

let renderFn: Render = () => {};
let currentHash = '';

function show(hash: string): void {
  currentHash = hash;
  renderFn(parseHash(hash));
}

/** Prejde na inú stránku a zapíše ju do histórie prehliadača (ak to prostredie dovolí). */
export function navigate(hash: string): void {
  if (hash === currentHash) {
    show(hash);
    return;
  }
  try {
    history.pushState(null, '', hash);
  } catch {
    // V niektorých vložených rámoch história nie je dostupná – stránku aj tak vykreslíme.
  }
  show(hash);
}

export function startRouter(render: Render): void {
  renderFn = render;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    e.preventDefault();
    navigate(href);
  });
  const fromLocation = () => {
    const hash = location.hash || '#domov';
    if (hash !== currentHash) show(hash);
  };
  window.addEventListener('popstate', fromLocation);
  window.addEventListener('hashchange', fromLocation);
  show(location.hash || '#domov');
}
