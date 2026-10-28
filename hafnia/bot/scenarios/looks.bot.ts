// The art gaps from the 2026-10-21 quality pass, shot for a look: furnished rooms, Vesterbro's brick blocks,
// the Kødbyen Cold Stores, the city at night, the bridge commuters, the name keyboard and the Coil gauge.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const ROOMS: [string, string][] = [
  ['norrebro', 'home'], ['norrebro', 'lukas'], ['norrebro', 'pc'], ['indreby', 'tower'], ['nyhavn', 'cafe'],
  ['vesterbro', 'cafe'], ['vesterbro', 'bakery'], ['kodbyen', 'kitchen'], ['slotsholmen', 'borsen']
];

test('furnished rooms and the new buildings @looks', async ({ bot }) => {
  test.setTimeout(240_000);
  await bot.loadSave(tweak(afterStarter(), { noEncounters: true, party: [{ species: 'sprigatito', level: 60 }] }));
  for (const [map, building] of ROOMS) {
    await bot.warp(map);
    const s = await bot.enter(building);
    expect(s.map, `${map}/${building} opens`).not.toBe(`hafnia:${map}`);
    await bot.shot(`${map}-${building}`);
  }
  await bot.warp('vesterbro'); await bot.walkTo(13, 11); await bot.shot('vesterbro-brick');
  await bot.warp('kodbyen'); await bot.walkTo(21, 9); await bot.shot('kodbyen-cold-stores');
  // the bridge commuters ride their own bikes now
  await bot.warp('norrebro'); await bot.exit('down', 12, 21); await bot.frames(20); await bot.shot('bridge-commuters');
  // night: lit windows, wall lanterns and door lamps
  for (let i = 0; i < 4 && (await bot.state()).world?.period !== 'night'; i++) await bot.debug('Clock +6 hours');
  expect((await bot.state()).world?.period).toBe('night');
  for (const [map, x, y] of [['vesterbro', 13, 10], ['indreby', 14, 9], ['nyhavn', 12, 9], ['norrebro', 13, 9]] as const) {
    await bot.warp(map); await bot.walkTo(x, y); await bot.shot(`${map}-night`);
  }
});

test('the name keyboard @looks', async ({ bot, page }) => {
  await bot.boot();
  await bot.titleChoice('New game');
  await bot.waitFor(s => !!s.choice?.options.includes('Type a name...'), 30_000, 'the name menu', () => bot.tap('A'));
  await bot.choose('Type a name...');
  await bot.frames(10);
  await bot.shot('keyboard');
  // typed on a real keyboard, and the Ø picked with the d-pad (row 3, column 8)
  await page.keyboard.type('S');
  for (const k of ['down', 'down', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] as const) { await bot.tap(k); await bot.frames(2); }
  await page.keyboard.press('Space');   // the bot's own A is the Z key, which types a z here
  await bot.frames(4);
  await page.keyboard.type('ren');
  await bot.frames(4);
  await bot.shot('keyboard-typed');
  await page.keyboard.press('Enter');
  await bot.settle({ pickLook: 'boy' });
  expect((await bot.state()).world?.name).toBe('Søren');
});

test('the Coil gauge sits under the databox @looks', async ({ bot }) => {
  await bot.loadSave(afterStarter());
  await bot.warp('route1');
  let shot = false;
  await bot.wildBattle(s => {
    if (!shot && s.battle) { shot = true; void bot.shot('coil-gauge'); }
    return { move: 0 };
  });
  expect(shot).toBe(true);
});
