// Post-game, "The Long Echo" (design/post-game-and-endgame.md §3). P1, Morning After: you wake up as Champion.
// Ørsted and Brix explain the Echoes (the reactor's stolen song, leaking out of cracked Resonance Cells) at the
// Palm House, the new statue on Langelinie gives you the Mermaid's Tear shard and Harmony, Lukas and Maja give
// you eggs of the two starters nobody picked, and Brix shows you the first Resonance Rift by Søerne.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import type { Step } from './lib';
import { STARTERS, lukasStarter, majaStarter } from './starters';

function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return n;
}

// ---------- P1 starts: the morning after ----------

/** Runs when you first step outside after the credits. */
export function* p1Start(s: ScriptApi): Step {
  if (!s.flag('ch13done') || s.flag('pg1')) return;
  s.setFlag('pg1', true);
  s.chapterEnd('Post-game', 'Morning After');
  s.say('pg1.start.1'); s.say('pg1.start.2');
  s.say('pg1.mum.1'); s.say('pg1.mum.2'); s.say('pg1.mum.3');
  s.sfx('pc');
  s.say('pg1.call.1'); s.say('pg1.call.2'); s.say('pg1.call.3');
  s.checkpoint();
}

// ---------- The Palm House: Ørsted and Brix ----------

function* palmScene(s: ScriptApi): Step {
  s.setFlag('pg1palm', true);
  const b = cast(s, 'brixpg', 8, 9);
  s.player.faceTo(8, 7);
  s.say('pg1.palm.orsted.1'); s.say('pg1.palm.brix.1'); s.say('pg1.palm.orsted.2');
  s.say('pg1.palm.brix.2'); s.say('pg1.palm.brix.3');
  s.say('pg1.palm.radio.1'); s.say('pg1.palm.radio.2'); s.say('pg1.palm.radio.3');
  s.say('pg1.palm.orsted.3'); s.say('pg1.palm.brix.4');
  s.giveItem('expcandyl', 3); s.me('me_item');
  s.say('pg1.palm.candy');
  s.say('pg1.palm.orsted.4');
  b.face('down');
  s.checkpoint();
}

const brixTalk: Script = function* (s) {
  if (!s.flag('pg1harmony')) { s.say('pg1.brix.statue'); return; }
  if (!s.flag('pg1rift')) { s.say('pg1.brix.rift'); return; }
  s.say('pg1.brix.after');
};

/** The Palm House scripts the post-game adds (the map's own onEnter still runs first). */
export const PALM_PG1 = {
  npcs: [{ id: 'brixpg', sprite: 'chars/scientist', x: 10, y: 8, dir: 'left', when: f => !!f('pg1palm'), talk: brixTalk } as NpcDef],
  onEnter: function* (s: ScriptApi): Step { if (s.flag('pg1') && !s.flag('pg1palm')) yield* palmScene(s); }
};

// ---------- Langelinie: the Mermaid's Tear ----------

/** The two starters nobody took: Lukas hatched one, Maja the other. */
export function spareStarters(s: ScriptApi): [string, string] {
  const taken = new Set([s.flag('starter') as string, lukasStarter(s), majaStarter(s)]);
  const left = STARTERS.map(x => x.species).filter(x => !taken.has(x));
  return [left[0] ?? 'eevee', left[1] ?? 'pikachu'];
}

/** Talking to the new statue once Ørsted has sent you there. Returns false if the scene doesn't run. */
export function* statueTear(s: ScriptApi): Generator<any, boolean, any> {
  if (!s.flag('pg1palm') || s.flag('pg1harmony')) return false;
  s.setFlag('pg1harmony', true);
  s.say('pg1.statue.1'); s.say('pg1.statue.2');
  s.wait(20); s.cry('langelira'); s.wait(20);
  s.say('pg1.statue.3');
  s.unlockCoil('harmony');
  s.me('me_badge');
  s.giveItem('mermaidtear');
  s.say('pg1.statue.harmony.1'); s.say('pg1.statue.harmony.2');
  const lukas = cast(s, 'lukaspg'), maja = cast(s, 'majapg');
  s.say('pg1.gift.maja.1'); s.say('pg1.gift.lukas.1'); s.say('pg1.gift.maja.2');
  const [a, b] = spareStarters(s);
  s.giveEgg(a, { perfectIvs: 3 }); s.me('me_get');
  s.say(`Lukas handed over an Egg.\nSomething inside it is very warm.`);
  s.giveEgg(b, { perfectIvs: 3 }); s.me('me_get');
  s.say(`Maja handed over an Egg.\nIt rocks the moment you hold it.`);
  s.say('pg1.gift.lukas.2'); s.say('pg1.gift.maja.3'); s.say('pg1.gift.lukas.3');
  lukas.walk('left', 4); maja.walk('left', 4);
  lukas.hide(); maja.hide();
  s.checkpoint();
  return true;
}

export const OSTERBRO_PG1: NpcDef[] = [
  { id: 'lukaspg', sprite: 'chars/lukas', x: 20, y: 11, dir: 'down', hidden: true },
  { id: 'majapg', sprite: 'chars/maja', x: 21, y: 11, dir: 'down', hidden: true }
];

// ---------- Søerne: the Resonance Rift ----------

/** Echo-warped Søerne locals for the repeatable Rift: [species, level, moves]. */
const RIFT_POOL: [string, number, string[]][] = [
  ['golduck', 60, ['hydropump', 'psychic', 'icebeam', 'calmmind']],
  ['pidgeot', 60, ['hurricane', 'heatwave', 'uturn', 'roost']],
  ['stoutland', 61, ['bodyslam', 'crunch', 'wildcharge', 'playrough']],
  ['ludicolo', 61, ['surf', 'gigadrain', 'icebeam', 'raindance']],
  ['pelipper', 60, ['hurricane', 'scald', 'uturn', 'roost']],
  ['lopunny', 61, ['highjumpkick', 'return', 'icepunch', 'bounce']],
  ['noctowl', 60, ['airslash', 'psychic', 'hypervoice', 'roost']],
  ['gyarados', 62, ['waterfall', 'crunch', 'icefang', 'dragondance']]
];

const echoTalk: Script = function* (s) {
  if (!s.flag('pg1harmony')) { s.say('pg1.echo.faint'); return; }
  const first = !s.flag('pg1rift');
  if (!first && s.flag('pg1riftPeriod') === s.period) { s.say('pg1.echo.quiet'); return; }
  if (first) {
    const b = cast(s, 'brixrift');
    s.say('pg1.rift.brix.1'); s.say('pg1.rift.brix.2'); s.say('pg1.rift.brix.3');
    b.hide();
  }
  const c: number = yield s.ask('pg1.echo.ask', ['Touch it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('hit_super'); s.fade(1, 10); s.fade(0, 10);
  s.say('pg1.echo.open');
  const n = Number(s.flag('pg1riftCount') ?? 0);
  const [species, level, moves] = first ? RIFT_POOL[0] : RIFT_POOL[(n * 5 + 3) % RIFT_POOL.length];
  const r = yield s.battle({ kind: 'wild', bg: 'field', echo: true, foes: [{ species, level, moves }] });
  if (r !== 'win' && r !== 'caught') return;
  s.setFlag('pg1riftCount', n + 1);
  s.setFlag('pg1riftPeriod', s.period);
  s.say('pg1.echo.close');
  s.giveItem('echoshard'); s.me('me_item');
  s.say('pg1.echo.shard');
  if (first) {
    s.setFlag('pg1rift', true);
    s.say('pg1.rift.after.1'); s.say('pg1.rift.after.2');
    s.setFlag('pg1done', true);
    s.checkpoint();
    s.chapterEnd('Post-game', 'The Long Echo');
    s.say('pg1.end');
  } else s.checkpoint();
};

export const ROUTE1_PG1: NpcDef[] = [
  { id: 'echo1', sprite: 'obj:echo', x: 14, y: 11, dir: 'down', object: true, when: f => !!f('pg1palm'), talk: echoTalk },
  { id: 'brixrift', sprite: 'chars/scientist', x: 15, y: 10, dir: 'down', hidden: true }
];
