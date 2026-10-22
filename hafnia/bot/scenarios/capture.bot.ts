// The capture sequence frame by frame, in real time with animations on: the throw arc, the Pokémon
// going into the ball, the ball dropping and wobbling, the click (or the break-out). Look at
// bot/results/shots/<test>/ after changing anything in the 'throw' battle event.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

/** Grabs the game canvas every few frames for `ms`, in the page, and saves them as shots. */
async function filmstrip(bot: import('../lib/bot').Bot, name: string, ms: number, every = 3, during?: () => Promise<void>) {
  const filming = bot.page.evaluate(({ ms, every }) => new Promise<string[]>(resolve => {
    const out: string[] = [], end = performance.now() + ms;
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    let n = 0;
    const tick = () => {
      if (n++ % every === 0) out.push(cv.toDataURL('image/png'));
      if (performance.now() < end) requestAnimationFrame(tick); else resolve(out);
    };
    requestAnimationFrame(tick);
  }), { ms, every });
  if (during) await during();
  const frames: string[] = await filming;
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'bot', 'results', 'shots', 'capture-frames', name);
  mkdirSync(dir, { recursive: true });
  frames.forEach((f, i) => writeFileSync(join(dir, `${String(i).padStart(3, '0')}.png`), Buffer.from(f.split(',')[1], 'base64')));
  return frames.length;
}

for (const where of [{ map: 'route1', x: 4, y: 4 }, { map: 'islandsbrygge', x: 5, y: 15 }]) test(`capture sequence on ${where.map}, frame by frame @battle @capture`, async ({ bot }) => {
  test.setTimeout(240_000);
  await bot.boot({ animations: 'on', speed: 1 });
  // A Lv 60 lead with a gentle move, so the foe is never knocked out and the throw comes first.
  await bot.loadSave(tweak(afterStarter('popplio'), {
    ...where, party: [{ species: 'popplio', level: 60, moves: ['growl'] }], bag: { pokeball: 10, greatball: 5, ultraball: 5 }
  }));
  let thrown = 0;
  for (let i = 0; i < 6 && (await bot.state()).world!.party.length < 2 && !bot.said.some(t => /broke free|almost had it|appeared to be caught/i.test(t)); i++) {
    let s = await bot.state();
    // Pace in the grass until a wild Pokémon appears.
    for (let k = 0; k < 400 && !s.battle; k++) { await bot.step(k % 2 ? 'left' : 'right', { settle: false }); s = await bot.state(); }
    thrown++;
    const ball = where.map === 'route1' ? ['Poké Ball', 'Great Ball', 'Ultra Ball'][i % 3] : 'Poké Ball';
    // Film the whole battle from the first menu: the ball goes out on the first turn.
    await filmstrip(bot, `${where.map}-throw-${thrown}`, 14_000, 3, async () => { await bot.settle({ battle: () => ({ ball }), timeout: 120_000 }); });
    await bot.settle();
  }
  expect(bot.battles.length).toBeGreaterThan(0);
});
