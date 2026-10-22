// The art gaps from the 2026-10-21 quality pass: furnished rooms (MapDef.decor) must not wall off part of a
// room or the people in it, and every Pokédex entry is a Copenhagen one.
import { describe, expect, it } from 'vitest';
import { Content, SOLID_TILES, dexOrder } from '@hafnia/core';
import { hafnia } from '../src';

describe('furnished interiors', () => {
  const rooms = Object.values(hafnia.maps).filter(m => m.decor);

  it('furnishes the homes, Centers, cafés, shops and story rooms', () => {
    const ids = new Set(rooms.map(m => m.id));
    for (const id of ['flat', 'lukasflat', 'pcnorrebro', 'cafein', 'cafevb', 'kitchen', 'bakery', 'towerin', 'bibliotek', 'fleetboat', 'borsen']) expect(ids).toContain(id);
  });

  it('every floor tile and every person can still be reached from the door', () => {
    const problems: string[] = [];
    for (const m of rooms) {
      const open = (x: number, y: number) => m.grid[y]?.[x] !== undefined && !SOLID_TILES.has(m.grid[y][x]);
      const doors = (m.warps ?? []).map(w => [w.x, w.y]);
      const seen = new Set<string>(), queue = [...doors];
      while (queue.length) {
        const [x, y] = queue.pop()!;
        if (!open(x, y) || seen.has(`${x},${y}`)) continue;
        seen.add(`${x},${y}`);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      m.grid.forEach((r, y) => r.forEach((_, x) => { if (open(x, y) && !seen.has(`${x},${y}`)) problems.push(`${m.id}: floor ${x},${y} is cut off`); }));
      for (const n of m.npcs) {
        if (n.hidden) continue;
        const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${n.x + dx},${n.y + dy}`));
        if (!near) problems.push(`${m.id}: ${n.id} at ${n.x},${n.y} can't be reached`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('Hafnia Pokédex text', () => {
  it('every species in the Dex has its own Copenhagen entry, short enough for the entry screen', () => {
    const order = dexOrder(new Content([hafnia]));
    expect(order.filter(id => !hafnia.dexText?.[id])).toEqual([]);
    expect(Object.entries(hafnia.dexText ?? {}).filter(([, t]) => t.length > 170).map(([id]) => id)).toEqual([]);
  });
});
