// The authoritative game: world rules, story scripts, battles and the save state.
// It has no DOM, network or timers. Feed it intents, get back events. A Web Worker runs it
// for solo play; the online server will run the very same class.
import { BattleSession, ITEMS } from './battle';
import { Content, GRASS_TILE, SOLID_TILES, ns, type MapDef, type NpcDef, type Respawn } from './content';
import { healMon, makeMon, maxHp, monName, monView, speciesExtra, speciesName, speciesTypes, type Mon } from './pokemon';
import type { Dir, Intent, ServerEvent, WorldView } from './protocol';
import { Rng } from './rng';
import type { NpcHandle, Pause, Script, ScriptApi } from './script';

export const SAVE_VERSION = 1;

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
}

const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const PARTY_MAX = 6;
const ENCOUNTER_RATE = 0.12;

export function faceTo(ax: number, ay: number, bx: number, by: number): Dir {
  const dx = bx - ax, dy = by - ay;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export class SaveError extends Error {}

export class Game {
  readonly rng: Rng;
  private out: ServerEvent[] = [];
  private script: { gen: Generator<Pause, unknown, any>; onDone?: (v: unknown) => void } | null = null;
  private pause: Pause | null = null;
  private battle: BattleSession | null = null;
  private battleSoft = false;
  private doorCache = new Map<string, Map<string, string>>();

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
      respawn: { ...start.respawn, map: ns(base.manifest.id, start.respawn.map) }, rng: seed >>> 0
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
      if (this.battle) {
        if (intent.t === 'battle') this.battleAct(intent.action);
      } else if (this.pause) {
        if (intent.t === 'answer') this.answer(intent.index);
      } else {
        switch (intent.t) {
          case 'turn': this.state.dir = intent.dir; break;
          case 'step': this.step(intent.dir); break;
          case 'interact': this.interact(); break;
          case 'useItem': this.useItem(intent.item, intent.uid); break;
          case 'lead': this.lead(intent.uid); break;
          case 'save': this.out.push({ t: 'checkpoint' }, { t: 'say', text: 'Your progress was saved.' }); break;
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
    return !this.npcState(m, n).hidden && (!n.when || n.when(name => this.flag(m.pack, name)));
  }

  private npcAt(m: MapDef & { key: string; pack: string }, x: number, y: number) {
    return m.npcs.find(n => { const s = this.npcState(m, n); return s.x === x && s.y === y && this.npcVisible(m, n); });
  }

  private buildingAt(m: MapDef & { key: string; pack: string }, x: number, y: number) {
    return m.buildings.some(b => {
      const st = this.content.stamp(m.pack, b.s);
      return x >= b.x && x < b.x + st.w && y >= b.y && y < b.y + st.h;
    });
  }

  solid(x: number, y: number, mapKey = this.state.map): boolean {
    const m = this.content.map(mapKey);
    const t = this.tile(m, x, y);
    if (t === null || SOLID_TILES.has(t)) return true;
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
      };
      if (ex.guard) this.run(ex.guard, m.pack, ok => { if (ok !== false) go(); });
      else go();
      return;
    }
    const door = this.doors(m).get(`${nx},${ny}`);
    if (door) { this.openDoor(m, door); return; }
    if (this.solid(nx, ny)) return;
    s.x = nx; s.y = ny;
    this.out.push({ t: 'walk', actor: 'player', dir });
    this.afterStep();
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
    if (this.tile(m, s.x, s.y) === GRASS_TILE && m.encounters?.length && this.partyAlive() && this.rng.chance(ENCOUNTER_RATE)) {
      let r = this.rng.next() * 100, sp = m.encounters[0][1];
      for (const [w, id] of m.encounters) { if (r < w) { sp = id; break; } r -= w; }
      const [lo, hi] = m.levels ?? [2, 4];
      const level = lo + this.rng.int(hi - lo + 1);
      const bg = m.battleBg;
      this.run(function* (api) { return yield api.battle({ kind: 'wild', foes: [{ species: sp, level }], bg }); }, m.pack);
    }
  }

  private interact() {
    const s = this.state, m = this.map, [dx, dy] = DIRS[s.dir];
    const n = this.npcAt(m, s.x + dx, s.y + dy);
    if (n?.talk) {
      if (!n.object) this.setNpc(m.key, n, { dir: faceTo(s.x + dx, s.y + dy, s.x, s.y) });
      this.run(n.talk, m.pack);
      return;
    }
    const door = this.doors(m).get(`${s.x + dx},${s.y + dy}`);
    if (door) this.openDoor(m, door);
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
    this.emitMap();
  }

  private emitMap() {
    const m = this.map, s = this.state;
    this.out.push({ t: 'map', map: m.key, name: m.name, x: s.x, y: s.y, dir: s.dir, bgm: m.bgm });
  }

  private partyAlive() { return this.state.party.some(p => p.hp > 0); }

  private useItem(item: string, uid: string) {
    const it = ITEMS[item], m = this.state.party.find(p => p.uid === uid);
    if (!it?.heal || !this.state.bag[item] || !m) return;
    if (m.hp <= 0 || m.hp >= maxHp(m)) { this.out.push({ t: 'say', text: 'It won\'t have any effect.' }); return; }
    const before = m.hp;
    m.hp = Math.min(maxHp(m), m.hp + it.heal);
    this.state.bag[item]--;
    this.out.push({ t: 'sfx', name: 'select' }, { t: 'say', text: `${monName(m)} recovered ${m.hp - before} HP.` });
  }

  private lead(uid: string) {
    const i = this.state.party.findIndex(p => p.uid === uid);
    if (i > 0) this.state.party.unshift(...this.state.party.splice(i, 1));
  }

  // ---------- scripts ----------

  private flag(pack: string, name: string) { return this.state.flags[ns(pack, name)]; }

  private run(script: Script, pack: string, onDone?: (v: unknown) => void) {
    this.script = { gen: script(this.api(pack)), onDone };
    this.resume(undefined);
  }

  private resume(value: unknown) {
    const sc = this.script!;
    let r = sc.gen.next(value);
    while (!r.done) {
      const p = r.value;
      if (p.kind === 'ask') { this.pause = p; this.out.push({ t: 'prompt', text: p.text, options: p.options, ...(p.cancel !== undefined ? { cancel: p.cancel } : {}) }); return; }
      if (p.kind === 'pickSpecies') {
        this.pause = p;
        this.out.push({ t: 'pickSpecies', species: p.species.map(x => ({ species: x.species, key: speciesExtra(x.species).key, name: speciesName(x.species), types: speciesTypes(x.species), blurb: x.blurb })) });
        return;
      }
      if (p.kind === 'battle') {
        if (!this.partyAlive()) { r = sc.gen.next('lose'); continue; }
        this.battleSoft = !!p.opts.soft;
        this.battle = new BattleSession(this.battleHost(), p.opts);
        this.battle.start();
        if (this.battle.result) { r = sc.gen.next(this.endBattle()); continue; }
        return;
      }
    }
    this.script = null;
    sc.onDone?.(r.value);
  }

  private answer(index: number) {
    const p = this.pause!;
    const n = p.kind === 'ask' ? p.options.length : p.kind === 'pickSpecies' ? p.species.length : 0;
    if (!Number.isInteger(index) || index < 0 || index >= n) { this.out.push({ t: 'error', message: 'Invalid answer' }); return; }
    this.pause = null;
    this.resume(index);
  }

  private battleAct(action: import('./protocol').BattleAction) {
    this.battle!.act(action);
    if (this.battle?.result) this.resume(this.endBattle());
  }

  private endBattle() {
    const result = this.battle!.result!;
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
    return result;
  }

  private battleHost() {
    const g = this;
    return {
      rng: g.rng, party: g.state.party, bag: g.state.bag, playerName: g.state.name,
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
        walk(dir, steps = 1, frames) {
          for (let i = 0; i < steps; i++) {
            const c = cur(), [dx, dy] = DIRS[dir];
            g.state.npcs[`${m.key}/${id}`] = { ...c, x: c.x + dx, y: c.y + dy, dir };
            emit({ t: 'walk', actor: id, dir, ...(frames ? { frames } : {}) });
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
        faceTo(x, y) { s.dir = faceTo(s.x, s.y, x, y); emit({ t: 'face', actor: 'player', dir: s.dir }); }
      },
      get party() { return s.party; },
      flag: name => g.flag(pack, name),
      setFlag: (name, v) => { s.flags[ns(pack, name)] = v; },
      say: text => emit({ t: 'say', text }),
      ask: (text, options, cancel) => ({ kind: 'ask', text, options, ...(cancel !== undefined ? { cancel } : {}) }),
      pickSpecies: species => ({ kind: 'pickSpecies', species }),
      battle: opts => ({ kind: 'battle', opts }),
      setName: name => { s.name = name; },
      givePokemon: (species, level) => {
        const m = makeMon(species, level, g.rng, { ot: s.name });
        g.addMon(m);
        return m;
      },
      giveItem: (item, qty = 1) => { s.bag[item] = (s.bag[item] ?? 0) + qty; },
      hasItem: item => s.bag[item] ?? 0,
      giveMoney: n => { s.money += n; },
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

  // ---------- view ----------

  view(): WorldView {
    const s = this.state, m = this.map;
    return {
      name: s.name, map: m.key, x: s.x, y: s.y, dir: s.dir,
      npcs: m.npcs.filter(n => this.npcVisible(m, n)).map(n => {
        const st = this.npcState(m, n);
        return { id: n.id, sprite: n.sprite, x: st.x, y: st.y, dir: st.dir, ...(n.object ? { object: true } : {}) };
      }),
      party: s.party.map(monView), bag: { ...s.bag }, money: s.money
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
  s.v = SAVE_VERSION;
  return s;
}
