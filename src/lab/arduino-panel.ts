/**
 * Panel Arduina pod schémou: editor programu, nahranie do dosky, reset, hlásenia prekladača
 * a sériový monitor (výpis zo Serial.print a riadok na posielanie textu do Arduina).
 */
import type { CompileResult, Diagnostic } from '../arduino/compiler';
import { SKETCHES } from '../arduino/sketches';
import { h } from '../lib/dom';
import { codeEditor } from './code-editor';
import type { Simulator } from './engine';
import type { Part } from './parts';

export interface ArduinoHandlers {
  /** Písanie v editore (program sa uloží, ale do Arduina sa nenahrá). */
  onCode(code: string): void;
  /** Vloženie vzorového programu (dá sa vrátiť tlačidlom Späť). */
  onTemplate(code: string): void;
  /** Preloží a nahrá program; null, keď je napájanie vypnuté. */
  onUpload(code: string): CompileResult | null;
  onVerify(code: string): CompileResult;
  onReset(): void;
  onSerial(text: string): void;
  onSerialClear(): void;
}

export interface ArduinoPanel {
  el: HTMLElement;
  partId: string;
  /** Zladí text v editore s programom súčiastky (po Späť alebo vložení vzoru). */
  sync(part: Part): void;
  update(sim: Simulator | null): void;
  focus(): void;
}

const pct = (n: number) => `${Math.round((100 * n) / 2048)} %`;

export function arduinoPanel(part: Part, handlers: ArduinoHandlers): ArduinoPanel {
  const partId = part.id;
  const status = h('p', { class: 'ard-status', role: 'status' });
  const msgs = h('div', { class: 'ard-msgs', 'aria-live': 'polite' });
  const notesBox = h('div', { class: 'ard-notes' });
  let result: { kind: 'ok' | 'error'; text: string; diags: Diagnostic[]; warn: Diagnostic[] } | null = null;

  const editor = codeEditor(String(part.props.code ?? ''), `Program pre Arduino ${part.name}`, (code) => {
    handlers.onCode(code);
    if (result?.kind === 'error') {
      result = null;
      editor.mark(null);
      renderMsgs();
    }
  });

  const lineBtn = (d: Diagnostic, cls: string) => {
    const b = h('button', { type: 'button', class: `ard-msg ${cls}` },
      h('span', { class: 'ard-msg-line' }, `riadok ${d.line}`), d.message);
    b.addEventListener('click', () => editor.goTo(d.line));
    return b;
  };

  function renderMsgs(): void {
    if (!result) {
      msgs.replaceChildren();
      return;
    }
    const items: HTMLElement[] = [];
    if (result.kind === 'ok') items.push(h('p', { class: 'ard-msg is-ok' }, result.text));
    items.push(...result.diags.map((d) => lineBtn(d, 'is-error')), ...result.warn.map((d) => lineBtn(d, 'is-warn')));
    msgs.replaceChildren(...items);
  }

  function show(r: CompileResult, uploaded: boolean): void {
    if (r.ok) {
      const ram = r.program.ramBytes;
      result = {
        kind: 'ok',
        text: `${uploaded ? 'Program je nahratý do Arduina a beží od začiatku.' : 'Program je bez chýb.'} Premenné zaberajú ${ram} B (${pct(ram)}) z 2048 B pamäte RAM.`,
        diags: [], warn: r.program.warnings,
      };
      editor.mark(r.program.warnings[0]?.line ?? null, 'warn');
    } else {
      result = { kind: 'error', text: '', diags: [r.error], warn: [] };
      editor.mark(r.error.line, 'error');
    }
    renderMsgs();
  }

  const templates = h('select', { class: 'field-input', 'aria-label': 'Vzorové programy' },
    h('option', { value: '' }, 'Vzorové programy…'),
    SKETCHES.map((sk) => h('option', { value: sk.id }, sk.title)));
  templates.addEventListener('change', () => {
    const sk = SKETCHES.find((x) => x.id === templates.value);
    templates.value = '';
    if (!sk) return;
    editor.setValue(sk.code);
    result = null;
    editor.mark(null);
    renderMsgs();
    handlers.onTemplate(sk.code);
    status.dataset.note = `Vložený program „${sk.title}“. Do Arduina ho pošleš tlačidlom Nahrať.`;
  });

  const verify = h('button', { type: 'button', class: 'btn btn-sm btn-secondary' }, '✓ Overiť');
  verify.addEventListener('click', () => show(handlers.onVerify(editor.value), false));
  const reset = h('button', { type: 'button', class: 'btn btn-sm btn-quiet' }, '↺ Reset');
  reset.addEventListener('click', () => handlers.onReset());
  const upload = h('button', { type: 'button', class: 'btn btn-sm btn-primary' }, '→ Nahrať do Arduina');
  upload.addEventListener('click', () => {
    const r = handlers.onUpload(editor.value);
    if (r) show(r, r.ok);
    else show(handlers.onVerify(editor.value), false);
  });

  // ------------------------------------------------------------------ sériový monitor
  const out = h('pre', { class: 'ard-serial-out', tabindex: '0', 'aria-label': 'Výpis sériového monitora' });
  const baud = h('span', { class: 'ard-baud' });
  const clear = h('button', { type: 'button', class: 'btn btn-sm btn-quiet' }, 'Vymazať');
  clear.addEventListener('click', () => {
    handlers.onSerialClear();
    out.textContent = '';
  });
  const input = h('input', {
    type: 'text', class: 'field-input', placeholder: 'Text pre Arduino (Serial.read)…', autocomplete: 'off', spellcheck: 'false',
    'aria-label': 'Text, ktorý sa pošle do Arduina',
  });
  const send = h('button', { type: 'submit', class: 'btn btn-sm btn-secondary' }, 'Odoslať');
  const form = h('form', { class: 'ard-serial-in' }, h('div', { class: 'field-box' }, input), send);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handlers.onSerial(`${input.value}\n`);
    input.value = '';
  });

  const el = h('section', { class: 'ard-panel', 'aria-label': `Arduino ${part.name} – program` },
    h('div', { class: 'ard-head' },
      h('div', null, h('p', { class: 'eyebrow' }, `Arduino UNO · ${part.name}`), h('h3', null, 'Program')),
      h('div', { class: 'ard-actions' }, h('div', { class: 'field-box lab-select' }, templates), verify, reset, upload),
    ),
    status,
    h('div', { class: 'ard-cols' },
      h('div', { class: 'ard-code' },
        editor.el,
        h('p', { class: 'ard-hint' }, 'Tab odsadí riadok. Klávesom Esc a potom Tab sa presunieš z editora ďalej.'),
        msgs,
        notesBox,
      ),
      h('div', { class: 'ard-serial' },
        h('div', { class: 'ard-serial-head' }, h('h4', null, 'Sériový monitor'), baud, clear),
        out,
        form,
      ),
    ),
  );

  let serialVersion = -1;
  let notesKey = '';
  let lastMcu: unknown = null;

  return {
    el,
    partId,
    sync(p: Part) {
      const code = String(p.props.code ?? '');
      if (code !== editor.value) editor.setValue(code);
    },
    update(sim: Simulator | null) {
      const mcu = sim?.mcus.get(partId) ?? null;
      let text: string;
      let tone: 'off' | 'run' | 'error' | 'warn';
      if (!sim || !mcu) {
        text = 'Napájanie je vypnuté – Arduino nebeží.';
        tone = 'off';
      } else if (mcu.compileError) {
        text = `Program v Arduine sa nedá preložiť (riadok ${mcu.compileError.line}: ${mcu.compileError.message}) – oprav ho a nahraj znova.`;
        tone = 'error';
      } else if (mcu.error) {
        text = `Program sa zastavil – riadok ${mcu.error.line}: ${mcu.error.message}`;
        tone = 'error';
      } else if (mcu.source !== editor.value) {
        text = 'Arduino beží s predchádzajúcim programom. Zmeny v editore pošleš tlačidlom → Nahrať do Arduina.';
        tone = 'warn';
      } else {
        const secs = Math.max(0, (mcu.time - mcu.startedAt));
        text = `Program beží · ${secs < 60 ? `${secs.toFixed(1).replace('.', ',')} s` : `${Math.floor(secs / 60)} min ${Math.floor(secs % 60)} s`} od spustenia`;
        tone = 'run';
      }
      const note = status.dataset.note;
      if (note && tone !== 'warn') delete status.dataset.note;
      const full = tone === 'warn' && note ? note : text;
      if (status.textContent !== full) status.textContent = full;
      status.className = `ard-status is-${tone}`;

      // Upozornenia počas behu (napr. analogWrite na pine bez PWM).
      const notes = mcu ? [...mcu.notes.values()] : [];
      const key = notes.map((n) => n.message).join('|');
      if (key !== notesKey) {
        notesKey = key;
        notesBox.replaceChildren(...notes.map((n) => lineBtn(n, 'is-warn')));
      }

      if (mcu !== lastMcu) {
        lastMcu = mcu;
        serialVersion = -1;
      }
      if (mcu && mcu.serialVersion !== serialVersion) {
        serialVersion = mcu.serialVersion;
        const atBottom = out.scrollHeight - out.scrollTop - out.clientHeight < 24;
        out.textContent = mcu.serialLog;
        if (atBottom) out.scrollTop = out.scrollHeight;
      }
      baud.textContent = !mcu ? '' : mcu.serialBegun ? `${mcu.baud} Bd` : 'bez Serial.begin()';
    },
    focus() {
      editor.textarea.focus();
    },
  };
}
