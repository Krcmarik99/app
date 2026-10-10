/**
 * Prihlásenie, registrácia a stránka účtu. Účty aj pokrok sa ukladajú v tomto prehliadači.
 */
import {
  NAME_MAX, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN,
  currentAccount, deleteAccount, login, logout, register,
  type Account, type AuthField, type AuthResult,
} from '../lib/auth';
import { h, type Attrs, type Child } from '../lib/dom';
import { checkCloud, cloudEnabled, cloudIsAdmin } from '../lib/cloud';
import { PUBLIC_URL } from '../lib/config';
import { hasGuestProgress } from '../lib/progress';
import { onSyncChange, syncStatus } from '../lib/sync';
import { navigate } from '../router';
import { icon } from '../ui/icons';
import { avatar, pageHead } from './common';
import { statsSection } from './home';

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
      navigate('#domov');
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

/** Stav servera účtov: či sa účet uloží online a či je Supabase správne nastavený. */
function cloudStatusLine(): HTMLElement {
  const line = h('p', { class: 'cloud-status', 'aria-live': 'polite' }, 'Overujem spojenie so serverom účtov…');
  void checkCloud().then((st) => {
    let text: string;
    let tone: 'ok' | 'warn';
    if (!st.reachable) {
      text = 'Server účtov teraz nie je dostupný – nový účet sa uloží len v tomto prehliadači a na server sa prenesie neskôr.';
      tone = 'warn';
    } else if (st.autoconfirm === false) {
      text = 'Server účtov vyžaduje potvrdenie e-mailom – v Supabase treba vypnúť „Confirm email“, inak registrácia neprejde.';
      tone = 'warn';
    } else if (st.table === false) {
      text = 'V databáze chýba tabuľka profiles – v Supabase treba spustiť SQL zo súboru supabase/schema.sql.';
      tone = 'warn';
    } else {
      text = 'Server účtov je pripojený – účet bude fungovať na každom zariadení.';
      tone = 'ok';
    }
    line.textContent = text;
    line.className = `cloud-status is-${tone}`;
    // Na stránke, ktorá spojenie so serverom blokuje (napr. náhľad na claude.ai), ponúkni plnú verziu.
    const elsewhere = typeof location !== 'undefined' && !location.href.startsWith(PUBLIC_URL);
    if (!st.reachable && elsewhere) {
      line.append(' Online účty fungujú na adrese ', h('a', { href: PUBLIC_URL, target: '_blank', rel: 'noopener' }, PUBLIC_URL.replace(/^https:\/\//, '')), '.');
    }
  });
  return line;
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
        ...(cloudEnabled()
          ? [
            h('p', null, 'Účet sa ukladá online. Prihlásiš sa ním na hocijakom zariadení a pokrok v lekciách, cvičeniach, kartičkách aj zapojenia z laboratória sa synchronizujú.'),
            h('p', null, 'Ak server účtov práve nie je dostupný, účet sa vytvorí v tomto prehliadači a na server sa prenesie pri najbližšom prihlásení. Heslo si zapamätaj – nedá sa obnoviť.'),
            h('p', null, PRIVACY),
            cloudStatusLine(),
          ]
          : [
            h('p', null, 'Účty aj pokrok sa ukladajú len v tomto prehliadači. Hodí sa to, keď sa na jednom počítači učí viac ľudí – každý má po prihlásení svoj vlastný pokrok.'),
            h('p', null, 'Na inom zariadení alebo v inom prehliadači si účet vytvor znova. Heslo sa neukladá v čitateľnej podobe, len jeho zašifrovaný odtlačok.'),
          ]),
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

/** Kde je účet uložený a ako prebieha synchronizácia. */
function storageLine(account: Account): HTMLElement {
  const line = h('p', { class: 'profile-storage' });
  if (!account.cloud) {
    line.textContent = 'Účet je uložený len v tomto prehliadači.';
    line.classList.add('is-local');
    return line;
  }
  const texts = {
    local: 'Online účet.',
    syncing: 'Online účet · synchronizujem…',
    synced: 'Online účet – prihlásiš sa na každom zariadení. Pokrok je uložený.',
    offline: 'Online účet · server nie je dostupný, zmeny sa odošlú neskôr.',
    error: 'Online účet · synchronizácia zlyhala.',
  } as const;
  const update = () => {
    const st = syncStatus();
    line.textContent = st.state === 'error' && st.message ? `${texts.error} ${st.message}` : texts[st.state];
    line.classList.toggle('is-problem', st.state === 'offline' || st.state === 'error');
  };
  const off = onSyncChange(() => {
    if (!line.isConnected && line.dataset.mounted) {
      off();
      return;
    }
    line.dataset.mounted = '1';
    update();
  });
  update();
  return line;
}

/** Čo z online účtu vidí správca aplikácie. */
const PRIVACY = 'Správca aplikácie vidí meno účtu, kedy sa prihlasuješ a otváraš aplikáciu a tvoj pokrok v lekciách a cvičeniach. Heslo nevidí nikto.';

/** Odkaz na správu – ukáže sa, len keď server potvrdí, že účet je správca. */
function adminCard(): HTMLElement {
  const slot = h('div');
  void cloudIsAdmin().then((ok) => {
    if (!ok) return;
    slot.replaceChildren(h('section', { class: 'admin-card', 'aria-label': 'Správa aplikácie' },
      h('div', null,
        h('p', { class: 'eyebrow' }, 'Správca'),
        h('p', null, 'Prehľad používateľov: kto sa prihlásil, posledná aktivita a pokrok.'),
      ),
      h('a', { href: '#sprava', class: 'btn btn-primary' }, 'Otvoriť správu'),
    ));
  });
  return slot;
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
        storageLine(account),
        account.cloud ? h('p', { class: 'privacy-note' }, PRIVACY) : null,
      ),
      h('button', { type: 'button', class: 'btn btn-secondary', onClick: () => { logout(); navigate('#domov'); } },
        icon('logout', 18), 'Odhlásiť sa'),
    ),
    account.cloud ? adminCard() : null,
    statsSection(),
    deleteControl(),
  );
}

export function accountView(mode?: 'login' | 'register'): HTMLElement {
  const account = currentAccount();
  return account ? profilePage(account) : authPage(mode ?? 'login');
}
