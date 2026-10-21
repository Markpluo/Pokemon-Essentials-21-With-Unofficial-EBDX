// Saving to a slot from the start menu and continuing from it after a reload.
import { test, expect } from '../lib/bot';
import { afterStarter } from '../lib/saves';

test('save to slot 2, reload, continue @save', async ({ bot }) => {
  await bot.loadSave(afterStarter());
  await bot.debug('Toggle wild encounters');
  await bot.warp('route1');
  const s0 = await bot.walkTo(9, 20);
  await bot.save(2);
  await bot.reload();
  const s1 = await bot.continueGame(2);
  expect([s1.map, s1.x, s1.y]).toEqual([s0.map, s0.x, s0.y]);
  expect(s1.world!.party.map(p => p.species)).toEqual(s0.world!.party.map(p => p.species));
  await bot.shot('continued');
});
