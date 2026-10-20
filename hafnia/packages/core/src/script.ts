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
  /** Prize money per level of the strongest foe (Essentials uses the trainer type's base money). */
  prize?: number;
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
