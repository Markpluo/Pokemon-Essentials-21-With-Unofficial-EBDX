// Small helpers shared by the story scripts. Text arguments are string keys from strings/en.json
// (see tools/import-strings.mjs) or literal lines.
import { levelEvolution, makeMon, Rng, type Pause, type BattleOptions, type Dir, type FoeSpec, type MapEvent, type NpcDef, type Script, type ScriptApi } from '@hafnia/core';

export interface MapScripts {
  npcs?: NpcDef[];
  doors?: Record<string, Script>;
  events?: MapEvent[];
  onEnter?: Script;
}

export const talk = (...lines: string[]): Script => function* (s) { for (const l of lines) s.say(l); };

export function* findItem(s: ScriptApi, flag: string, item: string, qty: number, label: string) {
  s.setFlag(flag, true);
  s.giveItem(item, qty);
  s.me('me_item');
  s.say(`${s.player.name} found ${qty > 1 ? `${qty} ` : ''}${label}!`);
}

/** An item ball that disappears once taken. */
export const itemBall = (id: string, x: number, y: number, item: string, qty: number, label: string): NpcDef => ({
  id, sprite: 'chars/ball', x, y, dir: 'down', object: true, when: f => !f(id), talk: s => findItem(s, id, item, qty, label)
});

/** A sign, notice board or other thing you read. */
export const sign = (id: string, x: number, y: number, sprite: string, ...lines: string[]): NpcDef => ({
  id, sprite, x, y, dir: 'down', object: true, talk: talk(...lines)
});

/** Trainer battle sprites by class (Graphics/Trainers placeholders until Mark's art). */
export const TR: Record<string, string> = {
  Jogger: 'tr/camper', Cyclist: 'tr/biker', Fisher: 'tr/fisher', Student: 'tr/student', Skater: 'tr/skater',
  Muralist: 'tr/painter', Raver: 'tr/rocker', 'Ghost Hunter': 'tr/channeler', Engineer: 'tr/engineer',
  Busker: 'tr/juggler', Tourist: 'tr/tourist', 'Royal Guard': 'tr/guard', Sailor: 'tr/sailor', Swimmer: 'tr/swimmer',
  Deckhand: 'tr/deckhand', Gardener: 'tr/gardener', Christianite: 'tr/picnicker', 'Grid Enforcer': 'tr/enforcer',
  Bosun: 'tr/ivar', Captain: 'tr/freja', Rival: 'tr/lukas', Leader: 'tr/tariq'
};

export interface TrainerSpec {
  id: string; x: number; y: number; dir: Dir; sprite: string; sight?: number;
  cls: string; name: string; foes: FoeSpec[];
  intro: string[]; lose: string[]; after?: string[];
  when?: NpcDef['when']; period?: NpcDef['period'];
  battle?: Partial<BattleOptions>;
  /** Runs after the player wins (rewards). */
  reward?: (s: ScriptApi) => Generator<any, void, any> | void;
}

/** A route trainer: spots the player, battles once, then says its after line. */
export function trainer(t: TrainerSpec): NpcDef {
  const flag = `tr.${t.id}`;
  return {
    id: t.id, sprite: t.sprite, x: t.x, y: t.y, dir: t.dir, when: t.when, period: t.period,
    trainer: t.sight === 0 ? undefined : { sight: t.sight ?? 3, flag },
    talk: function* (s) {
      if (s.flag(flag)) { for (const l of t.after ?? t.lose) s.say(l); return; }
      for (const l of t.intro) s.say(l);
      const r = yield s.battle({ kind: 'trainer', trainer: { name: t.name, title: t.cls, sprite: TR[t.cls] ?? 'tr/biker' }, foes: t.foes, ...t.battle });
      if (r !== 'win') return;
      s.setFlag(flag, true);
      for (const l of t.lose) s.say(l);
      if (t.reward) { const g = t.reward(s); if (g) yield* g; }
    }
  };
}

const evoRng = new Rng(1);
/** A rival's Pokémon at a level, evolved if it would have by then (Lukas's and Maja's starters). */
export function grown(species: string, level: number): string {
  let sp = species;
  for (let i = 0; i < 3; i++) {
    const to = levelEvolution(makeMon(sp, level, evoRng));
    if (!to) break;
    sp = to;
  }
  return sp;
}

/** A script step that can pause (ask, battle) and be delegated to with yield*. */
export type Step = Generator<Pause, any, any>;
