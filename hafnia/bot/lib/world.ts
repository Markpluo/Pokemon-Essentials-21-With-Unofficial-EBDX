// Map knowledge for the bot, read from the same content packs the game runs: which tiles are
// solid, where doors and warps are, and a path finder. NPC positions come from the live game.
// Call `await world()` once (the Bot does) before using the other helpers.
import type { Content, Dir, NpcView } from '@hafnia/core';
import { loadCore, type Core } from './core';

export const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

let C: Core | null = null;
let content: Content | null = null;

export async function world() {
  if (!C) { C = await loadCore(); content = new C.Content([C.hafnia]); }
  return { core: C, content: content! };
}
function sync() {
  if (!C || !content) throw new Error('Call `await world()` first');
  return { core: C, content };
}

/** `hafnia:nyhavn` or just `nyhavn` (base pack). */
export const mapKey = (id: string) => (id.includes(':') ? id : `hafnia:${id}`);
export const mapDef = (id: string) => sync().content.map(mapKey(id));

/** Same rule as Game.solid, with NPCs taken from the live view. */
export function solid(map: string, x: number, y: number, npcs: NpcView[]): boolean {
  const { core, content } = sync();
  const m = mapDef(map);
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  const t = m.grid[y][x];
  const npcAt = (floor: boolean) => npcs.some(n => n.x === x && n.y === y && !!n.floor === floor);
  if (core.SOLID_TILES.has(t) && !(core.WATER_TILES.has(t) && npcAt(true))) return true;
  if (m.buildings.some(b => { const st = content.stamp(m.pack, b.s); return x >= b.x && x < b.x + st.w && y >= b.y && y < b.y + st.h; })) return true;
  return npcAt(false);
}

/** The building whose door is at (x, y): bumping it opens the building. */
export function doorAt(map: string, x: number, y: number): string | null {
  const m = mapDef(map);
  for (const b of m.buildings) {
    const st = sync().content.stamp(m.pack, b.s);
    if (st.door && b.id && b.x + st.door[0] === x && b.y + st.door[1] === y) return b.id;
  }
  return null;
}
/** Doormats, ladders and stairs: stepping on one moves you. */
export const warpAt = (map: string, x: number, y: number) => mapDef(map).warps?.find(w => w.x === x && w.y === y) ?? null;

/** Where a building's door is, so `bot.enter('palm')` can walk into it. */
export function doorOf(map: string, building: string): [number, number] {
  const m = mapDef(map);
  const b = m.buildings.find(b => b.id === building);
  const st = b && sync().content.stamp(m.pack, b.s);
  if (!b || !st?.door) throw new Error(`No door "${building}" on ${map}. Doors: ${m.buildings.filter(b => b.id).map(b => b.id).join(', ')}`);
  return [b.x + st.door[0], b.y + st.door[1]];
}

/** Cheapest path from (sx, sy) to (tx, ty). Tall grass costs more (fewer wild battles); doors and
 *  warps are only entered when they are the target. Returns the directions to press, or null. */
export function findPath(map: string, sx: number, sy: number, tx: number, ty: number, npcs: NpcView[]): Dir[] | null {
  const m = mapDef(map), grass = m.encounterTile ?? sync().core.GRASS_TILE;
  const key = (x: number, y: number) => y * m.w + x;
  const cost = new Map<number, number>([[key(sx, sy), 0]]);
  const prev = new Map<number, [number, Dir]>();
  const open: [number, number, number][] = [[0, sx, sy]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [c, x, y] = open.shift()!;
    if (x === tx && y === ty) {
      const out: Dir[] = [];
      for (let k = key(x, y); prev.has(k);) { const [pk, d] = prev.get(k)!; out.unshift(d); k = pk; }
      return out;
    }
    if (c > (cost.get(key(x, y)) ?? Infinity)) continue;
    for (const [d, [dx, dy]] of Object.entries(DIRS) as [Dir, [number, number]][]) {
      const nx = x + dx, ny = y + dy, target = nx === tx && ny === ty;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      if (!target && (solid(map, nx, ny, npcs) || doorAt(map, nx, ny) || warpAt(map, nx, ny))) continue;
      const nc = c + (m.grid[ny][nx] === grass ? 6 : 1);
      if (nc >= (cost.get(key(nx, ny)) ?? Infinity)) continue;
      cost.set(key(nx, ny), nc); prev.set(key(nx, ny), [key(x, y), d]); open.push([nc, nx, ny]);
    }
  }
  return null;
}
