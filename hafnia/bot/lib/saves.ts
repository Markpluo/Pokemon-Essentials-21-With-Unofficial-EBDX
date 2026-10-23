// Ready-made save files, so a scenario can start where its feature is instead of replaying the
// story. They are produced by playing game-core directly (no browser, a second or two), so they
// are real saves with the right story flags. `bot.loadSave(save)` puts one in the browser.
import type { Dir, Game, Intent, SaveData, ServerEvent } from '@hafnia/core';
import { findPath, mapKey, world } from './world';

/** Plays game-core headlessly: answers prompts from `answers` (then the first option) and fights with the first usable move. */
export class CoreDriver {
  answers: number[] = [];
  log: ServerEvent[] = [];
  constructor(public game: Game, first: ServerEvent[]) { this.take(first); }

  static async newGame(seed = 7) {
    const { core, content } = await world();
    const { game, events } = core.Game.newGame(content, seed);
    return new CoreDriver(game, events);
  }
  get s() { return this.game.state; }

  send(intent: Intent) { this.take(this.game.handle(intent)); }
  private take(evs: ServerEvent[]) {
    this.log.push(...evs);
    for (const e of evs) if (e.t === 'error') throw new Error(e.message);
    const last = [...evs].reverse().find(e => ['prompt', 'pickSpecies', 'battleRequest', 'askName', 'pickLook'].includes(e.t));
    if (!last) return;
    if (last.t === 'askName') this.send({ t: 'answer', index: 0, text: last.suggestions[0] });
    else if (last.t === 'pickLook') this.send({ t: 'answer', index: 0 });
    else if (last.t === 'prompt' || last.t === 'pickSpecies') this.send({ t: 'answer', index: this.answers.shift() ?? 0 });
    else if (last.t === 'battleRequest') {
      const r = last.request;
      if (r.forceSwitch) this.send({ t: 'battle', action: { kind: 'switch', uid: r.party.find(p => p.hp > 0 && p.uid !== r.activeUid)!.uid } });
      else this.send({ t: 'battle', action: { kind: 'move', index: Math.max(0, r.moves.findIndex(m => !m.disabled)) } });
    }
  }

  walkTo(tx: number, ty: number) {
    for (let guard = 0; guard < 400 && (this.s.x !== tx || this.s.y !== ty); guard++) {
      const view = this.game.view();
      const path = findPath(this.s.map, this.s.x, this.s.y, tx, ty, view.npcs);
      if (!path) throw new Error(`CoreDriver: no path to ${tx},${ty} on ${this.s.map} from ${this.s.x},${this.s.y}`);
      const map = this.s.map;
      this.send({ t: 'step', dir: path[0] });
      if (this.s.map !== map) return;
    }
  }
  exit(dir: Dir, x: number, y: number) { this.walkTo(x, y); this.send({ t: 'step', dir }); }
  save(): SaveData { return this.game.toSave(); }
}

/** Fresh game, standing in the King's Garden right below the Palm House door: stepping up starts the starter scene. */
export async function beforeStarter(seed = 7): Promise<SaveData> {
  const d = await CoreDriver.newGame(seed);
  d.s.flags['debug:noEncounters'] = true;
  d.walkTo(6, 6); d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31);
  d.walkTo(14, 11);
  delete d.s.flags['debug:noEncounters'];
  return d.save();
}

export const STARTER_INDEX: Record<string, number> = { sprigatito: 0, charmander: 1, popplio: 2, eevee: 3, pikachu: 4 };

/** Just after the starter scene and Lukas's first battle (in the Palm House, Coil online, bike in the bag). */
export async function afterStarter(starter: keyof typeof STARTER_INDEX = 'sprigatito', seed = 7): Promise<SaveData> {
  const d = await CoreDriver.newGame(seed);
  d.s.flags['debug:noEncounters'] = true;
  d.answers.push(STARTER_INDEX[starter], 0, 1); // starter, yes, no nickname
  d.walkTo(6, 6); d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31); d.exit('up', 14, 11);
  if (d.s.flags['hafnia:starter'] !== starter) throw new Error(`afterStarter: got ${String(d.s.flags['hafnia:starter'])}`);
  delete d.s.flags['debug:noEncounters'];
  return d.save();
}

export interface SaveTweaks {
  /** Map id (`route1` or `hafnia:route1`) and where to stand. Without x/y the player keeps the save's spot, which must be on that map. */
  map?: string; x?: number; y?: number; dir?: Dir;
  /** Replace the team, e.g. [{ species: 'ditto', level: 30 }]. `ot` is the original trainer (default: the player). */
  party?: { species: string; level: number; moves?: string[]; gender?: 'M' | 'F' | ''; ot?: string }[];
  bag?: Record<string, number>;
  money?: number;
  /** Story flags without the pack prefix: { ch1: true }. */
  flags?: Record<string, unknown>;
  badges?: string[];
  coil?: { copper?: boolean; current?: boolean; harmony?: boolean };
  noEncounters?: boolean;
  /** World clock in minutes since midnight (02:00 is 120). */
  clock?: number;
}

/** Changes a save: put the player anywhere, with any team and bag. Good for feature scenarios (daycare, gyms, PC...). */
export async function tweak(save: SaveData | Promise<SaveData>, t: SaveTweaks): Promise<SaveData> {
  const { core, content } = await world();
  const { healMon, makeMon, maxPp } = core;
  const s = structuredClone(await save);
  const rng = new core.Rng(s.rng);
  if (t.map) {
    s.map = mapKey(t.map);
    const m = content.map(s.map);
    if (t.x === undefined || t.y === undefined) throw new Error('tweak: give x and y with map');
    if (t.x >= m.w || t.y >= m.h) throw new Error(`tweak: ${t.x},${t.y} is outside ${s.map}`);
  }
  if (t.x !== undefined) s.x = t.x;
  if (t.y !== undefined) s.y = t.y;
  if (t.dir) s.dir = t.dir;
  if (t.party) s.party = t.party.map(p => {
    const m = makeMon(p.species, p.level, rng, { ot: p.ot ?? s.name });
    if (p.moves) m.moves = p.moves.map(id => ({ id, pp: maxPp(id) }));
    if (p.gender !== undefined) m.gender = p.gender;
    healMon(m);
    return m;
  });
  if (t.bag) s.bag = { ...s.bag, ...t.bag };
  if (t.money !== undefined) s.money = t.money;
  if (t.flags) for (const [k, v] of Object.entries(t.flags)) s.flags[k.includes(':') ? k : `hafnia:${k}`] = v;
  if (t.badges) s.badges = t.badges.map(b => (b.includes(':') ? b : `hafnia:${b}`));
  if (t.coil) s.coil = { ...s.coil, ...t.coil };
  if (t.noEncounters !== undefined) s.flags['debug:noEncounters'] = t.noEncounters;
  if (t.clock !== undefined) s.clock = t.clock;
  return s;
}
