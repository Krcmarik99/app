/**
 * Stránka predplatného ElektroLab Premium: čo odomkne, cena, zľavový kód a aktivácia.
 */
import { CHAPTERS, LESSONS } from '../content/lessons';
import { currentAccount, type Account, type Subscription } from '../lib/auth';
import { frag, h } from '../lib/dom';
import {
  MONTHLY_PRICE, PREMIUM_CHAPTERS, activatePremium, cancelPremium, monthlyTotal, promoDiscount,
} from '../lib/premium';
import { fmtFixed } from '../lib/units';
import { navigate } from '../router';
import { icon } from '../ui/icons';
import { setAuthReturn } from './account';
import { CALCULATORS } from './calculators';
import { linkButton, pageHead, plural } from './common';

const eur = (x: number) => `${fmtFixed(x, 2)} €`;
const dateFormat = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

const premiumLessons = () => LESSONS.filter((l) => PREMIUM_CHAPTERS.has(l.chapter));
const premiumChapters = () => CHAPTERS.filter((c) => PREMIUM_CHAPTERS.has(c.id));

function priceRow(label: string, value: string, cls = ''): HTMLElement {
  return h('div', { class: `price-row ${cls}`.trim() }, h('dt', null, label), h('dd', null, value));
}

function planCard(): HTMLElement {
  const lessons = premiumLessons();
  const calcs = CALCULATORS.filter((c) => PREMIUM_CHAPTERS.has(c.chapter));
  const free = LESSONS.length - lessons.length;
  const feature = (text: string) => h('li', null, icon('check', 18), h('span', null, text));
  return h('section', { class: 'plan-card', 'aria-labelledby': 'plan-title' },
    h('p', { class: 'eyebrow', id: 'plan-title' }, 'Mesačné predplatné'),
    h('p', { class: 'plan-price' }, h('strong', null, `${MONTHLY_PRICE} €`), h('span', null, ' / mesiac')),
    h('ul', { class: 'plan-features' },
      feature(`${lessons.length} ${plural(lessons.length, 'lekcia', 'lekcie', 'lekcií')} navyše: ${premiumChapters().map((c) => c.title).join(' a ')}`),
      feature('Cvičenia z týchto tém s novými hodnotami pri každom pokuse'),
      feature(`${plural(calcs.length, 'Kalkulačka', 'Kalkulačky', 'Kalkulačky')}: ${calcs.map((c) => c.title).join(', ')}`),
      feature('Predplatné môžeš kedykoľvek zrušiť'),
    ),
    h('p', { class: 'plan-free' }, `Zadarmo ostáva ${free} ${plural(free, 'lekcia', 'lekcie', 'lekcií')}, ostatné kalkulačky, kartičky aj interaktívny obvod.`),
  );
}

function checkoutCard(account: Account | null): HTMLElement {
  let discount = 0;
  let code = '';

  const codeInput = h('input', {
    id: 'promo-code', class: 'field-input', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    'aria-describedby': 'promo-status',
  });
  const applyBtn = h('button', { type: 'submit', class: 'btn btn-secondary' }, 'Použiť');
  const codeStatus = h('p', { class: 'promo-status', id: 'promo-status', 'aria-live': 'polite' });
  const summary = h('dl', { class: 'price-summary' });
  const action = h('div', { class: 'checkout-action' });

  const render = () => {
    const total = monthlyTotal(discount);
    summary.replaceChildren(frag(
      priceRow('ElektroLab Premium, 1 mesiac', eur(MONTHLY_PRICE)),
      discount ? priceRow(`Zľava ${discount} % (kód)`, `−${eur(MONTHLY_PRICE - total)}`, 'is-discount') : null,
      priceRow('Spolu mesačne', eur(total), 'is-total'),
    ));
    if (!account) {
      action.replaceChildren(
        h('p', { class: 'muted' }, 'Predplatné patrí k účtu. Na aktiváciu sa najprv prihlás alebo si vytvor účet.'),
        h('div', { class: 'checkout-buttons' },
          h('a', { href: '#prihlasenie', class: 'btn btn-primary', onClick: () => setAuthReturn('#predplatne') }, 'Prihlásiť sa'),
          h('a', { href: '#registracia', class: 'btn btn-secondary', onClick: () => setAuthReturn('#predplatne') }, 'Vytvoriť účet'),
        ),
      );
    } else if (total === 0) {
      const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
      const activate = h('button', { type: 'button', class: 'btn btn-primary btn-lg' }, 'Aktivovať Premium za 0 €');
      activate.addEventListener('click', async () => {
        activate.disabled = true;
        const result = await activatePremium(code);
        if (result.ok) {
          navigate('#predplatne');
          return;
        }
        activate.disabled = false;
        error.textContent = result.error;
        error.hidden = false;
      });
      action.replaceChildren(error, activate);
    } else {
      action.replaceChildren(
        h('button', { type: 'button', class: 'btn btn-primary btn-lg', disabled: true }, `Zaplatiť ${eur(total)} kartou`),
        h('p', { class: 'muted' }, 'Platba kartou zatiaľ nie je dostupná. Predplatné si zatiaľ aktivuješ zľavovým kódom.'),
      );
    }
  };

  const codeForm = h('form', { class: 'promo-form', novalidate: true },
    h('label', { for: 'promo-code' }, 'Zľavový kód'),
    h('div', { class: 'promo-row' }, h('div', { class: 'field-box' }, codeInput), applyBtn),
    codeStatus,
  );
  codeInput.addEventListener('input', () => codeInput.classList.remove('is-invalid'));
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!codeInput.value.trim()) {
      codeStatus.textContent = 'Napíš zľavový kód.';
      codeStatus.className = 'promo-status is-error';
      return;
    }
    applyBtn.disabled = true;
    const found = await promoDiscount(codeInput.value);
    applyBtn.disabled = false;
    codeInput.classList.toggle('is-invalid', found === null);
    if (found === null) {
      codeStatus.textContent = 'Tento zľavový kód neplatí.';
      codeStatus.className = 'promo-status is-error';
      discount = 0;
      code = '';
    } else {
      codeStatus.textContent = `Kód je platný – zľava ${found} %.`;
      codeStatus.className = 'promo-status is-ok';
      discount = found;
      code = codeInput.value;
    }
    render();
  });
  render();

  return h('section', { class: 'checkout-card', 'aria-labelledby': 'checkout-title' },
    h('h2', { id: 'checkout-title' }, 'Objednávka'),
    codeForm,
    summary,
    action,
  );
}

function activeCard(subscription: Subscription): HTMLElement {
  const since = new Date(subscription.since);
  const total = monthlyTotal(subscription.discount);
  const cancel = h('details', { class: 'danger-zone' },
    h('summary', null, 'Zrušiť predplatné'),
    h('div', { class: 'auth-form' },
      h('p', null, 'Po zrušení sa kapitoly Premium znova zamknú. Tvoj pokrok v nich ostane uložený.'),
      h('button', { type: 'button', class: 'btn btn-danger', onClick: () => { cancelPremium(); navigate('#predplatne'); } }, 'Zrušiť predplatné'),
    ),
  );
  const firstOf = (chapter: string) => LESSONS.find((l) => l.chapter === chapter);
  return h('div', { class: 'premium-active' },
    h('section', { class: 'plan-card is-active', 'aria-labelledby': 'active-title' },
      h('p', { class: 'chip chip-good' }, icon('check', 14), 'Aktívne'),
      h('h2', { id: 'active-title' }, 'Premium máš aktívne'),
      Number.isNaN(since.getTime()) ? null : h('p', { class: 'muted' }, `Od ${dateFormat.format(since)}.`),
      h('dl', { class: 'price-summary' },
        priceRow('Cena', `${eur(subscription.price)} / mesiac`),
        subscription.discount ? priceRow(`Zľava ${subscription.discount} % (kód)`, `−${eur(subscription.price - total)}`, 'is-discount') : null,
        priceRow('Platíš', `${eur(total)} / mesiac`, 'is-total'),
      ),
      h('div', { class: 'checkout-buttons' },
        premiumChapters().map((c, i) => {
          const first = firstOf(c.id);
          return first ? linkButton(`#lekcia-${first.id}`, c.title, i === 0 ? 'primary' : 'secondary', i === 0 ? 'arrow' : undefined) : null;
        }),
      ),
    ),
    cancel,
  );
}

export function premiumView(): HTMLElement {
  const account = currentAccount();
  const subscription = account?.subscription;
  return h('div', { class: 'view view-premium' },
    pageHead('Predplatné', 'ElektroLab Premium',
      subscription
        ? 'Ďakujeme! Kapitoly Striedavý prúd a Elektrotechnické merania máš odomknuté.'
        : `Odomkni kapitoly ${premiumChapters().map((c) => c.title).join(' a ')} – lekcie s testami, cvičenia a kalkulačky.`),
    subscription
      ? activeCard(subscription)
      : h('div', { class: 'premium-layout' }, planCard(), checkoutCard(account)),
  );
}
