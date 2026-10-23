// Post-game P1 (Morning After): stepping out after the credits, the Mermaid's Tear on Langelinie (Harmony and two
// Eggs), and the first Resonance Rift on Søerne Path, won with Harmony.
import { test, expect } from '../lib/bot';
import { afterStarter, tweak } from '../lib/saves';

const TEAM = [{ species: 'garchomp', level: 80, moves: ['earthquake', 'dragonclaw', 'crunch', 'swordsdance'] },
  { species: 'lapras', level: 70, moves: ['surf', 'icebeam', 'thunderbolt', 'psychic'] }];
const BADGES = ['spray', 'lily', 'frost', 'lantern', 'orrery', 'harlequin', 'spire', 'turbine'];

test('post-game P1: the morning after, the Mermaid\'s Tear and the first Resonance Rift @story', async ({ bot }) => {
  test.setTimeout(300_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'flat', x: 6, y: 5, dir: 'down', party: TEAM, badges: BADGES, noEncounters: true,
    flags: { ch12done: true, ch13: true, champion: true, ch13done: true }
  }));
  await bot.walkTo(6, 6);                                   // out into the courtyard: Mum, then Ørsted calls
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/No jacket needed/);
  expect((await bot.state()).map).toBe('hafnia:norrebro');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'osterbro', x: 22, y: 16, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true },
    flags: { ch13done: true, pg1: true, pg1palm: true }
  }));
  await bot.talkTo(22, 13);                                 // the statue's copper tear
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Harmony unlocked/);
  expect(bot.said.join('\n')).toMatch(/Maja handed over an Egg/);
  await bot.shot('pg1-statue');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'route1', x: 14, y: 13, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true, harmony: true },
    flags: { ch13done: true, pg1: true, pg1palm: true, pg1harmony: true }
  }));
  bot.battlePlan = s => {
    const req = s.battle?.request;
    // Swords Dance until the Coil is charged, then Earthquake with Harmony.
    if (!req?.moves.some(m => m.name === 'Earthquake')) return { move: 0 };
    return req.coil?.harmony === null ? { move: 'Earthquake', coil: 'harmony' } : { move: req.coil?.used ? 'Earthquake' : 'Swords Dance' };
  };
  await bot.talkTo(14, 11);                                 // Brix, then the Echo opens as a Rift
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/frozen song warps/);
  expect(bot.said.join('\n')).toMatch(/Copper and Current in harmony/);
  expect(bot.said.join('\n')).toMatch(/An Echo Shard/);
  await bot.shot('pg1-rift');
});

test('post-game P2: Kystbanen to Helsingør, the Oath Trials and Kronvakt @story', async ({ bot }) => {
  test.setTimeout(420_000);
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'osterbro', x: 26, y: 5, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true,
    flags: { ch12done: true, ch13done: true, pg1: true, pg1palm: true, pg1harmony: true, pg1rift: true, pg1done: true, dyrehavenSeen: true }
  }));
  bot.answers.push({ when: /Where to/, pick: 'Helsingør' });
  await bot.talkTo(27, 4);                                  // Kystbanen runs to Helsingør again
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:helsingor');
  expect(bot.said.join('\n')).toMatch(/Kronvakt is home/);
  await bot.enter('kronborg');
  await bot.talkTo(18, 1);
  expect(bot.said.join('\n')).toMatch(/untested trainer/);
  await bot.talkTo(13, 1);                                  // the Trial of Copper
  expect(bot.said.join('\n')).toMatch(/Copper held/);
  await bot.shot('pg2-trial');

  // The other two trials done: the Guardian's Test, from behind a wall of Skarmory.
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'casemates', x: 18, y: 3, dir: 'up', badges: BADGES, noEncounters: true, bag: { ultraball: 99 },
    party: [1, 2, 3, 4, 5, 6].map(() => ({ species: 'skarmory', level: 100, moves: ['roost', 'bodypress'] })),
    flags: { ch12done: true, ch13done: true, pg1done: true, pg2: true, oathCopper: true, oathCurrent: true, oathOath: true }
  }));
  bot.battlePlan = s => {                                   // wear it down with Body Press, Roost when hurt, then throw
    const b = s.battle!, me = b.ally, foe = b.foe;
    if (me && me.hp < me.maxhp / 2 && b.request?.moves.some(m => m.name === 'Roost' && m.pp > 0)) return { move: 'Roost' };
    return foe && foe.hp > foe.maxhp * 0.45 ? { move: 'Body Press' } : { ball: 'Ultra Ball' };
  };
  await bot.talkTo(18, 1);
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Kronvakt was caught/);
  await bot.shot('pg2-kronvakt');
});

test('post-game P3: the Øresund Bridge, Peberholm and Lumen Nord @story', async ({ bot }) => {
  test.setTimeout(300_000);
  const P3 = { ch12done: true, ch13done: true, pg1done: true, pg2done: true };
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'dragor', x: 19, y: 17, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, flags: P3
  }));
  await bot.talkTo(19, 16);                                 // the toll booth: the bridge is open again
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:oresund');
  await bot.walkTo(9, 4);                                   // the first gust
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/holds you steady/);
  await bot.shot('pg3-bridge');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'peberholm', x: 12, y: 8, dir: 'down', party: TEAM, badges: BADGES, noEncounters: true,
    flags: { ...P3, pg3: true, pg3permit: true }
  }));
  await bot.talkTo(12, 13);                                 // Lumen Nord's field lead, then Vinther
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/Think of it as recycling/);
  await bot.shot('pg3-vinther');
});

test('post-game P4: the Bornholm ferry, a round-church shrine and Vinther under Hammershus @story', async ({ bot }) => {
  test.setTimeout(300_000);
  const P4 = { ch12done: true, ch13done: true, pg1done: true, pg1harmony: true };
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'dragor', x: 20, y: 7, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true, harmony: true }, flags: P4
  }));
  bot.answers.push({ when: /Where to/, pick: 'Bornholm' });
  await bot.talkTo(20, 5);                                  // the Bornholm ferry
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:ronne');
  expect(bot.said.join('\n')).toMatch(/Last issue of Undergrunden/);
  await bot.shot('pg4-ronne');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'route14', x: 6, y: 8, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: { copper: true, current: true, harmony: true },
    flags: { ...P4, pg4: true }
  }));
  bot.answers.push({ when: /charge the Coil/, pick: 'Copper' });
  await bot.walkTo(6, 7);
  await bot.step('up');                                     // Nyker church: a door sealed with patina
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/church starts to hum/);
  await bot.shot('pg4-church');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'hammerdeep', x: 11, y: 7, dir: 'up', party: [{ species: 'garchomp', level: 100, moves: ['earthquake', 'flamethrower', 'dragonclaw', 'swordsdance'] }, TEAM[1]],
    badges: BADGES, noEncounters: true,
    flags: { ...P4, pg4: true, shrineNyker: true, shrineNylars: true, shrineOlsker: true, shrineOsterlars: true }
  }));
  bot.battlePlan = s => {                                   // Flamethrower for the Steel types, Earthquake for the rest
    const foe = s.battle?.foe?.name?.toLowerCase() ?? '';
    return { move: /bronzong|magnezone/.test(foe) ? 'Flamethrower' : 'Earthquake' };
  };
  await bot.talkTo(11, 4);                                  // Vinther, then Maja's broadcast
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/investors just pulled out/);
  await bot.shot('pg4-broadcast');
});

test('post-game P5: the Fleet hydrofoil, the Deep Sound concert and the lighthouse @story', async ({ bot }) => {
  test.setTimeout(360_000);
  const P5 = { ch8done: true, ch12done: true, ch13done: true, pg1done: true, pg1harmony: true, pg2done: true, pg3done: true, pg4done: true, pg5: true };
  const COIL = { copper: true, current: true, harmony: true };
  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'christianshavn', x: 3, y: 8, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: COIL, flags: P5
  }));
  bot.answers.push({ when: /Where to/, pick: 'Trekroner' });
  await bot.talkTo(3, 6);                                   // the Black Fleet's hydrofoil
  await bot.settle();
  expect((await bot.state()).map).toBe('hafnia:trekroner');
  expect(bot.said.join('\n')).toMatch(/My grandfather kept this lamp/);
  await bot.shot('pg5-fort');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'deepsound', x: 9, y: 4, dir: 'up', badges: BADGES,
    party: [1, 2, 3].map(() => ({ species: 'blissey', level: 100, moves: ['seismictoss', 'softboiled'] })), noEncounters: true, coil: COIL, bag: { lastecho: 1 },
    flags: { ...P5, pg5fort: true, pg5echo: true, noteLow: true, noteHigh: true, noteBoth: true }
  }));
  // Sing each mode once as soon as the Coil is charged (the narration says which ones have been sung).
  const SUNG = { copper: /coated in a copper patina/, current: /The Coil surges/, harmony: /in harmony!/ };
  bot.battlePlan = s => {
    const c = s.battle?.request?.coil, said = bot.said.join('\n');
    const mode = (['copper', 'current', 'harmony'] as const).find(m => c?.[m] === null && !SUNG[m].test(said));
    return { move: 'Seismic Toss', ...(mode ? { coil: mode } : {}) };
  };
  await bot.talkTo(9, 1);                                   // the concert
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/holds the note/);
  expect(bot.said.join('\n')).toMatch(/song is home/);
  await bot.shot('pg5-concert');

  await bot.loadSave(tweak(afterStarter('charmander'), {
    map: 'tklighthouse', x: 4, y: 4, dir: 'up', party: TEAM, badges: BADGES, noEncounters: true, coil: COIL,
    flags: { ...P5, pg5fort: true, pg5echo: true, pg5song: true }
  }));
  bot.answers.push({ when: /Charge the lamp/, pick: 'Charge it' });
  await bot.talkTo(2, 4);                                   // Freja relights the lamp
  await bot.settle();
  expect(bot.said.join('\n')).toMatch(/a light answers/);
  await bot.shot('pg5-lamp');
});
