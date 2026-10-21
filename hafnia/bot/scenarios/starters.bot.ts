// Each of the five starters can be picked on the starter screen, and Lukas's first battle follows.
import { test, expect } from '../lib/bot';
import { beforeStarter } from '../lib/saves';

for (const [i, species] of ['sprigatito', 'charmander', 'popplio', 'eevee', 'pikachu'].entries()) {
  test(`starter ${i + 1}: ${species}`, async ({ bot }) => {
    await bot.loadSave(beforeStarter());
    bot.answers.push({ when: /^Choose /, pick: 'Yes' }, { when: /nickname/i, pick: 'No' });
    await bot.step('up', { settle: false });                           // into the Palm House
    await bot.settle({ until: s => s.picker?.kind === 'species' });
    await bot.pick(i, { shot: 'starter-screen' });
    await bot.settle();                                                // Lukas's first battle and the Coil
    const s = await bot.state();
    expect(s.map).toBe('hafnia:palmhouse');
    expect(s.world?.party[0].species).toBe(species);
    expect(bot.battles.map(b => b.trainer)).toContain('Lukas');
    expect(s.world?.bag.pokeball).toBe(5);
    await bot.shot('after-lukas');
  });
}
