// Chapter 10 (Refshaleøen and CopenHill): Lukas at the top of the great crane, then Gym 8, the turbine hall:
// start turbines until relays 1 and 3 are live and 2 is dark, and the lift gate opens to Astrid.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('copenhill: Lukas on the crane, the turbine relays, Astrid @gym', async ({ bot }) => {
  test.setTimeout(400_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'eastquay', x: 9, y: 2, dir: 'up',
    party: [{ species: 'garchomp', level: 70, moves: ['crunch', 'dragonclaw', 'firefang', 'stoneedge'] }, { species: 'charizard', level: 62, moves: ['flamethrower', 'airslash', 'dragonclaw', 'slash'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire'], noEncounters: true, bag: { shutdownseq: 1 },
    flags: { ch9done: true, ch10: true, c10arrive: true, c10brix: true, 'tr.sy4': true, 'tr.sy5': true }   // the quay's trainers are behind us
  }));
  await bot.shot('gym8-eastquay');
  bot.answers.push({ when: /Battle Lukas/, pick: 'Ready' }, { when: /Switch the turbine/, pick: 'Start' }, { when: /Battle Astrid/, pick: 'Yes' });
  await bot.talkTo(9, 1);                                   // up the great crane
  let s = await bot.state();
  expect(s.map).toBe('hafnia:cranetop');
  await bot.talkTo(12, 2);                                  // Lukas
  expect(bot.said.join('\n')).toMatch(/You're ready/);
  await bot.shot('gym8-cranetop');
  await bot.talkTo(1, 2);
  await bot.walkTo(14, 16);
  await bot.step('right');
  s = await bot.state();
  expect(s.map).toBe('hafnia:copenhill');
  await bot.shot('gym8-copenhill');
  await bot.walkTo(14, 7);
  await bot.step('up');
  s = await bot.state();
  expect(s.map).toBe('hafnia:gym8');
  await bot.talkTo(4, 8);                                   // turbine A: relays 1 and 2
  expect(bot.said.join('\n')).toMatch(/Relays live: 1 and 2/);
  await bot.talkTo(9, 8);                                   // and B: relay 2 cancels out
  expect(bot.said.join('\n')).toMatch(/summit lift jerks awake/);
  await bot.shot('gym8-hall');
  await bot.walkTo(9, 3);
  await bot.talkTo(9, 2);                                   // Astrid
  expect(bot.said.join('\n')).toMatch(/received the Turbine Badge/);
  s = await bot.state();
  expect(s.world?.badges).toBe(8);
  await bot.walkTo(9, 13);                                  // Lindholm on every screen
  expect(bot.said.join('\n')).toMatch(/It'll break/);
  await bot.shot('gym8-broadcast');
});
