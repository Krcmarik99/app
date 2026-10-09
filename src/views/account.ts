/**
 * Prihlásenie, registrácia a stránka účtu. Účty aj pokrok sa ukladajú v tomto prehliadači.
 */
import {
  NAME_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN,
  currentAccount, deleteAccount, login, logout, register,
  type Account, type AuthField, type AuthResult,
} from '../lib/auth';
import { h, type Attrs, type Child } from '../lib/dom';
import { MONTHLY_PRICE, monthlyTotal } from '../lib/premium';
import { hasGuestProgress } from '../lib/progress';
import { fmtFixed } from '../lib/units';
import { navigate } from '../router';
import { icon } from '../ui/icons';
import { avatar, linkButton, pageHead } from './common';
import { statsSection } from './home';

/** Kam sa vrátiť po prihlásení alebo registrácii (napr. späť na predplatné). */
let returnTo: string | null = null;

export function setAuthReturn(hash: string | null): void {
  returnTo = hash;
}

interface FormField {
  el: HTMLElement;
  input: HTMLInputElement;
  setError(text: string | null): void;
}

function formField(id: string, label: Child, attrs: Attrs, hint?: string): FormField {
  const input = h('input', { id, class: 'field-input', ...attrs });
  const error = h('p', { class: 'field-error', id: `${id}-error`, hidden: true });
  input.setAttribute('aria-describedby', hint ? `${id}-hint ${id}-error` : `${id}-error`);
  const box = h('div', { class: 'field-box' }, input);
  if (attrs.type === 'password') {
    const reveal = h('button', { type: 'button', class: 'field-reveal', 'aria-pressed': 'false', 'aria-label': 'Zobraziť heslo' }, 'Zobraziť');
    reveal.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.textContent = show ? 'Skryť' : 'Zobraziť';
      reveal.setAttribute('aria-pressed', String(show));
    });
    box.append(reveal);
  }
  const setError = (text: string | null) => {
    error.textContent = text ?? '';
    error.hidden = !text;
    input.classList.toggle('is-invalid', !!text);
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  input.addEventListener('input', () => setError(null));
  return {
    el: h('div', { class: 'field' },
      h('label', { for: id }, label),
      box,
      hint ? h('p', { class: 'field-hint', id: `${id}-hint` }, hint) : null,
      error,
    ),
    input,
    setError,
  };
}

function checkbox(id: string, label: string, checked: boolean): { el: HTMLElement; input: HTMLInputElement } {
  const input = h('input', { id, type: 'checkbox', checked });
  return { el: h('label', { class: 'check', for: id }, input, label), input };
}

/**
 * Odoslanie formulára: zablokuje tlačidlo počas overovania hesla, chybu ukáže pri políčku,
 * ktorého sa týka (inak nad tlačidlom), a po úspechu prejde na domovskú stránku.
 */
function handleSubmit(
  form: HTMLFormElement, button: HTMLButtonElement, busyText: string,
  fields: Partial<Record<AuthField, FormField>>, run: () => Promise<AuthResult>,
): HTMLElement {
  const formError = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const idleText = button.textContent;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    formError.hidden = true;
    Object.values(fields).forEach((f) => f?.setError(null));
    button.disabled = true;
    button.textContent = busyText;
    const result = await run();
    button.disabled = false;
    button.textContent = idleText;
    if (result.ok) {
      const target = returnTo ?? '#domov';
      returnTo = null;
      navigate(target);
      return;
    }
    const target = result.field ? fields[result.field] : undefined;
    if (target) {
      target.setError(result.error);
      target.input.focus();
    } else {
      formError.textContent = result.error;
      formError.hidden = false;
    }
  });
  return formError;
}

function loginForm(): HTMLElement {
  const username = formField('login-username', 'Používateľské meno', {
    type: 'text', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false',
  });
  const password = formField('login-password', 'Heslo', { type: 'password', name: 'password', autocomplete: 'current-password' });
  const remember = checkbox('login-remember', 'Pamätať si prihlásenie na tomto zariadení', true);
  const button = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Prihlásiť sa');
  const form = h('form', { class: 'auth-form', novalidate: true });
  const formError = handleSubmit(form, button, 'Overujem…', { username, password },
    () => login(username.input.value, password.input.value, remember.input.checked));
  form.append(username.el, password.el, remember.el, formError, button,
    h('p', { class: 'auth-switch' }, 'Ešte nemáš účet? ', h('a', { href: '#registracia' }, 'Zaregistruj sa')),
  );
  return form;
}

function registerForm(): HTMLElement {
  const name = formField('reg-name', 'Meno', { type: 'text', name: 'name', autocomplete: 'nickname', maxlength: NAME_MAX },
    'Takto ťa bude aplikácia oslovovať.');
  const username = formField('reg-username', 'Používateľské meno', {
    type: 'text', name: 'username', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: USERNAME_MAX,
  }, `${USERNAME_MIN} až ${USERNAME_MAX} znakov: písmená bez diakritiky, číslice, bodka, pomlčka alebo podčiarkovník.`);
  const password = formField('reg-password', 'Heslo', { type: 'password', name: 'new-password', autocomplete: 'new-password' },
    `Aspoň ${PASSWORD_MIN} znakov. Zapamätaj si ho – zabudnuté heslo sa nedá obnoviť.`);
  const password2 = formField('reg-password2', 'Heslo znova', { type: 'password', name: 'new-password-again', autocomplete: 'new-password' });
  const keep = hasGuestProgress() ? checkbox('reg-keep', 'Preniesť doterajší pokrok z tohto prehliadača do nového účtu', true) : null;
  const remember = checkbox('reg-remember', 'Pamätať si prihlásenie na tomto zariadení', true);
  const button = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Vytvoriť účet');
  const form = h('form', { class: 'auth-form', novalidate: true });
  const formError = handleSubmit(form, button, 'Vytváram účet…', { name, username, password, password2 }, () => register({
    name: name.input.value,
    username: username.input.value,
    password: password.input.value,
    password2: password2.input.value,
    keepProgress: keep?.input.checked ?? false,
    remember: remember.input.checked,
  }));
  form.append(name.el, username.el, password.el, password2.el, ...(keep ? [keep.el] : []), remember.el, formError, button,
    h('p', { class: 'auth-switch' }, 'Už máš účet? ', h('a', { href: '#prihlasenie' }, 'Prihlás sa')),
  );
  return form;
}

function authPage(mode: 'login' | 'register'): HTMLElement {
  const tab = (href: string, label: string, active: boolean) =>
    h('a', { href, 'aria-current': active ? 'page' : false }, label);
  return h('div', { class: 'view view-account' },
    pageHead('Účet', mode === 'login' ? 'Prihlásenie' : 'Registrácia',
      mode === 'login'
        ? 'Prihlás sa a pokračuj so svojím pokrokom v lekciách, cvičeniach aj kartičkách.'
        : 'S vlastným účtom sa tvoj pokrok nepomieša s pokrokom ostatných, ktorí sa učia v tomto prehliadači.'),
    h('div', { class: 'auth-layout' },
      h('section', { class: 'auth-card', 'aria-label': mode === 'login' ? 'Prihlásenie' : 'Registrácia' },
        h('nav', { class: 'auth-tabs', 'aria-label': 'Prihlásenie alebo registrácia' },
          tab('#prihlasenie', 'Prihlásenie', mode === 'login'),
          tab('#registracia', 'Registrácia', mode === 'register'),
        ),
        mode === 'login' ? loginForm() : registerForm(),
      ),
      h('aside', { class: 'note' },
        h('p', { class: 'note-label' }, 'Kde sa účet ukladá'),
        h('p', null, 'Účty aj pokrok sa ukladajú len v tomto prehliadači. Hodí sa to, keď sa na jednom počítači učí viac ľudí – každý má po prihlásení svoj vlastný pokrok.'),
        h('p', null, 'Na inom zariadení alebo v inom prehliadači si účet vytvor znova. Heslo sa neukladá v čitateľnej podobe, len jeho zašifrovaný odtlačok.'),
      ),
    ),
  );
}

const dateFormat = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });

function deleteControl(): HTMLElement {
  const password = formField('delete-password', 'Na potvrdenie zadaj heslo', { type: 'password', name: 'password', autocomplete: 'current-password' });
  const button = h('button', { type: 'submit', class: 'btn btn-danger' }, 'Zmazať účet natrvalo');
  const form = h('form', { class: 'auth-form delete-form', novalidate: true });
  const formError = handleSubmit(form, button, 'Mažem…', { password }, () => deleteAccount(password.input.value));
  form.append(
    h('p', null, 'Zmaže sa účet aj celý jeho pokrok. Túto akciu nejde vrátiť.'),
    password.el, formError, button,
  );
  return h('details', { class: 'danger-zone' }, h('summary', null, 'Zmazať účet'), form);
}

function subscriptionCard(account: Account): HTMLElement {
  const sub = account.subscription;
  return h('section', { class: 'sub-card', 'aria-label': 'Predplatné' },
    h('div', null,
      h('p', { class: 'eyebrow' }, 'Predplatné'),
      sub
        ? h('p', { class: 'sub-state' }, 'ElektroLab Premium · ',
          h('strong', null, `${fmtFixed(monthlyTotal(sub.discount), 2)} € / mesiac`),
          sub.discount ? ` (zľava ${sub.discount} %)` : '')
        : h('p', { class: 'sub-state' }, `Zatiaľ nemáš predplatné. Premium odomkne Striedavý prúd a Elektrotechnické merania za ${MONTHLY_PRICE} € mesačne.`),
    ),
    linkButton('#predplatne', sub ? 'Spravovať predplatné' : 'Zobraziť predplatné', sub ? 'secondary' : 'primary'),
  );
}

function profilePage(account: Account): HTMLElement {
  const created = new Date(account.created);
  return h('div', { class: 'view view-account' },
    pageHead(null, 'Môj účet'),
    h('section', { class: 'profile-card', 'aria-label': 'Údaje účtu' },
      avatar(account.name, 'avatar-lg'),
      h('div', { class: 'profile-meta' },
        h('p', { class: 'profile-name' }, account.name),
        h('p', { class: 'profile-username' }, `@${account.username}`),
        Number.isNaN(created.getTime()) ? null : h('p', { class: 'muted' }, `Účet vytvorený ${dateFormat.format(created)}`),
      ),
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { logout(); navigate('#domov'); } },
        icon('logout', 18), 'Odhlásiť sa'),
    ),
    subscriptionCard(account),
    statsSection(),
    deleteControl(),
  );
}

export function accountView(mode?: 'login' | 'register'): HTMLElement {
  const account = currentAccount();
  return account ? profilePage(account) : authPage(mode ?? 'login');
}
