import { s } from '../lib/dom';

const PATHS = {
  home: 'M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z',
  lessons: 'M4 5.5h5.5A2.5 2.5 0 0 1 12 8v12a2 2 0 0 0-2-2H4zM20 5.5h-5.5A2.5 2.5 0 0 0 12 8v12a2 2 0 0 1 2-2h6z',
  practice: 'M20 12a8 8 0 1 1-4.7-7.3M8.5 11.5l3 3L20 6',
  calc: 'M6.5 3.5h11v17h-11zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01',
  cards: 'M8 3.5h11v13H8zM5 7v13.5h11',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  shuffle: 'M4 7h3.5c4 0 5 10 9 10H20M17 14l3 3-3 3M4 17h3.5c1.4 0 2.5-1.2 3.3-2.8M13.2 9.8C14 8.2 15 7 16.5 7H20M17 4l3 3-3 3',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  logout: 'M14 4.5h5v15h-5M10 8l-4 4 4 4M6 12h10',
  lock: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3M5.5 11h13v9.5h-13zM12 15v2',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 22): SVGSVGElement {
  return s(
    'svg',
    { viewBox: '0 0 24 24', width: size, height: size, class: 'icon', 'aria-hidden': 'true', focusable: 'false' },
    s('path', { d: PATHS[name] }),
  );
}

/** Logo: rezistor podľa EN 60617 so zlatým prúžkom – značka aplikácie. */
export function logo(size = 34): SVGSVGElement {
  return s(
    'svg',
    { viewBox: '0 0 48 24', width: size * 2, height: size, class: 'logo', 'aria-hidden': 'true' },
    s('line', { x1: 2, y1: 12, x2: 12, y2: 12, class: 'logo-lead' }),
    s('line', { x1: 36, y1: 12, x2: 46, y2: 12, class: 'logo-lead' }),
    s('rect', { x: 12, y: 6, width: 24, height: 12, rx: 1.5, class: 'logo-body' }),
    s('rect', { x: 16, y: 6, width: 3, height: 12, class: 'logo-band' }),
    s('rect', { x: 21.5, y: 6, width: 3, height: 12, class: 'logo-band' }),
    s('rect', { x: 30, y: 6, width: 3, height: 12, class: 'logo-band logo-gold' }),
  );
}
