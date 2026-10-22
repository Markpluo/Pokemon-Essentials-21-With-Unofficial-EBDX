// Gym 7 (Børsen): Margrethe reads Andersen's ledger, the archive clerk sends Kul the Torkoal along, then the vault:
// three merchants' tokens, the brass scales (a wrong guess first) and Margrethe herself.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('borsen: the ledger, Kul, the scales, Margrethe @gym', async ({ bot }) => {
  test.setTimeout(400_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'borsen', x: 8, y: 7, dir: 'up',
    party: [{ species: 'houndstone', level: 60, moves: ['earthquake', 'shadowball', 'playrough', 'crunch'] }, { species: 'charizard', level: 60, moves: ['flamethrower', 'airslash', 'dragonclaw', 'earthquake'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin'], noEncounters: true, bag: { ledgercopy: 1 },
    flags: { ch8done: true, ch9: true, c9arrive: true }
  }));
  await bot.shot('gym7-borsen');
  bot.answers.push({ when: /Show Margrethe/, pick: 'Show' }, { when: /Which tokens/, pick: 'Ship + Salt', once: true },
    { when: /Which tokens/, pick: 'Ship + Spice' }, { when: /Battle Margrethe/, pick: 'Yes' });
  await bot.talkTo(5, 1);                                   // Margrethe reads the ledger
  expect(bot.said.join('\n')).toMatch(/So: the vault/);
  await bot.talkTo(2, 4);                                   // the clerk's Torkoal
  expect(bot.said.join('\n')).toMatch(/received a Torkoal/);
  let s = await bot.state();
  expect(s.world?.party.map(m => m.species)).toContain('torkoal');
  await bot.talkTo(12, 1);                                  // the hatch
  s = await bot.state();
  expect(s.map).toBe('hafnia:gym7');
  await bot.shot('gym7-vault');
  await bot.talkTo(4, 12);                                  // the merchants' tokens
  await bot.talkTo(4, 7);
  await bot.talkTo(14, 7);
  await bot.talkTo(9, 7);                                   // the scales: wrong, then right
  expect(bot.said.join('\n')).toMatch(/Not balanced/);
  await bot.talkTo(9, 7);
  expect(bot.said.join('\n')).toMatch(/perfectly level/);
  await bot.walkTo(9, 3);
  await bot.talkTo(9, 2);                                   // Margrethe
  expect(bot.said.join('\n')).toMatch(/received the Spire Badge/);
  s = await bot.state();
  expect(s.world?.badges).toBe(7);
  await bot.shot('gym7-badge');
});
