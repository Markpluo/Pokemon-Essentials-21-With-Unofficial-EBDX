// Post-game P1 (Morning After): stepping out after the credits, the Mermaid's Tear on Langelinie (Harmony and two
// Eggs), and the first Resonance Rift on Søerne Path, won with Harmony.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const TEAM = [{ species: 'garchomp', level: 80, moves: ['earthquake', 'dragonclaw', 'crunch', 'swordsdance'] },
  { species: 'lapras', level: 70, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }];
const BADGES = ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'];

test('post-game P1: the morning after, the Mermaid\'s Tear and the first Resonance Rift @story', async ({ bot }) => {
  test.setTimeout(300_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'flat', x: 6, y: 5, dir: 'down', party: TEAM, badges: BADGES, noEncounters: true,
    flags: { ch12done: true, ch13: true, champion: true, ch13done: true }
  }));
  await bot.walkTo(6, 6);                                   // out into the courtyard: Mum, then Ørsted calls
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/No jacket needed/);
  expect((await bot.state()).map).toBe('hafnia:norrebro');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'osterbro', x: 22, y: 16, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true },
    flags: { ch13done: true, pg1: true, pg1palm: true }
  }));
  await bot.talkTo(22, 13);                                 // the statue's copper tear
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Harmony unlocked/);
  expect(bot.said.join('\n')).toMatch(/Maja handed over an Egg/);
  await bot.shot('pg1-statue');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'route1', x: 14, y: 13, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true, harmony: true },
    flags: { ch13done: true, pg1: true, pg1palm: true, pg1harmony: true }
  }));
  bot.battlePlan = s => {
    const req = s.battle?.request;
    // Swords Dance until the Coil is charged, then Earthquake with Harmony.
    if (!req?.moves.some(m => m.name === 'Earthquake')) return { move: 0 };
    return req.coil?.harmony === null ? { move: 'Earthquake', coil: 'harmony' } : { move: req.coil?.used ? 'Earthquake' : 'Swords Dance' };
  };
  await bot.talkTo(14, 11);                                 // Brix, then the Echo opens as a Rift
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/frozen song warps/);
  expect(bot.said.join('\n')).toMatch(/Copper and Current in harmony/);
  expect(bot.said.join('\n')).toMatch(/An Echo Shard/);
  await bot.shot('pg1-rift');
});
