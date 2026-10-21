// Multi battles (Nyhavn): you and Maja against two Black Fleet deckhands, picking targets.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

test('multi battle with a partner @battle', async ({ bot }) => {
  await bot.loadSave(tweak(afterStarter('popplio'), { party: [{ species: 'popplio', level: 22 }], noEncounters: true }));
  let targetAsked = false, partner = '', secondFoe = '';
  // Strongest move, aimed at the right-hand foe, to check the target picker is really asked and answered.
  bot.battlePlan = s => {
    const b = s.battle!, moves = b.request?.moves ?? [];
    if (b.grid?.key === 'target') targetAsked = true;
    partner ||= b.ally2?.name ?? '';
    secondFoe ||= b.foe2?.name ?? '';
    const best = moves.reduce((bi, m, i) => (!m.disabled && m.pp > 0 && m.power > (moves[bi]?.power ?? -1) ? i : bi), 0);
    return { move: best, target: 1 };
  };
  await bot.debug('Try a multi battle');   // the Debug menu's autopilot fights the whole battle
  await bot.settle();
  const said = bot.said.join('\n');
  expect(said).toMatch(/would like to battle/);
  expect(partner, 'the partner is on the field').toBeTruthy();
  expect(secondFoe, 'the second foe is on the field').toBeTruthy();
  expect(targetAsked, 'single-target moves ask which foe to hit').toBe(true);
  expect(said).toMatch(/You defeated/);
  expect(bot.battles.at(-1)?.result).toBe('win');
  await bot.shot('after-multi-battle');
});
