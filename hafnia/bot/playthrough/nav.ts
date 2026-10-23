// Getting around the city: which map leads to which (edge exits, doors, doormats and the few
// talk-to-travel spots), and a route finder over that graph. `goto(p, 'nyhavn')` walks there from
// anywhere the story has opened.
import type { Dir } from '@hafnia/core';
import type { Player } from './driver';
import { DIRS, doorOf, findPath, mapDef, solid } from '../lib/world';

type Hop = { to: string; how: (p: Player) => void; cost: number };

/** Building doors: map -> door id -> the map it opens onto. */
const DOORS: Record<string, Record<string, string>> = {
  norrebro: { home: 'flat', lukas: 'lukasflat', pc: 'pcnorrebro', gym: 'gym1' },
  garden: { palm: 'palmhouse' },
  indreby: { pc: 'pcindreby', tower: 'towerin' },
  nyhavn: { cafe: 'cafein' },
  christianshavn: { pc: 'pcchristianshavn' },
  stadsgraven: { gym: 'gym2' },
  vesterbro: { cafe: 'cafevb', pc: 'pcvesterbro', bakery: 'bakery' },
  kodbyen: { kitchen: 'kitchen', gym: 'gym3' },
  frederiksberg: { pc: 'pcfrederiksberg', cisterns: 'cisterns' },
  osterbro: { kastellet: 'kastellet', pc: 'pcosterbro' },
  dyrehaven: { substation: 'substation' },
  bakken: { gym: 'gym6', pc: 'pcbakken' },
  trekroner: { lighthouse: 'tklighthouse', battery: 'battery', siphon: 'siphon' },
  slotsholmen: { borsen: 'borsen', pc: 'pcslotsholmen', palace: 'leaguehall' },
  copenhill: { plant: 'gym8', pc: 'pccopenhill' },
  helsingor: { kronborg: 'casemates', pc: 'pchelsingor' }
};
/** Things you talk to that move you. */
/** The player whose story flags gate hops (`needs`); set by goto. */
let current: Player | null = null;
const TALK: Record<string, { to: string; x: number; y: number; pick?: string; needs?: string }[]> = {
  garden: [{ to: 'tunnels', x: 23, y: 10 }],
  nyhavn: [{ to: 'drydock', x: 22, y: 11 }],
  drydock: [{ to: 'nyhavn', x: 1, y: 2 }],
  assistens: [{ to: 'stormdrain', x: 24, y: 20 }],
  stormdrain: [{ to: 'assistens', x: 1, y: 1 }],
  cisterns: [{ to: 'frederiksberg', x: 1, y: 1 }],
  islandsbrygge: [{ to: 'dragor', x: 2, y: 11 }],
  dragor: [{ to: 'islandsbrygge', x: 20, y: 8 }, { to: 'oresund', x: 19, y: 16, needs: 'pg1done' }],
  osterbro: [{ to: 'dyrehaven', x: 27, y: 4 }, { to: 'helsingor', x: 27, y: 4, pick: 'Helsingør', needs: 'pg1done' }],
  helsingor: [{ to: 'osterbro', x: 1, y: 6, needs: 'ch12done' }],
  dyrehaven: [{ to: 'osterbro', x: 14, y: 26 }],
  christianshavn: [{ to: 'fleetboat', x: 3, y: 6 }],
  borsen: [{ to: 'gym7', x: 12, y: 1 }],
  gym7: [{ to: 'borsen', x: 9, y: 13 }],
  shipyards: [{ to: 'eastquay', x: 14, y: 9 }],
  eastquay: [{ to: 'shipyards', x: 1, y: 10 }, { to: 'cranetop', x: 9, y: 1 }],
  cranetop: [{ to: 'eastquay', x: 1, y: 2 }],
  floodnyhavn: [{ to: 'metro', x: 12, y: 12 }],
  metro: [{ to: 'slotsholmen', x: 26, y: 1 }],
  slotsholmen: [{ to: 'ruins', x: 8, y: 6 }],
  ruins: [{ to: 'slotsholmen', x: 1, y: 4 }],
  stables: [{ to: 'admiral', x: 5, y: 0 }],
  admiral: [{ to: 'greathall', x: 5, y: 0 }],
  greathall: [{ to: 'towerstairs', x: 5, y: 0 }],
  towerstairs: [{ to: 'towerroof', x: 5, y: 0 }]
};
/** Tiles you step on that move you (step events, not warps). */
const STEP: Record<string, { to: string; x: number; y: number }[]> = {
  towerin: [{ to: 'rundetarn', x: 6, y: 2 }],
  leaguehall: [{ to: 'stables', x: 6, y: 0 }]
};

function edgeTiles(map: string, dir: Dir): [number, number][] {
  const m = mapDef(map), out: [number, number][] = [];
  const n = dir === 'up' || dir === 'down' ? m.w : m.h;
  for (let i = 0; i < n; i++) {
    const [x, y] = dir === 'up' ? [i, 0] : dir === 'down' ? [i, m.h - 1] : dir === 'left' ? [0, i] : [m.w - 1, i];
    if (!solid(map, x, y, [])) out.push([x, y]);
  }
  return out;
}

export function hops(map: string): Hop[] {
  const m = mapDef(map), out: Hop[] = [];
  for (const [d, ex] of Object.entries(m.exits ?? {}) as [Dir, { to: string }][]) {
    const to = ex.to.replace(/^hafnia:/, '');
    out.push({ to, cost: 20, how: p => {
      const tiles = edgeTiles(map, d);
      const best = tiles.map(t => ({ t, path: findPath(map, p.s.x, p.s.y, t[0], t[1], p.view.npcs) })).filter(o => o.path).sort((a, b) => a.path!.length - b.path!.length)[0];
      if (!best) throw new Error(`no way to the ${d} edge of ${map}`);
      p.exit(d, best.t[0], best.t[1]);
    } });
  }
  for (const [door, to] of Object.entries(DOORS[map] ?? {})) out.push({ to, cost: 10, how: p => p.enter(door) });
  for (const w of m.warps ?? []) {
    const to = w.to.replace(/^hafnia:/, '');
    if (!out.some(h => h.to === to)) out.push({ to, cost: 10, how: p => p.walkTo(w.x, w.y) });
  }
  for (const t of TALK[map] ?? []) if (!t.needs || current?.flag(t.needs)) out.push({ to: t.to, cost: 15, how: p => {
    if (t.pick) p.answers.push({ when: /Where to\?/, pick: t.pick, once: true });
    p.talkTo(t.x, t.y);
  } });
  for (const t of STEP[map] ?? []) out.push({ to: t.to, cost: 10, how: p => p.walkTo(t.x, t.y) });
  return out;
}

/** Maps in order from `from` to `to` (Dijkstra over the hop graph). */
export function plan(from: string, to: string, closed: Set<string> = new Set()): string[] | null {
  const dist = new Map([[from, 0]]), prev = new Map<string, string>(), open = [from];
  while (open.length) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const cur = open.shift()!;
    if (cur === to) break;
    for (const h of hops(cur)) {
      if (closed.has(`${cur}>${h.to}`)) continue;
      const d = dist.get(cur)! + h.cost;
      if (d < (dist.get(h.to) ?? Infinity)) { dist.set(h.to, d); prev.set(h.to, cur); open.push(h.to); }
    }
  }
  if (!dist.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

export function goto(p: Player, to: string) {
  current = p;
  const closed = new Set<string>();
  for (let guard = 0; guard < 40 && p.mapId !== to; guard++) {
    const route = plan(p.mapId, to, closed);
    if (!route) throw new Error(`goto ${to}: no route from ${p.mapId}${closed.size ? ` (blocked: ${[...closed].join(', ')})` : ''}`);
    const next = route[1], from = p.mapId;
    const hop = hops(from).find(h => h.to === next)!;
    hop.how(p);
    if (p.mapId === from) closed.add(`${from}>${next}`);   // a guard said no, or a cutscene kept us here
  }
  if (p.mapId !== to) throw new Error(`goto ${to}: stuck on ${p.mapId}`);
}

void DIRS; void doorOf;
