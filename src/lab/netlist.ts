/**
 * Z polôh súčiastok a vodičov zistí uzly obvodu. Spojené sú body na tom istom mieste mriežky,
 * oba konce vodiča a bod, ktorý leží na vodiči (odbočka „T“). Kríženie dvoch vodičov nie je spoj.
 */
import { KINDS, terminalsOf, type Circuit, type Pt, type Wire } from './parts';

export const key = ([x, y]: Pt): string => `${x},${y}`;

class UnionFind {
  private parent = new Map<string, string>();

  find(k: string): string {
    if (!this.parent.has(k)) this.parent.set(k, k);
    let root = k;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = k;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Leží bod p vo vnútri úsečky w (nie na jej konci)? */
export function onSegmentInterior(p: Pt, w: Pick<Wire, 'a' | 'b'>): boolean {
  const [px, py] = p;
  const [ax, ay] = w.a;
  const [bx, by] = w.b;
  if ((px === ax && py === ay) || (px === bx && py === by)) return false;
  const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if (cross !== 0) return false;
  return px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
}

export interface Nets {
  /** Číslo uzla pre každý vývod každej súčiastky (podľa id súčiastky). */
  partNodes: Map<string, number[]>;
  nodeCount: number;
  /** Body, kde sa stretávajú aspoň tri spojenia – kreslí sa bodka. */
  junctions: Pt[];
  /** Vývody, ku ktorým nie je nič pripojené. */
  openTerminals: Pt[];
}

export function buildNets(circuit: Circuit): Nets {
  const uf = new UnionFind();
  const points = new Map<string, Pt>();
  const degree = new Map<string, number>();
  const bump = (p: Pt, n = 1) => {
    const k = key(p);
    points.set(k, p);
    degree.set(k, (degree.get(k) ?? 0) + n);
    uf.find(k);
  };

  const terminals = circuit.parts.map((p) => terminalsOf(p));
  terminals.flat().forEach((t) => bump(t));
  // Vývody spojené vo vnútri súčiastky (všetky GND Arduina, oba COM displeja).
  circuit.parts.forEach((p, i) => {
    for (const group of KINDS[p.kind].bridges ?? []) {
      for (const k of group.slice(1)) uf.union(key(terminals[i][group[0]]), key(terminals[i][k]));
    }
  });
  for (const w of circuit.wires) {
    if (w.a[0] === w.b[0] && w.a[1] === w.b[1]) continue;
    bump(w.a);
    bump(w.b);
    uf.union(key(w.a), key(w.b));
  }
  // Odbočky: koniec vodiča alebo vývod ležiaci vo vnútri iného vodiča.
  const pointList = [...points.values()];
  for (const w of circuit.wires) {
    for (const p of pointList) {
      if (onSegmentInterior(p, w)) {
        uf.union(key(p), key(w.a));
        degree.set(key(p), (degree.get(key(p)) ?? 0) + 2);
      }
    }
  }

  const ids = new Map<string, number>();
  const nodeOf = (p: Pt): number => {
    const root = uf.find(key(p));
    let id = ids.get(root);
    if (id === undefined) {
      id = ids.size;
      ids.set(root, id);
    }
    return id;
  };
  const partNodes = new Map<string, number[]>();
  circuit.parts.forEach((part, i) => partNodes.set(part.id, terminals[i].map(nodeOf)));
  for (const p of pointList) nodeOf(p);

  // Moduly s mnohými pinmi (Arduino) nemusia mať zapojené všetky vývody.
  const terminalKeys = new Set(circuit.parts.flatMap((p, i) => (KINDS[p.kind].optionalPins ? [] : terminals[i].map(key))));
  return {
    partNodes,
    nodeCount: ids.size,
    junctions: pointList.filter((p) => (degree.get(key(p)) ?? 0) >= 3),
    openTerminals: pointList.filter((p) => terminalKeys.has(key(p)) && degree.get(key(p)) === 1),
  };
}

/** Trasa nového vodiča: rovno, alebo do „L“ (najprv vodorovne, potom zvisle). */
export function routeWire(a: Pt, b: Pt): [Pt, Pt][] {
  if (a[0] === b[0] && a[1] === b[1]) return [];
  if (a[0] === b[0] || a[1] === b[1]) return [[a, b]];
  const corner: Pt = [b[0], a[1]];
  return [[a, corner], [corner, b]];
}
