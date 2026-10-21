// Walking looks smooth: holding a direction walks on without a stop on each tile, the walker moves
// in whole pixels, and the legs alternate one stride per tile (Mark: "graphics when you walk is a bit off").
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

type Sample = { t: number; x: number; y: number; px: number; py: number; frame: number };

test('holding a direction walks smoothly @walk', async ({ bot }) => {
  await bot.boot({ speed: 1 });
  await bot.loadSave(tweak(afterStarter(), { noEncounters: true }));
  await bot.warp('route1');
  for (const [dir, key] of [['right', 'ArrowRight'], ['down', 'ArrowDown']] as const) {
    // Record what each rendered frame shows while the key is held.
    await bot.page.evaluate(() => {
      const w = window as any; w.__walk = [];
      const f = () => {
        const G = w.__hafnia.G, p = G.player;
        w.__walk.push({ t: G.t, x: p.x, y: p.y, px: p.px, py: p.py, frame: p.moving ? p.anim : 0 });
        if (w.__walk.length < 90) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await bot.page.keyboard.down(key);
    await bot.page.waitForFunction(() => (window as any).__walk.length >= 90);
    await bot.shot(`walking-${dir}`);
    await bot.page.keyboard.up(key);
    const rec: Sample[] = await bot.page.evaluate(() => (window as any).__walk);
    const along = (s: Sample) => (dir === 'right' ? s.x * 32 + s.px : s.y * 32 + s.py);
    const start = rec.findIndex(s => s.px || s.py), run = rec.slice(start, -1);
    const deltas = run.slice(1).map((s, i) => along(s) - along(run[i]));
    expect(run.length, 'the player never started walking').toBeGreaterThan(40);
    const moves = deltas.filter(d => d !== 0); // displays faster than 60 Hz show some updates twice
    expect(Math.min(...moves), 'walked backwards').toBeGreaterThan(0);
    expect(Math.max(...moves), 'jumped').toBeLessThanOrEqual(6);
    expect(run.every(s => Number.isInteger(s.px) && Number.isInteger(s.py)), 'sub-pixel offsets wobble against the camera').toBe(true);
    // A walking step takes 12 updates. Any pause between tiles shows up as extra updates.
    const tiles = (along(run.at(-1)!) - along(run[0])) / 32, ticks = run.at(-1)!.t - run[0].t;
    expect(tiles, 'walked too few tiles').toBeGreaterThan(4);
    expect(ticks - tiles * 12, `the walk paused: ${ticks} updates for ${tiles} tiles`).toBeLessThan(3);
    // Strides alternate: one tile shows the left leg (1), the next the right (3).
    const strides = run.map(s => s.frame).filter((f, i, a) => f && f !== a[i - 1]);
    expect(strides.slice(0, 4).join(','), 'legs do not alternate').toMatch(/^(1,3,1,3|3,1,3,1)$/);
    await bot.settle();
  }
});
