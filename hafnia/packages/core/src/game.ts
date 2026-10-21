// The authoritative game: world rules, story scripts, battles and the save state.
// It has no DOM, network or timers. Feed it intents, get back events. A Web Worker runs it
// for solo play; the online server will run the very same class.
import { BattleSession } from './battle';
import type { CoilUnlocks } from './coil';
import { Content, GRASS_TILE, SOLID_TILES, WATER_TILES, ns, type MapDef, type MapEvent, type NpcDef, type Period, type Respawn } from './content';
import { ITEMS, itemEffect } from './items';
import {
  canLearnTM, evolveMon, expForLevel, gainExp, healMon, levelEvolution, makeMon, maxHp, maxPp, monName, monView, moveName, replaceMove,
  speciesExtra, speciesName, speciesTypes, type Mon
} from './pokemon';
import type { BattleResult, DayPeriod, DebugCommand, Dir, Intent, Look, ServerEvent, WorldView } from './protocol';
import { Rng } from './rng';
import type { NpcHandle, Pause, Script, ScriptApi } from './script';

export const SAVE_VERSION = 2;

export interface SaveData {
  v: number;
  packs: string[];                 // packs this save has used; loading fails cleanly if one is missing
  name: string;
  map: string; x: number; y: number; dir: Dir;
  party: Mon[]; box: Mon[];
  bag: Record<string, number>;
  money: number;
  flags: Record<string, unknown>;  // "pack:flag" -> value
  npcs: Record<string, { x: number; y: number; dir: Dir; hidden: boolean }>; // "pack:map/npc"
  respawn: Respawn;
  rng: number;
  badges: string[];                // "pack:badge" ids, in the order earned
  coil: CoilUnlocks;               // Copper & Current modes the player has unlocked
  repel: number;                   // steps left
  look: Look;                      // the player's character
  clock: number;                   // in-game minutes since midnight (1 day = 48 real minutes in the overworld)
}

/** Start minute of each period of the day (progression-quests-time.md §3.6). */
const PERIOD_START: Record<DayPeriod, number> = { morning: 4 * 60, day: 10 * 60, evening: 17 * 60, night: 20 * 60 };
export function periodOf(clock: number): DayPeriod {
  const h = clock / 60;
  return h >= 4 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night';
}
const GAME_MINUTES_PER_SECOND = 1440 / (48 * 60);
const NAME_MAX = 10;

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const PARTY_MAX = 6;

export function faceTo(ax: number, ay: number, bx: number, by: number): Dir {
  const dx = bx - ax, dy = by - ay;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export class SaveError extends Error {}

export class Game {
  readonly rng: Rng;
  private out: ServerEvent[] = [];
  /** The running script. Helpers such as the post-battle evolution check are pushed on top of it. */
  private script: { stack: Generator<Pause, unknown, any>[]; onDone?: (v: unknown) => void } | null = null;
  /** Dev and test builds only: enables the debug menu commands. The online server never sets it. */
  debug = false;
  private pause: Pause | null = null;
  private battle: BattleSession | null = null;
  private battleSoft = false;
  private doorCache = new Map<string, Map<string, string>>();
  /** A map the player just arrived on whose onEnter hook still has to run. */
  private pendingEnter: string | null = null;

  private constructor(readonly content: Content, readonly state: SaveData) {
    this.rng = new Rng(state.rng);
  }

  /** Starts a new game: places the player and runs the base pack's intro script. */
  static newGame(content: Content, seed: number): { game: Game; events: ServerEvent[] } {
    const base = content.base, start = base.newGame!;
    const map = ns(base.manifest.id, start.map);
    const game = new Game(content, {
      v: SAVE_VERSION, packs: [...content.packs.keys()], name: 'Player', map, x: start.x, y: start.y, dir: start.dir,
      party: [], box: [], bag: {}, money: 3000, flags: {}, npcs: {},
      respawn: { ...start.respawn, map: ns(base.manifest.id, start.respawn.map) }, rng: seed >>> 0,
      badges: [], coil: {}, repel: 0, look: 'boy', clock: PERIOD_START.morning + 4 * 60
    });
    game.emitMap();
    game.run(start.intro, base.manifest.id);
    return { game, events: game.flush() };
  }

  /** Loads a save after checking that every pack it used is installed. */
  static load(content: Content, save: SaveData): Game {
    if (!save || typeof save !== 'object') throw new SaveError('This save file is damaged.');
    if (save.v > SAVE_VERSION) throw new SaveError('This save was made by a newer version of the game.');
    const missing = save.packs.filter(p => !content.packs.has(p));
    if (missing.length) throw new SaveError(`This save needs these content packs: ${missing.join(', ')}.`);
    const game = new Game(content, migrate(save));
    content.map(save.map);
    return game;
  }

  /** Events to show a freshly loaded game (map, music, view). */
  resumeEvents(): ServerEvent[] {
    this.emitMap();
    return this.flush();
  }

  toSave(): SaveData {
    this.state.rng = this.rng.state;
    for (const p of this.content.packs.keys()) if (!this.state.packs.includes(p)) this.state.packs.push(p);
    return structuredClone(this.state);
  }

  get busy() { return !!(this.script || this.battle); }

  handle(intent: Intent): ServerEvent[] {
    try {
      if (intent.t === 'debug') { if (this.debug && !this.busy) this.debugCommand(intent.cmd, intent.arg); }
      else if (this.battle) {
        if (intent.t === 'battle') this.battleAct(intent.action);
        else if (intent.t === 'answer' && this.battle.waitingForAnswer) { this.battle.answer(intent.index); this.afterBattleAct(); }
      } else if (this.pause) {
        if (intent.t === 'answer') this.answer(intent.index, intent.text);
      } else {
        switch (intent.t) {
          case 'tick': this.state.clock = (this.state.clock + Math.max(0, Math.min(60, Number(intent.seconds) || 0)) * GAME_MINUTES_PER_SECOND) % 1440; break;
          case 'turn': this.state.dir = intent.dir; break;
          case 'step': this.step(intent.dir); break;
          case 'interact': this.interact(); break;
          case 'useItem': this.useItem(intent.item, intent.uid); break;
          case 'lead': this.lead(intent.uid); break;

        }
      }
    } catch (e) {
      this.out.push({ t: 'error', message: e instanceof Error ? e.message : String(e) });
    }
    return this.flush();
  }

  private flush(): ServerEvent[] {
    const evs = this.out;
    evs.push({ t: 'view', view: this.view() });
    this.out = [];
    return evs;
  }

  // ---------- world ----------

  private get map() { return this.content.map(this.state.map); }

  private doors(m: MapDef & { key: string; pack: string }) {
    let d = this.doorCache.get(m.key);
    if (!d) {
      d = new Map();
      for (const b of m.buildings) {
        const st = this.content.stamp(m.pack, b.s);
        if (st.door && b.id) d.set(`${b.x + st.door[0]},${b.y + st.door[1]}`, b.id);
      }
      this.doorCache.set(m.key, d);
    }
    return d;
  }

  private tile(m: MapDef, x: number, y: number): string | null {
    return x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.grid[y][x];
  }

  private npcState(m: MapDef & { key: string }, n: NpcDef) {
    const o = this.state.npcs[`${m.key}/${n.id}`];
    return { x: o?.x ?? n.x, y: o?.y ?? n.y, dir: o?.dir ?? n.dir, hidden: o?.hidden ?? !!n.hidden };
  }

  private npcVisible(m: MapDef & { key: string; pack: string }, n: NpcDef) {
    return !this.npcState(m, n).hidden && (!n.period || n.period.includes(this.period as Period))
      && (!n.when || n.when(name => this.flag(m.pack, name)));
  }

  private npcAt(m: MapDef & { key: string; pack: string }, x: number, y: number, floor = false) {
    return m.npcs.find(n => { const s = this.npcState(m, n); return s.x === x && s.y === y && !!n.floor === floor && this.npcVisible(m, n); });
  }

  get period(): DayPeriod { return periodOf(this.state.clock); }

  private buildingAt(m: MapDef & { key: string; pack: string }, x: number, y: number) {
    return m.buildings.some(b => {
      const st = this.content.stamp(m.pack, b.s);
      return x >= b.x && x < b.x + st.w && y >= b.y && y < b.y + st.h;
    });
  }

  solid(x: number, y: number, mapKey = this.state.map): boolean {
    const m = this.content.map(mapKey);
    const t = this.tile(m, x, y);
    if (t === null) return true;
    if (SOLID_TILES.has(t) && !(WATER_TILES.has(t) && this.npcAt(m, x, y, true))) return true; // lily pads make water walkable
    if (this.buildingAt(m, x, y)) return true;
    if (mapKey === this.state.map && this.state.x === x && this.state.y === y) return true;
    return !!this.npcAt(m, x, y);
  }

  private step(dir: Dir) {
    const s = this.state, m = this.map;
    s.dir = dir;
    const [dx, dy] = DIRS[dir], nx = s.x + dx, ny = s.y + dy;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) {
      const ex = m.exits?.[dir];
      if (!ex) return;
      const go = () => {
        const to = this.content.map(ns(m.pack, ex.to));
        const x = dir === 'up' || dir === 'down' ? s.x + ex.offset : dir === 'left' ? to.w - 1 : 0;
        const y = dir === 'left' || dir === 'right' ? s.y + ex.offset : dir === 'up' ? to.h - 1 : 0;
        this.warp(to.key, Math.max(0, Math.min(to.w - 1, x)), Math.max(0, Math.min(to.h - 1, y)), dir);
        this.out.push({ t: 'checkpoint' });
        this.checkEnter();
      };
      if (ex.guard) this.run(ex.guard, m.pack, ok => { if (ok !== false) go(); });
      else go();
      return;
    }
    const door = this.doors(m).get(`${nx},${ny}`);
    if (door) { this.openDoor(m, door); return; }
    if (this.solid(nx, ny)) { this.tickWorld(); return; }
    s.x = nx; s.y = ny;
    this.out.push({ t: 'walk', actor: 'player', dir });
    const w = m.warps?.find(w => w.x === nx && w.y === ny);
    if (w) {
      this.out.push({ t: 'sfx', name: 'door' });
      this.warp(ns(m.pack, w.to), w.tx, w.ty, w.dir);
      this.out.push({ t: 'checkpoint' });
      this.checkEnter();
      return;
    }
    if (this.tickWorld()) return;
    const ev = this.eventAt(m, nx, ny, 'step');
    if (ev) { this.run(ev.run, m.pack); return; }
    this.afterStep();
  }

  private eventAt(m: MapDef & { key: string; pack: string }, x: number, y: number, on: MapEvent['on']) {
    const t = this.tile(m, x, y);
    return m.events?.find(e => e.on === on
      && (e.tile !== undefined ? e.tile === t : x >= e.x! && y >= e.y! && x < e.x! + (e.w ?? 1) && y < e.y! + (e.h ?? 1))
      && (!e.when || e.when(name => this.flag(m.pack, name))));
  }

  /** Advances patrolling NPCs (bike traffic) one tile. Returns true if one ran into the player. */
  private tickWorld(): boolean {
    const s = this.state, m = this.map;
    let hit: NpcDef | null = null;
    for (const n of m.npcs) {
      if (!n.patrol || !this.npcVisible(m, n)) continue;
      const st = this.npcState(m, n), [dx, dy] = DIRS[n.patrol.dir];
      const horiz = dx !== 0, pos = horiz ? st.x : st.y, step = horiz ? dx : dy;
      const next = pos + step;
      const key = `${m.key}/${n.id}`;
      if (next > n.patrol.max || next < n.patrol.min) {
        const wrap = step > 0 ? n.patrol.min : n.patrol.max;
        this.state.npcs[key] = { ...st, x: horiz ? wrap : st.x, y: horiz ? st.y : wrap };
        const c = this.state.npcs[key];
        this.out.push({ t: 'place', actor: n.id, x: c.x, y: c.y, dir: c.dir, sprite: n.sprite, hidden: false });
      } else {
        this.state.npcs[key] = { ...st, x: st.x + dx, y: st.y + dy, dir: n.patrol.dir };
        this.out.push({ t: 'walk', actor: n.id, dir: n.patrol.dir, frames: 8, async: true });
      }
      const c = this.state.npcs[key];
      if (c.x === s.x && c.y === s.y) hit = n;
    }
    if (hit?.bump && !this.script) { this.run(hit.bump, m.pack); return true; }
    return false;
  }

  /** Runs the onEnter hook of a map the player just arrived on, once no script is running. */
  private checkEnter() {
    if (!this.pendingEnter || this.script || this.battle) return;
    const m = this.content.map(this.pendingEnter);
    this.pendingEnter = null;
    if (m.onEnter && m.key === this.state.map) this.run(m.onEnter, m.pack);
  }

  private openDoor(m: MapDef & { key: string; pack: string }, building: string) {
    this.out.push({ t: 'sfx', name: 'door' });
    const script = m.doors?.[building];
    if (script) this.run(script, m.pack);
  }

  private afterStep() {
    const s = this.state, m = this.map;
    for (const n of m.npcs) {
      if (!n.trainer || this.flag(m.pack, n.trainer.flag) || !this.npcVisible(m, n) || !n.talk) continue;
      const ns_ = this.npcState(m, n), [dx, dy] = DIRS[ns_.dir];
      for (let i = 1; i <= n.trainer.sight; i++) {
        const tx = ns_.x + dx * i, ty = ns_.y + dy * i;
        if (tx === s.x && ty === s.y) {
          const talk = n.talk;
          this.run(function* (api) {
            const npc = api.npc(n.id);
            npc.exclaim();
            if (i > 1) npc.walk(npc.dir, i - 1, 10);
            api.player.faceTo(npc.x, npc.y);
            return yield* talk(api);
          }, m.pack);
          return;
        }
        if (this.solid(tx, ty)) break;
      }
    }
    if (s.repel > 0 && --s.repel === 0) {
      const g = this;
      this.run(function* (api) {
        if (!api.hasItem('repel')) { api.say('The Repel wore off.'); return; }
        const c: number = yield api.ask('The Repel wore off.\nUse another?', ['Yes', 'No'], 1);
        if (c === 0) { g.state.bag.repel--; g.state.repel = ITEMS.repel.repel!; api.sfx('select'); }
      }, m.pack);
      return;
    }
    if (this.flag('debug', 'noEncounters')) return;
    const table = this.period === 'night' && m.encountersNight ? m.encountersNight : m.encounters;
    if (this.tile(m, s.x, s.y) === (m.encounterTile ?? GRASS_TILE) && table?.length && this.partyAlive() && this.rng.chance(this.content.rules.encounterRate)) {
      const sp = this.rollTable(table);
      const [lo, hi] = m.levels ?? [2, 4];
      const level = lo + this.rng.int(hi - lo + 1);
      const lead = s.party.find(p => p.hp > 0);
      if (s.repel > 0 && lead && level < lead.level) return;
      const bg = m.battleBg;
      this.run(function* (api) { return yield api.battle({ kind: 'wild', foes: [{ species: sp, level }], bg }); }, m.pack);
    }
  }

  private rollTable(table: [number, string][]) {
    let r = this.rng.next() * 100;
    for (const [w, id] of table) { if (r < w) return id; r -= w; }
    return table[0][1];
  }

  private interact() {
    const s = this.state, m = this.map, [dx, dy] = DIRS[s.dir], fx = s.x + dx, fy = s.y + dy;
    const n = this.npcAt(m, fx, fy) ?? this.npcAt(m, fx, fy, true);
    if (n?.talk) {
      if (!n.object) this.setNpc(m.key, n, { dir: faceTo(fx, fy, s.x, s.y) });
      this.run(n.talk, m.pack);
      return;
    }
    const door = this.doors(m).get(`${fx},${fy}`);
    if (door) { this.openDoor(m, door); return; }
    const ev = this.eventAt(m, fx, fy, 'interact');
    if (ev) { this.run(ev.run, m.pack); return; }
    const t = this.tile(m, fx, fy);
    if (t && WATER_TILES.has(t) && m.fishing?.length && s.bag.oldrod) { this.fish(m.fishing, m.fishLevels ?? [5, 10], m.battleBg, m.pack); return; }
    this.tickWorld(); // pressing A at nothing waits a moment
  }

  private fish(table: [number, string][], [lo, hi]: [number, number], bg: string, pack: string) {
    const g = this;
    this.run(function* (api) {
      api.say(`${api.player.name} cast the Old Rod...`);
      api.wait(30);
      if (!g.partyAlive() || !g.rng.chance(0.6)) { api.say('Not even a nibble...'); return; }
      api.sfx('exclaim');
      api.say('Oh! A bite!');
      return yield api.battle({ kind: 'wild', foes: [{ species: g.rollTable(table), level: lo + g.rng.int(hi - lo + 1) }], bg });
    }, pack);
  }

  private setNpc(mapKey: string, n: NpcDef, patch: Partial<{ x: number; y: number; dir: Dir; hidden: boolean }>) {
    const m = this.content.map(mapKey);
    const key = `${mapKey}/${n.id}`;
    const cur = this.npcState(m, n);
    this.state.npcs[key] = { ...cur, ...patch };
    const st = this.state.npcs[key];
    if (patch.dir && Object.keys(patch).length === 1) this.out.push({ t: 'face', actor: n.id, dir: st.dir });
    else this.out.push({ t: 'place', actor: n.id, x: st.x, y: st.y, dir: st.dir, sprite: n.sprite, hidden: st.hidden });
  }

  private warp(mapKey: string, x: number, y: number, dir: Dir) {
    this.content.map(mapKey);
    Object.assign(this.state, { map: mapKey, x, y, dir });
    this.pendingEnter = mapKey;
    this.emitMap();
  }

  private emitMap() {
    const m = this.map, s = this.state;
    this.out.push({ t: 'map', map: m.key, name: m.name, x: s.x, y: s.y, dir: s.dir, bgm: m.bgm });
  }

  private partyAlive() { return this.state.party.some(p => p.hp > 0); }

  private useItem(item: string, uid: string) {
    const it = ITEMS[item];
    if (!it || !this.state.bag[item]) return;
    if (it.repel) {
      if (this.state.repel > 0) { this.out.push({ t: 'say', text: 'A Repel is still working.' }); return; }
      this.state.bag[item]--; this.state.repel = it.repel;
      this.out.push({ t: 'sfx', name: 'select' }, { t: 'say', text: `${this.state.name} used a ${it.name}.\nWeaker wild Pokémon will stay away.` });
      return;
    }
    const m = this.state.party.find(p => p.uid === uid);
    if (m && it.tm) { this.teachTM(m, it.tm, it.name); return; }
    if (!m || it.pocket !== 'medicine') return;
    const fx = itemEffect(it, m.hp, maxHp(m), m.status);
    if (!fx) { this.out.push({ t: 'say', text: 'It won\'t have any effect.' }); return; }
    const before = m.hp;
    m.hp = fx.hp; if (fx.cure) m.status = '';
    this.state.bag[item]--;
    const text = before === 0 ? `${monName(m)} was revived!` : m.hp > before ? `${monName(m)} recovered ${m.hp - before} HP.` : `${monName(m)} is healthy again.`;
    this.out.push({ t: 'sfx', name: 'select' }, { t: 'say', text });
  }

  /** TMs are reusable (systems.md §5.2): teaching never uses one up. */
  private teachTM(m: Mon, move: string, tmName: string) {
    const name = monName(m), mv = moveName(move);
    if (m.moves.some(x => x.id === move)) { this.out.push({ t: 'say', text: `${name} already knows ${mv}.` }); return; }
    if (!canLearnTM(m.species, move)) { this.out.push({ t: 'say', text: `${name} can't learn ${mv}.` }); return; }
    const g = this;
    this.run(function* (api) {
      api.say(`${api.player.name} booted up the ${tmName}.\nIt contained ${mv}.`);
      if (m.moves.length < 4) { m.moves.push({ id: move, pp: maxPp(move) }); api.me('me_item'); api.say(`${name} learned ${mv}!`); return; }
      yield* g.learnPrompt(m, move);
    }, this.map.pack);
  }

  // ---------- debug (dev builds) ----------

  private debugCommand(cmd: DebugCommand, arg?: string | number) {
    const s = this.state, say = (text: string) => this.out.push({ t: 'say', text });
    switch (cmd) {
      case 'givePokemon': {
        const m = makeMon(String(arg ?? 'sprigatito'), 10, this.rng, { ot: s.name });
        say(this.addMon(m) === 'party' ? `Debug: ${monName(m)} joined your team.` : `Debug: ${monName(m)} went to the PC.`); break;
      }
      case 'heal': for (const m of s.party) healMon(m); say('Debug: team healed.'); break;
      case 'levelUp': {
        const m = s.party[0]; if (!m) break;
        const target = Math.min(100, m.level + (Number(arg) || 5));
        for (const step of gainExp(m, expForLevel(speciesExtra(m.species).growth, target) - m.exp)) {
          for (const id of step.pending) replaceMove(m, 0, id);
        }
        healMon(m); say(`Debug: ${monName(m)} is now Lv. ${m.level}.`); break;
      }
      case 'items':
        for (const [k, n] of Object.entries({ pokeball: 10, greatball: 5, potion: 10, superpotion: 5, fullheal: 3, revive: 3, repel: 5 })) s.bag[k] = (s.bag[k] ?? 0) + n;
        say('Debug: items added.'); break;
      case 'money': s.money += 10000; say('Debug: 10,000 kr. added.'); break;
      case 'unlockCoil': s.coil = { ...s.coil, copper: true, current: true }; say('Debug: Copper and Current unlocked.'); break;
      case 'encounters': {
        const off = !s.flags['debug:noEncounters']; s.flags['debug:noEncounters'] = off;
        say(off ? 'Debug: wild encounters off.' : 'Debug: wild encounters on.'); break;
      }
      case 'badge': s.badges.push(`debug:badge${s.badges.length + 1}`); say(`Debug: you now have ${s.badges.length} badge(s).`); break;
      case 'warp': {
        const m = this.content.map(String(arg));
        let best: [number, number] = [0, 0], bd = Infinity;
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
          const d = Math.abs(x - m.w / 2) + Math.abs(y - m.h / 2);
          if (d < bd && !this.solid(x, y, m.key) && m.grid[y][x] !== GRASS_TILE) { bd = d; best = [x, y]; }
        }
        this.warp(m.key, best[0], best[1], 'down'); break;
      }
    }
  }

  private lead(uid: string) {
    const i = this.state.party.findIndex(p => p.uid === uid);
    if (i > 0) this.state.party.unshift(...this.state.party.splice(i, 1));
  }

  // ---------- scripts ----------

  private flag(pack: string, name: string) { return this.state.flags[ns(pack, name)]; }

  private run(script: Script, pack: string, onDone?: (v: unknown) => void) {
    this.script = { stack: [script(this.api(pack))], onDone };
    this.resume(undefined);
  }

  private resume(value: unknown) {
    const sc = this.script!;
    for (;;) {
      const r = sc.stack[sc.stack.length - 1].next(value);
      if (r.done) {
        sc.stack.pop();
        if (!sc.stack.length) { this.script = null; sc.onDone?.(r.value); this.checkEnter(); return; }
        value = r.value;
        continue;
      }
      const p = r.value;
      value = undefined;
      if (p.kind === 'ask') { this.pause = p; this.out.push({ t: 'prompt', text: p.text, options: p.options, ...(p.cancel !== undefined ? { cancel: p.cancel } : {}) }); return; }
      if (p.kind === 'name') { this.pause = p; this.out.push({ t: 'askName', text: this.text(this.map.pack, p.text), suggestions: p.suggestions }); return; }
      if (p.kind === 'look') {
        this.pause = p;
        this.out.push({ t: 'pickLook', text: this.text(this.map.pack, p.text), options: [
          { look: 'boy', sprite: 'tr/player_boy', label: 'This one' }, { look: 'girl', sprite: 'tr/player_girl', label: 'This one' }] });
        return;
      }
      if (p.kind === 'pickSpecies') {
        this.pause = p;
        this.out.push({ t: 'pickSpecies', species: p.species.map(x => ({ species: x.species, key: speciesExtra(x.species).key, name: speciesName(x.species), types: speciesTypes(x.species), blurb: x.blurb })) });
        return;
      }
      if (p.kind === 'battle') {
        if (!this.partyAlive()) { value = 'lose'; continue; }
        this.battleSoft = !!p.opts.soft;
        this.battle = new BattleSession(this.battleHost(), p.opts);
        this.battle.start();
        if (!this.battle.result) return;
        this.endBattle();
      }
    }
  }

  private answer(index: number, text?: string) {
    const p = this.pause!;
    if (p.kind === 'name') {
      const name = String(text ?? '').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, NAME_MAX);
      if (!name) { this.out.push({ t: 'error', message: 'Invalid name' }); return; }
      this.pause = null;
      this.resume(name);
      return;
    }
    const n = p.kind === 'ask' ? p.options.length : p.kind === 'pickSpecies' ? p.species.length : p.kind === 'look' ? 2 : 0;
    if (!Number.isInteger(index) || index < 0 || index >= n) { this.out.push({ t: 'error', message: 'Invalid answer' }); return; }
    this.pause = null;
    this.resume(p.kind === 'look' ? (['boy', 'girl'] as Look[])[index] : index);
  }

  /** Looks a string key up in the pack's table and fills in {player} and the pack's own variables. */
  text(pack: string, key: string): string {
    const p = this.content.packs.get(pack);
    let str = p?.strings?.[key] ?? key;
    if (!str.includes('{')) return str;
    const vars: Record<string, string> = { player: this.state.name, ...(p?.textVars?.(name => this.flag(pack, name)) ?? {}) };
    return str.replace(/\{(\w+)\}/g, (all, k) => vars[k] ?? all);
  }

  private battleAct(action: import('./protocol').BattleAction) {
    this.battle!.act(action);
    this.afterBattleAct();
  }

  private afterBattleAct() {
    if (!this.battle?.result) return;
    this.endBattle();
    this.resume(undefined);
  }

  /** Closes the battle and pushes the post-battle steps (evolution) that hand its result back to the script. */
  private endBattle() {
    const result = this.battle!.result!, leveled = this.battle!.leveled;
    this.battle = null;
    if (result === 'lose') {
      for (const m of this.state.party) healMon(m);
      if (!this.battleSoft) {
        const r = this.state.respawn;
        this.warp(r.map, r.x, r.y, r.dir);
        this.out.push({ t: 'say', text: r.text });
      }
    }
    this.out.push({ t: 'checkpoint' });
    this.script!.stack.push(this.afterBattle(result, leveled));
  }

  private *afterBattle(result: BattleResult, leveled: Set<string>): Generator<Pause, BattleResult, any> {
    if (result === 'lose') return result;
    for (const m of this.state.party) {
      if (!leveled.has(m.uid) || m.hp <= 0) continue;
      const to = levelEvolution(m);
      if (!to) continue;
      const name = monName(m), from = speciesName(m.species);
      const c: number = yield { kind: 'ask', text: `What? ${name} is evolving!`, options: ['Let it evolve', 'Stop it'], cancel: 1 };
      if (c !== 0) { this.out.push({ t: 'say', text: `Huh? ${name} stopped evolving!` }); continue; }
      this.out.push({ t: 'evolve', from: speciesExtra(m.species).key, to: speciesExtra(to).key, fromName: name, toName: speciesName(to) });
      const learn = evolveMon(m, to);
      this.out.push({ t: 'me', name: 'me_get' }, { t: 'say', text: `Congratulations! Your ${from}\nevolved into ${speciesName(to)}!` });
      for (const id of learn.learned) this.out.push({ t: 'say', text: `${monName(m)} learned ${moveName(id)}!` });
      for (const id of learn.pending) yield* this.learnPrompt(m, id);
    }
    this.out.push({ t: 'checkpoint' });
    return result;
  }

  /** The "forget a move?" prompt outside battle. */
  private *learnPrompt(m: Mon, id: string): Generator<Pause, void, any> {
    const name = monName(m), mv = moveName(id);
    this.out.push({ t: 'say', text: `${name} wants to learn ${mv}.\nBut ${name} already knows four moves.` });
    const c: number = yield { kind: 'ask', text: `Forget a move to make room for ${mv}?`, options: [...m.moves.map(x => moveName(x.id)), `Don't learn ${mv}`], cancel: m.moves.length };
    if (c < m.moves.length) {
      const old = moveName(m.moves[c].id);
      replaceMove(m, c, id);
      this.out.push({ t: 'say', text: `1, 2 and... Poof!\n${name} forgot ${old}...` }, { t: 'say', text: `And... ${name} learned ${mv}!` });
    } else this.out.push({ t: 'say', text: `${name} did not learn ${mv}.` });
  }

  private battleHost() {
    const g = this;
    return {
      rng: g.rng, party: g.state.party, bag: g.state.bag, playerName: g.state.name,
      rules: g.content.rules, badges: g.state.badges.length, coil: g.state.coil,
      whiteout: () => {
        const rules = g.content.rules, top = Math.max(1, ...g.state.party.map(m => m.level));
        const loss = Math.min(g.state.money, rules.whiteoutBase[Math.min(g.state.badges.length, rules.whiteoutBase.length - 1)] * top);
        g.state.money -= loss;
        return loss;
      },
      emit: (e: ServerEvent) => g.out.push(e),
      addMon: (m: Mon) => g.addMon(m),
      giveMoney: (n: number) => { g.state.money += n; }
    };
  }

  private addMon(m: Mon): 'party' | 'box' {
    if (this.state.party.length < PARTY_MAX) { this.state.party.push(m); return 'party'; }
    this.state.box.push(m); return 'box';
  }

  private api(pack: string): ScriptApi {
    const g = this, s = this.state, out = this.out;
    const emit = (e: ServerEvent) => g.out.push(e);
    void out;
    const npcHandle = (id: string): NpcHandle => {
      const m = g.map;
      const def = m.npcs.find(n => n.id === id);
      if (!def) throw new Error(`No NPC "${id}" on ${m.key}`);
      const cur = () => g.npcState(m, def);
      return {
        id,
        get x() { return cur().x; }, get y() { return cur().y; }, get dir() { return cur().dir; }, get hidden() { return cur().hidden; },
        place(x, y, dir) { g.setNpc(m.key, def, { x, y, dir }); },
        show() { g.setNpc(m.key, def, { hidden: false }); },
        hide() { g.setNpc(m.key, def, { hidden: true }); },
        face(dir) { g.setNpc(m.key, def, { dir }); },
        facePlayer() { const c = cur(); g.setNpc(m.key, def, { dir: faceTo(c.x, c.y, s.x, s.y) }); },
        walk(dir, steps = 1, frames, async) {
          for (let i = 0; i < steps; i++) {
            const c = cur(), [dx, dy] = DIRS[dir];
            g.state.npcs[`${m.key}/${id}`] = { ...c, x: c.x + dx, y: c.y + dy, dir };
            emit({ t: 'walk', actor: id, dir, ...(frames ? { frames } : {}), ...(async ? { async: true } : {}) });
          }
        },
        exclaim() { emit({ t: 'sfx', name: 'exclaim' }); emit({ t: 'exclaim', actor: id }); }
      };
    };
    return {
      pack,
      player: {
        get name() { return s.name; }, get x() { return s.x; }, get y() { return s.y; }, get dir() { return s.dir; },
        face(dir) { s.dir = dir; emit({ t: 'face', actor: 'player', dir }); },
        faceTo(x, y) { s.dir = faceTo(s.x, s.y, x, y); emit({ t: 'face', actor: 'player', dir: s.dir }); },
        walk(dir, steps = 1) {
          for (let i = 0; i < steps; i++) { const [dx, dy] = DIRS[dir]; s.x += dx; s.y += dy; s.dir = dir; emit({ t: 'walk', actor: 'player', dir }); }
        }
      },
      get party() { return s.party; },
      flag: name => g.flag(pack, name),
      setFlag: (name, v) => { s.flags[ns(pack, name)] = v; },
      say: text => emit({ t: 'say', text: g.text(pack, text) }),
      t: key => g.text(pack, key),
      ask: (text, options, cancel) => ({ kind: 'ask', text: g.text(pack, text), options: options.map(o => g.text(pack, o)), ...(cancel !== undefined ? { cancel } : {}) }),
      askName: (text, suggestions) => ({ kind: 'name', text, suggestions }),
      pickLook: text => ({ kind: 'look', text }),
      pickSpecies: species => ({ kind: 'pickSpecies', species }),
      battle: opts => ({ kind: 'battle', opts }),
      setName: name => { s.name = name; },
      setLook: look => { s.look = look; },
      get period() { return g.period; },
      setTime: period => { s.clock = PERIOD_START[period]; },
      givePokemon: (species, level) => {
        const m = makeMon(species, level, g.rng, { ot: s.name });
        g.addMon(m);
        return m;
      },
      giveItem: (item, qty = 1) => { s.bag[item] = (s.bag[item] ?? 0) + qty; },
      hasItem: item => s.bag[item] ?? 0,
      takeItem: (item, qty = 1) => { if ((s.bag[item] ?? 0) < qty) return false; s.bag[item] -= qty; return true; },
      giveMoney: n => { s.money += n; },
      get money() { return s.money; },
      takeMoney: n => { if (s.money < n) return false; s.money -= n; return true; },
      giveBadge: (id, name) => { const key = ns(pack, id); if (!s.badges.includes(key)) s.badges.push(key); void name; },
      get badges() { return s.badges.length; },
      unlockCoil: mode => { s.coil = { ...s.coil, [mode]: true }; },
      mart: stock => g.mart(stock),
      heal: () => { for (const m of s.party) healMon(m); },
      partyAlive: () => g.partyAlive(),
      sfx: name => emit({ t: 'sfx', name }),
      me: name => emit({ t: 'me', name }),
      bgm: name => emit({ t: 'bgm', name }),
      cry: species => emit({ t: 'cry', key: speciesExtra(species).key }),
      wait: frames => emit({ t: 'wait', frames }),
      fade: (to, frames) => emit({ t: 'fade', to, ...(frames ? { frames } : {}) }),
      npc: npcHandle,
      warp: (map, x, y, dir) => g.warp(ns(pack, map), x, y, dir),
      setRespawn: (map, x, y, dir, text) => { s.respawn = { map: ns(pack, map), x, y, dir, text }; },
      freeSpotNear: (x, y) => {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
          if (!g.solid(x + dx, y + dy)) return [x + dx, y + dy];
        }
        return [x, y - 1];
      },
      checkpoint: () => emit({ t: 'checkpoint' }),
      chapterEnd: (title, subtitle) => emit({ t: 'chapterEnd', title, subtitle })
    };
  }

  // ---------- Mart ----------

  private *mart(stock: string[]): Generator<Pause, void, any> {
    const s = this.state, say = (text: string) => this.out.push({ t: 'say', text });
    for (;;) {
      const c: number = yield { kind: 'ask', text: `Welcome! How may I help you?\n(You have ${s.money} kr.)`, options: ['Buy', 'Sell', 'Done'], cancel: 2 };
      if (c === 2) { say('Please come again!'); return; }
      if (c === 0) {
        const items = stock.filter(id => ITEMS[id] && (ITEMS[id].minBadges ?? Infinity) <= s.badges.length);
        for (;;) {
          const i: number = yield { kind: 'ask', text: `What would you like? (${s.money} kr.)`, options: [...items.map(id => `${ITEMS[id].name}  ${ITEMS[id].price} kr.`), 'Back'], cancel: items.length };
          if (i >= items.length) break;
          const it = ITEMS[items[i]];
          const q: number = yield { kind: 'ask', text: `${it.name}: ${it.desc}\nHow many?`, options: ['1', '5', '10', 'Back'], cancel: 3 };
          if (q === 3) continue;
          const n = [1, 5, 10][q], cost = n * it.price;
          if (s.money < cost) { say('You don\'t have enough money.'); continue; }
          s.money -= cost; s.bag[items[i]] = (s.bag[items[i]] ?? 0) + n;
          this.out.push({ t: 'sfx', name: 'select' });
          say(`Here you are! ${n} × ${it.name} for ${cost} kr.\nThank you!`);
        }
      } else {
        for (;;) {
          const owned = Object.keys(s.bag).filter(id => s.bag[id] > 0 && ITEMS[id]);
          if (!owned.length) { say('You have nothing I can buy.'); break; }
          const i: number = yield { kind: 'ask', text: `What would you like to sell? (${s.money} kr.)`, options: [...owned.map(id => `${ITEMS[id].name} x${s.bag[id]}  ${ITEMS[id].price / 2} kr.`), 'Back'], cancel: owned.length };
          if (i >= owned.length) break;
          const id = owned[i], price = ITEMS[id].price / 2;
          s.bag[id]--; s.money += price;
          this.out.push({ t: 'sfx', name: 'select' });
          say(`Sold one ${ITEMS[id].name} for ${price} kr.`);
        }
      }
    }
  }

  // ---------- view ----------

  view(): WorldView {
    const s = this.state, m = this.map;
    return {
      name: s.name, map: m.key, x: s.x, y: s.y, dir: s.dir,
      npcs: m.npcs.filter(n => this.npcVisible(m, n)).map(n => {
        const st = this.npcState(m, n);
        return { id: n.id, sprite: n.sprite, x: st.x, y: st.y, dir: st.dir, ...(n.object ? { object: true } : {}), ...(n.floor ? { floor: true } : {}) };
      }),
      party: s.party.map(monView), bag: { ...s.bag }, money: s.money, badges: s.badges.length,
      look: s.look, period: this.period, clock: Math.floor(s.clock),
      ...(this.debug ? { debug: true } : {})
    };
  }

  summary(): string {
    const s = this.state;
    const lead = s.party[0];
    return `${s.name} · ${this.map.name}${lead ? ` · ${monName(lead)} Lv. ${lead.level}` : ''}`;
  }
}

/** Upgrades older saves. Add a step here whenever SaveData changes shape. */
export function migrate(save: SaveData): SaveData {
  const s = structuredClone(save);
  s.box ??= []; s.npcs ??= {}; s.flags ??= {};
  s.badges ??= []; s.coil ??= {}; s.repel ??= 0;   // v2: badges, Coil unlocks, Repel
  s.look ??= 'boy'; s.clock ??= 8 * 60;              // character look and world clock (no version bump: defaults are safe)
  s.v = SAVE_VERSION;
  return s;
}
