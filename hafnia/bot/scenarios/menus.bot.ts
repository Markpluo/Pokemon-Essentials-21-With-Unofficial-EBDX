// Start-menu screens: the Pokémon summary, the Pokédex, options, and PC storage at a Pokémon Center.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('summary, Pokédex and options @menus', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter('sprigatito'), { party: [{ species: 'sprigatito', level: 12 }, { species: 'pidgey', level: 8 }], noEncounters: true }));
  await bot.openMenu();
  await bot.choose('Pokémon');
  await bot.waitFor(s => s.picker?.kind === 'party');
  await bot.tap('A');
  await bot.choose('Summary');
  await bot.waitFor(s => s.picker?.kind === 'summary');
  await bot.shot('summary-info');
  await bot.tap('right'); await bot.shot('summary-stats');
  await bot.tap('right'); await bot.shot('summary-moves');
  await bot.tap('down');
  expect((await bot.state()).picker?.idx, 'down shows the next Pokémon').toBe(1);
  await bot.tap('B');
  await bot.waitFor(s => s.picker?.kind === 'party');
  await bot.tap('B');
  await bot.settle();

  await bot.openMenu();
  await bot.choose('Pokédex');
  const dex = await bot.waitFor(s => s.picker?.kind === 'dex');
  expect(dex.world!.dex.caught).toBe(2);
  await bot.shot('pokedex');
  await bot.tap('A'); await bot.shot('pokedex-entry');
  await bot.tap('B'); await bot.tap('B');
  await bot.settle();

  await bot.openMenu();
  await bot.choose('Options');
  await bot.waitFor(s => s.picker?.kind === 'options');
  await bot.tap('right');   // text speed: Normal -> Fast
  await bot.shot('options');
  await bot.tap('B');
  await bot.settle();
  const saved = await bot.page.evaluate(() => localStorage.getItem('hafnia.options'));
  expect(JSON.parse(saved ?? '{}').text).toBe(2);
});

test('PC storage: deposit and withdraw @menus', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter('popplio'), {
    map: 'pcnorrebro', x: 6, y: 2, dir: 'up', party: [{ species: 'popplio', level: 10 }, { species: 'pidgey', level: 5 }], noEncounters: true
  }));
  await bot.waitFor(s => s.scene === 'overworld' && !s.busy && s.fade === 0, 30_000, 'the game to load');
  await bot.tap('A');   // not bot.interact(): its autopilot would log straight off again
  await bot.settle({ until: s => !!s.choice?.options.includes('Log off') });
  await bot.choose('Deposit');
  await bot.pick('Pidgey');
  await bot.waitFor(s => s.picker?.kind === 'party' && s.picker.options.length === 1, 5000, 'the party without Pidgey');
  await bot.tap('B');
  await bot.choose('Open boxes');
  await bot.waitFor(s => s.picker?.kind === 'box');
  await bot.shot('pc-box');
  await bot.tap('A');
  await bot.choose('Withdraw');
  await bot.settle();
  expect((await bot.state()).world!.party.map(m => m.name)).toEqual(['Popplio', 'Pidgey']);
});
