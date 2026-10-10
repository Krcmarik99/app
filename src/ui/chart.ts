import { s } from '../lib/dom';

export interface Axis {
  min: number;
  max: number;
  ticks: number[];
  format: (v: number) => string;
  label: string;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  x: Axis;
  y: Axis;
  series: { points: [number, number][]; className?: string }[];
  hlines?: { y: number; label: string }[];
  /** Zvislé čiary (napr. medzná frekvencia). */
  vlines?: { x: number; label: string }[];
  markers?: { x: number; y: number; label: string; above?: boolean }[];
  /** Legenda pri viacerých priebehoch. */
  legend?: { label: string; className?: string }[];
  ariaLabel: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Popis dielika osi x; pri pravom okraji sa zarovná doprava, aby sa neorezal. */
function xTick(x: number, y: number, text: string, width: number): SVGTextElement {
  const half = text.length * 3.6;
  const atEdge = x + half > width - 2;
  return s('text', { x: r1(atEdge ? width - 2 : x), y, 'text-anchor': atEdge ? 'end' : 'middle', class: 'tick' }, text);
}

/** Popis v legende; „X_L“ sa vysadí ako veličina kurzívou s dolným indexom. */
function legendText(x: number, label: string): SVGTextElement {
  const t = s('text', { x, y: 16, class: 'legend-text' });
  const [main, sub] = label.split('_');
  if (sub === undefined) {
    t.append(label);
    return t;
  }
  t.append(s('tspan', { 'font-style': 'italic' }, main), s('tspan', { dy: '0.3em', 'font-size': '0.75em' }, sub));
  return t;
}

export function lineChart(o: ChartOptions): SVGSVGElement {
  const W = o.width ?? 420;
  const H = o.height ?? 230;
  const m = { l: 50, r: 18, t: o.legend?.length ? 46 : 24, b: 44 };
  const sx = (v: number) => m.l + ((v - o.x.min) / (o.x.max - o.x.min)) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - ((v - o.y.min) / (o.y.max - o.y.min)) * (H - m.t - m.b);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, class: 'chart', role: 'img', 'aria-label': o.ariaLabel }, s('title', null, o.ariaLabel));

  for (const t of o.y.ticks) {
    svg.append(
      s('line', { x1: m.l, x2: W - m.r, y1: r1(sy(t)), y2: r1(sy(t)), class: t === 0 ? 'axis' : 'grid' }),
      s('text', { x: m.l - 7, y: r1(sy(t) + 4), 'text-anchor': 'end', class: 'tick' }, o.y.format(t)),
    );
  }
  for (const t of o.x.ticks) {
    svg.append(
      s('line', { x1: r1(sx(t)), x2: r1(sx(t)), y1: m.t, y2: H - m.b, class: t === o.x.min ? 'axis' : 'grid' }),
      xTick(sx(t), H - m.b + 17, o.x.format(t), W),
    );
  }
  svg.append(
    s('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end', class: 'axis-label' }, o.x.label),
    s('text', { x: 4, y: m.t - 11, class: 'axis-label' }, o.y.label),
  );

  for (const hl of o.hlines ?? []) {
    svg.append(
      s('line', { x1: m.l, x2: W - m.r, y1: r1(sy(hl.y)), y2: r1(sy(hl.y)), class: 'hline' }),
      s('text', { x: W - m.r - 4, y: r1(sy(hl.y) - 6), 'text-anchor': 'end', class: 'hline-label' }, hl.label),
    );
  }

  for (const vl of o.vlines ?? []) {
    svg.append(
      s('line', { x1: r1(sx(vl.x)), x2: r1(sx(vl.x)), y1: m.t, y2: H - m.b, class: 'hline' }),
      s('text', { x: r1(sx(vl.x) + 5), y: m.t + 12, class: 'hline-label' }, vl.label),
    );
  }

  // Body mimo rozsahu osi y sa orežú, aby čiara neprešla cez popisy.
  const clipId = `clip-${Math.random().toString(36).slice(2, 9)}`;
  svg.append(s('clipPath', { id: clipId }, s('rect', { x: m.l, y: m.t - 2, width: W - m.l - m.r, height: H - m.t - m.b + 4 })));
  for (const series of o.series) {
    const d = series.points.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(sx(x))} ${r1(sy(Math.max(o.y.min - (o.y.max - o.y.min), Math.min(o.y.max + (o.y.max - o.y.min), y))))}`).join('');
    svg.append(s('path', { d, class: `line ${series.className ?? ''}`.trim(), 'clip-path': `url(#${clipId})` }));
  }

  if (o.legend?.length) {
    let x = m.l;
    for (const item of o.legend) {
      svg.append(
        s('line', { x1: x, x2: x + 18, y1: 12, y2: 12, class: `line legend-swatch ${item.className ?? ''}`.trim() }),
        legendText(x + 23, item.label),
      );
      x += 32 + item.label.length * 6.6;
    }
  }

  for (const mk of o.markers ?? []) {
    const x = sx(mk.x);
    const y = sy(mk.y);
    const nearRight = x > W - m.r - 70;
    svg.append(
      s('line', { x1: r1(x), x2: r1(x), y1: r1(y), y2: H - m.b, class: 'drop' }),
      s('circle', { cx: r1(x), cy: r1(y), r: 4, class: 'marker' }),
      s('text', { x: r1(nearRight ? x - 8 : x + 8), y: r1(mk.above ? y - 9 : y + 15), 'text-anchor': nearRight ? 'end' : 'start', class: 'marker-label' }, mk.label),
    );
  }
  return svg;
}

/** Rovnomerne rozložené body funkcie na intervale. */
export function sample(fn: (x: number) => number, min: number, max: number, n = 120): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = min + ((max - min) * i) / n;
    return [x, fn(x)];
  });
}
