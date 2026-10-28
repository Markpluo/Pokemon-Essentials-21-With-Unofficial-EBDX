// Story scripts are generator functions. Plain calls (say, sfx, giveItem...) run at once and
// queue events for the client. `yield` pauses the script until the player answers a prompt
// or a battle ends, which is what lets the same script run in a Web Worker or on a server.
import type { Dir, BattleResult, DayPeriod, Look } from './protocol';
import type { Mon } from './pokemon';

export interface FoeSpec { species: string; level: number; moves?: string[]; item?: string; ability?: string }

export interface BattleOptions {
  kind: 'wild' | 'trainer';
  foes: FoeSpec[];
  trainer?: { name: string; title: string; sprite: string };
  bg?: string;
  /** A soft battle does not send the player to the last heal point on a loss (rival intro fights). */
  soft?: boolean;
  leader?: boolean;
  /** Battle music key; when left out the pack's battleMusic picks one, else battle_wild / battle_trainer. */
  bgm?: string;
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
  /** First battle of the game: the foe picks moves at random, deals half damage and can't knock the player's Pokémon out. */
  tutorial?: boolean;
  /** Resonance Rift (post-game): the wild Pokémon is Echo-warped, +1 to every stat. */
  echo?: boolean;
  /** A Troldtræ Titan: a boss that gets +1 to every stat and swats balls away. */
  titan?: boolean;
  /** The concert (post-game P5): the player's Coil starts full and refills after each use, and the foe can't be
   *  knocked out until Copper, Current and Harmony have all been used. */
  concert?: boolean;
  /** Multi battle: a partner (AI) fights beside the player against two trainers, one Pokémon each at a time. */
  multi?: {
    partner: { name: string; sprite: string; foes: FoeSpec[]; ai?: number };
    second: { name: string; title: string; sprite: string; foes: FoeSpec[] };
  };
}

export type Pause =
  | { kind: 'ask'; text: string; options: string[]; cancel?: number }
  | { kind: 'pickSpecies'; species: { species: string; blurb: string }[] }
  | { kind: 'name'; text: string; suggestions: string[] }
  | { kind: 'look'; text: string }
  | { kind: 'battle'; opts: BattleOptions };

export type Script = (s: ScriptApi) => Generator<Pause, unknown, any>;

export interface NpcHandle {
  readonly id: string; readonly x: number; readonly y: number; readonly dir: Dir; readonly hidden: boolean;
  place(x: number, y: number, dir: Dir): void;
  show(): void;
  hide(): void;
  face(dir: Dir): void;
  facePlayer(): void;
  /** async: the client animates it alongside whatever comes next instead of waiting. */
  walk(dir: Dir, steps?: number, frames?: number, async?: boolean): void;
  exclaim(): void;
}

export interface ScriptApi {
  readonly pack: string;
  readonly player: {
    readonly name: string; readonly x: number; readonly y: number; readonly dir: Dir;
    face(dir: Dir): void; faceTo(x: number, y: number): void;
    /** Cutscene movement: no collision checks, no encounters. */
    walk(dir: Dir, steps?: number): void;
  };
  readonly party: readonly Mon[];

  // flags are namespaced to the script's pack unless given as "pack:name"
  flag(name: string): any;
  setFlag(name: string, value: unknown): void;

  /** Text can be a string key from the pack's string table ("p.mum.1") or literal text. */
  say(text: string): void;
  t(key: string): string;
  ask(text: string, options: string[], cancel?: number): Pause;
  /** The player types a name (or picks a suggestion). Resumes with the name. */
  askName(text: string, suggestions: string[]): Pause;
  /** Character creation: resumes with the chosen look. */
  pickLook(text: string): Pause;
  pickSpecies(species: { species: string; blurb: string }[]): Pause;
  battle(opts: BattleOptions): Pause;

  setName(name: string): void;
  setLook(look: Look): void;
  readonly period: DayPeriod;
  /** Moves the clock forward to the start of a period (sleeping, waiting). */
  setTime(period: DayPeriod): void;
  /** In-game minutes since midnight. */
  readonly clock: number;
  /** In-game days passed since the start (for once-a-day events). */
  readonly day: number;
  /** Whether the Pokédex has this species as caught. */
  hasCaught(species: string): boolean;
  /** Eggs hatched so far (Ørsted's Hatchery Log). */
  hatched(): number;
  setClock(minutes: number): void;
  givePokemon(species: string, level: number): Mon;
  giveItem(item: string, qty?: number): void;
  hasItem(item: string): number;
  takeItem(item: string, qty?: number): boolean;
  /** A quest egg: optional perfect IVs, hidden ability, ball and hatch steps. */
  giveEgg(species: string, opts?: { perfectIvs?: number; hiddenAbility?: boolean; ball?: string; steps?: number }): Mon;

  // Vuggestuen (breeding.ts). Deposits keep at least one Pokémon that can battle in the party.
  readonly daycare: readonly { name: string; species: string; level: number; gender: '' | 'M' | 'F'; item?: string }[];
  readonly daycareEggs: number;
  /** How well the two daycare Pokémon get along, or null with fewer than two. */
  daycareCompat(): string | null;
  depositDaycare(uid: string, item?: string): boolean;
  /** Returns the Pokémon (healed, its toy back in the bag), or null if the party is full. */
  withdrawDaycare(index: number): Mon | null;
  /** Moves the oldest pram egg into the party, or null if there is none or the party is full. */
  takeDaycareEgg(): Mon | null;
  giveMoney(amount: number): void;
  readonly money: number;
  takeMoney(amount: number): boolean;
  giveBadge(id: string, name: string): void;
  readonly badges: number;
  unlockCoil(mode: 'copper' | 'current' | 'harmony'): void;
  /** Opens the Mart: the player buys from the stock that the badge count allows. */
  mart(stock: string[]): Generator<Pause, void, any>;
  heal(): void;
  /** Opens PC storage; the player moves Pokémon in and out once the script has ended. */
  openPc(): void;
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
