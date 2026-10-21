// Regression: NPCs must be drawn during the cutscene that plays when you enter a map, not only once it
// ends. Before the fix, the room's NPCs only arrived with the view at the end of the batch, so Mum in
// the intro and Ørsted, Lukas and Maja in the Palm House were invisible while they talked.
import { test, expect } from '../lib/bot';
import { beforeStarter } from '../lib/saves';
import type { Probe } from '../../apps/client/src/main';

const ids = (s: Probe) => s.actors.map(a => a.id);

test('Mum is in the flat during the intro @story @cutscene', async ({ bot }) => {
  await bot.boot();
  await bot.titleChoice('New game');
  expect(await bot.settle({ pickLook: 'boy', until: s => !!s.text?.startsWith('Mum: Morning') })).toBe(true);
  const s = await bot.state();
  expect(s.map).toBe('hafnia:flat');
  expect(ids(s)).toContain('mum');
  await bot.shot('mum-talking');
});

test('Ørsted, Lukas and Maja are in the Palm House during the starter scene @story @cutscene', async ({ bot }) => {
  await bot.loadSave(beforeStarter());
  await bot.step('up', { settle: false });                             // through the door: map change + cutscene
  expect(await bot.settle({ until: s => !!s.text?.startsWith('Professor Ørsted: Ah!') })).toBe(true);
  const s = await bot.state();
  expect(s.map).toBe('hafnia:palmhouse');
  expect(ids(s)).toEqual(expect.arrayContaining(['prof', 'lukas', 'maja']));
  await bot.shot('orsted-talking');
});
