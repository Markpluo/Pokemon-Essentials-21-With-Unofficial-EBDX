// Chapter 8 (Trekroner): the hydrofoil run on Pierrot's charts, the lighthouse keys, Maja in the battery cells,
// Langelira through the viewport and Commander Kaas, then dawn in Christianshavn.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('trekroner: hydrofoil, lighthouse, battery, siphon chamber @story', async ({ bot }) => {
  test.setTimeout(400_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'fleetboat', x: 5, y: 2, dir: 'up',
    party: [{ species: 'houndstone', level: 60, moves: ['earthquake', 'shadowball', 'playrough', 'crunch'] }, { species: 'charizard', level: 58, moves: ['flamethrower', 'airslash', 'dragonclaw', 'earthquake'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin'], noEncounters: true, bag: { ferrycharts: 1 },
    flags: { ch7done: true, ch8: true, c8brief: true }
  }));
  bot.answers.push({ when: /Ready to cross/, pick: 'Let' }, { when: /Which way/, pick: 'Behind' },
    { when: /Speed or silence/, pick: 'Cut' }, { when: /Where do we land/, pick: /south/ });
  await bot.talkTo(5, 1);                                   // Freja: let's go
  let s = await bot.state();
  expect(s.map).toBe('hafnia:trekroner');
  expect(bot.said.join('\n')).not.toMatch(/Heave to/);
  await bot.shot('trekroner-jetty');
  await bot.walkTo(13, 14);                                 // the alarm: Maja is caught
  expect(bot.said.join('\n')).toMatch(/They've got Maja/);
  await bot.walkTo(3, 7);
  await bot.step('up');
  s = await bot.state();
  expect(s.map).toBe('hafnia:tklighthouse');
  await bot.talkTo(3, 1);                                   // the photograph
  expect(bot.said.join('\n')).toMatch(/your grandfather's face/);
  await bot.talkTo(4, 3);                                   // the battery keys
  await bot.shot('trekroner-lighthouse');
  await bot.walkTo(4, 5);
  await bot.walkTo(21, 15);
  await bot.step('up');
  s = await bot.state();
  expect(s.map).toBe('hafnia:battery');
  await bot.walkTo(9, 6);                                   // the corridor, with Lukas
  expect(bot.said.join('\n')).toMatch(/I've got your left/);
  await bot.talkTo(10, 3);                                  // cell three
  expect(bot.said.join('\n')).toMatch(/Siphon Keycard/);
  await bot.walkTo(9, 9);
  await bot.walkTo(13, 5);
  await bot.step('up');
  s = await bot.state();
  expect(s.map).toBe('hafnia:siphon');
  await bot.shot('trekroner-siphon');
  await bot.walkTo(8, 6);                                   // the viewport, Lindholm and Kaas
  expect(bot.said.join('\n')).toMatch(/One creature, or a drowned city/);
  expect(bot.said.join('\n')).toMatch(/Chapter 9: The Spire/);
  s = await bot.state();
  expect(s.map).toBe('hafnia:christianshavn');
  await bot.shot('trekroner-dawn');
});
