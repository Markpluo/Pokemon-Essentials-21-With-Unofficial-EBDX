// Gym 4 (the Lantern Walk): read the rhymes, take the true gap in each hedge, beat Søren at Andersen's grave.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('lantern walk: wind gust, rhymes, Søren @gym', async ({ bot }) => {
  test.setTimeout(240_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'assistens', x: 15, y: 3, dir: 'up', party: [{ species: 'houndstone', level: 55, moves: ['crunch', 'shadowball', 'playrough', 'dig'] }, { species: 'charizard', level: 50 }],
    badges: ['spray', 'lily', 'frost'], noEncounters: true,
    flags: { ch3done: true, ch4: true, metSoren: true, litwickBack: true, lanternsLit: true }
  }));
  await bot.walkTo(15, 0);
  await bot.step('up');                        // the gate: waits until night if needed
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:gym4');
  await bot.walkTo(7, 13);
  await bot.step('up');                        // the middle gap is false
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/gust of wind/);
  let s = await bot.state();
  expect([s.x, s.y]).toEqual([7, 18]);
  await bot.talkTo(8, 14);                     // the first rhyme: west
  expect(bot.said.join('\n')).toMatch(/match girl/);
  await bot.walkTo(2, 13); await bot.walkTo(2, 11);
  await bot.walkTo(12, 9); await bot.walkTo(12, 7);
  await bot.walkTo(7, 5); await bot.walkTo(7, 3);
  await bot.shot('gym4-andersen');
  await bot.talkTo(7, 2);
  expect(bot.said.join('\n')).toMatch(/received the Lantern Badge/);
  expect((await bot.state()).world?.badges).toBe(4);
  await bot.shot('gym4-badge');
});
