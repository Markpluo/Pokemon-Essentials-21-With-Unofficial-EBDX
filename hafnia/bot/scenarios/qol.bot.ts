// Getting around: bus stops (city bus by day, free Natbus at night), the current-goal line in the
// start menu, and the touch Bike button.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const CH3 = { c1done: true, c2: true, enforcer: true, demoEnd: true, ch3: true, vbArrive: true };

test('city bus by day costs a fare @qol', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter(), { map: 'vesterbro', x: 22, y: 8, dir: 'up', money: 1000, clock: 12 * 60, flags: CH3, noEncounters: true }));
  bot.answers.push({ when: /Ride to/, pick: 'Indre By', once: true });
  await bot.talkTo(22, 7);
  const s = await bot.state();
  expect([s.map, s.x, s.y]).toEqual(['hafnia:indreby', 3, 6]);
  expect(s.world?.money).toBe(950);
  expect(bot.said.join('\n')).toMatch(/City bus: 50 kr/);
});

test('Natbus at night is free and arrives at 05:00 @qol', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter(), { map: 'norrebro', x: 19, y: 7, dir: 'up', money: 0, clock: 2 * 60, flags: CH3, noEncounters: true }));
  bot.answers.push({ when: /Ride to/, pick: 'Christianshavn', once: true });
  await bot.talkTo(19, 6);
  const s = await bot.state();
  expect([s.map, s.x, s.y]).toEqual(['hafnia:christianshavn', 19, 11]);
  expect(s.world?.clock).toBeGreaterThanOrEqual(300);
  expect(s.world?.clock).toBeLessThan(310);
  await bot.shot('natbus-arrival');
});

test('start menu shows the current goal @qol @menus', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter(), { map: 'vesterbro', x: 10, y: 10, flags: CH3, noEncounters: true }));
  expect((await bot.state()).world?.goal).toMatch(/Kasper's Kitchen/);
  await bot.openMenu();
  await bot.shot('menu-goal');
  await bot.tap('B');
  await bot.settle();
});

test('touch Bike button gets on and off @qol', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter(), { map: 'norrebro', x: 10, y: 9, bag: { bike: 1 }, noEncounters: true }));
  const btn = bot.page.locator('#bikebtn');
  await expect(btn).toBeVisible();
  await btn.click();
  await bot.waitFor(s => s.biking, 3000, 'the bike');
  await expect(btn).toHaveText('Get off');
  await bot.shot('bike-button');
  await btn.click();
  await bot.waitFor(s => !s.biking, 3000, 'getting off');
});
