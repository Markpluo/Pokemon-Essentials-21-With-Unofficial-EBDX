// Every building with a door can be walked into (Mark: "every building with a door is enterable").
// Gyms, the Cisterns pyramid, the Dyrehaven substation and the Trekroner battery and siphon doors Christiansborg (until the League), the Bornholm round-church shrines, the Hammershus gate, Tivoli (until you are Champion) and the Dragør safehouse (until Karen gives you the key) may be locked until the story opens them, and Vuggestuen (Dragør nursery) is served at the
// door for now; those must at least say something.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';
import { world } from '../lib/world';
import { MAPS, STAMPS } from '@hafnia/pack-hafnia/world';

const doors = Object.entries(MAPS).filter(([, m]) => !m.indoor)
  .flatMap(([id, m]) => m.buildings.filter(b => b.id && STAMPS[b.s]?.door).map(b => [id, b.id!] as const));

test('every door leads inside, or says why it is locked @doors', async ({ bot }) => {
  test.setTimeout(480_000);
  // Every trainer already beaten (most of them hold the path now, and a battle per door would take
  // longer than the test), and a strong team in case anyone still steps out.
  const { content } = await world();
  const beaten = Object.fromEntries([...content.maps.values()].flatMap(m => m.npcs.flatMap(n => (n.trainer ? [[n.trainer.flag, true]] : []))));
  await bot.loadSave(tweak(afterStarter(), { noEncounters: true, party: [{ species: 'sprigatito', level: 60 }], flags: beaten }));
  const out: string[] = [];
  for (const [map, building] of doors) {
    await bot.warp(map);
    bot.said.push(`[${map}/${building}]`); // so a repeated line (four shut churches) still counts as said
    const before = bot.said.length;
    const s = await bot.enter(building);
    const inside = s.map !== `hafnia:${map}`;
    out.push(`${map}/${building}: ${inside ? s.map : 'locked'}`);
    if (inside) await bot.shot(`${map}-${building}-inside`);
    else expect(bot.said.length, `${map}/${building} neither opens nor says anything`).toBeGreaterThan(before);
    if (!/gym|vuggestuen|cisterns|substation|battery|siphon|palace|nyker|nylars|olsker|osterlars|gate|tivoli|safehouse/.test(building)) expect(inside, `${map}/${building} does not open`).toBe(true);
  }
  console.log(out.join('\n'));
});
