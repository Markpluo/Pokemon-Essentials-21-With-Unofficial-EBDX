// The game loads, the title screen works, and a new game reaches the flat with nothing logged as an error.
import { test, expect } from '../lib/bot';

test('boots to the title and starts a new game @smoke', async ({ bot }) => {
  await bot.boot();
  await bot.shot('title');
  const s = await bot.newGame({ name: 'Asta', look: 'girl' });
  expect(s.map).toBe('hafnia:flat');
  expect(s.world?.name).toBe('Asta');
  expect(s.world?.look).toBe('girl');
  expect(bot.said[0]).toContain('Welcome to Hafnia');
  await bot.shot('flat');
});
