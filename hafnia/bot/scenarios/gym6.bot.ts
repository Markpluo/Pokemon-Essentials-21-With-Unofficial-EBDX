// Gym 6 (Bakken): find the weeping reflection in the hall of mirrors, ride the coaster cars red, green and
// blue up to the stage, and beat Pierrot.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('bakken: mirrors, coaster cars, Pierrot @gym', async ({ bot }) => {
  test.setTimeout(300_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'gym6', x: 10, y: 15, dir: 'up',
    party: [{ species: 'houndstone', level: 60, moves: ['ironhead', 'poisonjab', 'shadowball', 'dig'] }, { species: 'charizard', level: 58, moves: ['flamethrower', 'airslash', 'dragonclaw', 'slash'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery'], noEncounters: true,
    flags: { ch6done: true, ch7: true, c7met: true, dyrehavenSeen: true, sifMet: true, lightsOn: true, bakkenSeen: true }
  }));
  await bot.shot('gym6-hall');
  bot.answers.push({ when: /Step through/, pick: 'Step through' }, { when: /Ride/, pick: 'Ride' });
  await bot.talkTo(2, 11);                                  // a laughing reflection
  expect(bot.said.join('\n')).toMatch(/slide back to the door/);
  let s = await bot.state();
  expect([s.x, s.y]).toEqual([10, 15]);
  await bot.talkTo(12, 11);                                 // the weeping one
  expect(bot.said.join('\n')).toMatch(/The way up is open/);
  await bot.walkTo(10, 9);
  await bot.talkTo(8, 7);                                   // red
  s = await bot.state();
  expect([s.x, s.y]).toEqual([3, 2]);
  await bot.talkTo(5, 1);                                   // green
  s = await bot.state();
  expect([s.x, s.y]).toEqual([17, 2]);
  await bot.talkTo(15, 1);                                  // blue: the stage
  s = await bot.state();
  expect([s.x, s.y]).toEqual([10, 3]);
  await bot.shot('gym6-stage');
  await bot.talkTo(10, 1);
  expect(bot.said.join('\n')).toMatch(/received the Harlequin Badge/);
  expect(bot.said.join('\n')).toMatch(/Chapter 8: Trekroner/);
  s = await bot.state();
  expect(s.world?.badges).toBe(6);
  await bot.shot('gym6-badge');
});
