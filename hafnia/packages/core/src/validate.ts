// Content checks run by the test suite (systems.md §12): every map, exit, building, NPC sprite and
// encounter must point at something that exists, so a broken reference fails CI, not a playtest.
import { Dex } from '@pkmn/sim';
import { GRASS_TILE, SOLID_TILES, ns, type Content } from './content';
import { speciesExtra } from './pokemon';

const KNOWN_TILES = new Set(['.', '=', 'f', 'r', 'k', GRASS_TILE, ...SOLID_TILES]);

export function validateContent(content: Content): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
  for (const [id, pack] of content.packs) {
    const images = pack.manifest.images;
    for (const sp of pack.manifest.species) {
      if (!Dex.species.get(sp).exists) err(id, `species "${sp}" is not in the simulator's dex`);
      try { speciesExtra(sp); } catch { err(id, `species "${sp}" has no PBS data`); }
    }
    for (const m of Object.values(pack.maps)) {
      const where = `${id}:${m.id}`;
      if (m.grid.length !== m.h || m.grid.some(r => r.length !== m.w)) err(where, `grid is not ${m.w}x${m.h}`);
      for (const row of m.grid) for (const t of row) if (!KNOWN_TILES.has(t)) { err(where, `unknown tile "${t}"`); break; }
      for (const b of m.buildings) {
        const st = pack.stamps[b.s];
        if (!st) { err(where, `building uses unknown stamp "${b.s}"`); continue; }
        if (b.x < 0 || b.y < 0 || b.x + st.w > m.w || b.y + st.h > m.h) err(where, `building "${b.id ?? b.s}" is off the map`);
        if (b.id && m.doors && !st.door && m.doors[b.id]) err(where, `building "${b.id}" has a door script but its stamp has no door`);
      }
      for (const door of Object.keys(m.doors ?? {})) {
        if (!m.buildings.some(b => b.id === door)) err(where, `door script for missing building "${door}"`);
      }
      for (const [dir, ex] of Object.entries(m.exits ?? {})) {
        if (!ex) continue;
        if (!content.maps.has(ns(id, ex.to))) err(where, `exit ${dir} leads to unknown map "${ex.to}"`);
      }
      for (const n of m.npcs) {
        if (!images[n.sprite]) err(where, `NPC "${n.id}" uses sprite "${n.sprite}" missing from pack.json`);
        if (n.x < 0 || n.y < 0 || n.x >= m.w || n.y >= m.h) err(where, `NPC "${n.id}" is off the map`);
        else if (!n.hidden && SOLID_TILES.has(m.grid[n.y][n.x])) err(where, `NPC "${n.id}" stands on a solid tile`);
      }
      let total = 0;
      for (const [w, sp] of m.encounters ?? []) {
        total += w;
        if (!pack.manifest.species.includes(sp)) err(where, `encounter species "${sp}" is not listed in pack.json`);
      }
      if (m.encounters?.length && total !== 100) err(where, `encounter weights add up to ${total}, not 100`);
      if (m.encounters?.length && !m.grid.some(r => r.includes(GRASS_TILE))) err(where, 'has encounters but no tall grass');
    }
  }
  return errors;
}
