// Gym 5 (Rundetårn): up the spiral ramp across the Trick Room floors, set the three brass rings from the
// star chart, and beat Tycho in the observatory.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('rundetarn: trick room, brass rings, Tycho @gym', async ({ bot }) => {
  test.setTimeout(300_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'towerin', x: 4, y: 3, dir: 'up',
    party: [{ species: 'houndstone', level: 55, moves: ['crunch', 'shadowball', 'playrough', 'dig'] }, { species: 'charizard', level: 52, moves: ['crunch', 'airslash', 'dragonclaw', 'slash'] }],
    badges: ['spray', 'lily', 'frost', 'lantern'], noEncounters: true, bag: { lensobjective: 1, lenseyepiece: 1 },
    flags: { ch5done: true, ch6: true, ch6met: true, lens1Got: true, lens2Got: true }
  }));
  await bot.walkTo(6, 2);                                   // up the ramp
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:rundetarn');
  await bot.walkTo(3, 2);                                   // the first Trick Room tile
  await bot.shot('gym5-trickroom');
  await bot.step('left');                                   // pressing left walks right
  let s = await bot.state();
  expect([s.x, s.y]).toEqual([4, 2]);
  await bot.walkTo(20, 11);                                 // across the Trick Room floor
  await bot.talkTo(7, 15);                                  // the star chart
  expect(bot.said.join('\n')).toMatch(/Great Bear keeps the north/);
  for (const [x, y, sign] of [[8, 11, 'Lion'], [12, 8, 'Great Bear'], [14, 11, 'Swan']] as const) {
    bot.answers.push({ when: /Turn the pointer/, pick: sign, once: true });
    await bot.talkTo(x, y);
  }
  expect(bot.said.join('\n')).toMatch(/orrery gate slides open/);
  await bot.walkTo(11, 12);
  await bot.shot('gym5-observatory');
  await bot.talkTo(11, 11);
  expect(bot.said.join('\n')).toMatch(/received the Orrery Badge/);
  expect(bot.said.join('\n')).toMatch(/Chapter 7: North by Kystbanen/);
  s = await bot.state();
  expect(s.world?.badges).toBe(5);
  await bot.shot('gym5-badge');
});
