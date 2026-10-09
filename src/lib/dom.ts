export type Child = Node | string | number | null | undefined | false | Child[];
export type Attrs = Record<string, unknown>;

const SVG_NS = 'http://www.w3.org/2000/svg';

function setAttrs(el: Element, attrs?: Attrs | null): void {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign((el as HTMLElement).style, value);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

function append(el: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
    else el.appendChild(child);
  }
}

/** Vytvorí HTML element: h('p', { class: 'x', onClick }, 'text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

/** Vytvorí SVG element. */
export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, attrs);
  append(el, children);
  return el;
}

export function frag(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}
