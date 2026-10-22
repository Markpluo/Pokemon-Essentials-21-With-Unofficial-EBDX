// Chapter 5 (the Cisterns): the mirror pool and the Sableye's false wall, both sluice wheels, Brix's
// drone swarm beside Maja, the Sunken Archive, and Lukas at the pyramid.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('cisterns: mirror pool, sluice wheels, drones, archive, Lukas @story', async ({ bot }) => {
  test.setTimeout(300_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'frederiksberg', x: 21, y: 17, dir: 'up',
    party: [{ species: 'houndstone', level: 55, moves: ['crunch', 'shadowball', 'playrough', 'dig'] }, { species: 'charizard', level: 52 }],
    badges: ['spray', 'lily', 'frost', 'lantern'], noEncounters: true,
    flags: { ch3done: true, ch4: true, ch4done: true, ch5: true, ch5met: true }
  }));
  await bot.walkTo(21, 15);
  await bot.step('up');                                     // the pyramid door
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:cisterns');
  await bot.shot('cisterns-arrive');
  await bot.talkTo(6, 5);                                   // the mirror pool: the Sableye's trick
  expect(bot.said.join('\n')).toMatch(/an old brick arch opens/);
  await bot.talkTo(13, 1);
  expect(bot.said.join('\n')).toMatch(/a stone walkway surfaces/);
  await bot.talkTo(28, 1);
  expect(bot.said.join('\n')).toMatch(/a causeway rises/);
  await bot.shot('cisterns-drained');
  await bot.walkTo(21, 12);
  await bot.walkTo(13, 16);                                 // the drone swarm, with Maja beside you
  expect(bot.said.join('\n')).toMatch(/The old doorway stands open/);
  await bot.walkTo(11, 16);                                 // the Sunken Archive
  expect(bot.said.join('\n')).toMatch(/I didn't ask why/);
  await bot.shot('cisterns-archive');
  await bot.talkTo(1, 20);                                  // back stairs: Lukas is waiting
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:frederiksberg');
  expect(bot.said.join('\n')).toMatch(/Chapter 6: Look Up/);
  await bot.shot('cisterns-end');
});
