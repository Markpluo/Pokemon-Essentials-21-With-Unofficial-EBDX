// Every indoor map (debug warp to its middle), shot at two points in the story: just after the starter and
// after the whole post-game (from the playthrough's saves when they exist). For looking over the rooms by eye:
// missing tiles, people standing in walls, furniture cut off, wrong backgrounds. Run `npm run playthrough` first
// for the late-game shots.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';
import { MAPS } from '@hafnia/pack-hafnia/world';
import type { SaveData } from '@hafnia/core';

const rooms = Object.entries(MAPS).filter(([, m]) => m.indoor).map(([id]) => id);
const late = join(dirname(fileURLToPath(import.meta.url)), '..', 'results', 'playthrough', 'pg5.json');

for (const [when, save] of [['early', () => afterStarter()], ['late', () => JSON.parse(readFileSync(late, 'utf8')) as SaveData]] as const) {
  test(`every room, ${when} in the story @interiors`, async ({ bot, page }) => {
    test.skip(when === 'late' && !existsSync(late), 'no playthrough save');
    test.setTimeout(600_000);
    await bot.loadSave(tweak(save(), { noEncounters: true }));
    const out: string[] = [];
    for (const id of rooms) {
      const m = MAPS[id as keyof typeof MAPS];
      await bot.settle({ timeout: 20_000 }).catch(() => {});
      await page.evaluate(async arg => { const h = (window as any).__hafnia; void h.play(await h.send({ t: 'debug', cmd: 'warp', arg })); }, `hafnia:${id}`);
      const ok = await bot.settle({ until: st => st.map === `hafnia:${id}` && st.fade === 0, timeout: 20_000 }).catch(() => false);
      const s = await bot.state();
      if (!ok || s.map !== `hafnia:${id}`) { out.push(`${id}: could not warp (on ${s.map})`); continue; }
      await bot.frames(6);
      await bot.shot(`${id}`);
      out.push(`${id}: ${m.name} ${m.w}x${m.h} npcs ${s.world?.npcs.length ?? 0}`);
    }
    console.log(out.join('\n'));
    expect(out.filter(l => /could not warp/.test(l))).toEqual([]);
  });
}
