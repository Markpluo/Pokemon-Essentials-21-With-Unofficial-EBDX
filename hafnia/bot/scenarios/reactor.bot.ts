// Chapter 12 (Copper & Current): Kronvakt breaks the black ice on CopenHill's slope, Lukas fights beside you for the
// lift, Lindholm's team and his Reactor Rotom on the Smokestack Ring, the city's song, and catching Langelira.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('copenhill in the storm: the ice, the lift, Lindholm, Langelira @story', async ({ bot }) => {
  test.setTimeout(480_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'stormhill', x: 2, y: 20, dir: 'up',
    party: [{ species: 'garchomp', level: 75, moves: ['crunch', 'dragonclaw', 'firefang', 'stoneedge'] }, { species: 'charizard', level: 66, moves: ['flamethrower', 'airslash', 'dragonclaw', 'slash'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'], noEncounters: true, bag: { ultraball: 99 },
    flags: { ch11done: true, kronvakt: true, ch12: true, c12iceB: true, c12iceC: true, 'tr.slEnf1': true, 'tr.slEnf2': true, 'tr.slEnf3': true }
  }));
  await bot.shot('reactor-slope');
  await bot.talkTo(1, 18);                                  // Kronvakt breaks the black ice
  expect(bot.said.join('\n')).toMatch(/ice splits like a bell/);
  await bot.shot('reactor-ice');
  await bot.walkTo(7, 2);                                   // the Enforcer captains, with Lukas
  expect(bot.said.join('\n')).toMatch(/I've got your back/);
  await bot.walkTo(7, 0);
  await bot.step('up');                                     // the Smokestack Ring: Lindholm, then the Reactor Rotom
  let s = await bot.state();
  expect(s.map).toBe('hafnia:smokestack');
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/whole city sings/);
  await bot.shot('reactor-ring');
  bot.answers.push({ when: /Face Langelira/, pick: 'Yes' });
  bot.battlePlan = () => ({ ball: 'Ultra Ball' });
  await bot.talkTo(12, 1);                                  // Langelira
  bot.battlePlan = 'fight';
  expect(bot.battles.some(b => b.result === 'caught'), bot.battles.map(b => `${b.foe}: ${b.result}`).join(', ')).toBe(true);
  expect(bot.said.join('\n')).toMatch(/Is the sea calm/);
  await bot.shot('reactor-end');
});
