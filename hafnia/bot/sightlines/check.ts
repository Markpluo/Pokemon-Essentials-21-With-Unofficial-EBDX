// Which route trainers can be walked around? A trainer "holds the path" when every way between two of the
// map's ways in or out (edge exits, doors, doormats, travel spots, story step triggers) crosses their line of
// sight, so the battle can't be dodged. `npm run sightlines` lists every trainer; `-- --fix` also suggests the
// nearest spot, facing and sight range that would make each open trainer hold the path, without ever walling
// off a way in or out or a character you need to talk to. `-- --fix --write` applies those to the pack's source.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Content, hafnia, ICE_TILES, SOLID_TILES, type Dir, type NpcDef } from '../lib/core-entry';
import { STEP, TALK } from '../playthrough/nav';

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const content = new Content([hafnia]);
const args = process.argv.slice(2);
const FIX = args.includes('--fix'), WRITE = args.includes('--write');
const ONLY = args.includes('--map') ? args[args.indexOf('--map') + 1] : null;
/** Trainers left open on purpose (optional side areas), by id. */
const SKIP = new Set((args.includes('--skip') ? args[args.indexOf('--skip') + 1] : '').split(',').filter(Boolean));
const MAX_SIGHT = 7, RADIUS = 8;
/** Gym Leaders: in a gym the way through runs from the doormat to them. */
const LEADERS = new Set(['tariqg', 'alvag', 'kasperg', 'soreng', 'tychog', 'pierrotg', 'margretheg', 'astrid']);

type M = ReturnType<Content['map']>;
type Pt = [number, number];
const K = (x: number, y: number) => `${x},${y}`;

function baseSolid(m: M) {
  const s = new Set<string>();
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (SOLID_TILES.has(m.grid[y][x])) s.add(K(x, y));
  for (const b of m.buildings) {
    const st = content.stamp(m.pack, b.s);
    for (let j = 0; j < st.h; j++) for (let i = 0; i < st.w; i++) s.add(K(b.x + i, b.y + j));
  }
  // Characters who are always there block the way; ones that come and go (story scenes) don't count.
  for (const n of m.npcs) if (!n.hidden && !n.floor && !n.when && !n.patrol && !n.period && !n.trainer) s.add(K(n.x, n.y));
  // Lily pads and other floor objects make water walkable.
  for (const n of m.npcs) if (n.floor) s.delete(K(n.x, n.y));
  return s;
}

/** The map's ways in and out, each a group of tiles you can stand on to use it. */
function portals(m: M, solid: Set<string>): { name: string; tiles: string[] }[] {
  const out: { name: string; tiles: string[] }[] = [];
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && !solid.has(K(x, y));
  const around = (x: number, y: number) => Object.values(DIRS).map(([dx, dy]) => [x + dx, y + dy] as Pt).filter(([a, b]) => free(a, b)).map(([a, b]) => K(a, b));
  for (const d of Object.keys(m.exits ?? {}) as Dir[]) {
    const tiles: string[] = [];
    const n = d === 'up' || d === 'down' ? m.w : m.h;
    for (let i = 0; i < n; i++) {
      const [x, y] = d === 'up' ? [i, 0] : d === 'down' ? [i, m.h - 1] : d === 'left' ? [0, i] : [m.w - 1, i];
      if (free(x, y)) tiles.push(K(x, y));
    }
    if (tiles.length) out.push({ name: `exit ${d}`, tiles });
  }
  for (const b of m.buildings) {
    const st = content.stamp(m.pack, b.s);
    if (st.door && b.id) out.push({ name: `door ${b.id}`, tiles: around(b.x + st.door[0], b.y + st.door[1]) });
  }
  for (const w of m.warps ?? []) out.push({ name: `warp ${w.to}`, tiles: [K(w.x, w.y)] });
  for (const t of TALK[m.id] ?? []) out.push({ name: `travel ${t.to}`, tiles: around(t.x, t.y) });
  for (const t of STEP[m.id] ?? []) out.push({ name: `step ${t.to}`, tiles: [K(t.x, t.y)] });
  for (const n of m.npcs) if (LEADERS.has(n.id)) out.push({ name: `leader ${n.id}`, tiles: around(n.x, n.y) });
  for (const [i, e] of (m.events ?? []).entries()) if (e.on === 'step' && e.x !== undefined) {
    const tiles: string[] = [];
    for (let y = e.y!; y < e.y! + (e.h ?? 1); y++) for (let x = e.x; x < e.x + (e.w ?? 1); x++) if (free(x, y)) tiles.push(K(x, y));
    if (tiles.length) out.push({ name: `event ${i}`, tiles });
  }
  return out.filter(p => p.tiles.length);
}

/** Tiles reachable from `from` without stepping on `solid` or `banned`. */
function flood(m: M, from: string[], solid: Set<string>, banned: Set<string>) {
  const seen = new Set<string>(), q: string[] = [];
  for (const t of from) if (!solid.has(t) && !banned.has(t)) { seen.add(t); q.push(t); }
  while (q.length) {
    const [x, y] = q.pop()!.split(',').map(Number);
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny);
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || seen.has(k) || solid.has(k) || banned.has(k)) continue;
      seen.add(k); q.push(k);
    }
  }
  return seen;
}

/** Pairs of portals (as "i-j") that connect. */
function pairs(m: M, ps: { tiles: string[] }[], solid: Set<string>, banned: Set<string>) {
  const out = new Set<string>();
  ps.forEach((p, i) => {
    const r = flood(m, p.tiles, solid, banned);
    ps.forEach((q, j) => { if (j > i && q.tiles.some(t => r.has(t) && !banned.has(t))) out.add(`${i}-${j}`); });
  });
  return out;
}

function sightCells(m: M, x: number, y: number, dir: Dir, sight: number, solid: Set<string>) {
  const [dx, dy] = DIRS[dir], out: string[] = [];
  for (let i = 1; i <= sight; i++) {
    const tx = x + dx * i, ty = y + dy * i;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || solid.has(K(tx, ty))) break;
    out.push(K(tx, ty));
  }
  return out;
}

/** People and things you talk to: each needs a free tile next to it that a portal reaches. */
function talkers(m: M, skip: NpcDef) {
  return m.npcs.filter(n => n !== skip && n.talk && !n.hidden && !n.floor && !n.patrol);
}
function reachableTalkers(m: M, ps: { tiles: string[] }[], solid: Set<string>, skip: NpcDef) {
  const all = new Set<string>();
  for (const p of ps) for (const t of flood(m, p.tiles, solid, new Set())) all.add(t);
  return new Set(talkers(m, skip).filter(n => Object.values(DIRS).some(([dx, dy]) => all.has(K(n.x + dx, n.y + dy)))).map(n => n.id));
}

const isTrainer = (n: NpcDef) => !!n.trainer && n.trainer.sight > 0 && !!n.talk && !n.hidden;
const results: { map: string; id: string; holds: boolean; fix?: { x: number; y: number; dir: Dir; sight: number; moved: number; from: string }; note?: string }[] = [];

for (const m0 of content.maps.values()) {
  if (m0.pack !== 'hafnia' || (ONLY && m0.id !== ONLY)) continue;
  // Work on a copy so fixes on one trainer are seen by the next.
  const m = { ...m0, npcs: m0.npcs.map(n => ({ ...n })) } as M;
  const trainers = m.npcs.filter(isTrainer);
  if (!trainers.length) continue;
  const slides = m.grid.some(r => r.some(c => ICE_TILES.has(c)));
  for (const t of trainers) {
    const solid = baseSolid(m);
    for (const o of trainers) if (o !== t) solid.add(K(o.x, o.y));
    const ps = portals(m, solid);
    const base = pairs(m, ps, solid, new Set());
    const withT = new Set(solid); withT.add(K(t.x, t.y));
    const cut = (s: Set<string>, x: number, y: number, dir: Dir, sight: number) => {
      const got = pairs(m, ps, s, new Set(sightCells(m, x, y, dir, sight, s)));
      return [...base].filter(p => !got.has(p));
    };
    const lost = cut(withT, t.x, t.y, t.dir, t.trainer!.sight);
    const r: (typeof results)[number] = { map: m.id, id: t.id, holds: lost.length > 0 };
    results.push(r);
    if (r.holds || !FIX || SKIP.has(t.id)) continue;
    if (slides) { r.note = 'ice map: left alone'; continue; }
    const talkBase = reachableTalkers(m, ps, withT, t);
    // Not right next to a door, doormat or travel spot (an exit edge is fine: you walk in and get spotted).
    const portalTiles = new Set(ps.filter(p => !p.name.startsWith('exit')).flatMap(p => p.tiles));
    const near = (x: number, y: number) => [...portalTiles].some(k => { const [a, b] = k.split(',').map(Number); return Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1; })
      || m.npcs.some(n => n !== t && !n.hidden && Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1);
    let best: { x: number; y: number; dir: Dir; sight: number; moved: number; score: number } | null = null;
    for (let y = t.y - RADIUS; y <= t.y + RADIUS; y++) for (let x = t.x - RADIUS; x <= t.x + RADIUS; x++) {
      const moved = Math.abs(x - t.x) + Math.abs(y - t.y);
      if (moved > RADIUS || x < 0 || y < 0 || x >= m.w || y >= m.h || solid.has(K(x, y))) continue;
      if (moved > 0 && (near(x, y) || x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1)) continue;
      const s2 = new Set(solid); s2.add(K(x, y));
      // Standing there mustn't wall anything off.
      const phys = pairs(m, ps, s2, new Set());
      if ([...base].some(p => !phys.has(p))) continue;
      const talk2 = reachableTalkers(m, ps, s2, t);
      if ([...talkBase].some(id => !talk2.has(id))) continue;
      for (const dir of Object.keys(DIRS) as Dir[]) {
        for (let sight = 1; sight <= MAX_SIGHT; sight++) {
          const cells = sightCells(m, x, y, dir, sight, s2);
          if (cells.length < sight) break;
          const lost2 = cut(s2, x, y, dir, sight);
          if (!lost2.length) continue;
          // Prefer few changes: stay close, keep the facing, keep sight short, and cut between exits rather than off a door.
          const exitsCut = lost2.some(p => p.split('-').every(i => /^(exit|warp|travel|step|leader)/.test(ps[+i].name)));
          const score = moved * 3 + Math.max(0, sight - t.trainer!.sight) + (dir === t.dir ? 0 : 1) + (exitsCut ? 0 : 6);
          if (!best || score < best.score) best = { x, y, dir, sight, moved, score };
          break;
        }
      }
    }
    if (best) {
      r.fix = { x: best.x, y: best.y, dir: best.dir, sight: best.sight, moved: best.moved, from: `id: '${t.id}', x: ${t.x}, y: ${t.y}, dir: '${t.dir}'` };
      t.x = best.x; t.y = best.y; t.dir = best.dir; t.trainer = { ...t.trainer!, sight: best.sight };
    } else r.note = 'no spot within reach holds the path';
  }
}

const held = results.filter(r => r.holds).length;
for (const r of results) console.log(`${r.map.padEnd(16)} ${r.id.padEnd(16)} ${r.holds ? 'holds' : r.fix ? `-> ${r.fix.x},${r.fix.y} ${r.fix.dir} sight ${r.fix.sight} (moved ${r.fix.moved})` : `open${r.note ? ` (${r.note})` : ''}`}`);
console.log(`\n${held} of ${results.length} trainers hold the path${FIX ? `; ${results.filter(r => r.fix).length} more can` : ''}.`);

if (WRITE) {
  const dir = join(process.cwd(), 'packs', 'hafnia', 'src');
  // Ids repeat across maps (an Ida on Route 1 and another indoors), so a trainer is found by id and old spot.
  const files = readdirSync(dir).filter(f => f.endsWith('.ts')).map(f => ({ f, src: readFileSync(join(dir, f), 'utf8'), changed: false }));
  for (const r of results.filter(r => r.fix)) {
    const hits = files.filter(x => x.src.includes(r.fix!.from));
    if (hits.length !== 1) { console.log(`!! ${r.id}: found ${hits.length} times, change it by hand`); continue; }
    const file = hits[0], at = file.src.indexOf(r.fix!.from);
    const end = file.src.indexOf('intro:', at), stop = file.src.indexOf('\n', file.src.indexOf('foes', at));
    const head = file.src.slice(at, Math.min(end < 0 ? Infinity : end, stop < 0 ? Infinity : stop));
    const fixed = head.replace(r.fix!.from, `id: '${r.id}', x: ${r.fix!.x}, y: ${r.fix!.y}, dir: '${r.fix!.dir}'`).replace(/sight: \d+/, `sight: ${r.fix!.sight}`);
    if (!/sight: \d+/.test(head)) { console.log(`!! ${r.id}: no sight to change in ${file.f}`); continue; }
    file.src = file.src.slice(0, at) + fixed + file.src.slice(at + head.length);
    file.changed = true;
  }
  for (const x of files) if (x.changed) writeFileSync(join(dir, x.f), x.src);
}
