// Wild battles on Route 1: fighting with the Copper & Current Coil, and catching.
import { test, expect } from '../lib/bot';
import { afterStarter } from '../lib/saves';

test('wild battle using the Coil @battle', async ({ bot }) => {
  await bot.loadSave(afterStarter('charmander'));
  await bot.warp('route1');
  // The Coil starts a wild battle one pip short, so it isn't always ready before the foe faints: try a few.
  for (let i = 0; i < 5 && !bot.said.some(t => /Coil surges|copper patina/.test(t)); i++) {
    const b = await bot.wildBattle('coil');
    expect(b.result, 'a level 5 starter should beat Route 1').not.toBe('lose');
    await bot.debug('Heal team');
  }
  expect(bot.said.join('\n')).toMatch(/Coil surges|copper patina/);
  await bot.shot('after-coil-battle');
});

test('catching a wild Pokémon @battle', async ({ bot }) => {
  await bot.loadSave(afterStarter('popplio'));
  await bot.debug('Give items');
  await bot.warp('route1');
  for (let i = 0; i < 8 && (await bot.state()).world!.party.length < 2; i++) {
    await bot.wildBattle('catch');
    await bot.debug('Heal team');
  }
  const s = await bot.state();
  expect(s.world!.party.length, bot.battles.map(b => `${b.foe}: ${b.result}`).join(', ')).toBe(2);
  expect(bot.battles.some(b => b.result === 'caught')).toBe(true);
  await bot.openMenu();
  await bot.choose('Pokémon');
  await bot.waitFor(s => s.picker?.kind === 'party');
  await bot.shot('party');
  await bot.tap('B');
  await bot.settle();
});
