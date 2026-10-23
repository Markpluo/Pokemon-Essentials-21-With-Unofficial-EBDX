// Gym 3 (Kødbyen Cold Stores): slide on the sea ice, turn the steam valves in menu order, beat Chef Kasper.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';
import type { Dir } from '@hafnia/core';

test('ice gym: slide, valves, Kasper @gym', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'gym3', x: 7, y: 10, dir: 'up', party: [{ species: 'charmeleon', level: 40 }],
    badges: ['spray', 'lily'], flags: { ch3: true, dinnerDone: true, neonDone: true }, noEncounters: true
  }));
  const at = async () => { const s = await bot.state(); return [s.x, s.y]; };
  // A slide can pause for a frame between ice tiles, so wait until the player has stopped on one tile
  // before the next push; on a slow runner the next key otherwise lands mid-slide and is lost.
  const stopped = async () => {
    let last = '', since = Date.now();
    for (const end = Date.now() + 5000; Date.now() < end; await bot.frames(1)) {
      const s = await bot.state(), k = `${s.x},${s.y},${s.moving}`;
      if (k !== last) { last = k; since = Date.now(); } else if (!s.moving && Date.now() - since > 150) return;
    }
  };
  const slide = async (...dirs: Dir[]) => { for (const d of dirs) { await bot.step(d); await stopped(); } };
  const valve = async (dir: Dir) => { await bot.face(dir); await bot.interact(); };

  await slide('up', 'right', 'down', 'left', 'up', 'right');
  expect(await at(), 'slid to the forret valve').toEqual([13, 7]);
  await valve('right');
  await slide('left', 'up', 'left', 'up', 'left', 'down');
  expect(await at(), 'slid to the hovedret valve').toEqual([1, 7]);
  await valve('left');
  await slide('up', 'right', 'down', 'right', 'up', 'right');
  expect(await at(), 'slid to the dessert valve').toEqual([13, 4]);
  await valve('right');
  await bot.shot('gym3-steam');
  await slide('left', 'down', 'left', 'up', 'left', 'up', 'right', 'up');
  expect(await at(), 'up through the melted ice block').toEqual([7, 3]);
  await bot.talkTo(7, 1);
  expect(bot.battles.at(-1)?.result).toBe('win');
  expect(bot.said.join('\n')).toMatch(/received the Frost Badge/);
  expect((await bot.state()).world?.badges).toBe(3);
  await bot.shot('gym3-badge');
});
