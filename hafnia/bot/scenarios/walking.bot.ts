// Walking looks smooth: holding a direction walks on without a stop on each tile, the walker moves
// in whole pixels, and the legs alternate one stride per tile (Mark: "graphics when you walk is a bit off").
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

type Sample = { t: number; x: number; y: number; px: number; py: number; frame: number };

test('holding a direction walks smoothly @walk', async ({ bot }) => {
  await bot.boot({ speed: 1 });
  // Route 1's trainers already beaten, so nobody steps out to battle mid-stride.
  await bot.loadSave(tweak(afterStarter(), { noEncounters: true, flags: Object.fromEntries(['mads', 'emil', 'sofie', 'bent', 'ole', 'ida'].map(id => [`tr.${id}`, true])) }));
  await bot.warp('route1');
  await bot.walkTo(3, 21);                                  // open ground to the right and below (the pram lady stands on row 20)
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
    // From the first moving frame to the last one (the walk may end at a wall before the key is let go).
    const start = rec.findIndex(s => s.px || s.py), end = rec.length - 1 - [...rec].reverse().findIndex(s => s.px || s.py);
    const run = rec.slice(start, end + 1);
    const deltas = run.slice(1).map((s, i) => along(s) - along(run[i]));
    expect(run.length, 'the player never started walking').toBeGreaterThan(40);
    // Per game update, not per rendered frame: a busy machine renders less often than it updates.
    const speeds = deltas.map((d, i) => [d, run[i + 1].t - run[i].t]).filter(([, dt]) => dt > 0).map(([d, dt]) => d / dt);
    expect(Math.min(...speeds), 'walked backwards').toBeGreaterThanOrEqual(0);
    expect(Math.max(...speeds), 'jumped').toBeLessThanOrEqual(3);
    expect(run.every(s => Number.isInteger(s.px) && Number.isInteger(s.py)), 'sub-pixel offsets wobble against the camera').toBe(true);
    // A walking step takes 12 updates. A pause between tiles shows up as extra updates (the old
    // client lost 2-3 on every tile; allow one per tile for a busy machine).
    const tiles = (along(run.at(-1)!) - along(run[0])) / 32, ticks = run.at(-1)!.t - run[0].t;
    expect(tiles, 'walked too few tiles').toBeGreaterThan(4);
    expect(ticks - tiles * 12, `the walk paused: ${ticks} updates for ${tiles} tiles`).toBeLessThan(tiles);
    // Strides alternate: one tile shows the left leg (1), the next the right (3).
    const strides = run.map(s => s.frame).filter((f, i, a) => f && f !== a[i - 1]);
    expect(strides.slice(0, 4).join(','), 'legs do not alternate').toMatch(/^(1,3,1,3|3,1,3,1)$/);
    await bot.settle();
  }
});
