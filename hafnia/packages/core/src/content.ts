// Content packs. The base game is a pack, and future DLC (new cities, regions, countries)
// are more packs. The engine never refers to a map, flag or NPC by name: everything a pack
// adds is namespaced as "pack:id". Standard species and moves keep their Showdown ids so a
// Pokémon caught in one region is the same Pokémon in every other.
import { Dex } from '@pkmn/sim';
import type { Dir } from './protocol';
import { COIL_DEFAULTS, type CoilRules } from './coil';
import { registerSpeciesExtra, type SpeciesExtra } from './pokemon';
import type { Script } from './script';

/** A building: tileset parts [srcX, srcY, w, h, dx, dy], or `draw` naming a client-drawn building. */
export interface Stamp { parts?: number[][]; draw?: string; w: number; h: number; door?: [number, number] }

export interface NpcDef {
  id: string;
  sprite: string;
  x: number; y: number; dir: Dir;
  object?: boolean;            // item ball etc.: never turns to face the player
  hidden?: boolean;            // starts hidden until a script shows it
  when?: (flags: FlagReader) => boolean;
  talk?: Script;
  trainer?: { sight: number; flag: string };
  /** Only shown in these periods of the day (night trainers etc.). */
  period?: Period[];
  /** Walkable object drawn under the player (lily pads, floor switches). */
  floor?: boolean;
  /** Moves one tile along `dir` every world tick (each step, bump or wait), wrapping from max back to min. */
  patrol?: { dir: Dir; min: number; max: number };
  /** Runs when a patrolling NPC runs into the player. */
  bump?: Script;
}

export type Period = 'morning' | 'day' | 'evening' | 'night';

/** A tile event: `step` runs when the player walks onto it, `interact` when the player faces it and presses A.
 *  Matches a rectangle (x, y, w, h) or every tile of a kind (`tile`). */
export interface MapEvent {
  x?: number; y?: number; w?: number; h?: number; tile?: string;
  on: 'step' | 'interact';
  when?: (flags: FlagReader) => boolean;
  run: Script;
}

/** Stepping on (x, y) moves the player to (tx, ty) on map `to` (doormats, ladders, stairs). */
export interface Warp { x: number; y: number; to: string; tx: number; ty: number; dir: Dir }

export interface MapDef {
  id: string;                  // local id; the engine uses `${pack}:${id}`
  name: string;
  w: number; h: number;
  grid: string[][];            // tile chars, see SOLID_TILES / GRASS_TILE
  buildings: { s: string; x: number; y: number; id?: string }[];
  exits?: Partial<Record<Dir, { to: string; offset: number; guard?: Script }>>;  // offset shifts x (up/down) or y (left/right); a guard returns false to block
  doors?: Record<string, Script>;   // building id -> script run on bumping its door
  npcs: NpcDef[];
  encounters?: [number, string][];  // [weight %, species]
  levels?: [number, number];
  encountersNight?: [number, string][];
  /** Tile that triggers wild encounters (default tall grass). */
  encounterTile?: string;
  /** Old Rod table, used when the player faces water. */
  fishing?: [number, string][];
  fishLevels?: [number, number];
  warps?: Warp[];
  events?: MapEvent[];
  /** Runs once the player arrives on the map (after any running script ends). */
  onEnter?: Script;
  indoor?: boolean;            // no day-night tint
  dark?: boolean;              // tunnels: lit only around the player
  battleBg: string;
  bgm: string;
}

/** Balance numbers (systems.md principle 4). The base pack can override any of them. */
export interface Rules {
  encounterRate: number;
  prizeBase: Record<string, number>;   // prize = base for the trainer's title × level of their last Pokémon
  prizeDefault: number;
  whiteoutBase: number[];              // money lost = base for the badge count × highest party level
  obedienceBase: number;               // other trainers' Pokémon obey up to base + perBadge × badges
  obediencePerBadge: number;
  /** Exp for party members who didn't fight (the Exp Share), as a share of the full amount. */
  benchExp: number;
  /** Soft level caps by badge count (the next leader's ace): Pokémon at or above it get `overCapExp` of the Exp. */
  levelCaps: number[];
  overCapExp: number;
  coil: CoilRules;
}

export const DEFAULT_RULES: Rules = {
  encounterRate: 0.1,
  prizeBase: { Youngster: 16, Cyclist: 24, Skater: 20, Grunt: 40, Rival: 60, Leader: 120, 'Elite Four': 160, Champion: 200 },
  prizeDefault: 24,
  whiteoutBase: [8, 16, 24, 36, 48, 64, 80, 100, 120],
  obedienceBase: 20, obediencePerBadge: 5,
  benchExp: 0.5,
  levelCaps: [14, 19, 24, 29, 34, 39, 44, 49, 55, 62], overCapExp: 0.1,
  coil: COIL_DEFAULTS
};

export interface PackManifest {
  id: string; name: string; version: string; requires?: string[];
  species: string[];
  /** Regional Pokédex order (defaults to `species`); level evolutions are slotted in after each. */
  dex?: string[];
  images: Record<string, string>;   // asset key -> path inside the Essentials repo
  /** Sprites and cries for the pack's own Pokémon, by key (LANGELIRA); "pack:" paths are inside the pack. */
  pokemon?: Record<string, { front: string; back: string; icons: string; cry: string }>;
  audio: Record<string, string>;
}

export interface Pack {
  manifest: PackManifest;
  maps: Record<string, MapDef>;
  stamps: Record<string, Stamp>;
  /** Species data for creatures Showdown does not know (e.g. our legendaries). */
  speciesExtra?: Record<string, SpeciesExtra>;
  /** Raw Showdown data merged into the simulator's dex: { Pokedex, Moves, Learnsets, ... }. */
  simData?: Record<string, Record<string, unknown>>;
  /** Text by key ("p.mum.1"). say() and ask() look keys up here; `{player}` and textVars are filled in. */
  strings?: Record<string, string>;
  textVars?: (flags: FlagReader) => Record<string, string>;
  /** Balance overrides; only the base pack's are used. */
  rules?: Partial<Rules>;
  /** Only the base game sets this: where a new game begins. */
  newGame?: { map: string; x: number; y: number; dir: Dir; intro: Script; respawn: Respawn };
}

export interface Respawn { map: string; x: number; y: number; dir: Dir; text: string }
export type FlagReader = (name: string) => any;

// Outdoor: T trees, ~ sea, o still water, H house fronts, x containers, n railings.
// Indoor and tunnels: w walls, K furniture, R rock, p pipes, P palm planters. Ice (i) is walkable but slippery.
export const SOLID_TILES = new Set(['T', '~', 'o', 'H', 'x', 'n', 'w', 'K', 'R', 'p', 'P', 'u', 'j']);
export const WATER_TILES = new Set(['~', 'o']);
export const GRASS_TILE = 'g';
/** Ice: the player slides until something stops them (Gym 3). */
export const ICE_TILES = new Set(['i']);
/** Trick Room floor: while standing on it, every step goes the opposite way to the one pressed (Gym 5). */
export const TRICK_TILES = new Set(['z']);
export const OPPOSITE: Record<'up' | 'down' | 'left' | 'right', 'up' | 'down' | 'left' | 'right'> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const ns = (pack: string, id: string) => (id.includes(':') ? id : `${pack}:${id}`);

export class Content {
  readonly packs = new Map<string, Pack>();
  readonly maps = new Map<string, MapDef & { key: string; pack: string }>();

  constructor(packs: Pack[]) {
    for (const p of packs) this.add(p);
    for (const p of packs) for (const r of p.manifest.requires ?? []) {
      if (!this.packs.has(r)) throw new Error(`Pack "${p.manifest.id}" needs pack "${r}"`);
    }
  }

  private add(p: Pack) {
    const id = p.manifest.id;
    if (this.packs.has(id)) throw new Error(`Pack "${id}" loaded twice`);
    this.packs.set(id, p);
    for (const [k, v] of Object.entries(p.speciesExtra ?? {})) registerSpeciesExtra(k, v);
    if (p.simData) {
      const data = Dex.data as unknown as Record<string, Record<string, unknown>>;
      for (const [table, entries] of Object.entries(p.simData)) Object.assign(data[table], entries);
    }
    for (const m of Object.values(p.maps)) this.maps.set(ns(id, m.id), { ...m, key: ns(id, m.id), pack: id });
  }

  map(key: string) {
    const m = this.maps.get(key);
    if (!m) throw new Error(`Unknown map "${key}" (is its pack installed?)`);
    return m;
  }

  stamp(pack: string, s: string): Stamp {
    const st = this.packs.get(pack)?.stamps[s];
    if (!st) throw new Error(`Unknown stamp "${s}" in pack "${pack}"`);
    return st;
  }

  get rules(): Rules {
    const r = this.base.rules ?? {};
    return { ...DEFAULT_RULES, ...r, prizeBase: { ...DEFAULT_RULES.prizeBase, ...r.prizeBase }, coil: { ...DEFAULT_RULES.coil, ...r.coil } };
  }

  get base(): Pack {
    for (const p of this.packs.values()) if (p.newGame) return p;
    throw new Error('No base game pack installed');
  }
}
