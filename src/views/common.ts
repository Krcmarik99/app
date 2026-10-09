import { h, type Child } from '../lib/dom';
import { MONTHLY_PRICE } from '../lib/premium';
import { icon, type IconName } from '../ui/icons';

export function linkButton(href: string, label: Child, variant: 'primary' | 'secondary' | 'quiet' = 'primary', iconName?: IconName): HTMLAnchorElement {
  return h('a', { href, class: `btn btn-${variant}` }, label, iconName ? icon(iconName, 18) : null);
}

export function backLink(href: string, label: string): HTMLAnchorElement {
  return h('a', { href, class: 'back-link' }, icon('back', 18), label);
}

export function pageHead(eyebrow: string | null, title: string, lead?: Child): HTMLElement {
  return h('header', { class: 'page-head' },
    eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
    h('h1', null, title),
    lead ? h('p', { class: 'lead' }, lead) : null,
  );
}

export function meter(value: number, max: number, label: string): HTMLElement {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': label },
    h('span', { class: 'meter-fill', style: { width: `${pct}%` } }),
  );
}

/** Štítok „Premium“ pri obsahu, ktorý je len pre predplatiteľov. */
export function lockBadge(): HTMLElement {
  return h('span', { class: 'chip chip-premium' }, icon('lock', 13), 'Premium');
}

/** Namiesto zamknutého obsahu: čo k nemu treba a odkaz na predplatné. */
export function premiumGate(subject: string): HTMLElement {
  return h('section', { class: 'premium-gate', 'aria-labelledby': 'gate-title' },
    h('span', { class: 'premium-gate-icon' }, icon('lock', 26)),
    h('h2', { id: 'gate-title' }, 'Odomkni s predplatným Premium'),
    h('p', null, `${subject} je súčasťou predplatného ElektroLab Premium za ${MONTHLY_PRICE} € mesačne. `
      + 'Odomkne kapitoly Striedavý prúd a Elektrotechnické merania aj s cvičeniami a kalkulačkami.'),
    h('div', { class: 'premium-gate-actions' },
      linkButton('#predplatne', 'Odomknúť Premium', 'primary', 'arrow'),
      linkButton('#predplatne', 'Mám zľavový kód', 'secondary'),
    ),
  );
}

/** Iniciály mena do avatara: „Ján Novák“ → „JN“. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((w) => Array.from(w)[0] ?? '').join('').toUpperCase() || '?';
}

export function avatar(name: string, cls = ''): HTMLElement {
  return h('span', { class: `avatar ${cls}`.trim(), 'aria-hidden': 'true' }, initials(name));
}

/** Slovenské skloňovanie podľa počtu: 1 deň, 2 dni, 5 dní. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
