// Chapter 13 (Christiansborg): the League. From the palace door through the League hall, then Freja on the Tower
// stairs, and the Champions on the roof: Ørsted and Lukas against you and Maja. Then the ending, and home.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('christiansborg: the League hall, Freja, the Champions, the ending @story', async ({ bot }) => {
  test.setTimeout(480_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'slotsholmen', x: 6, y: 7, dir: 'up',
    party: [{ species: 'garchomp', level: 95, moves: ['crunch', 'dragonclaw', 'firefang', 'stoneedge'] }, { species: 'charizard', level: 90, moves: ['flamethrower', 'airslash', 'dragonclaw', 'slash'] }, { species: 'lapras', level: 90, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'], noEncounters: true,
    flags: { ch12done: true, ch13: true, e4valdemar: true, e4clara: true, e4nikolai: true, e4pfreja: true }
  }));
  await bot.enter('palace');                                // Christiansborg's doors are open
  let s = await bot.state();
  expect(s.map).toBe('hafnia:leaguehall');
  await bot.shot('league-hall');
  await bot.walkTo(6, 0);
  s = await bot.state();
  expect(s.map).toBe('hafnia:stables');
  for (const next of ['admiral', 'greathall', 'towerstairs']) {   // halls already won: straight up the stairs
    await bot.talkTo(5, 0);
    s = await bot.state();
    expect(s.map).toBe(`hafnia:${next}`);
  }
  await bot.talkTo(5, 2);                                   // Freja
  expect(bot.said.join('\n')).toMatch(/That's my crew's captain/);
  await bot.shot('league-freja');
  await bot.talkTo(5, 0);                                   // the roof: Ørsted and Lukas, with Maja
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/new Champion/);
  expect(bot.said.join('\n')).toMatch(/Not tiny/);
  s = await bot.state();
  expect(s.map).toBe('hafnia:flat');
  await bot.shot('league-end');
});
