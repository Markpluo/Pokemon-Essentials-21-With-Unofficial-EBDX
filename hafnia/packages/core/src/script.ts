// Story scripts are generator functions. Plain calls (say, sfx, giveItem...) run at once and
// queue events for the client. `yield` pauses the script until the player answers a prompt
// or a battle ends, which is what lets the same script run in a Web Worker or on a server.
import type { Dir, BattleResult } from './protocol';
import type { Mon } from './pokemon';

export interface FoeSpec { species: string; level: number; moves?: string[] }

export interface BattleOptions {
  kind: 'wild' | 'trainer';
  foes: FoeSpec[];
  trainer?: { name: string; title: string; sprite: string };
  bg?: string;
  /** A soft battle does not send the player to the last heal point on a loss (rival intro fights). */
  soft?: boolean;
  leader?: boolean;
  /** Prize money per level of the last foe; defaults to the rules' base for the trainer's title. */
  prize?: number;
  /** Trainer AI tier (systems.md §2.4): 1 basic, 2 smart, 3 expert. Default: 2 for leaders and rivals, else 1. */
  ai?: 1 | 2 | 3;
  /** false turns the Copper & Current Coil off for both sides (a "plain" battle). */
  coil?: boolean;
  /** Coil modes the opponent may use. Most trainers have none. */
  foeCoil?: { copper?: boolean; current?: boolean };
  /** Villain teams: the Coil refills and each activation is Copper and Current at once, with HP drain. */
  overcharge?: boolean;
}

export type Pause =
  | { kind: 'ask'; text: string; options: string[]; cancel?: number }
  | { kind: 'pickSpecies'; species: { species: string; blurb: string }[] }
  | { kind: 'battle'; opts: BattleOptions };

export type Script = (s: ScriptApi) => Generator<Pause, unknown, any>;

export interface NpcHandle {
  readonly id: string; readonly x: number; readonly y: number; readonly dir: Dir; readonly hidden: boolean;
  place(x: number, y: number, dir: Dir): void;
  show(): void;
  hide(): void;
  face(dir: Dir): void;
  facePlayer(): void;
  walk(dir: Dir, steps?: number, frames?: number): void;
  exclaim(): void;
}

export interface ScriptApi {
  readonly pack: string;
  readonly player: { readonly name: string; readonly x: number; readonly y: number; readonly dir: Dir; face(dir: Dir): void; faceTo(x: number, y: number): void };
  readonly party: readonly Mon[];

  // flags are namespaced to the script's pack unless given as "pack:name"
  flag(name: string): any;
  setFlag(name: string, value: unknown): void;

  say(text: string): void;
  ask(text: string, options: string[], cancel?: number): Pause;
  pickSpecies(species: { species: string; blurb: string }[]): Pause;
  battle(opts: BattleOptions): Pause;

  setName(name: string): void;
  givePokemon(species: string, level: number): Mon;
  giveItem(item: string, qty?: number): void;
  hasItem(item: string): number;
  giveMoney(amount: number): void;
  readonly money: number;
  takeMoney(amount: number): boolean;
  giveBadge(id: string, name: string): void;
  readonly badges: number;
  unlockCoil(mode: 'copper' | 'current' | 'harmony'): void;
  /** Opens the Mart: the player buys from the stock that the badge count allows. */
  mart(stock: string[]): Generator<Pause, void, any>;
  heal(): void;
  partyAlive(): boolean;

  sfx(name: string): void;
  me(name: string): void;
  bgm(name: string | null): void;
  cry(species: string): void;
  wait(frames: number): void;
  fade(to: number, frames?: number): void;

  npc(id: string): NpcHandle;
  warp(map: string, x: number, y: number, dir: Dir): void;
  setRespawn(map: string, x: number, y: number, dir: Dir, text: string): void;
  freeSpotNear(x: number, y: number): [number, number];
  checkpoint(): void;
  chapterEnd(title: string, subtitle: string): void;
}

export type { BattleResult };
