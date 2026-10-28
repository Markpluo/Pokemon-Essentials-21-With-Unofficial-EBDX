// The Six Forgotten Trolls and the small side quests: a Troldtræ Titan in Kalvebod Wilds (boosted, can't be caught,
// leaves a Titan Herb), Ella's first snowdrop letter in Christianshavn, and Ørsted's Hatchery Log in the Palm House.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const TEAM = [{ species: 'garchomp', level: 80, moves: ['earthquake', 'dragonclaw', 'crunch', 'firefang'] },
  { species: 'lapras', level: 70, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }];
const BADGES = ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'];

test('a Troldtræ Titan wakes in Kalvebod Wilds @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'kalvebod', x: 37, y: 22, dir: 'up', party: TEAM, badges: BADGES.slice(0, 3), noEncounters: true, flags: { frost: true, kalvebodArrive: true }
  }));
  await bot.shot('titan-storemor');
  await bot.talkTo(37, 20);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/STORE MOR/);
  expect(bot.said.join('\n')).toMatch(/got a Titan Herb/);
  expect(bot.said.join('\n')).toMatch(/1 of the six trolls/);
});

test('Gækkebrev: Ella\'s first snowdrop letter @story', async ({ bot }) => {
  test.setTimeout(120_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'christianshavn', x: 7, y: 12, dir: 'up', party: TEAM, badges: BADGES.slice(0, 2), noEncounters: true, flags: { chrMaja: true }
  }));
  bot.answers.push({ when: /Who sent it/, pick: 'Tariq', once: true }, { when: /Who sent it/, pick: 'Knud', once: true });
  await bot.talkTo(7, 11);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Tariq! Of course! \(1 of 8\)/);
  expect(bot.said.join('\n')).toMatch(/doesn't fit the dots/);
  await bot.shot('gaekkebrev');
});

test('Ørsted\'s Hatchery Log counts your eggs @story', async ({ bot }) => {
  test.setTimeout(120_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'palmhouse', x: 15, y: 9, dir: 'up', party: TEAM, badges: BADGES.slice(0, 5), noEncounters: true, flags: { ch5: true }
  }));
  await bot.talkTo(15, 7);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/HATCHERY LOG/);
  expect(bot.said.join('\n')).toMatch(/10 to go/);
  await bot.shot('hatchery-log');
});
