// The Elite Four halls' puzzles: each hall's row of crates, cannons, tables or barrels has one gap, held shut until
// you saddle Valdemar's horses eldest first, light all of Clara's lamps, answer Nikolai's Lampent and beat Freja's
// two deckhands.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const TEAM = [{ species: 'garchomp', level: 90, moves: ['earthquake', 'dragonclaw', 'crunch', 'swordsdance'] },
  { species: 'lapras', level: 90, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }];
const BADGES = ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'];
const at = (map: string, flags: Record<string, unknown> = {}) => tweak(afterStarter('charmander'), {
  map, x: 5, y: 7, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, flags: { ch12done: true, ch13: true, ...flags }
});

test('the stables: a wrong horse resets, eldest first opens the gate @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(at('stables'));
  await bot.shot('e4-stables');
  await bot.talkTo(8, 7);                                   // Brun is the youngest: the saddles slide off
  expect(bot.said.join('\n')).toMatch(/Eldest first/);
  for (const [x, y] of [[2, 5], [8, 5], [8, 7]]) await bot.talkTo(x, y);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/stable gate swings open/);
});

test('the Admiral\'s hall: four lamps on one wick @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(at('admiral', { e4valdemar: true }));
  await bot.shot('e4-admiral');
  for (const x of [2, 4, 6]) await bot.talkTo(x, 6);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/All four lamps blaze/);
  await bot.shot('e4-admiral-lit');
});

test('the Great Hall: Nikolai\'s Lampent asks three questions @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(at('greathall', { e4valdemar: true, e4clara: true }));
  bot.answers.push({ when: /squares loud/, pick: 'Tariq', once: true }, { when: /Black Fleet/, pick: 'Freja', once: true },
    { when: /CopenHill/, pick: 'Langelira', once: true });
  await bot.talkTo(5, 4);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/The way to Nikolai is open/);
  await bot.shot('e4-greathall');
});

test('the Tower stairs: Freja\'s two deckhands, then the Bosun @story', async ({ bot }) => {
  test.setTimeout(240_000);
  await bot.loadSave(at('towerstairs', { e4valdemar: true, e4clara: true, e4nikolai: true }));
  await bot.talkTo(5, 4);                                   // the Bosun first: not yet
  expect(bot.said.join('\n')).toMatch(/Both of them/);
  await bot.talkTo(2, 6);
  await bot.talkTo(8, 6);
  await bot.talkTo(5, 4);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/earned the stairs/);
  await bot.shot('e4-towerstairs');
});
