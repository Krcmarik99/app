// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DECKS } from '../src/content/flashcards';
import { LESSONS } from '../src/content/lessons';
import { currentAccount, logout, register } from '../src/lib/auth';
import { formula, rich } from '../src/lib/formula';
import { configureCloud } from '../src/lib/cloud';

// Tieto testy overujú účty uložené v prehliadači – bez servera.
configureCloud(null);
import { accountView } from '../src/views/account';
import { labView } from '../src/views/lab';
import { DEMO_FOR, EXAMPLES, exampleById } from '../src/lab/examples';
import { PALETTE } from '../src/lab/parts';
import { calculatorView, calculatorsView, CALCULATORS } from '../src/views/calculators';
import { flashcardsView } from '../src/views/flashcards';
import { homeView } from '../src/views/home';
import { lessonView, lessonsView } from '../src/views/lessons';
import { practiceView } from '../src/views/practice';

function mount(el: HTMLElement): HTMLElement {
  document.body.replaceChildren(el);
  return el;
}

beforeEach(() => {
  localStorage.clear();
});

describe('vzorce', () => {
  it('vykreslí veličiny kurzívou, indexy a zlomky', () => {
    const div = document.createElement('div');
    div.append(formula('$U_{2} = $U · @f{$R_{2}}{$R_{1} + $R_{2}}'));
    expect(div.querySelectorAll('i.v')).toHaveLength(5);
    expect(div.querySelectorAll('sub')).toHaveLength(4);
    expect(div.querySelector('.frac .num')?.textContent).toBe('R2');
    expect(div.querySelector('.frac .den')?.textContent).toBe('R1 + R2');
  });

  it('podporuje odmocninu a text s tučným písmom', () => {
    const div = document.createElement('div');
    div.append(rich('Platí `$U = @f{$U_{m}}{@s{2}}` a **pozor** na jednotky.'));
    expect(div.querySelector('.sqrt-rad')?.textContent).toBe('2');
    expect(div.querySelector('strong')?.textContent).toBe('pozor');
    expect(div.textContent).toContain('na jednotky.');
  });
});

describe('stránky sa vykreslia bez chyby', () => {
  it('domov', () => {
    const el = mount(homeView());
    expect(el.querySelector('h1')?.textContent).toContain('Elektrotechnika');
    expect(el.querySelector('#hero-u')).not.toBeNull();
  });

  describe('obvod na domovskej stránke', () => {
    const setup = () => {
      const el = mount(homeView());
      const $ = (sel: string) => el.querySelector<HTMLInputElement>(sel)!;
      const set = (input: HTMLInputElement, value: string, event = 'input') => {
        input.value = value;
        input.dispatchEvent(new Event(event));
      };
      const texts = (sel: string) => [...el.querySelectorAll(sel)].map((o) => o.textContent?.replace(/\u00a0/g, ' '));
      const fields = () => [...el.querySelectorAll<HTMLInputElement>('.slider-field')].map((o) => o.value.replace(/\u00a0/g, ' '));
      const readouts = () => texts('.readout-value');
      const status = () => (el.querySelector('.hero-status')?.textContent ?? '').replace(/\u00a0/g, ' ');
      return { el, $, set, fields, readouts, status, u: $('#hero-u'), r: $('#hero-r'), uVal: $('#hero-u-val'), rVal: $('#hero-r-val') };
    };

    it('posuvníky pokryjú 0 až 500 V a 0 Ω až 5 MΩ', () => {
      const { set, fields, readouts, status, u, r } = setup();
      expect(fields()).toEqual(['9 V', '330 Ω']);

      set(u, u.max);
      set(r, r.max);
      expect(fields()).toEqual(['500 V', '5 MΩ']);
      expect(readouts()).toEqual(['100 µA', '50 mW']);

      set(r, '1');
      expect(fields()[1]).toBe('1 mΩ');
      expect(readouts()).toEqual(['500 kA', '250 MW']);
      expect(status()).toContain('zhorel');

      set(r, '0');
      expect(fields()[1]).toBe('0 Ω');
      expect(readouts()).toEqual(['∞ A', '∞ W']);
      expect(status()).toContain('Skrat');

      set(u, '0');
      expect(readouts()).toEqual(['0 A', '0 W']);
      expect(status()).toBe('Bez napätia neteče prúd.');
    });

    it('hodnoty sa dajú napísať aj na stotiny', () => {
      const { el, set, fields, readouts, r, uVal, rVal } = setup();
      set(uVal, '12,25');
      set(rVal, '4,7k');
      expect(readouts()).toEqual(['2,606 mA', '31,93 mW']);
      expect(Number(r.value)).toBeGreaterThan(0);
      set(rVal, '4,7k', 'change');
      expect(fields()).toEqual(['12,25', '4,7 kΩ']);
      set(uVal, '12,25', 'change');
      expect(fields()[0]).toBe('12,25 V');

      uVal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(fields()[0]).toBe('12,26 V');
      rVal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(fields()[1]).toBe('4,69 kΩ');

      set(uVal, '600');
      expect(uVal.classList.contains('is-invalid')).toBe(true);
      expect(el.querySelector('.hero-entry-hint')?.textContent).toContain('0 až 500 V');
      set(uVal, '600', 'change');
      expect(fields()[0]).toBe('12,26 V');
      expect(uVal.classList.contains('is-invalid')).toBe(false);
    });

    it('schéma s LED a predradným rezistorom', () => {
      const { el, $, set, readouts, status, uVal, rVal } = setup();
      const led = $('#hero-mode-led');
      led.checked = true;
      led.dispatchEvent(new Event('change'));
      expect(el.querySelector('.hero-sch .comp-led')).not.toBeNull();
      expect($('#hero-led-color').closest('.hero-color')?.hasAttribute('hidden')).toBe(false);

      set(uVal, '5');
      set(rVal, '220');
      expect(readouts()).toEqual(['13,64 mA', '40,91 mW']);
      expect(status()).toContain('LED svieti');

      set(rVal, '100');
      expect(status()).toContain('zhorí');
      expect(status()).toContain('150 Ω');
      expect(el.querySelector('.comp-led')?.classList.contains('is-burnt')).toBe(true);

      set(uVal, '1,5');
      expect(readouts()).toEqual(['0 A', '0 W']);
      expect(status()).toContain('LED nesvieti');

      set(uVal, '5');
      set(rVal, '220');
      set($('#hero-led-color'), 'blue', 'change');
      expect(readouts()[0]).toBe('8,182 mA');
    });
  });

  it('zoznam lekcií a všetky lekcie', () => {
    expect(mount(lessonsView()).querySelectorAll('.lesson-row')).toHaveLength(LESSONS.length);
    for (const l of LESSONS) {
      const el = mount(lessonView(l.id));
      expect(el.querySelector('h1')?.textContent).toBe(l.title);
      expect(el.querySelectorAll('.question').length).toBeGreaterThanOrEqual(2);
    }
    expect(mount(lessonView('neexistuje')).textContent).toContain('nenašla');
  });

  it('cvičenie – nastavenie, odpoveď a výsledok', () => {
    const el = mount(practiceView());
    expect(el.querySelectorAll('.chip-toggle')).toHaveLength(LESSONS.length);
    const run = mount(practiceView('farebny-kod'));
    expect(run.querySelector('.question')).not.toBeNull();
    for (let i = 0; i < 5; i++) {
      const option = run.querySelector<HTMLButtonElement>('.option');
      if (option) option.click();
      else {
        run.querySelector<HTMLButtonElement>('.numeric-form .btn-quiet:not([disabled])')?.click();
      }
      run.querySelector<HTMLButtonElement>('.run-next')?.click();
    }
    expect(run.querySelector('.summary-big')?.textContent).toMatch(/\d+ \/ 5/);
    expect(JSON.parse(localStorage.getItem('elektrolab:v1')!).stats['farebny-kod'].answered).toBe(5);
  });

  it('všetky kalkulačky', () => {
    expect(mount(calculatorsView()).querySelectorAll('.calc-card')).toHaveLength(CALCULATORS.length);
    for (const c of CALCULATORS) {
      const el = mount(calculatorView(c.id));
      expect(el.querySelector('.calc-error'), c.id).toBeNull();
      expect(el.querySelector('.results, .big-value'), c.id).not.toBeNull();
    }
  });

  it('kalkulačka Ohmovho zákona dopočíta prúd a výkon', () => {
    const el = mount(calculatorView('ohm'));
    const I = el.querySelector<HTMLInputElement>('#ohm-I')!;
    const P = el.querySelector<HTMLInputElement>('#ohm-P')!;
    expect(I.value).toBe('25,53m');
    expect(P.value).toBe('306,4m');
    const R = el.querySelector<HTMLInputElement>('#ohm-R')!;
    R.value = '1k';
    R.dispatchEvent(new Event('input'));
    expect(I.value).toBe('12m');
  });

  it('kartičky', () => {
    for (const d of DECKS) {
      const el = mount(flashcardsView(d.id));
      const card = el.querySelector<HTMLButtonElement>('.flip-card')!;
      card.click();
      expect(card.classList.contains('is-flipped')).toBe(true);
      el.querySelector<HTMLButtonElement>('.card-answers .btn-primary')!.click();
    }
    expect(JSON.parse(localStorage.getItem('elektrolab:v1')!).cardsKnown).toHaveLength(DECKS.length);
  });
});

describe('účet', () => {
  beforeEach(() => {
    logout();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('prihlásenie a registrácia cez formulár', async () => {
    const loginPage = mount(accountView('login'));
    expect(loginPage.querySelector('h1')?.textContent).toBe('Prihlásenie');
    expect(loginPage.querySelector<HTMLInputElement>('#login-password')?.type).toBe('password');

    const page = mount(accountView('register'));
    const fill = (id: string, value: string) => {
      const input = page.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const form = page.querySelector('form')!;
    fill('reg-name', 'Eva');
    fill('reg-username', 'eva');
    fill('reg-password', 'tajne1');
    fill('reg-password2', 'ine');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(page.querySelector('#reg-password2-error')?.textContent).toBe('Heslá sa nezhodujú.'));
    expect(currentAccount()).toBeNull();

    fill('reg-password2', 'tajne1');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(currentAccount()?.username).toBe('eva'));
  });

  it('stránka účtu ukáže prihláseného a odhlásenie', async () => {
    await register({ name: 'Eva Malá', username: 'eva', password: 'tajne1', password2: 'tajne1', keepProgress: false, remember: true });
    const page = mount(accountView());
    expect(page.querySelector('.profile-name')?.textContent).toBe('Eva Malá');
    expect(page.querySelector('.avatar')?.textContent).toBe('EM');
    expect(mount(homeView()).querySelector('.eyebrow')?.textContent).toBe('Ahoj, Eva');

    const logoutBtn = [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Odhlásiť'))!;
    logoutBtn.click();
    expect(currentAccount()).toBeNull();
  });
});

describe('zapájanie obvodov', () => {
  beforeEach(() => {
    logout();
    localStorage.clear();
  });

  it('vykreslí paletu, ukážky a vlastnosti súčiastky', () => {
    const el = mount(labView());
    const items = PALETTE.flatMap((g) => g.items);
    expect(el.querySelectorAll('.lab-palette-btn')).toHaveLength(items.length);
    expect(items.map((i) => i.label)).toEqual(expect.arrayContaining([
      'Ampérmeter', 'Voltmeter', 'Multimeter', 'Wattmeter', 'Osciloskop', 'Zdroj DC', 'Zdroj AC', 'Spínač',
      'Rezistor', 'Žiarovka', 'Kondenzátor', 'Elektrolytický kondenzátor', 'Cievka', 'Dióda', 'LED dióda',
      'Tranzistor NPN', 'Tranzistor PNP', 'MOSFET N', 'MOSFET P',
    ]));
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Ukážkové zapojenia"]')!;
    for (const ex of EXAMPLES) {
      select.value = ex.id;
      select.dispatchEvent(new Event('change'));
      expect(el.querySelectorAll('.lab-svg .lab-part-g').length, ex.id).toBe(ex.build().parts.length);
      expect(el.querySelectorAll('.lab-open'), ex.id).toHaveLength(0);
      expect(el.querySelectorAll('.scope-panel').length, ex.id).toBe(ex.build().parts.filter((p) => p.kind === 'scope').length);
    }
    expect(JSON.parse(localStorage.getItem('elektrolab:lab:guest')!).parts.length).toBe(EXAMPLES[EXAMPLES.length - 1].build().parts.length);

    select.value = '__empty';
    select.dispatchEvent(new Event('change'));
    expect(el.querySelectorAll('.lab-svg .lab-part-g')).toHaveLength(0);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Späť'))!.click();
    expect(el.querySelectorAll('.lab-svg .lab-part-g').length).toBe(EXAMPLES[EXAMPLES.length - 1].build().parts.length);
  });

  it('pri každej súčiastke ukáže ukážku zapojenia a otvorí ju na doske', () => {
    const el = mount(labView());
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.lab-palette-btn')];
    for (const item of PALETTE.flatMap((g) => g.items)) {
      buttons.find((b) => b.title === item.label)!.click();
      const demo = el.querySelector('.lab-inspector .lab-demo');
      expect(demo, item.id).not.toBeNull();
      expect(demo!.querySelector('.lab-preview-svg .lab-focus'), item.id).not.toBeNull();
      expect(demo!.querySelector('.lab-demo-title')?.textContent).toBe(exampleById(DEMO_FOR[item.id])!.title);
      buttons.find((b) => b.title === item.label)!.click();
    }
    buttons.find((b) => b.title === 'Cievka')!.click();
    [...el.querySelectorAll<HTMLButtonElement>('.lab-demo button')].find((b) => b.textContent === 'Otvoriť ukážku na doske')!.click();
    expect(el.querySelectorAll('.lab-svg .lab-part-g')).toHaveLength(exampleById('rl')!.build().parts.length);
    expect(el.querySelector('.lab-status')?.textContent).toContain('Späť');
  });

  it('Arduino má editor programu, nahrávanie s hlásením chýb a sériový monitor', () => {
    const el = mount(labView());
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Ukážkové zapojenia"]')!;
    select.value = 'ard-blink';
    select.dispatchEvent(new Event('change'));
    const panel = el.querySelector('.ard-panel')!;
    expect(panel).not.toBeNull();
    const ta = panel.querySelector<HTMLTextAreaElement>('.code-input')!;
    expect(ta.value).toContain('digitalWrite(LED, HIGH)');
    expect(panel.querySelector('.code-hl .c-fn')?.textContent).toBe('setup');
    expect(panel.querySelector('.ard-status')?.textContent).toContain('Program beží');

    // Chyba v programe: hlásenie s číslom riadka, riadok je označený.
    ta.value = ta.value.replace('pinMode(LED, OUTPUT);', 'pinMode(LED, OUTPUT)');
    ta.dispatchEvent(new Event('input'));
    const upload = [...panel.querySelectorAll('button')].find((b) => b.textContent?.includes('Nahrať'))!;
    upload.click();
    expect(panel.querySelector('.ard-msg.is-error')?.textContent).toContain('bodkočiarka');
    expect(panel.querySelector('.code-gutter .is-error')?.textContent).toBe('7');

    // Vzorový program sa vloží a dá sa nahrať.
    const templates = panel.querySelector<HTMLSelectElement>('select[aria-label="Vzorové programy"]')!;
    templates.value = 'serial';
    templates.dispatchEvent(new Event('change'));
    expect(ta.value).toContain('Serial.readStringUntil');
    upload.click();
    expect(panel.querySelector('.ard-msg.is-ok')?.textContent).toContain('nahratý');
    const saved = JSON.parse(localStorage.getItem('elektrolab:lab:guest')!) as { parts: { kind: string; props: { code: string } }[] };
    expect(saved.parts.find((p) => p.kind === 'arduino')!.props.code).toContain('Serial.readStringUntil');

    // Arduino sa nedá otáčať; v paneli vlastností sú piny.
    const board = el.querySelector<SVGGElement>('.lab-part-g:has(.lab-arduino)')!;
    board.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    board.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(el.querySelector('.lab-inspector h3')?.textContent).toBe('Arduino UNO');
    expect(el.querySelector('.lab-inspector .lab-pins')).not.toBeNull();
    [...el.querySelectorAll<HTMLButtonElement>('.lab-inspector button')].find((b) => b.textContent?.startsWith('Otočiť'))!.click();
    expect(el.querySelector('.lab-status')?.textContent).toContain('neotáča');
  });
});
