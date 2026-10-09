/**
 * Zapájanie obvodov: súčiastky a meracie prístroje sa vkladajú do mriežky, spájajú vodičmi
 * a obvod sa hneď simuluje. Merače ukazujú hodnoty priamo v schéme, osciloskop pod ňou.
 */
import { currentAccount } from '../lib/auth';
import { pushCircuit } from '../lib/sync';
import { frag, h, s } from '../lib/dom';
import { formatSI, parseQuantity } from '../lib/units';
import { Simulator, glowLevel, meterReading, type PartState } from '../lab/engine';
import { DEMO_FOR, EXAMPLES, exampleById, paletteIdOf } from '../lab/examples';
import { buildNets, onSegmentInterior, routeWire } from '../lab/netlist';
import {
  KINDS, PALETTE, createPart, displayName, newId, num, parseCircuit, terminalsOf,
  type Circuit, type PaletteItem, type Part, type PropDef, type Pt, type Rot, type Wire,
} from '../lab/parts';
import { circuitPreview } from '../lab/preview';
import { scopePanel, type ScopePanel } from '../lab/scope';
import { G, drawPart, hitBox, partIcon, type PartDrawing } from '../lab/symbols';
import { icon } from '../ui/icons';
import { pageHead } from './common';

const COLS = 48;
const ROWS = 28;
const W = COLS * G;
const H = ROWS * G;
const SPEEDS: [number, string][] = [[1, '1× (skutočný čas)'], [0.1, '0,1× (spomalene)'], [0.01, '0,01×'], [0.001, '0,001×']];
const ZOOMS = [1, 1.5, 2, 2.5, 3];

const HELP: Record<Part['kind'], string> = {
  resistor: 'Obmedzuje prúd. Výkon sa na ňom mení na teplo – pri preťažení sa rezistor sfarbí.',
  lamp: 'Svieti tým jasnejšie, čím väčší výkon na nej je. Pri menovitom napätí má menovitý výkon. Rozžeravené vlákno má odpor R = U² / P.',
  capacitor: 'Nabíja sa cez rezistor s časovou konštantou τ = R · C. V ustálenom stave jednosmerný prúd neprepúšťa.',
  ecap: 'Má veľkú kapacitu, ale záleží na polarite: vývod + musí byť na vyššom napätí. Neprekroč menovité napätie.',
  inductor: 'Bráni zmenám prúdu. Pri náhlom prerušení prúdu vzniká na cievke napäťová špička.',
  diode: 'Vedie len v priepustnom smere – z anódy do katódy (v smere trojuholníka). Úbytok napätia je asi 0,6 až 0,8 V.',
  led: 'Svieti v priepustnom smere. Prúd musíš obmedziť predradným rezistorom – najviac 20 mA.',
  bjt: 'Malý prúd bázy riadi veľký prúd kolektora: I_C ≈ h21E · I_B. NPN otvára kladné napätie bázy voči emitoru, PNP záporné.',
  mosfet: 'Otvára ho napätie hradla voči source U_GS väčšie ako prahové napätie. Hradlo neodoberá žiadny prúd.',
  dc: 'Laboratórny zdroj s vnútorným odporom 0,1 Ω. Kladný vývod je pri dlhšej doštičke (+).',
  ac: 'Zdroj sínusového napätia. Zadávaš efektívnu hodnotu – amplitúda je √2-krát väčšia.',
  switch: 'Kliknutím na spínač v schéme ho zapneš alebo vypneš.',
  ammeter: 'Zapája sa do série. Má veľmi malý odpor (0,01 Ω), preto zapojený paralelne spôsobí skrat.',
  voltmeter: 'Zapája sa paralelne. Má veľký odpor (10 MΩ), takže obvod takmer neovplyvní.',
  multimeter: 'Prepni funkciu: napätie (zapojenie paralelne), prúd (do série) alebo odpor (súčiastka musí byť bez napätia).',
  wattmeter: 'Prúdovú cievku (vývody I*, I) zapoj do série so spotrebičom, napäťovú (U*, U) paralelne k nemu. Začiatky cievok sú označené hviezdičkou.',
  scope: 'Kanály CH1 a CH2 ukazujú napätie voči svorke ⏚. Obrazovka osciloskopu je pod schémou.',
};

/** Nastavenia, ktoré vydržia aj prechod na inú stránku. */
let speed = 1;
let powered = true;
/** Stop: čas obvodu stojí, merače ukazujú posledné hodnoty. */
let running = true;
let zoom: number | null = null;

const storeKey = () => `elektrolab:lab:${currentAccount()?.id ?? 'guest'}`;

function loadCircuit(): Circuit {
  try {
    const raw = localStorage.getItem(storeKey());
    const c = raw ? parseCircuit(JSON.parse(raw)) : null;
    if (c) return c;
  } catch {
    // Poškodený záznam – začneme ukážkou.
  }
  return exampleById('led')!.build();
}

function saveCircuit(c: Circuit): void {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(c));
  } catch {
    // Bez úložiska sa obvod neuloží, editor funguje ďalej.
  }
  // Pri online účte sa zapojenie uloží aj na server – otvoríš ho na inom zariadení.
  pushCircuit(c);
}

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
const clone = (c: Circuit): Circuit => JSON.parse(JSON.stringify(c)) as Circuit;

function centroid(pts: Pt[]): Pt {
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

function fmtValue(v: number, unit: string): string {
  return formatSI(Math.abs(v) < 1e-12 ? 0 : v, unit, 4);
}

type Selection = { type: 'part' | 'wire'; id: string } | null;
type Drag =
  | { kind: 'part'; id: string; start: Pt; origin: Pt; moved: boolean; before: string; ends: { wire: Wire; end: 'a' | 'b'; orig: Pt }[] }
  | { kind: 'wire'; start: Pt; moved: boolean }
  | null;

export function labView(): HTMLElement {
  let circuit = loadCircuit();
  let sim: Simulator | null = null;
  let selected: Selection = null;
  let tool: 'select' | 'wire' = 'select';
  let armed: PaletteItem | null = null;
  /** Rozkreslený vodič: začiatok a zlomy; prázdne = nekreslí sa. */
  let wirePath: Pt[] = [];
  let hoverPt: Pt | null = null;
  /** Zmeny zapojenia počas zastavenia sa prejavia až po spustení. */
  let dirty = false;
  let drag: Drag = null;
  let slowed = false;
  const history: string[] = [];
  const drawings = new Map<string, PartDrawing>();
  const partGroups = new Map<string, SVGGElement>();
  let scopes: ScopePanel[] = [];

  // ------------------------------------------------------------------ plátno
  const defs = s('defs', null,
    s('pattern', { id: 'lab-grid', width: G, height: G, patternUnits: 'userSpaceOnUse' },
      s('circle', { cx: G / 2, cy: G / 2, r: 1.1, class: 'lab-grid-dot' })),
    ...[['red', '#ff3b2f'], ['yellow', '#ffc21a'], ['green', '#22d65a'], ['blue', '#3d7bff'], ['white', '#b9d2ff'], ['lamp', '#ffb22e']].map(([id, color]) =>
      s('radialGradient', { id: `lab-glow-${id}` },
        s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.95 }),
        s('stop', { offset: '50%', 'stop-color': color, 'stop-opacity': 0.45 }),
        s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }))),
  );
  const wiresLayer = s('g', { class: 'lab-wires' });
  const partsLayer = s('g', { class: 'lab-parts' });
  const dotsLayer = s('g', { class: 'lab-dots' });
  const overlay = s('g', { class: 'lab-overlay' });
  const termsLayer = s('g', { class: 'lab-terms' });
  const svg = s('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'sch lab-svg', role: 'application',
    'aria-label': 'Plocha na zapájanie obvodu', tabindex: '0',
  },
  defs,
  s('rect', { x: -G / 2, y: -G / 2, width: W + G, height: H + G, fill: 'url(#lab-grid)', class: 'lab-bg' }),
  wiresLayer, partsLayer, dotsLayer, overlay, termsLayer);
  const canvasWrap = h('div', { class: 'lab-canvas-wrap' }, svg);

  // ------------------------------------------------------------------ ovládacie prvky
  const status = h('p', { class: 'lab-status', 'aria-live': 'polite' });
  const timeOut = h('span', { class: 'lab-time' });
  const warningsBox = h('div', { class: 'lab-warnings', 'aria-live': 'polite' });
  const inspector = h('aside', { class: 'lab-inspector', 'aria-label': 'Vlastnosti' });
  const scopesBox = h('div', { class: 'lab-scopes' });
  const paletteButtons = new Map<string, HTMLButtonElement>();

  const toolBtn = (t: 'select' | 'wire', label: string, iconName: 'arrow' | 'plus') => {
    const b = h('button', { type: 'button', class: 'btn btn-sm lab-tool', 'aria-pressed': String(tool === t) }, icon(iconName, 16), label);
    b.addEventListener('click', () => {
      tool = t;
      const wasArmed = !!armed;
      armed = null;
      wirePath = [];
      syncTools();
      renderOverlay(null);
      if (wasArmed) renderInspector();
    });
    return b;
  };
  const selectTool = toolBtn('select', 'Vybrať a presúvať', 'arrow');
  const wireTool = toolBtn('wire', 'Kresliť vodič', 'plus');
  const undoBtn = h('button', { type: 'button', class: 'btn btn-sm btn-quiet', onClick: () => undo() }, icon('back', 16), 'Späť');
  const powerBtn = h('button', { type: 'button', class: 'btn btn-sm lab-power' });
  powerBtn.addEventListener('click', () => {
    powered = !powered;
    sim = null;
    dirty = false;
    rebuildSim(false);
    syncTools();
  });
  const stopBtn = h('button', { type: 'button', class: 'btn btn-sm lab-stop' });
  stopBtn.addEventListener('click', () => {
    running = !running;
    if (running && dirty) {
      dirty = false;
      rebuildSim(true);
      renderScopes();
    }
    status.textContent = running
      ? 'Obvod znova beží.'
      : 'Obvod je zastavený – merače a osciloskop ukazujú hodnoty v okamihu zastavenia. Zmeny v zapojení sa prejavia po spustení.';
    syncTools();
  });
  const cancelWireBtn = h('button', { type: 'button', class: 'btn btn-sm btn-quiet lab-cancel-wire', hidden: true },
    icon('close', 16), 'Zrušiť vodič');
  cancelWireBtn.addEventListener('click', () => cancelWire());
  const speedSel = h('select', { class: 'field-input', 'aria-label': 'Rýchlosť simulácie' },
    SPEEDS.map(([v, t]) => h('option', { value: v, selected: v === speed }, t)));
  speedSel.addEventListener('change', () => { speed = Number(speedSel.value); });
  const exampleSel = h('select', { class: 'field-input', 'aria-label': 'Ukážkové zapojenia' },
    h('option', { value: '' }, 'Ukážky zapojení…'),
    EXAMPLES.map((e) => h('option', { value: e.id }, e.title)),
    h('option', { value: '__empty' }, 'Prázdna doska'),
  );
  exampleSel.addEventListener('change', () => {
    const id = exampleSel.value;
    exampleSel.value = '';
    if (id) loadExample(id);
  });

  /** Nahradí zapojenie na doske ukážkou; tlačidlo Späť vráti pôvodné. */
  function loadExample(id: string): void {
    pushHistory();
    const ex = exampleById(id);
    circuit = ex ? ex.build() : { parts: [], wires: [] };
    selected = null;
    armed = null;
    wirePath = [];
    commit(false);
    status.textContent = ex
      ? `${ex.title}: ${ex.description} Tlačidlom Späť sa vrátiš k predchádzajúcemu zapojeniu.`
      : 'Doska je prázdna. Vyber súčiastku vľavo a klikni do mriežky.';
  }
  const zoomOut = h('button', { type: 'button', class: 'btn btn-sm btn-quiet', 'aria-label': 'Zmenšiť' }, '−');
  const zoomIn = h('button', { type: 'button', class: 'btn btn-sm btn-quiet', 'aria-label': 'Zväčšiť' }, '+');
  const zoomOutText = h('span', { class: 'lab-zoom' });
  const applyZoom = () => {
    const z = zoom ?? 1;
    svg.style.width = `${z * 100}%`;
    zoomOutText.textContent = `${Math.round(z * 100)} %`;
  };
  zoomOut.addEventListener('click', () => { zoom = ZOOMS[Math.max(0, ZOOMS.indexOf(zoom ?? 1) - 1)]; applyZoom(); });
  zoomIn.addEventListener('click', () => { zoom = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom ?? 1) + 1)]; applyZoom(); });

  function syncTools(): void {
    selectTool.setAttribute('aria-pressed', String(tool === 'select' && !armed));
    wireTool.setAttribute('aria-pressed', String(tool === 'wire' && !armed));
    paletteButtons.forEach((b, id) => b.setAttribute('aria-pressed', String(armed?.id === id)));
    undoBtn.disabled = history.length === 0;
    powerBtn.replaceChildren(icon('bolt', 16), powered ? 'Napájanie zapnuté' : 'Napájanie vypnuté');
    powerBtn.className = `btn btn-sm lab-power ${powered ? 'is-on' : ''}`;
    powerBtn.setAttribute('aria-pressed', String(powered));
    stopBtn.replaceChildren(running ? '■ Stop' : '▶ Spustiť');
    stopBtn.className = `btn btn-sm lab-stop ${running ? '' : 'is-stopped'}`;
    stopBtn.setAttribute('aria-pressed', String(!running));
    stopBtn.disabled = !powered;
    cancelWireBtn.hidden = wirePath.length === 0;
    svg.classList.toggle('is-wiring', tool === 'wire' || wirePath.length > 0);
    svg.classList.toggle('is-placing', !!armed);
    updateHint();
  }

  function updateHint(): void {
    if (armed) status.textContent = `Klikni do mriežky – vložíš: ${armed.label}. Pravé tlačidlo alebo Esc zruší.`;
    else if (wirePath.length) status.textContent = 'Kreslíš vodič: kliknutím do mriežky pridáš zlom, vodič sa dokončí na svorke alebo inom vodiči. Pravé tlačidlo myši alebo Esc ho zruší.';
    else if (tool === 'wire') status.textContent = 'Kreslenie vodičov: začni na svorke súčiastky alebo na vodiči.';
    else if (!status.textContent) status.textContent = 'Vodič nakreslíš ťahaním od svorky (krúžok) k inej svorke. Súčiastku presunieš ťahaním.';
  }

  // ------------------------------------------------------------------ paleta
  const palette = h('aside', { class: 'lab-palette', 'aria-label': 'Súčiastky a prístroje' },
    PALETTE.map((group) => h('div', { class: 'lab-palette-group' },
      h('p', { class: 'chip-group-title' }, group.title),
      h('div', { class: 'lab-palette-items' }, group.items.map((item) => {
        const b = h('button', { type: 'button', class: 'lab-palette-btn', 'aria-pressed': 'false', title: item.label },
          partIcon(item.kind, item.props), h('span', null, item.label));
        b.addEventListener('click', () => {
          armed = armed?.id === item.id ? null : item;
          wirePath = [];
          syncTools();
          renderOverlay(null);
          renderInspector();
        });
        paletteButtons.set(item.id, b);
        return b;
      })),
    )),
  );

  // ------------------------------------------------------------------ úpravy obvodu
  function pushHistory(snapshot = JSON.stringify(circuit)): void {
    history.push(snapshot);
    if (history.length > 80) history.shift();
  }

  function undo(): void {
    const prev = history.pop();
    if (!prev) return;
    circuit = parseCircuit(JSON.parse(prev)) ?? circuit;
    if (selected && !(selected.type === 'part' ? circuit.parts : circuit.wires).some((x) => x.id === selected!.id)) selected = null;
    commit(true);
  }

  function rebuildSim(keepState: boolean): void {
    sim = powered ? new Simulator(clone(circuit), keepState && sim ? sim.exportState() : undefined) : null;
  }

  /**
   * Po každej zmene: uložiť, znova postaviť simuláciu a prekresliť. Pri zastavenom obvode
   * zostanú zobrazené posledné namerané hodnoty a simulácia sa prestavia až po spustení.
   */
  function commit(keepState: boolean): void {
    saveCircuit(circuit);
    if (!running && keepState && sim) dirty = true;
    else {
      dirty = false;
      rebuildSim(keepState);
    }
    render();
    renderInspector();
    renderScopes();
    syncTools();
  }

  const partById = (id: string) => circuit.parts.find((p) => p.id === id);

  function attachedEnds(part: Part): { wire: Wire; end: 'a' | 'b'; orig: Pt; k: number }[] {
    const terms = terminalsOf(part);
    const out: { wire: Wire; end: 'a' | 'b'; orig: Pt; k: number }[] = [];
    for (const w of circuit.wires) {
      terms.forEach((t, k) => {
        if (same(w.a, t)) out.push({ wire: w, end: 'a', orig: [...w.a] as Pt, k });
        if (same(w.b, t)) out.push({ wire: w, end: 'b', orig: [...w.b] as Pt, k });
      });
    }
    return out;
  }

  function rotateSelected(): void {
    const part = selected?.type === 'part' ? partById(selected.id) : undefined;
    if (!part) return;
    pushHistory();
    const ends = attachedEnds(part);
    const c0 = centroid(terminalsOf(part));
    part.rot = ((part.rot + 1) % 4) as Rot;
    const c1 = centroid(terminalsOf(part));
    part.x += Math.round(c0[0] - c1[0]);
    part.y += Math.round(c0[1] - c1[1]);
    const terms = terminalsOf(part);
    for (const e of ends) e.wire[e.end] = [...terms[e.k]] as Pt;
    removeZeroWires();
    commit(true);
  }

  function deleteSelected(): void {
    if (!selected) return;
    pushHistory();
    if (selected.type === 'part') circuit.parts = circuit.parts.filter((p) => p.id !== selected!.id);
    else circuit.wires = circuit.wires.filter((w) => w.id !== selected!.id);
    selected = null;
    commit(true);
  }

  function removeZeroWires(): void {
    circuit.wires = circuit.wires.filter((w) => !same(w.a, w.b));
  }

  function setProp(part: Part, key: string, value: string | number | boolean): void {
    pushHistory();
    part.props[key] = value;
    commit(true);
  }

  function placeArmed(pt: Pt): void {
    if (!armed) return;
    const part = createPart(circuit, armed.kind, 0, 0, armed.props ?? {});
    const c = centroid(terminalsOf(part));
    part.x = Math.max(1, Math.min(COLS - 1, pt[0] - Math.round(c[0])));
    part.y = Math.max(1, Math.min(ROWS - 1, pt[1] - Math.round(c[1])));
    pushHistory();
    circuit.parts.push(part);
    selected = { type: 'part', id: part.id };
    armed = null;
    status.textContent = `${displayName(part)} ${part.name} je na doske. Spoj jej vývody vodičmi.`;
    commit(true);
  }

  /** Dá sa v bode p pripojiť vodič? Na svorke súčiastky alebo kdekoľvek na existujúcom vodiči. */
  function isConnectable(p: Pt): boolean {
    return circuit.parts.some((part) => terminalsOf(part).some((t) => same(t, p)))
      || circuit.wires.some((w) => same(w.a, p) || same(w.b, p) || onSegmentInterior(p, w));
  }

  function cancelWire(): void {
    if (!wirePath.length) return;
    wirePath = [];
    drag = null;
    renderOverlay(null);
    status.textContent = 'Kreslenie vodiča je zrušené.';
    syncTools();
  }

  /**
   * Ďalší bod vodiča. Vodič sa dokončí až v bode, kde sa dá pripojiť (svorka alebo vodič);
   * inde sa len pridá zlom a kreslí sa ďalej.
   */
  function wireStep(p: Pt): void {
    if (!wirePath.length) {
      wirePath = [p];
      renderOverlay(hoverPt ?? p);
      syncTools();
      return;
    }
    const last = wirePath[wirePath.length - 1];
    if (same(p, last)) return;
    for (const [, b] of routeWire(last, p)) wirePath.push(b);
    if (isConnectable(p)) commitWire();
    else {
      renderOverlay(hoverPt ?? p);
      syncTools();
    }
  }

  function commitWire(): void {
    const pts = wirePath;
    wirePath = [];
    renderOverlay(null);
    pushHistory();
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      if (same(a, b)) continue;
      const dup = circuit.wires.some((w) => (same(w.a, a) && same(w.b, b)) || (same(w.a, b) && same(w.b, a)));
      if (!dup) circuit.wires.push({ id: newId('w'), a, b });
    }
    status.textContent = '';
    commit(true);
  }

  // ------------------------------------------------------------------ kreslenie
  function render(): void {
    const nets = buildNets(circuit);
    drawings.clear();
    partGroups.clear();
    wiresLayer.replaceChildren(...circuit.wires.map((w) => {
      const sel = selected?.type === 'wire' && selected.id === w.id;
      const [x1, y1, x2, y2] = [w.a[0] * G, w.a[1] * G, w.b[0] * G, w.b[1] * G];
      return s('g', { class: `lab-wire ${sel ? 'is-selected' : ''}`, 'data-wire': w.id },
        s('line', { x1, y1, x2, y2, class: 'lab-wire-hit' }),
        s('line', { x1, y1, x2, y2, class: 'w lab-wire-line' }));
    }));
    partsLayer.replaceChildren(...circuit.parts.map((part) => {
      const d = drawPart(part);
      drawings.set(part.id, d);
      const box = hitBox(part);
      const sel = selected?.type === 'part' && selected.id === part.id;
      const g = s('g', { class: `lab-part-g ${sel ? 'is-selected' : ''}`, 'data-part': part.id },
        s('rect', { ...box, rx: 6, class: 'lab-hit' }), d.g);
      partGroups.set(part.id, g);
      return g;
    }));
    dotsLayer.replaceChildren(...nets.junctions.map(([x, y]) => s('circle', { cx: x * G, cy: y * G, r: 3.4, class: 'dot' })));
    const open = new Set(nets.openTerminals.map(([x, y]) => `${x},${y}`));
    termsLayer.replaceChildren(...circuit.parts.flatMap((part) => terminalsOf(part).map(([x, y], k) => s('g', null,
      open.has(`${x},${y}`) ? s('circle', { cx: x * G, cy: y * G, r: 3.6, class: 'lab-open' }) : null,
      s('circle', {
        cx: x * G, cy: y * G, r: 10, class: 'lab-term', 'data-term': `${part.id}:${k}`,
      }, s('title', null, `${part.name} – vývod ${KINDS[part.kind].terminalNames[k]}`)),
    ))));
    updateLive(true);
  }

  function renderOverlay(pt: Pt | null): void {
    overlay.replaceChildren();
    if (wirePath.length) {
      const seg = (a: Pt, b: Pt, cls: string) => overlay.append(s('line', { x1: a[0] * G, y1: a[1] * G, x2: b[0] * G, y2: b[1] * G, class: cls }));
      for (let i = 1; i < wirePath.length; i++) seg(wirePath[i - 1], wirePath[i], 'lab-pending');
      const last = wirePath[wirePath.length - 1];
      if (pt) for (const [a, b] of routeWire(last, pt)) seg(a, b, 'lab-preview');
      for (const [x, y] of wirePath) overlay.append(s('circle', { cx: x * G, cy: y * G, r: 3.5, class: 'lab-preview-dot' }));
      if (pt && isConnectable(pt)) overlay.append(s('circle', { cx: pt[0] * G, cy: pt[1] * G, r: 9, class: 'lab-target' }));
    } else if (armed && pt) {
      const ghost = createPart(circuit, armed.kind, 0, 0, armed.props ?? {});
      const c = centroid(terminalsOf(ghost));
      ghost.x = pt[0] - Math.round(c[0]);
      ghost.y = pt[1] - Math.round(c[1]);
      const g = drawPart(ghost, true).g;
      g.classList.add('lab-ghost');
      overlay.append(g);
    }
  }

  // ------------------------------------------------------------------ živé hodnoty
  let lastPanels = 0;
  function updateLive(force = false): void {
    const hasAC = sim?.hasAC ?? false;
    const warned = new Set((sim?.warnings() ?? []).map((w) => w.part));
    for (const part of circuit.parts) {
      const d = drawings.get(part.id);
      const st = sim?.states.get(part.id);
      if (!d) continue;
      if (d.display) {
        const r = sim && st ? meterReading(part, st, hasAC) : null;
        d.display.textContent = !r ? '—' : r.value === null ? 'OL' : fmtValue(r.value, r.unit);
      }
      if (d.glow) {
        const b = glowLevel(part, st, hasAC);
        d.glow.setAttribute('opacity', b < 0.005 ? '0' : String((0.25 + 0.75 * Math.sqrt(b)).toFixed(2)));
      }
      if (d.body && st) {
        const pmax = num(part.props.pmax, 0.25);
        const heat = Math.min(1, Math.sqrt(Math.max(0, hasAC ? st.mp : st.p) / (pmax * 2)));
        d.body.style.fill = `color-mix(in srgb, var(--copper) ${Math.round(heat * 85)}%, var(--surface))`;
      } else if (d.body) {
        d.body.style.fill = '';
      }
      partGroups.get(part.id)?.classList.toggle('has-warning', warned.has(part.id));
    }
    const now = performance.now();
    if (force || now - lastPanels > 120) {
      lastPanels = now;
      renderWarnings();
      updateInspectorLive();
      scopes.forEach((sc) => sc.update(sim));
      timeOut.textContent = !sim ? 'vypnuté' : `t = ${formatSI(sim.time, 's', 3)}${!running ? ' · zastavené' : slowed ? ' · spomalené' : ''}`;
    }
  }

  function renderWarnings(): void {
    if (!sim) {
      warningsBox.replaceChildren(h('p', { class: 'muted' }, 'Napájanie je vypnuté – zapni ho tlačidlom nad schémou.'));
      return;
    }
    if (sim.error) {
      warningsBox.replaceChildren(h('p', { class: 'lab-warning' }, icon('bolt', 16), sim.error));
      return;
    }
    const list = sim.warnings();
    warningsBox.replaceChildren(...list.map((w) => {
      const b = h('button', { type: 'button', class: 'lab-warning' }, icon('bolt', 16), w.text);
      b.addEventListener('click', () => {
        selected = { type: 'part', id: w.part };
        render();
        renderInspector();
      });
      return b;
    }));
  }

  // ------------------------------------------------------------------ vlastnosti súčiastky
  let liveRows: { set: (st: PartState | undefined) => void } | null = null;

  function propField(part: Part, def: PropDef): HTMLElement {
    const id = `lab-prop-${def.key}`;
    if (def.options) {
      const sel = h('select', { id, class: 'field-input' },
        def.options.map(([v, t]) => h('option', { value: v, selected: String(part.props[def.key]) === v }, t)));
      sel.addEventListener('change', () => setProp(part, def.key, sel.value));
      return h('div', { class: 'field' }, h('label', { for: id }, def.label), h('div', { class: 'field-box' }, sel),
        def.hint ? h('p', { class: 'field-hint' }, def.hint) : null);
    }
    const unit = def.unit ?? '';
    const value = num(part.props[def.key], 0);
    const input = h('input', {
      id, class: 'field-input', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false',
      value: unit ? formatSI(value, '', 6).trim() : String(value).replace('.', ','),
    });
    const err = h('p', { class: 'field-error', hidden: true });
    input.addEventListener('change', () => {
      const v = parseQuantity(input.value, unit);
      const ok = Number.isFinite(v) && v >= (def.min ?? -Infinity) && v <= (def.max ?? Infinity);
      input.classList.toggle('is-invalid', !ok);
      err.hidden = ok;
      if (!ok) {
        err.textContent = `Zadaj hodnotu od ${formatSI(def.min ?? 0, unit, 3)} do ${formatSI(def.max ?? 0, unit, 3)}.`;
        return;
      }
      setProp(part, def.key, v);
    });
    return h('div', { class: 'field' },
      h('label', { for: id }, def.label),
      h('div', { class: 'field-box' }, input, unit ? h('span', { class: 'field-unit' }, unit) : null),
      def.hint ? h('p', { class: 'field-hint' }, def.hint) : null,
      err,
    );
  }

  function readingRows(part: Part): { el: HTMLElement; set: (st: PartState | undefined) => void } {
    const dl = h('dl', { class: 'lab-readings' });
    const set = (st: PartState | undefined) => {
      if (!sim || !st) {
        dl.replaceChildren(h('div', null, h('dt', null, 'Napájanie'), h('dd', null, 'vypnuté')));
        return;
      }
      const ac = sim.hasAC;
      const rows: [string, string][] = [];
      const ef = (m2: number) => Math.sqrt(Math.max(0, m2));
      const u = ac ? ef(st.mu2) : st.u;
      const i = ac ? ef(st.mi2) : st.i;
      const p = ac ? st.mp : st.p;
      const suffix = ac ? ' (ef.)' : '';
      const reading = meterReading(part, st, ac);
      switch (part.kind) {
        case 'ammeter':
        case 'voltmeter':
        case 'multimeter':
        case 'wattmeter':
          rows.push(['Údaj prístroja', !reading ? '—' : reading.value === null ? 'OL – prekročený rozsah' : fmtValue(reading.value, reading.unit)]);
          break;
        case 'scope':
          rows.push(['CH1 (okamžite)', fmtValue(st.extra.v1 ?? 0, 'V')], ['CH2 (okamžite)', fmtValue(st.extra.v2 ?? 0, 'V')]);
          break;
        case 'bjt': {
          const ic = st.extra.ic ?? 0;
          const uce = st.extra.uce ?? 0;
          const pnp = part.props.type === 'pnp';
          const mode = Math.abs(ic) < 1e-6 ? 'zatvorený' : (pnp ? uce > -0.25 : uce < 0.25) ? 'otvorený – v nasýtení' : 'otvorený – aktívny režim';
          rows.push(['U_BE', fmtValue(st.extra.ube ?? 0, 'V')], ['U_CE', fmtValue(uce, 'V')],
            ['I_B', fmtValue(st.extra.ib ?? 0, 'A')], ['I_C', fmtValue(ic, 'A')], ['Stav', mode]);
          break;
        }
        case 'mosfet': {
          const id = st.extra.id ?? 0;
          rows.push(['U_GS', fmtValue(st.extra.ugs ?? 0, 'V')], ['U_DS', fmtValue(st.extra.uds ?? 0, 'V')],
            ['I_D', fmtValue(id, 'A')], ['Stav', Math.abs(id) < 1e-6 ? 'zatvorený' : 'otvorený – vedie']);
          break;
        }
        case 'dc':
        case 'ac':
          rows.push([`Napätie na svorkách${suffix}`, fmtValue(u, 'V')], [`Dodávaný prúd${suffix}`, fmtValue(i, 'A')], ['Dodávaný výkon', fmtValue(p, 'W')]);
          break;
        default:
          rows.push([`Napätie U${suffix}`, fmtValue(u, 'V')], [`Prúd I${suffix}`, fmtValue(i, 'A')], ['Výkon P', fmtValue(p, 'W')]);
          if (part.kind === 'lamp') rows.push(['Svieti na', `${Math.round((100 * Math.max(0, p)) / num(part.props.P, 5))} % menovitého výkonu`]);
      }
      dl.replaceChildren(...rows.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v))));
    };
    return { el: dl, set };
  }

  // ------------------------------------------------------------------ ukážky zapojenia
  const dialogBody = h('div', { class: 'lab-dialog-body' });
  const dialog = h('dialog', { class: 'lab-dialog', 'aria-label': 'Ukážka zapojenia' },
    h('div', { class: 'lab-dialog-head' },
      h('p', { class: 'eyebrow' }, 'Ukážka zapojenia'),
      h('button', { type: 'button', class: 'btn btn-sm btn-quiet', onClick: () => dialog.close?.() }, icon('close', 16), 'Zavrieť'),
    ),
    dialogBody,
  );
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close?.();
  });

  /** Náhľad, ako sa súčiastka zapája, s tlačidlom na otvorenie ukážky na doske. */
  function demoSection(paletteId: string): HTMLElement | null {
    const ex = exampleById(DEMO_FOR[paletteId] ?? '');
    const item = PALETTE.flatMap((g) => g.items).find((i) => i.id === paletteId);
    if (!ex || !item) return null;
    const focus = (p: Part) => paletteIdOf(p.kind, p.props) === paletteId;
    const preview = () => circuitPreview(`${ex.id}:${paletteId}`, ex.title, ex.build(), focus);
    const open = h('button', { type: 'button', class: 'btn btn-sm btn-primary' }, 'Otvoriť ukážku na doske');
    open.addEventListener('click', () => {
      dialog.close?.();
      loadExample(ex.id);
      canvasWrap.scrollIntoView?.({ block: 'nearest' });
    });
    const thumb = h('button', { type: 'button', class: 'lab-demo-thumb', title: 'Zväčšiť ukážku' }, preview());
    thumb.addEventListener('click', () => {
      const openBig = h('button', { type: 'button', class: 'btn btn-primary' }, 'Otvoriť ukážku na doske');
      openBig.addEventListener('click', () => open.click());
      dialogBody.replaceChildren(
        h('h3', null, ex.title),
        h('div', { class: 'lab-dialog-preview' }, preview()),
        h('p', { class: 'lab-help' }, ex.description),
        h('p', { class: 'lab-help' }, `${item.label}: ${HELP[item.kind]}`),
        openBig,
      );
      if (typeof dialog.showModal === 'function') dialog.showModal();
    });
    return h('section', { class: 'lab-demo', 'aria-label': `Ukážka zapojenia: ${item.label}` },
      h('p', { class: 'eyebrow' }, 'Ukážka zapojenia'),
      h('p', { class: 'lab-demo-title' }, ex.title),
      thumb,
      h('p', { class: 'lab-help' }, ex.description),
      open,
    );
  }

  function renderInspector(): void {
    liveRows = null;
    if (armed && !(selected?.type === 'part')) {
      const item = armed;
      inspector.replaceChildren(frag(
        h('p', { class: 'eyebrow' }, 'Vkladáš'),
        h('h3', null, item.label),
        h('p', { class: 'lab-help' }, HELP[item.kind]),
        h('p', { class: 'lab-help lab-strong' }, 'Klikni do mriežky na miesto, kam ju chceš dať. Pravé tlačidlo alebo Esc vkladanie zruší.'),
        demoSection(item.id),
      ));
      return;
    }
    const part = selected?.type === 'part' ? partById(selected.id) : undefined;
    if (part) {
      const rows = readingRows(part);
      liveRows = rows;
      const info = KINDS[part.kind];
      inspector.replaceChildren(frag(
        h('p', { class: 'eyebrow' }, part.name),
        h('h3', null, displayName(part)),
        h('p', { class: 'lab-help' }, HELP[part.kind]),
        part.kind === 'switch'
          ? h('button', {
            type: 'button', class: `btn ${part.props.on ? 'btn-done' : 'btn-primary'}`,
            onClick: () => setProp(part, 'on', !part.props.on),
          }, part.props.on ? 'Zapnutý – vypnúť' : 'Vypnutý – zapnúť')
          : null,
        part.kind === 'scope' ? null : info.props.map((d) => propField(part, d)),
        rows.el,
        h('p', { class: 'lab-terms-info' }, 'Vývody: ', info.terminalNames.join(', ')),
        h('div', { class: 'lab-insp-actions' },
          h('button', { type: 'button', class: 'btn btn-sm btn-secondary', onClick: rotateSelected }, 'Otočiť (R)'),
          h('button', { type: 'button', class: 'btn btn-sm btn-quiet lab-delete', onClick: deleteSelected }, 'Zmazať (Del)'),
        ),
        demoSection(paletteIdOf(part.kind, part.props)),
      ));
      rows.set(sim?.states.get(part.id));
      return;
    }
    if (selected?.type === 'wire') {
      inspector.replaceChildren(
        h('p', { class: 'eyebrow' }, 'Vodič'),
        h('h3', null, 'Vodič'),
        h('p', { class: 'lab-help' }, 'Vodiče sa spájajú na koncoch a v bode, kde koniec jedného leží na druhom (spoj označuje bodka). Kríženie bez bodky nie je spoj.'),
        h('div', { class: 'lab-insp-actions' },
          h('button', { type: 'button', class: 'btn btn-sm btn-quiet lab-delete', onClick: deleteSelected }, 'Zmazať vodič (Del)')),
      );
      return;
    }
    inspector.replaceChildren(
      h('p', { class: 'eyebrow' }, 'Ako na to'),
      h('h3', null, 'Zapájanie'),
      h('ol', { class: 'lab-steps' },
        h('li', null, 'Vyber súčiastku alebo prístroj v zozname a klikni do mriežky. Tu vpravo hneď uvidíš ukážku, ako sa zapája.'),
        h('li', null, 'Vodič začni na svorke (krúžok na konci vývodu). Kliknutím do mriežky pridáš zlom – vodič sa dokončí, až keď ho privedieš na svorku alebo iný vodič. Pravé tlačidlo myši alebo Esc kreslenie zruší.'),
        h('li', null, 'Kliknutím súčiastku vyberieš – tu jej nastavíš hodnotu, otočíš ju alebo zmažeš. Ťahaním ju presunieš.'),
        h('li', null, 'Spínač prepneš kliknutím. Merače ukazujú hodnoty priamo v schéme. Stop zastaví obvod a hodnoty na meračoch ostanú.'),
      ),
      h('p', { class: 'lab-help' }, 'Skratky: R otočí, Delete zmaže, Esc zruší, Ctrl + Z vráti späť.'),
    );
  }

  function updateInspectorLive(): void {
    if (liveRows && selected?.type === 'part') liveRows.set(sim?.states.get(selected.id));
  }

  function renderScopes(): void {
    scopes = circuit.parts.filter((p) => p.kind === 'scope').map((part) => scopePanel(part, (key, value) => {
      const p = partById(part.id);
      if (p) setProp(p, key, value);
    }));
    scopesBox.replaceChildren(...scopes.map((sc) => sc.el));
    scopesBox.hidden = scopes.length === 0;
    scopes.forEach((sc) => sc.update(sim));
  }

  // ------------------------------------------------------------------ myš a dotyk
  const toGrid = (e: PointerEvent): Pt => {
    const r = svg.getBoundingClientRect();
    const x = r.width ? ((e.clientX - r.left) / r.width) * W : 0;
    const y = r.height ? ((e.clientY - r.top) / r.height) * H : 0;
    return [Math.max(0, Math.min(COLS, Math.round(x / G))), Math.max(0, Math.min(ROWS, Math.round(y / G)))];
  };

  const termPoint = (el: Element | null | undefined): Pt | null => {
    const term = el?.closest?.('[data-term]');
    if (!term) return null;
    const [id, k] = term.getAttribute('data-term')!.split(':');
    const part = partById(id);
    return part ? terminalsOf(part)[Number(k)] : null;
  };

  // Pravé tlačidlo myši zruší rozkreslený vodič alebo vkladanie súčiastky.
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  svg.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      if (e.button === 2) {
        e.preventDefault();
        if (wirePath.length) cancelWire();
        else if (armed) {
          armed = null;
          renderOverlay(null);
          syncTools();
          renderInspector();
        }
      }
      return;
    }
    const pt = toGrid(e);
    hoverPt = pt;
    const target = e.target as Element;
    if (armed) {
      e.preventDefault();
      placeArmed(pt);
      return;
    }
    const tp = termPoint(target);
    if (wirePath.length) {
      e.preventDefault();
      wireStep(tp ?? pt);
      return;
    }
    if (tp || (tool === 'wire' && isConnectable(pt))) {
      e.preventDefault();
      const start = tp ?? pt;
      wireStep(start);
      drag = { kind: 'wire', start, moved: false };
      svg.setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === 'wire') {
      status.textContent = 'Vodič začni na svorke súčiastky (krúžok) alebo na existujúcom vodiči.';
      return;
    }
    const partEl = target.closest('[data-part]');
    if (partEl) {
      e.preventDefault();
      const id = partEl.getAttribute('data-part')!;
      const part = partById(id)!;
      const changed = !(selected?.type === 'part' && selected.id === id);
      selected = { type: 'part', id };
      drag = {
        kind: 'part', id, start: pt, origin: [part.x, part.y], moved: false, before: JSON.stringify(circuit),
        ends: attachedEnds(part).map(({ wire, end, orig }) => ({ wire, end, orig })),
      };
      svg.setPointerCapture?.(e.pointerId);
      if (changed) {
        render();
        renderInspector();
      }
      return;
    }
    const wireEl = target.closest('[data-wire]');
    if (wireEl) {
      selected = { type: 'wire', id: wireEl.getAttribute('data-wire')! };
      render();
      renderInspector();
      return;
    }
    if (selected) {
      selected = null;
      render();
      renderInspector();
    }
  });

  svg.addEventListener('pointermove', (e) => {
    const pt = toGrid(e);
    if (drag?.kind === 'part') {
      const part = partById(drag.id);
      if (!part) return;
      const nx = drag.origin[0] + pt[0] - drag.start[0];
      const ny = drag.origin[1] + pt[1] - drag.start[1];
      if (nx === part.x && ny === part.y) return;
      if (!drag.moved) pushHistory(drag.before);
      drag.moved = true;
      const dx = nx - drag.origin[0];
      const dy = ny - drag.origin[1];
      part.x = nx;
      part.y = ny;
      for (const end of drag.ends) end.wire[end.end] = [end.orig[0] + dx, end.orig[1] + dy];
      render();
      return;
    }
    hoverPt = pt;
    if (drag?.kind === 'wire' && !same(pt, drag.start)) drag.moved = true;
    if (wirePath.length || armed) renderOverlay(pt);
  });

  const endPointer = (e: PointerEvent) => {
    const current = drag;
    drag = null;
    if (!current) return;
    if (current.kind === 'part') {
      if (current.moved) {
        removeZeroWires();
        commit(true);
      } else {
        const part = partById(current.id);
        if (part?.kind === 'switch') setProp(part, 'on', !part.props.on);
      }
    } else if (current.kind === 'wire' && current.moved && e.type === 'pointerup' && wirePath.length) {
      // Ťahanie od svorky: pustenie na svorke alebo vodiči vodič dokončí, inde pridá zlom.
      const p = termPoint(document.elementFromPoint?.(e.clientX, e.clientY)) ?? toGrid(e);
      if (!same(p, current.start)) wireStep(p);
    }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('pointerleave', () => {
    if (!drag && armed) renderOverlay(null);
  });

  const onKey = (e: KeyboardEvent) => {
    if (!root.isConnected) {
      document.removeEventListener('keydown', onKey);
      return;
    }
    const t = e.target as HTMLElement | null;
    if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selected) {
        e.preventDefault();
        deleteSelected();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      if (selected?.type === 'part') rotateSelected();
    } else if (e.key === 'Escape') {
      const wasArmed = !!armed;
      armed = null;
      cancelWire();
      drag = null;
      renderOverlay(null);
      syncTools();
      if (wasArmed) renderInspector();
    }
  };
  document.addEventListener('keydown', onKey);

  // ------------------------------------------------------------------ simulácia v čase
  let last = 0;
  const frame = (t: number) => {
    if (!root.isConnected && last !== 0) return;
    const realDt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (sim && running && realDt > 0) slowed = !sim.advance(realDt * speed);
    updateLive();
    requestAnimationFrame(frame);
  };

  const root = h('div', { class: 'view view-lab' },
    pageHead('Laboratórium', 'Zapájanie obvodov',
      'Poskladaj obvod zo súčiastok, pripoj meracie prístroje a sleduj, čo sa deje. Obvod sa počíta priebežne – prepni spínač a hneď uvidíš zmenu.'),
    h('div', { class: 'lab' },
      palette,
      h('div', { class: 'lab-main' },
        h('div', { class: 'lab-toolbar' },
          h('div', { class: 'lab-tool-group' }, selectTool, wireTool, undoBtn, cancelWireBtn),
          h('div', { class: 'lab-tool-group' }, powerBtn, stopBtn, h('div', { class: 'field-box lab-select' }, speedSel), timeOut),
          h('div', { class: 'lab-tool-group' }, h('div', { class: 'field-box lab-select' }, exampleSel), zoomOut, zoomOutText, zoomIn),
        ),
        canvasWrap,
        status,
        warningsBox,
        scopesBox,
      ),
      inspector,
    ),
    dialog,
  );

  if (zoom === null) zoom = typeof window !== 'undefined' && window.innerWidth < 760 ? 3 : 1;
  applyZoom();
  rebuildSim(false);
  render();
  renderInspector();
  renderScopes();
  syncTools();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
  return root;
}
