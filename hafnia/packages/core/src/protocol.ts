// The message protocol between a client and a game server.
// Solo play runs the server in a Web Worker (LocalServer); online play will run the same
// game-core on a real server. The client only ever sends intents and renders events.

export type Dir = 'up' | 'down' | 'left' | 'right';
export type StatusId = '' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';
export type Weather = 'rain' | 'sun' | 'sand' | 'snow' | 'none';

// ---------- client -> server ----------
export type CoilMode = 'copper' | 'current' | 'harmony';
export type BattleAction =
  | { kind: 'move'; index: number; mode?: CoilMode; target?: Slot }
  | { kind: 'switch'; uid: string }
  | { kind: 'item'; item: string; uid: string }
  | { kind: 'ball'; item: string }
  | { kind: 'run' };

export type Intent =
  | { t: 'title' }
  | { t: 'newGame' }
  | { t: 'continue'; slot?: SaveSlot }
  | { t: 'turn'; dir: Dir }
  | { t: 'step'; dir: Dir }
  | { t: 'interact' }
  | { t: 'answer'; index: number; text?: string }
  | { t: 'tick'; seconds: number }
  | { t: 'battle'; action: BattleAction }
  | { t: 'useItem'; item: string; uid: string }
  | { t: 'lead'; uid: string }
  | { t: 'save'; slot?: SaveSlot }
  | { t: 'slots' }
  | { t: 'autosave' }
  | { t: 'debug'; cmd: DebugCommand; arg?: string | number }
  | { t: 'dex' }
  /** PC storage, only while a PC is open: deposit/withdraw/release a Pokémon by uid, or close it. */
  | { t: 'pc'; op: 'deposit' | 'withdraw' | 'release' | 'close'; uid?: string };

export type SaveSlot = 'auto' | 1 | 2 | 3;
export interface SlotInfo { slot: SaveSlot; summary: string | null }
export type DebugCommand = 'givePokemon' | 'heal' | 'levelUp' | 'items' | 'money' | 'unlockCoil' | 'encounters' | 'warp' | 'badge' | 'time' | 'hatchEggs' | 'layEgg' | 'multiBattle';

// ---------- server -> client ----------
export interface MoveView {
  id: string; name: string; type: string; category: 'Physical' | 'Special' | 'Status'; power: number; pp: number; maxpp: number; disabled?: boolean;
  /** In a multi battle: the move hits one Pokémon the player picks. */
  aim?: boolean;
}
export interface MonView {
  uid: string; species: string; key: string; name: string; types: string[]; level: number;
  hp: number; maxhp: number; status: StatusId; moves: MoveView[];
  exp: number; expLo: number; expHi: number; gender: '' | 'M' | 'F'; shiny: boolean;
  /** Present for eggs, which show no species, level or moves. */
  egg?: { hint: string };
  /** The summary screen's details (not for eggs). */
  info?: { nature: string; ability: string; abilityText: string; item?: string; ot?: string; ball?: string; stats: { atk: number; def: number; spa: number; spd: number; spe: number } };
}
/** One Pokédex line. Unseen species show only their number; caught ones show their entry. */
export interface DexEntry {
  n: number; species: string; seen: boolean; caught: boolean;
  key?: string; name?: string; types?: string[];
  category?: string; text?: string; height?: number; weight?: number;
}
export interface NpcView { id: string; sprite: string; x: number; y: number; dir: Dir; object?: boolean; floor?: boolean }
export type Look = 'boy' | 'girl';
export type DayPeriod = 'morning' | 'day' | 'evening' | 'night';
export interface WorldView {
  name: string; map: string; x: number; y: number; dir: Dir;
  npcs: NpcView[]; party: MonView[]; bag: Record<string, number>; money: number;
  badges: number; debug?: boolean;
  look: Look; period: DayPeriod; clock: number;   // clock: minutes since midnight, in game time
  dex: { seen: number; caught: number };
  goal?: string;                                  // what the story wants next, for the start menu
}

export type BattleSide = 'ally' | 'foe';
/** Which of a side's two places in a multi battle: 0 is the player's (or the first trainer's), 1 the partner's (or the second trainer's). Absent means 0. */
export type Slot = 0 | 1;
export interface BattleMonView {
  uid?: string; species: string; key: string; name: string; level: number; hp: number; maxhp: number;
  status: StatusId; gender: '' | 'M' | 'F'; shiny: boolean; exp?: number; expLo?: number; expHi?: number;
}
export type BattleEvent =
  | { b: 'text'; text: string }
  | { b: 'trainerOut'; text: string; count: number }
  | { b: 'switch'; side: BattleSide; slot?: Slot; mon: BattleMonView; text: string }
  | { b: 'recall'; side: BattleSide; slot?: Slot; text: string }
  /** `id` picks the animation; `target` is the side the move aimed at (absent for field moves); `miss` and `still` trim it. */
  | { b: 'move'; side: BattleSide; slot?: Slot; text: string; id: string; type: string; category: 'Physical' | 'Special' | 'Status'; target?: BattleSide; targetSlot?: Slot; miss?: boolean; still?: boolean }
  | { b: 'hp'; side: BattleSide; slot?: Slot; hp: number; maxhp: number; effect: 'super' | 'weak' | 'normal' | 'heal' | 'residual'; crit?: boolean; cause?: string }
  | { b: 'boost'; side: BattleSide; slot?: Slot; up: boolean }
  | { b: 'weather'; weather: Weather; upkeep?: boolean }
  | { b: 'status'; side: BattleSide; slot?: Slot; status: StatusId }
  | { b: 'faint'; side: BattleSide; slot?: Slot; text: string }
  | { b: 'exp'; side: BattleSide; exp: number; expLo: number; expHi: number; level: number; hp: number; maxhp: number }
  /** `ball` is the item id of the ball thrown (its art). */
  | { b: 'throw'; shakes: number; caught: boolean; ball?: string }
  | { b: 'flee' }
  | { b: 'coil'; side: BattleSide; coil: CoilView }
  | { b: 'copper'; side: BattleSide; text: string }
  | { b: 'current'; side: BattleSide; text: string }
  | { b: 'overcharge'; side: BattleSide; text: string }
  | { b: 'harmony'; side: BattleSide; text: string };

/** A side's Coil gauge. `ready` is the pip count needed to activate. */
export interface CoilView { pips: number; max: number; ready: number; used: boolean; overcharge?: boolean }

export interface BattleRequest {
  moves: MoveView[];
  forceSwitch: boolean;
  /** The active Pokémon can't switch out (Mean Look, Shadow Tag, a binding move). */
  trapped?: boolean;
  canCatch: boolean;
  canRun: boolean;
  activeUid: string;
  party: MonView[];
  bag: Record<string, number>;
  /** Present when the player's Coil is online. A string says why a mode can't be used now. */
  coil?: CoilView & { copper: string | null; current: string | null; harmony?: string | null };
  /** Multi battles: the opposing Pokémon a move with `aim` can target. */
  targets?: { slot: Slot; name: string }[];
}

export interface BattleStart {
  kind: 'wild' | 'trainer';
  bg: string;
  bgm: string;
  trainer?: { name: string; title: string; sprite: string };
  foeCount: number;
  /** Multi battles: the partner beside the player and the second opposing trainer. */
  multi?: { partner: { name: string; sprite: string }; second: { name: string; title: string; sprite: string }; foeCount2: number };
  coil?: { ally?: CoilView; foe?: CoilView };
}

export type ServerEvent =
  | { t: 'title'; hasSave: boolean; summary?: string; slots?: SlotInfo[] }
  | { t: 'slots'; slots: SlotInfo[] }
  | { t: 'evolve'; from: string; to: string; fromName: string; toName: string }
  | { t: 'hatch'; key: string; name: string; shiny: boolean }
  | { t: 'view'; view: WorldView }
  | { t: 'say'; text: string }
  | { t: 'prompt'; text: string; options: string[]; cancel?: number }
  | { t: 'askName'; text: string; suggestions: string[] }
  | { t: 'pickLook'; text: string; options: { look: Look; sprite: string; label: string }[] }
  | { t: 'pickSpecies'; species: { species: string; key: string; name: string; types: string[]; blurb: string }[] }
  | { t: 'sfx'; name: string }
  | { t: 'me'; name: string }
  | { t: 'bgm'; name: string | null }
  | { t: 'cry'; key: string }
  | { t: 'face'; actor: string; dir: Dir }
  | { t: 'walk'; actor: string; dir: Dir; frames?: number; async?: boolean }
  | { t: 'place'; actor: string; x: number; y: number; dir: Dir; sprite?: string; hidden?: boolean }
  | { t: 'exclaim'; actor: string }
  | { t: 'map'; map: string; name: string; x: number; y: number; dir: Dir; bgm: string; npcs: NpcView[] }
  | { t: 'wait'; frames: number }
  | { t: 'fade'; to: number; frames?: number }
  | { t: 'battleStart'; battle: BattleStart }
  | { t: 'battle'; ev: BattleEvent }
  | { t: 'battleRequest'; request: BattleRequest }
  | { t: 'battleEnd'; result: BattleResult }
  | { t: 'chapterEnd'; title: string; subtitle: string }
  | { t: 'checkpoint' }
  | { t: 'dex'; entries: DexEntry[] }
  /** The PC is open (or changed): every boxed Pokémon, oldest first. */
  | { t: 'pc'; box: MonView[] }
  | { t: 'error'; message: string };

export type BattleResult = 'win' | 'lose' | 'run' | 'caught';

/** What a client talks to. LocalConnection (solo) and a future WebSocket connection implement it. */
export interface GameConnection {
  send(intent: Intent): Promise<ServerEvent[]>;
}
