// Chapter 11 (The Rising Tide): Absalon's ruins under Slotsholmen, where each door wants the badge its
// plaque describes, then Kronborg: Commander Kaas and Bjørn in a multi battle with Maja, and Holger Danske.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('kronborg: the badge doors, Kaas with Maja, Holger Danske @story', async ({ bot }) => {
  test.setTimeout(400_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'ruins', x: 2, y: 4, dir: 'right',
    party: [{ species: 'garchomp', level: 70, moves: ['crunch', 'dragonclaw', 'firefang', 'stoneedge'] }, { species: 'charizard', level: 62, moves: ['flamethrower', 'airslash', 'dragonclaw', 'slash'] }],
    badges: ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'], noEncounters: true,
    flags: { ch10done: true, ch11: true, resJensen: true, resPolse: true, resBodil: true, c11metro: true, c11broadcast: true }
  }));
  await bot.shot('kronborg-ruins');
  bot.answers.push({ when: /Hold up which badge/, pick: 'Frost', once: true });
  await bot.talkTo(4, 2);                                   // the wrong badge: the door stays shut
  expect(bot.said.join('\n')).toMatch(/door doesn't move/);
  for (const [x, badge] of [[4, 'Spray'], [8, 'Lantern'], [12, 'Orrery'], [16, 'Turbine']] as const) {
    bot.answers.push({ when: /Hold up which badge/, pick: badge, once: true });
    await bot.talkTo(x, 2);
  }
  expect(bot.said.join('\n').match(/door grinds open/g)?.length).toBe(4);
  await bot.talkTo(18, 1);                                  // Absalon's altar, then the coast line north
  let s = await bot.state();
  expect(s.map).toBe('hafnia:helsingor');
  await bot.shot('kronborg-helsingor');
  await bot.walkTo(15, 7);
  await bot.step('up');
  s = await bot.state();
  expect(s.map).toBe('hafnia:casemates');
  await bot.walkTo(14, 8);                                  // Kaas and Bjørn, two on two with Maja
  expect(bot.said.join('\n')).toMatch(/Unit, stand down/);
  await bot.shot('kronborg-casemates');
  await bot.talkTo(16, 1);                                  // Holger Danske
  expect(bot.said.join('\n')).toMatch(/Kronvakt rises/);
  await bot.shot('kronborg-holger');
});
