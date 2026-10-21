// The opening on foot with real input: out of the flat, through Nørrebro, over the bridge, down
// Route 1 (wild battles on) into the King's Garden and the Palm House for a starter, then back
// north past Maja to the flat for Chapter 1. Walking, doors, map exits, trainers and story scripts.
import { test, expect } from '../lib/bot';

test('prologue on foot @story', async ({ bot }) => {
  test.setTimeout(420_000);
  await bot.boot();
  await bot.newGame();
  bot.answers.push({ when: /^Choose /, pick: 'Yes' }, { when: /nickname/i, pick: 'No' });
  const at = async (map: string) => expect((await bot.state()).map, bot.describe(await bot.state())).toBe(`hafnia:${map}`);

  await bot.walkTo(6, 6); await at('norrebro');
  await bot.shot('norrebro');
  await bot.exit('down', 12, 21); await at('bridge');
  await bot.exit('down', 9, 15); await at('route1');
  await bot.exit('down', 11, 31); await at('garden');
  await bot.exit('up', 14, 11); await at('palmhouse');
  const s = await bot.state();
  expect(s.world!.party[0].species).toBe('sprigatito');
  await bot.shot('palmhouse-with-starter');

  // Strong enough for Maja on the bridge, and no wild battles on the way back.
  await bot.debug('Lead +5 levels'); await bot.debug('Lead +5 levels');
  await bot.debug('Toggle wild encounters');
  await bot.walkTo(8, 10); await at('garden');
  await bot.exit('up', 13, 0); await at('route1');
  await bot.exit('up', 10, 0); await at('bridge');
  expect(bot.battles.map(b => b.trainer)).toContain('Maja');
  await bot.exit('up', 9, 0); await at('norrebro');
  await bot.exit('up', 4, 8); await at('flat');
  expect(bot.battles.filter(b => b.trainer).every(b => b.result === 'win')).toBe(true);
  await bot.shot('home-for-chapter-1');
});
