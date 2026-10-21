// The Vuggestuen daycare in Dragør, through the real menus: leaving two Pokémon with Bodil.
// Egg laying and hatching take hundreds of steps, so packs/hafnia/test/breeding.test.ts covers those.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('leave two Pidgey at the Vuggestuen @daycare', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter(), {
    map: 'dragor', x: 6, y: 9, dir: 'up', badges: ['a', 'b', 'c'], money: 5000, noEncounters: true,
    party: [{ species: 'sprigatito', level: 20, gender: 'M' }, { species: 'pidgey', level: 20, gender: 'M' }, { species: 'pidgey', level: 20, gender: 'F', ot: 'Asta' }]
  }));
  await bot.shot('dragor');
  // Same answers as the core test: leave Pidgey, no toy, leave the other Pidgey, take the Everstone, done.
  for (const pick of [0, 1, 1, 0, 1, 0, 2]) bot.answers.push({ pick, once: true });
  await bot.talkTo(6, 8);
  const s = await bot.state();
  expect(bot.said.join('\n')).toMatch(/received an Everstone/);
  expect(s.world!.party.map(p => p.species)).toEqual(['sprigatito']);
  expect(s.world!.money).toBe(4000);
  await bot.shot('after-drop-off');
});
