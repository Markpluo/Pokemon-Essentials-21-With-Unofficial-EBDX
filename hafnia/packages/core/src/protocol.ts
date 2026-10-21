// The message protocol between a client and a game server.
// Solo play runs the server in a Web Worker (LocalServer); online play will run the same
// game-core on a real server. The client only ever sends intents and renders events.

export type Dir = 'up' | 'down' | 'left' | 'right';
export type StatusId = '' | 'brn' | 'par' | 'psn' | 'tox' | 'slp' | 'frz';

// ---------- client -> server ----------
export type CoilMode = 'copper' | 'current';
export type BattleAction =
  | { kind: 'move'; index: number; mode?: CoilMode }
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
  | { t: 'answer'; index: number }
  | { t: 'battle'; action: BattleAction }
  | { t: 'useItem'; item: string; uid: string }
  | { t: 'lead'; uid: string }
  | { t: 'save'; slot?: SaveSlot }
  | { t: 'slots' }
  | { t: 'autosave' }
  | { t: 'debug'; cmd: DebugCommand; arg?: string | number };

export type SaveSlot = 'auto' | 1 | 2 | 3;
export interface SlotInfo { slot: SaveSlot; summary: string | null }
export type DebugCommand = 'heal' | 'levelUp' | 'items' | 'money' | 'unlockCoil' | 'encounters' | 'warp' | 'badge';

// ---------- server -> client ----------
export interface MoveView { id: string; name: string; type: string; category: 'Physical' | 'Special' | 'Status'; power: number; pp: number; maxpp: number; disabled?: boolean }
export interface MonView {
  uid: string; species: string; key: string; name: string; types: string[]; level: number;
  hp: number; maxhp: number; status: StatusId; moves: MoveView[];
  exp: number; expLo: number; expHi: number; gender: '' | 'M' | 'F'; shiny: boolean;
}
export interface NpcView { id: string; sprite: string; x: number; y: number; dir: Dir; object?: boolean }
export interface WorldView {
  name: string; map: string; x: number; y: number; dir: Dir;
  npcs: NpcView[]; party: MonView[]; bag: Record<string, number>; money: number;
  badges: number; debug?: boolean;
}

export type BattleSide = 'ally' | 'foe';
export interface BattleMonView {
  uid?: string; species: string; key: string; name: string; level: number; hp: number; maxhp: number;
  status: StatusId; gender: '' | 'M' | 'F'; shiny: boolean; exp?: number; expLo?: number; expHi?: number;
}
export type BattleEvent =
  | { b: 'text'; text: string }
  | { b: 'trainerOut'; text: string; count: number }
  | { b: 'switch'; side: BattleSide; mon: BattleMonView; text: string }
  | { b: 'recall'; side: BattleSide; text: string }
  | { b: 'move'; side: BattleSide; text: string; type: string; category: 'Physical' | 'Special' | 'Status' }
  | { b: 'hp'; side: BattleSide; hp: number; maxhp: number; effect: 'super' | 'weak' | 'normal' | 'heal' | 'residual' }
  | { b: 'status'; side: BattleSide; status: StatusId }
  | { b: 'faint'; side: BattleSide; text: string }
  | { b: 'exp'; side: BattleSide; exp: number; expLo: number; expHi: number; level: number; hp: number; maxhp: number }
  | { b: 'throw'; shakes: number; caught: boolean }
  | { b: 'flee' }
  | { b: 'coil'; side: BattleSide; coil: CoilView }
  | { b: 'copper'; side: BattleSide; text: string }
  | { b: 'current'; side: BattleSide; text: string }
  | { b: 'overcharge'; side: BattleSide; text: string };

/** A side's Coil gauge. `ready` is the pip count needed to activate. */
export interface CoilView { pips: number; max: number; ready: number; used: boolean; overcharge?: boolean }

export interface BattleRequest {
  moves: MoveView[];
  forceSwitch: boolean;
  canCatch: boolean;
  canRun: boolean;
  activeUid: string;
  party: MonView[];
  bag: Record<string, number>;
  /** Present when the player's Coil is online. A string says why a mode can't be used now. */
  coil?: CoilView & { copper: string | null; current: string | null };
}

export interface BattleStart {
  kind: 'wild' | 'trainer';
  bg: string;
  bgm: string;
  trainer?: { name: string; title: string; sprite: string };
  foeCount: number;
  coil?: { ally?: CoilView; foe?: CoilView };
}

export type ServerEvent =
  | { t: 'title'; hasSave: boolean; summary?: string; slots?: SlotInfo[] }
  | { t: 'slots'; slots: SlotInfo[] }
  | { t: 'evolve'; from: string; to: string; fromName: string; toName: string }
  | { t: 'view'; view: WorldView }
  | { t: 'say'; text: string }
  | { t: 'prompt'; text: string; options: string[]; cancel?: number }
  | { t: 'pickSpecies'; species: { species: string; key: string; name: string; types: string[]; blurb: string }[] }
  | { t: 'sfx'; name: string }
  | { t: 'me'; name: string }
  | { t: 'bgm'; name: string | null }
  | { t: 'cry'; key: string }
  | { t: 'face'; actor: string; dir: Dir }
  | { t: 'walk'; actor: string; dir: Dir; frames?: number }
  | { t: 'place'; actor: string; x: number; y: number; dir: Dir; sprite?: string; hidden?: boolean }
  | { t: 'exclaim'; actor: string }
  | { t: 'map'; map: string; name: string; x: number; y: number; dir: Dir; bgm: string }
  | { t: 'wait'; frames: number }
  | { t: 'fade'; to: number; frames?: number }
  | { t: 'battleStart'; battle: BattleStart }
  | { t: 'battle'; ev: BattleEvent }
  | { t: 'battleRequest'; request: BattleRequest }
  | { t: 'battleEnd'; result: BattleResult }
  | { t: 'chapterEnd'; title: string; subtitle: string }
  | { t: 'checkpoint' }
  | { t: 'error'; message: string };

export type BattleResult = 'win' | 'lose' | 'run' | 'caught';

/** What a client talks to. LocalConnection (solo) and a future WebSocket connection implement it. */
export interface GameConnection {
  send(intent: Intent): Promise<ServerEvent[]>;
}
