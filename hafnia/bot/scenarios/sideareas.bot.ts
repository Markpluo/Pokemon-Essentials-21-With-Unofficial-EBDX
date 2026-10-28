// The optional side areas: the rangers' skiff to Kalvebod Wilds, the Last Singers in Dragør, the Roskilde crypt
// and Tivoli's Battle Gardens. Each starts from a tweaked save next to the place it checks and screenshots it.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const TEAM = [{ species: 'garchomp', level: 80, moves: ['earthquake', 'dragonclaw', 'crunch', 'swordsdance'] },
  { species: 'lapras', level: 70, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }];
const BADGES = ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'];

test('Kalvebod Wilds: the skiff, Ranger Ebbe and the hut @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'islandsbrygge', x: 18, y: 12, dir: 'right', party: TEAM, badges: BADGES.slice(0, 3), noEncounters: true, flags: { frost: true, ibArrive: true }
  }));
  await bot.talkTo(20, 12);                                 // the ranger: "Take the skiff?" Yes
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:kalvebod');
  await bot.talkTo(21, 2);                                  // Ranger Ebbe's first task
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/catch five kinds/);
  await bot.walkTo(23, 7);
  await bot.shot('kalvebod-hut');
  await bot.walkTo(28, 15);
  await bot.shot('kalvebod-meadow');
});

test('The Last Singers: an elder\'s errand and the safehouse door @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'dragor', x: 12, y: 11, dir: 'up', party: TEAM, badges: BADGES.slice(0, 3), noEncounters: true, flags: { frost: true }
  }));
  await bot.talkTo(12, 10);                                 // Elder Ingeborg wants her net float back
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/net float/);
  await bot.enter('safehouse');                             // the red house: locked without Karen's key
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/tiny black ship/);
  await bot.shot('dragor-singers');
});

test('The Roskilde Saga: the cathedral, the crypt and the museum @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'roskilde', x: 12, y: 10, dir: 'up', party: TEAM, badges: BADGES.slice(0, 6), noEncounters: true, flags: { roskildeArrive: true }
  }));
  await bot.shot('roskilde-cathedral');
  await bot.walkTo(19, 17);
  await bot.shot('roskilde-museum');
  await bot.enter('cathedral');
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:domkirke');
  await bot.talkTo(6, 1);                                   // the stairs down to the royal crypt
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:crypt');
  await bot.shot('roskilde-crypt');
});

test('Tivoli: closed before the League, then the Battle Gardens @story', async ({ bot }) => {
  test.setTimeout(180_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'vesterbro', x: 23, y: 16, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, flags: { vbArrive: true }
  }));
  await bot.enter('tivoli');
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Closed for the winter/);
  await bot.shot('tivoli-closed');
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'vesterbro', x: 23, y: 16, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, flags: { vbArrive: true, champion: true, ch13done: true }
  }));
  await bot.enter('tivoli');
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:tivoli');
  await bot.walkTo(15, 9);
  await bot.shot('tivoli-daemonen');
  await bot.walkTo(22, 12);
  await bot.shot('tivoli-concert');
});
