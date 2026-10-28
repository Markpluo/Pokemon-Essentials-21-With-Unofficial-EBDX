// Post-game, "The Long Echo" (design/post-game-and-endgame.md §3). P1, Morning After: you wake up as Champion.
// Ørsted and Brix explain the Echoes (the reactor's stolen song, leaking out of cracked Resonance Cells) at the
// Palm House, the new statue on Langelinie gives you the Mermaid's Tear shard and Harmony, Lukas and Maja give
// you eggs of the two starters nobody picked, and Brix shows you the first Resonance Rift by Søerne.
import type { BattleOptions, FoeSpec, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { ballsFor, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { STARTERS, lukasStarter, majaStarter } from './starters';

function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return n;
}

// ---------- P1 starts: the morning after ----------

/** Runs when you first step outside after the credits. */
export function* p1Start(s: ScriptApi): Step {
  if (!s.flag('ch13done') || s.flag('pg1')) return;
  s.setFlag('pg1', true);
  s.chapterEnd('Post-game', 'Morning After');
  s.say('pg1.start.1'); s.say('pg1.start.2');
  s.say('pg1.mum.1'); s.say('pg1.mum.2'); s.say('pg1.mum.3');
  s.sfx('pc');
  s.say('pg1.call.1'); s.say('pg1.call.2'); s.say('pg1.call.3');
  s.checkpoint();
}

// ---------- The Palm House: Ørsted and Brix ----------

function* palmScene(s: ScriptApi): Step {
  s.setFlag('pg1palm', true);
  const b = cast(s, 'brixpg', 8, 9);
  s.player.faceTo(8, 7);
  s.say('pg1.palm.orsted.1'); s.say('pg1.palm.brix.1'); s.say('pg1.palm.orsted.2');
  s.say('pg1.palm.brix.2'); s.say('pg1.palm.brix.3');
  s.say('pg1.palm.radio.1'); s.say('pg1.palm.radio.2'); s.say('pg1.palm.radio.3');
  s.say('pg1.palm.orsted.3'); s.say('pg1.palm.brix.4');
  s.giveItem('expcandyl', 3); s.me('me_item');
  s.say('pg1.palm.candy');
  s.say('pg1.palm.orsted.4');
  b.face('down');
  s.checkpoint();
}

const brixTalk: Script = function* (s) {
  if (!s.flag('pg1harmony')) { s.say('pg1.brix.statue'); return; }
  if (!s.flag('pg1rift')) { s.say('pg1.brix.rift'); return; }
  s.say('pg1.brix.after');
};

/** The Palm House scripts the post-game adds (the map's own onEnter still runs first). */
export const PALM_PG1 = {
  npcs: [{ id: 'brixpg', sprite: 'chars/scientist', x: 10, y: 8, dir: 'left', when: f => !!f('pg1palm'), talk: brixTalk } as NpcDef],
  onEnter: function* (s: ScriptApi): Step { if (s.flag('pg1') && !s.flag('pg1palm')) yield* palmScene(s); }
};

// ---------- Langelinie: the Mermaid's Tear ----------

/** The two starters nobody took: Lukas hatched one, Maja the other. */
export function spareStarters(s: ScriptApi): [string, string] {
  const taken = new Set([s.flag('starter') as string, lukasStarter(s), majaStarter(s)]);
  const left = STARTERS.map(x => x.species).filter(x => !taken.has(x));
  return [left[0] ?? 'eevee', left[1] ?? 'pikachu'];
}

/** Talking to the new statue once Ørsted has sent you there. Returns false if the scene doesn't run. */
export function* statueTear(s: ScriptApi): Generator<any, boolean, any> {
  if (!s.flag('pg1palm') || s.flag('pg1harmony')) return false;
  s.setFlag('pg1harmony', true);
  s.say('pg1.statue.1'); s.say('pg1.statue.2');
  s.wait(20); s.cry('langelira'); s.wait(20);
  s.say('pg1.statue.3');
  s.unlockCoil('harmony');
  s.me('me_badge');
  s.giveItem('mermaidtear');
  s.say('pg1.statue.harmony.1'); s.say('pg1.statue.harmony.2');
  const lukas = cast(s, 'lukaspg'), maja = cast(s, 'majapg');
  s.say('pg1.gift.maja.1'); s.say('pg1.gift.lukas.1'); s.say('pg1.gift.maja.2');
  const [a, b] = spareStarters(s);
  s.giveEgg(a, { perfectIvs: 3 }); s.me('me_get');
  s.say(`Lukas handed over an Egg.\nSomething inside it is very warm.`);
  s.giveEgg(b, { perfectIvs: 3 }); s.me('me_get');
  s.say(`Maja handed over an Egg.\nIt rocks the moment you hold it.`);
  s.say('pg1.gift.lukas.2'); s.say('pg1.gift.maja.3'); s.say('pg1.gift.lukas.3');
  lukas.walk('left', 4); maja.walk('left', 4);
  lukas.hide(); maja.hide();
  s.checkpoint();
  return true;
}

export const OSTERBRO_PG1: NpcDef[] = [
  { id: 'lukaspg', sprite: 'chars/lukas', x: 20, y: 11, dir: 'down', hidden: true },
  { id: 'majapg', sprite: 'chars/maja', x: 21, y: 11, dir: 'down', hidden: true }
];

// ---------- Søerne: the Resonance Rift ----------

/** Echo-warped Søerne locals for the repeatable Rift: [species, level, moves]. */
const RIFT_POOL: [string, number, string[]][] = [
  ['golduck', 60, ['hydropump', 'psychic', 'icebeam', 'calmmind']],
  ['pidgeot', 60, ['hurricane', 'heatwave', 'uturn', 'roost']],
  ['stoutland', 61, ['bodyslam', 'crunch', 'wildcharge', 'playrough']],
  ['ludicolo', 61, ['surf', 'gigadrain', 'icebeam', 'raindance']],
  ['pelipper', 60, ['hurricane', 'scald', 'uturn', 'roost']],
  ['lopunny', 61, ['highjumpkick', 'return', 'icepunch', 'bounce']],
  ['noctowl', 60, ['airslash', 'psychic', 'hypervoice', 'roost']],
  ['gyarados', 62, ['waterfall', 'crunch', 'icefang', 'dragondance']]
];

const echoTalk: Script = function* (s) {
  if (!s.flag('pg1harmony')) { s.say('pg1.echo.faint'); return; }
  const first = !s.flag('pg1rift');
  if (!first && s.flag('pg1riftPeriod') === s.period) { s.say('pg1.echo.quiet'); return; }
  if (first) {
    const b = cast(s, 'brixrift');
    s.say('pg1.rift.brix.1'); s.say('pg1.rift.brix.2'); s.say('pg1.rift.brix.3');
    b.hide();
  }
  const c: number = yield s.ask('pg1.echo.ask', ['Touch it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('hit_super'); s.fade(1, 10); s.fade(0, 10);
  s.say('pg1.echo.open');
  const n = Number(s.flag('pg1riftCount') ?? 0);
  const [species, level, moves] = first ? RIFT_POOL[0] : RIFT_POOL[(n * 5 + 3) % RIFT_POOL.length];
  const r = yield s.battle({ kind: 'wild', bg: 'field', echo: true, foes: [{ species, level, moves }] });
  if (r !== 'win' && r !== 'caught') return;
  s.setFlag('pg1riftCount', n + 1);
  s.setFlag('pg1riftPeriod', s.period);
  s.say('pg1.echo.close');
  s.giveItem('echoshard'); s.me('me_item');
  s.say('pg1.echo.shard');
  if (first) {
    s.setFlag('pg1rift', true);
    s.say('pg1.rift.after.1'); s.say('pg1.rift.after.2');
    s.setFlag('pg1done', true);
    s.checkpoint();
    s.chapterEnd('Post-game', 'The Long Echo');
    s.say('pg1.end');
  } else s.checkpoint();
};

export const ROUTE1_PG1: NpcDef[] = [
  { id: 'echo1', sprite: 'obj:echo', x: 14, y: 11, dir: 'down', object: true, when: f => !!f('pg1palm'), talk: echoTalk },
  { id: 'brixrift', sprite: 'chars/scientist', x: 15, y: 10, dir: 'down', hidden: true }
];

// ---------- P2, The Guardian's Oath: Kronborg ----------
// Kronvakt went home to the casemates after the storm, and he won't fight an untested trainer. Kaas, a harbour guard
// now, runs three Oath Trials with his old Enforcer squad: Copper (a team that hits hard and super-effectively),
// Current (an ace behind Protect) and the Oath (three battles in a row with no healing, the last against Overcharge). Then
// the Guardian's Test: Kronvakt at Lv 70, catchable. Kaas stays for a rematch, once per time of day.

/** Runs on the way into Helsingør once P1 is done. */
export function* p2Start(s: ScriptApi): Step {
  if (!s.flag('pg1done') || s.flag('pg2')) return;
  s.setFlag('pg2', true);
  s.chapterEnd('Post-game', 'The Guardian\'s Oath');
  s.say('pg2.start.1'); s.say('pg2.start.2');
  s.checkpoint();
}

const TRIALS: { flag: string; key: string; name: string; sprite: string; opts: Partial<BattleOptions>; foes: FoeSpec[] }[] = [
  { flag: 'oathCopper', key: 'copper', name: 'Gorm', sprite: 'tr/enforcer', opts: { foeCoil: { current: true } }, foes: [
    { species: 'magnezone', level: 64, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'voltswitch'] },
    { species: 'hariyama', level: 64, moves: ['closecombat', 'knockoff', 'bulletpunch', 'heavyslam'] },
    { species: 'luxray', level: 65, moves: ['wildcharge', 'crunch', 'icefang', 'playrough'], item: 'sitrusberry' }
  ] },
  { flag: 'oathCurrent', key: 'current', name: 'Bjørn', sprite: 'tr/enforcer', opts: { foeCoil: { copper: true } }, foes: [
    { species: 'klinklang', level: 64, moves: ['geargrind', 'wildcharge', 'shiftgear', 'protect'] },
    { species: 'lucario', level: 65, moves: ['aurasphere', 'flashcannon', 'protect', 'nastyplot'] },
    { species: 'aegislash', level: 66, moves: ['kingsshield', 'shadowball', 'flashcannon', 'sacredsword'], item: 'sitrusberry' }
  ] }
];

const OATH_CHAIN: { name: string; foes: FoeSpec[] }[] = [
  // One Pokémon each for the first two and no Fighting moves for Søs: with Overcharge on top, the chain was a wall.
  { name: 'Lone', foes: [{ species: 'electivire', level: 63, moves: ['wildcharge', 'icepunch', 'crosschop', 'earthquake'] }] },
  { name: 'Dorte', foes: [{ species: 'magnezone', level: 64, moves: ['thunderbolt', 'flashcannon', 'triattack', 'protect'] }] },
  { name: 'Søs', foes: [{ species: 'luxray', level: 63, moves: ['wildcharge', 'crunch', 'icefang', 'firefang'] }, { species: 'manectric', level: 64, moves: ['thunderbolt', 'flamethrower', 'overheat', 'voltswitch'], item: 'sitrusberry' }] }
];

const trialTalk = (t: (typeof TRIALS)[number]): Script => function* (s) {
  if (!s.flag('pg2')) { s.say('pg2.trial.locked'); return; }
  if (s.flag(t.flag)) { s.say(`pg2.trial.${t.key}.after`); return; }
  s.say(`pg2.trial.${t.key}.1`); s.say(`pg2.trial.${t.key}.2`);
  const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: t.name, title: 'Oath Trial', sprite: t.sprite }, foes: t.foes, ...t.opts });
  if (r !== 'win') return;
  s.setFlag(t.flag, true);
  s.say(`pg2.trial.${t.key}.win`);
  s.giveItem('echoshard'); s.me('me_item');
  s.checkpoint();
};

/** Kaas runs the third trial (three battles, no healing between them), then stays for rematches. */
const kaasTalk: Script = function* (s) {
  if (!s.flag('pg2')) { s.say('pg2.kaas.locked'); return; }
  if (!s.flag('oathCopper') || !s.flag('oathCurrent')) { s.say('pg2.kaas.1'); s.say('pg2.kaas.2'); return; }
  if (!s.flag('oathOath')) {
    s.say('pg2.trial.oath.1'); s.say('pg2.trial.oath.2');
    const c: number = yield s.ask('pg2.trial.oath.ask', ['Begin', 'Not yet'], 1);
    if (c !== 0) return;
    for (const [i, e] of OATH_CHAIN.entries()) {
      if (i) s.say(`pg2.trial.oath.next${i}`);
      // Only Søs, the last, still Overcharges: a whole chain of it with no healing was a wall.
      const r = yield s.battle({ kind: 'trainer', ai: 2, bg: 'indoor1', overcharge: i === 2, trainer: { name: e.name, title: 'Oath Trial', sprite: 'tr/enforcer' }, foes: e.foes });
      if (r !== 'win') return;
    }
    s.setFlag('oathOath', true);
    s.say('pg2.trial.oath.win.1'); s.say('pg2.trial.oath.win.2');
    s.giveItem('echoshard'); s.me('me_item');
    s.checkpoint();
    return;
  }
  if (!s.flag('pg2done')) { s.say('pg2.kaas.go'); return; }
  if (s.flag('kaasRematch') === s.period) { s.say('pg2.kaas.rested'); return; }
  s.say('pg2.kaas.rematch');
  const c: number = yield s.ask('pg2.kaas.rematch.ask', ['Battle', 'Not now'], 1);
  if (c !== 0) return;
  const r = yield s.battle({
    kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: 'Kaas', title: 'Harbour Guard', sprite: 'tr/kaas' },
    foes: [
      { species: 'hariyama', level: 70, moves: ['closecombat', 'knockoff', 'bulletpunch', 'heavyslam'] },
      { species: 'lucario', level: 70, moves: ['aurasphere', 'flashcannon', 'vacuumwave', 'nastyplot'] },
      { species: 'luxray', level: 70, moves: ['wildcharge', 'crunch', 'icefang', 'playrough'] },
      { species: 'electivire', level: 72, moves: ['wildcharge', 'icepunch', 'crosschop', 'earthquake'], item: 'sitrusberry' }
    ]
  });
  if (r !== 'win') return;
  s.setFlag('kaasRematch', s.period);
  s.say('pg2.kaas.rematch.lose');
  s.checkpoint();
};

/** The Guardian's Test. Kronvakt only fights once all three trials are done. */
const kronvaktTalk: Script = function* (s) {
  if (!s.flag('pg2')) { s.say('pg2.kv.sleep'); return; }
  if (!s.flag('oathCopper') || !s.flag('oathCurrent') || !s.flag('oathOath')) { s.say('pg2.kv.notyet.1'); s.say('pg2.kv.notyet.2'); return; }
  s.say('pg2.kv.test.1'); s.say('pg2.kv.test.2');
  ballsFor(s, 'Kaas');
  s.cry('kronvakt');
  const r = yield s.battle({ kind: 'wild', bg: 'indoor1', foes: [{ species: 'kronvakt', level: 70, moves: ['danishoath', 'closecombat', 'stoneedge', 'irondefense'] }] });
  if (r === 'lose') return;
  if (r !== 'caught') { s.say('pg2.kv.again'); return; }
  s.setFlag('pg2done', true);
  s.say('pg2.kv.caught.1'); s.say('pg2.kv.caught.2');
  s.checkpoint();
  s.chapterEnd('Post-game', 'The Guardian\'s Oath complete');
  s.say('pg2.end');
};

/** Helsingør station: Kystbanen back south to Østerport. */
export const HELSINGOR_PG2: NpcDef[] = [
  { id: 'hgtrainpg', sprite: 'obj:train', x: 1, y: 6, dir: 'down', object: true, when: f => !!f('ch12done'), talk: function* (s) {
    s.say('pg2.train.helsingor');
    const c: number = yield s.ask('c7.train.ask.south', ['Ride', 'Stay'], 1);
    if (c !== 0) return;
    s.sfx('door'); s.fade(1, 20);
    s.warp('osterbro', 26, 4, 'down');
    s.fade(0, 20);
  } }
];

export const CASEMATES_PG2: NpcDef[] = [
  { id: 'kronvaktpg', sprite: 'chars/kronvakt', x: 18, y: 1, dir: 'down', when: f => !!f('ch12done') && !f('pg2done'), talk: kronvaktTalk },
  { id: 'kaaspg', sprite: 'chars/kaas', x: 20, y: 3, dir: 'left', when: f => !!f('pg2'), talk: kaasTalk },
  { id: 'trialcopper', sprite: 'chars/enforcer', x: 13, y: 1, dir: 'down', when: f => !!f('pg2'), talk: trialTalk(TRIALS[0]) },
  { id: 'trialcurrent', sprite: 'chars/enforcer', x: 13, y: 3, dir: 'right', when: f => !!f('pg2'), talk: trialTalk(TRIALS[1]) }
];

// ---------- P3, The Bridge and the Island: the Øresund Bridge and Peberholm ----------
// The bridge deck in a gale (an Ace Trainer every span, gusts the Copper Coil braces you against), Bjørk the
// reserve's ranger at the ramp down to Peberholm, Lumen Nord's survey drones around a huge Echo, their field
// lead, and Henrietta Vinther's first appearance. The Echo opens on an Echo-warped Paradox Pokémon.

/** The toll booth on Dragør's south quay: the bridge opens once P1 is done. */
export const tollTalk: Script = function* (s) {
  if (!s.flag('pg1done')) { s.say('pg3.toll.closed'); return; }
  if (!s.flag('pg3')) {
    s.setFlag('pg3', true);
    s.chapterEnd('Post-game', 'The Bridge and the Island');
    s.say('pg3.toll.1'); s.say('pg3.toll.2');
  } else s.say('pg3.toll.again');
  s.sfx('door'); s.fade(1, 12);
  s.warp('oresund', 1, 4, 'right');
  s.fade(0, 12);
};

export const DRAGOR_PG3: NpcDef[] = [
  { id: 'tollpg', sprite: 'chars/guard', x: 19, y: 16, dir: 'down', talk: tollTalk }
];

const gust = (id: string, x: number): import('@hafnia/core').MapEvent => ({
  x, y: 3, w: 1, h: 4, on: 'step', when: f => !f(id), run: function* (s) {
    s.setFlag(id, true);
    s.sfx('hit_weak');
    s.say('pg3.gust.1'); s.say('pg3.gust.2');
  }
});

// Each stands at a railing looking across the deck, so nobody rides past.
const bridgeTrainer = (id: string, x: number, y: number, cls: string, name: string, sprite: string, foes: FoeSpec[]) =>
  trainer({ id, x, y, dir: y === 3 ? 'down' : 'up', sprite, sight: 3, cls, name, foes, intro: [`pg3.${id}.intro`], lose: [`pg3.${id}.lose`] });

/** Bjørk at the ramp: the reserve's ranger now, with a permit for anyone who can beat her. */
const bjorkTalk: Script = function* (s) {
  if (s.flag('pg3permit')) { s.say(s.flag('pg3done') ? 'pg3.bjork.after' : 'pg3.bjork.go'); return; }
  s.say('pg3.bjork.1'); s.say('pg3.bjork.2');
  const r = yield s.battle({
    kind: 'trainer', ai: 3, bg: 'city', trainer: { name: 'Bjørk', title: 'Ranger', sprite: 'tr/ranger' },
    foes: [
      { species: 'sandaconda', level: 64, moves: ['earthquake', 'glare', 'rockslide', 'coil'] },
      { species: 'tropius', level: 64, moves: ['airslash', 'gigadrain', 'dragonpulse', 'synthesis'] },
      { species: 'grafaiai', level: 65, moves: ['gunkshot', 'knockoff', 'uturn', 'partingshot'], item: 'sitrusberry' }
    ]
  });
  if (r !== 'win') return;
  s.setFlag('pg3permit', true);
  s.say('pg3.bjork.3');
  s.giveItem('rangerpermit'); s.me('me_item');
  s.say('pg3.bjork.4');
  s.checkpoint();
};

export const ORESUND_SCRIPTS: MapScripts = {
  npcs: [
    bridgeTrainer('br1', 12, 3, 'Ace Trainer', 'Malte', 'chars/acem', [
      { species: 'staraptor', level: 62, moves: ['bravebird', 'closecombat', 'uturn', 'quickattack'] },
      { species: 'kilowattrel', level: 62, moves: ['thunderbolt', 'hurricane', 'roost', 'uturn'] }]),
    bridgeTrainer('br2', 20, 6, 'Cyclist', 'Signe', 'chars/cyclist2', [
      { species: 'cyclizar', level: 63, moves: ['dragonpulse', 'doubleedge', 'uturn', 'shedtail'] },
      { species: 'jolteon', level: 63, moves: ['thunderbolt', 'shadowball', 'voltswitch', 'hypervoice'] }]),
    bridgeTrainer('br3', 30, 3, 'Ace Trainer', 'Liv', 'chars/acef', [
      { species: 'corviknight', level: 64, moves: ['bravebird', 'bodypress', 'ironhead', 'roost'] },
      { species: 'pelipper', level: 63, moves: ['hurricane', 'scald', 'uturn', 'roost'] },
      { species: 'bombirdier', level: 64, moves: ['knockoff', 'bravebird', 'rockslide', 'suckerpunch'] }]),
    bridgeTrainer('br4', 38, 6, 'Cyclist', 'Mads', 'chars/biker', [
      { species: 'stoutland', level: 64, moves: ['bodyslam', 'crunch', 'wildcharge', 'playrough'] },
      { species: 'noivern', level: 65, moves: ['hurricane', 'dragonpulse', 'flamethrower', 'uturn'] }]),
    // Bjørk stands on the ramp until you have her permit, then steps aside.
    { id: 'bjork', sprite: 'chars/ranger', x: 22, y: 6, dir: 'up', when: f => !f('pg3permit'), talk: bjorkTalk },
    { id: 'bjork2', sprite: 'chars/ranger', x: 23, y: 6, dir: 'left', when: f => !!f('pg3permit'), talk: bjorkTalk },
    sign('swedensign', 42, 4, 'obj:sign', 'pg3.sweden')
  ],
  events: [gust('pg3gust1', 8), gust('pg3gust2', 17), gust('pg3gust3', 27), gust('pg3gust4', 35)]
};

/** Lumen Nord's field lead, then Vinther, then the Echo. */
const leadTalk: Script = function* (s) {
  if (s.flag('pg3lead')) return;
  s.say('pg3.lead.1'); s.say('pg3.lead.2');
  const r = yield s.battle({
    kind: 'trainer', ai: 3, bg: 'field', trainer: { name: 'Ansel', title: 'Lumen Nord Field Lead', sprite: 'tr/scientist' },
    foes: [
      { species: 'magnezone', level: 65, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'voltswitch'] },
      { species: 'porygon2', level: 65, moves: ['triattack', 'icebeam', 'thunderbolt', 'recover'], item: 'eviolite' },
      { species: 'ironvaliant', level: 67, moves: ['moonblast', 'closecombat', 'psychic', 'shadowball'], item: 'sitrusberry' }
    ]
  });
  if (r !== 'win') return;
  s.setFlag('pg3lead', true);
  s.say('pg3.lead.3');
  const v = cast(s, 'vinther');
  s.say('pg3.vinther.1'); s.say('pg3.vinther.2'); s.say('pg3.vinther.3'); s.say('pg3.vinther.4');
  v.walk('up', 3); v.hide();
  s.npc('lead').hide();
  s.say('pg3.lead.after');
  s.checkpoint();
};

/** Echo-warped Paradox Pokémon for the repeatable Peberholm Rift. */
const PARADOX_POOL: [string, number, string[]][] = [
  ['greattusk', 66, ['headlongrush', 'closecombat', 'icespinner', 'rapidspin']],
  ['ironbundle', 66, ['hydropump', 'freezedry', 'flipturn', 'icywind']],
  ['screamtail', 65, ['playrough', 'psychicfangs', 'bodyslam', 'wish']],
  ['irontreads', 66, ['earthquake', 'ironhead', 'knockoff', 'rapidspin']],
  ['fluttermane', 66, ['moonblast', 'shadowball', 'mysticalfire', 'calmmind']],
  ['ironhands', 67, ['drainpunch', 'thunderpunch', 'icepunch', 'swordsdance']]
];

/** A repeatable Rift: one Echo-warped Pokémon from the pool, once per time of day. */
function* rift(s: ScriptApi, key: string, pool: [string, number, string[]][]): Step {
  if (s.flag(`${key}Period`) === s.period) { s.say('pg1.echo.quiet'); return; }
  const c: number = yield s.ask('pg1.echo.ask', ['Touch it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('hit_super'); s.fade(1, 10); s.fade(0, 10);
  s.say('pg1.echo.open');
  const n = Number(s.flag(`${key}Count`) ?? 0);
  const [species, level, moves] = pool[(n * 5 + 3) % pool.length];
  const r = yield s.battle({ kind: 'wild', bg: 'field', echo: true, foes: [{ species, level, moves }] });
  if (r !== 'win' && r !== 'caught') return;
  s.setFlag(`${key}Count`, n + 1);
  s.setFlag(`${key}Period`, s.period);
  s.say('pg1.echo.close');
  s.giveItem('echoshard'); s.me('me_item');
  s.say('pg1.echo.shard');
  s.checkpoint();
}

const ECHO_PARADOX: FoeSpec = { species: 'ironbundle', level: 66, moves: ['hydropump', 'freezedry', 'flipturn', 'icywind'] };

const bigEchoTalk: Script = function* (s) {
  if (!s.flag('pg3lead')) { s.say('pg3.echo.drones'); return; }
  if (s.flag('pg3done')) { yield* rift(s, 'pg3rift', PARADOX_POOL); return; }
  s.say('pg3.echo.big.1');
  const c: number = yield s.ask('pg1.echo.ask', ['Touch it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('hit_super'); s.fade(1, 10); s.fade(0, 10);
  s.say('pg1.echo.open');
  const r = yield s.battle({ kind: 'wild', bg: 'field', echo: true, foes: [ECHO_PARADOX] });
  if (r !== 'win' && r !== 'caught') return;
  s.setFlag('pg3done', true);
  s.giveItem('echoshard', 2); s.me('me_item');
  s.say('pg3.echo.big.2'); s.say('pg3.echo.big.3');
  s.checkpoint();
  s.chapterEnd('Post-game', 'The Bridge and the Island complete');
  s.say('pg3.end');
};

const rangerHeal: Script = function* (s) {
  s.say('pg3.ranger.heal'); s.heal(); s.me('me_heal');
  s.setRespawn('peberholm', 12, 4, 'down', s.t('pg3.ranger.respawn'));
  s.checkpoint();
};

export const PEBERHOLM_SCRIPTS: MapScripts = {
  npcs: [
    { id: 'pbranger', sprite: 'chars/ranger', x: 14, y: 3, dir: 'down', talk: rangerHeal },
    sign('pbsign', 10, 3, 'obj:sign', 'pg3.pb.sign'),
    { id: 'drone1', sprite: 'obj:drone', x: 10, y: 12, dir: 'down', object: true, when: f => !f('pg3lead'), talk: talk('pg3.drone') },
    { id: 'drone2', sprite: 'obj:drone', x: 14, y: 12, dir: 'down', object: true, when: f => !f('pg3lead'), talk: talk('pg3.drone') },
    { id: 'lead', sprite: 'chars/scientist', x: 12, y: 13, dir: 'up', trainer: { sight: 3, flag: 'pg3lead' }, when: f => !f('pg3lead'), talk: leadTalk },
    { id: 'vinther', sprite: 'chars/lawyer', x: 12, y: 15, dir: 'up', hidden: true },
    { id: 'bigecho', sprite: 'obj:echo', x: 12, y: 16, dir: 'down', object: true, talk: bigEchoTalk },
    itemBall('item.pb1', 4, 4, 'expcandyl', 1, 'an Exp. Candy L'),
    itemBall('item.pb2', 21, 13, 'ultraball', 5, 'Ultra Balls')
  ]
};

// ---------- P4, Granite Song: Bornholm and Krønikon ----------
// The ferry to Bornholm with Maja, out for the last issue of Undergrunden. The granite hums the way Langelira did:
// the siphon pulled from Krønikon too. Four round churches are Coil shrines; when all four hum, Hammershus opens.
// Vinther's Lumen Nord tries to drill the Wyrm's chamber, and Maja broadcasts it live.

/** The Bornholm ferry on Dragør's quay (the Køge boat calls here in the post-game). */
const bornholmFerry: Script = function* (s) {
  if (!s.flag('pg1done')) { s.say('pg4.ferry.closed'); return; }
  const c: number = yield s.ask('pg4.ferry.ask', ['Bornholm', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 20);
  s.warp('ronne', 5, 9, 'right');
  s.fade(0, 20);
  if (s.flag('pg4')) return;
  s.setFlag('pg4', true);
  s.chapterEnd('Post-game', 'Granite Song');
  s.say('pg4.start.1');
  cast(s, 'majapg4');
  s.say('pg4.maja.1'); s.say('pg4.maja.2'); s.say('pg4.maja.3');
  s.checkpoint();
};

export const DRAGOR_PG4: NpcDef[] = [
  { id: 'bornferry', sprite: 'chars/sailor', x: 20, y: 5, dir: 'left', talk: bornholmFerry }
];

const ronneFerry: Script = function* (s) {
  const c: number = yield s.ask('pg4.ferry.back', ['Dragør', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 20);
  s.warp('dragor', 20, 6, 'up');
  s.fade(0, 20);
};

export const RONNE_SCRIPTS: MapScripts = {
  doors: { pc: function* (s) { s.warp('pcronne', 6, 5, 'up'); } },
  npcs: [
    { id: 'ronneferry', sprite: 'chars/sailor', x: 4, y: 10, dir: 'right', talk: ronneFerry },
    { id: 'majapg4', sprite: 'chars/maja', x: 7, y: 8, dir: 'down', when: f => !!f('pg4') && !f('pg4done'), talk: talk('pg4.maja.hint') },
    sign('ronnesign', 13, 8, 'obj:sign', 'pg4.ronne.sign'),
    { id: 'ronneold', sprite: 'chars/oldwoman', x: 18, y: 10, dir: 'left', talk: talk('pg4.ronne.old') },
    itemBall('item.rn1', 24, 15, 'expcandyl', 1, 'an Exp. Candy L')
  ]
};

/** The four round churches, each a Coil shrine: answer what the church needs with the right mode. */
const SHRINES: { id: string; name: string; mode: number; flag: string }[] = [
  { id: 'nyker', name: 'Nyker', mode: 0, flag: 'shrineNyker' },
  { id: 'nylars', name: 'Nylars', mode: 1, flag: 'shrineNylars' },
  { id: 'olsker', name: 'Olsker', mode: 2, flag: 'shrineOlsker' },
  { id: 'osterlars', name: 'Østerlars', mode: 1, flag: 'shrineOsterlars' }
];
export const shrinesDone = (f: (n: string) => unknown) => SHRINES.every(sh => !!f(sh.flag));

const shrine = (sh: typeof SHRINES[number]): Script => function* (s) {
  if (!s.flag('pg4')) { s.say('pg4.church.shut'); return; }
  if (s.flag(sh.flag)) { s.say('pg4.church.humming'); return; }
  // Østerlars has a Lumen Nord crew inside, trying to fit a meter to the pillar.
  if (sh.id === 'osterlars' && !s.flag('pg4crew')) {
    s.say('pg4.crew.1');
    const r = yield s.battle({
      kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: 'Ansel', title: 'Lumen Nord Field Lead', sprite: 'tr/scientist' },
      foes: [
        { species: 'magnezone', level: 68, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'voltswitch'] },
        { species: 'porygonz', level: 68, moves: ['triattack', 'icebeam', 'thunderbolt', 'nastyplot'] },
        { species: 'klinklang', level: 69, moves: ['geargrind', 'wildcharge', 'shiftgear', 'rockslide'] }
      ]
    });
    if (r !== 'win') return;
    s.setFlag('pg4crew', true);
    s.say('pg4.crew.2');
  }
  s.say(`pg4.church.${sh.id}`);
  const c: number = yield s.ask('pg4.church.ask', s.flag('pg1harmony') ? ['Copper', 'Current', 'Harmony', 'Leave'] : ['Copper', 'Current', 'Leave'], 3);
  if (c === (s.flag('pg1harmony') ? 3 : 2)) return;
  if (c !== sh.mode) { s.sfx('hit_weak'); s.say('pg4.church.wrong'); return; }
  s.sfx('hit_super'); s.fade(0.5, 6); s.fade(0, 6);
  s.setFlag(sh.flag, true);
  s.say('pg4.church.open');
  if (shrinesDone(s.flag.bind(s))) { s.say('pg4.church.all.1'); s.say('pg4.church.all.2'); }
  s.checkpoint();
};

/** The smokehouse on the coast road: smoked herring for the team. */
const smokehouse: Script = function* (s) {
  s.say('pg4.smoke.1'); s.heal(); s.me('me_heal'); s.say('pg4.smoke.2');
};

export const ROUTE14_SCRIPTS: MapScripts = {
  doors: Object.fromEntries(SHRINES.map(sh => [sh.id, shrine(sh)])),
  npcs: [
    { id: 'smoker', sprite: 'chars/chef', x: 21, y: 8, dir: 'down', talk: smokehouse },
    sign('r14sign', 2, 8, 'obj:sign', 'pg4.r14.sign'),
    sign('cliffsign', 37, 8, 'obj:sign', 'pg4.r14.cliffs'),
    trainer({ id: 'bh1', x: 12, y: 8, dir: 'down', sprite: 'chars/acem', sight: 3, cls: 'Ace Trainer', name: 'Rasmus',
      foes: [{ species: 'lycanroc', level: 67, moves: ['stoneedge', 'closecombat', 'crunch', 'accelerock'] }, { species: 'copperajah', level: 68, moves: ['heavyslam', 'playrough', 'superpower', 'rockslide'] }],
      intro: ['pg4.bh1.intro'], lose: ['pg4.bh1.lose'] }),
    trainer({ id: 'bh2', x: 25, y: 10, dir: 'up', sprite: 'chars/fisher', sight: 3, cls: 'Fisher', name: 'Holger',
      foes: [{ species: 'barraskewda', level: 67, moves: ['liquidation', 'closecombat', 'psychicfangs', 'aquajet'] }, { species: 'gyarados', level: 68, moves: ['waterfall', 'crunch', 'icefang', 'dragondance'] }],
      intro: ['pg4.bh2.intro'], lose: ['pg4.bh2.lose'] }),
    trainer({ id: 'bh3', x: 33, y: 8, dir: 'down', sprite: 'chars/painter', sight: 3, cls: 'Glassblower', name: 'Ida',
      foes: [{ species: 'volcarona', level: 68, moves: ['fierydance', 'bugbuzz', 'gigadrain', 'quiverdance'] }, { species: 'garganacl', level: 68, moves: ['saltcure', 'stoneedge', 'bodypress', 'recover'] }],
      intro: ['pg4.bh3.intro'], lose: ['pg4.bh3.lose'] }),
    itemBall('item.r14a', 22, 5, 'ultraball', 5, 'Ultra Balls'),
    itemBall('item.r14b', 3, 14, 'expcandyl', 1, 'an Exp. Candy L')
  ]
};

export const HAMMERSHUS_SCRIPTS: MapScripts = {
  doors: {
    gate: function* (s) {
      if (!shrinesDone(s.flag.bind(s))) { s.say('pg4.gate.locked'); return; }
      s.sfx('door'); s.warp('hammerdeep', 12, 9, 'up');
    }
  },
  npcs: [
    { id: 'rig', sprite: 'obj:terminal', x: 17, y: 4, dir: 'down', object: true, when: f => !f('pg4vinther'), talk: talk('pg4.rig') },
    { id: 'hsdrone', sprite: 'obj:drone', x: 16, y: 6, dir: 'down', object: true, when: f => !f('pg4vinther'), talk: talk('pg3.drone') },
    sign('hssign', 7, 8, 'obj:sign', 'pg4.hs.sign'),
    { id: 'hsranger', sprite: 'chars/ranger', x: 5, y: 10, dir: 'right', talk: function* (s) {
      s.say('pg4.hs.ranger'); s.heal(); s.me('me_heal');
      s.setRespawn('hammershus', 5, 11, 'up', s.t('pg4.hs.respawn'));
      s.checkpoint();
    } }
  ]
};

/** Vinther at the chamber door, then Maja's broadcast, then the Wyrm. */
const vintherTalk: Script = function* (s) {
  if (s.flag('pg4vinther')) return;
  s.say('pg4.vinther.1'); s.say('pg4.vinther.2');
  const r = yield s.battle({
    kind: 'trainer', ai: 3, bg: 'indoor1', trainer: { name: 'Henrietta Vinther', title: 'Lumen Nord CEO', sprite: 'tr/lawyer' },
    foes: [
      { species: 'bronzong', level: 69, moves: ['gyroball', 'earthquake', 'psychic', 'stealthrock'] },
      { species: 'magnezone', level: 69, moves: ['thunderbolt', 'flashcannon', 'voltswitch', 'bodypress'] },
      { species: 'porygonz', level: 70, moves: ['triattack', 'icebeam', 'darkpulse', 'thunderbolt'] },
      { species: 'ampharos', level: 72, moves: ['thunderbolt', 'dragonpulse', 'focusblast', 'powergem'], item: 'sitrusberry' }
    ]
  });
  if (r !== 'win') return;
  s.setFlag('pg4vinther', true);
  s.say('pg4.vinther.3');
  const m = cast(s, 'majapg4d');
  s.say('pg4.broadcast.1'); s.say('pg4.broadcast.2'); s.say('pg4.broadcast.3');
  s.say('pg4.vinther.4');
  s.npc('vinther4').hide();
  s.say('pg4.broadcast.4');
  m.hide();
  s.checkpoint();
};

const kronikonTalk: Script = function* (s) {
  if (!s.flag('pg4vinther')) { s.say('pg4.kr.blocked'); return; }
  s.say('pg4.kr.1'); s.say('pg4.kr.2');
  ballsFor(s, 'Maja');
  s.cry('kronikon');
  const r = yield s.battle({ kind: 'wild', bg: 'indoor1', foes: [{ species: 'kronikon', level: 75, moves: ['granitesong', 'dragonpulse', 'earthpower', 'calmmind'] }] });
  if (r === 'lose') return;
  if (r !== 'caught') { s.say('pg4.kr.again'); return; }
  s.setFlag('pg4done', true);
  s.say('pg4.kr.caught.1'); s.say('pg4.kr.caught.2');
  s.checkpoint();
  s.chapterEnd('Post-game', 'Granite Song complete');
  s.say('pg4.end');
};

export const HAMMERDEEP_SCRIPTS: MapScripts = {
  npcs: [
    { id: 'kronikon', sprite: 'chars/kronikon', x: 11, y: 1, dir: 'down', when: f => !f('pg4done'), talk: kronikonTalk },
    { id: 'vinther4', sprite: 'chars/lawyer', x: 11, y: 4, dir: 'down', when: f => !f('pg4vinther'), talk: vintherTalk },
    { id: 'majapg4d', sprite: 'chars/maja', x: 12, y: 6, dir: 'up', hidden: true },
    { id: 'hdworker', sprite: 'chars/scientist', x: 19, y: 7, dir: 'left', when: f => !f('pg4vinther'), talk: talk('pg4.hd.worker') },
    itemBall('item.hd1', 2, 7, 'expcandyl', 2, 'Exp. Candy L'),
    itemBall('item.hd2', 21, 8, 'ultraball', 5, 'Ultra Balls')
  ]
};

// ---------- P5, The Lighthouse: the last Echo, the concert and the lamp ----------
// Once Kronborg, the bridge and Bornholm are done, Freja calls. The Black Fleet is rebuilding Trekroner's
// lighthouse; the last big Echo is still in Vanguard's siphon chamber. You carry it down to the Deep Sound under
// Langelinie and give the song back in a concert, where only all three Coil modes make it whole. Freja relights
// the lamp, and far across the Sound a light in Sweden answers.

const p5Ready = (f: (n: string) => unknown) => !!f('pg2done') && !!f('pg3done') && !!f('pg4done');

/** Freja's call: runs on the way into the city's hubs once P2-P4 are all done. */
export function* p5Start(s: ScriptApi): Step {
  if (s.flag('pg5') || !p5Ready(s.flag.bind(s))) return;
  s.setFlag('pg5', true);
  s.chapterEnd('Post-game', 'The Lighthouse');
  s.sfx('pc');
  s.say('pg5.call.1'); s.say('pg5.call.2'); s.say('pg5.call.3');
  s.checkpoint();
}

/** The Black Fleet's hydrofoil at Christianshavn, now a friendly ferry. */
const fleetFerry: Script = function* (s) {
  if (!s.flag('pg5')) { s.say('pg5.deck.notyet'); return; }
  const c: number = yield s.ask('pg5.deck.ask', ['Trekroner', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 20);
  s.warp('trekroner', 13, 21, 'up');
  s.setRespawn('trekroner', 13, 21, 'up', s.t('pg5.respawn'));
  s.fade(0, 20);
  if (s.flag('pg5fort')) return;
  s.setFlag('pg5fort', true);
  s.setTime('day');
  cast(s, 'freja5');
  s.say('pg5.fort.1'); s.say('pg5.fort.2'); s.say('pg5.fort.3'); s.say('pg5.fort.4');
  s.checkpoint();
};

export const CHRISTIANSHAVN_PG5: NpcDef[] = [
  { id: 'fleetdeck5', sprite: 'chars/deckhand', x: 3, y: 6, dir: 'down', when: f => !!f('ch8done'), talk: fleetFerry }
];

const FREJA_TEAM: FoeSpec[] = [
  { species: 'overqwil', level: 70, moves: ['crunch', 'gunkshot', 'aquajet', 'swordsdance'] },
  { species: 'toxapex', level: 70, moves: ['scald', 'toxic', 'recover', 'haze'] },
  { species: 'dragalge', level: 71, moves: ['sludgebomb', 'dracometeor', 'scald', 'focusblast'] },
  { species: 'kingdra', level: 71, moves: ['hydropump', 'dracometeor', 'icebeam', 'raindance'] },
  { species: 'sharpedo', level: 72, moves: ['liquidation', 'crunch', 'closecombat', 'protect'], item: 'sitrusberry' }
];

/** Freja on the jetty patches your team up, and after the lamp is lit, battles once each time of day. */
const frejaJetty5: Script = function* (s) {
  s.say('pg5.freja.heal'); s.heal(); s.me('me_heal');
  if (s.flag('pg5done') && s.flag('frejaRematch') !== s.period) {
    s.say('pg5.freja.rematch');
    const c: number = yield s.ask('pg5.freja.rematch.ask', ['Battle', 'Not now'], 1);
    if (c !== 0) return;
    const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'city', leader: true, trainer: { name: 'Freja', title: 'Captain', sprite: 'tr/freja' }, foes: FREJA_TEAM });
    if (r === 'win') { s.setFlag('frejaRematch', s.period); s.say('pg5.freja.rematch.lose'); }
    return;
  }
  s.say(s.flag('pg5song') ? (s.flag('pg5done') ? 'pg5.freja.after' : 'pg5.freja.lamp') : s.flag('pg5echo') ? 'pg5.freja.dive' : 'pg5.freja.siphon');
};

/** The Fleet's hydrofoil back to Christianshavn. */
const boatBack: Script = function* (s) {
  const c: number = yield s.ask('pg5.freja.boat', ['Christianshavn', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 20);
  s.warp('christianshavn', 6, 7, 'down');
  s.fade(0, 20);
};

export const TREKRONER_PG5: NpcDef[] = [
  { id: 'freja5', sprite: 'chars/freja', x: 12, y: 21, dir: 'right', when: f => !!f('pg5fort'), talk: frejaJetty5 },
  { id: 'boat5', sprite: 'chars/deckhand', x: 12, y: 20, dir: 'right', when: f => !!f('pg5fort'), talk: boatBack },
  { id: 'deck5a', sprite: 'chars/deckhand', x: 4, y: 8, dir: 'up', when: f => !!f('pg5fort'), talk: talk('pg5.deck.a') },
  { id: 'deck5b', sprite: 'chars/sailor', x: 6, y: 8, dir: 'up', when: f => !!f('pg5fort'), talk: talk('pg5.deck.b') }
];

/** The last big Echo, still caught in Vanguard's machines. */
const lastEcho: Script = function* (s) {
  s.say('pg5.echo.1');
  const c: number = yield s.ask('pg1.echo.ask', ['Touch it', 'Leave it'], 1);
  if (c !== 0) return;
  s.sfx('hit_super'); s.fade(1, 10); s.fade(0, 10);
  s.say('pg1.echo.open');
  const r = yield s.battle({ kind: 'wild', bg: 'indoor1', echo: true, foes: [{ species: 'milotic', level: 72, moves: ['scald', 'icebeam', 'recover', 'dragontail'] }] });
  if (r !== 'win' && r !== 'caught') return;
  s.setFlag('pg5echo', true);
  s.say('pg5.echo.2');
  s.giveItem('lastecho'); s.me('me_get');
  s.say('pg5.echo.3');
  s.checkpoint();
};

export const SIPHON_PG5: NpcDef[] = [
  { id: 'echo5', sprite: 'obj:echo', x: 8, y: 4, dir: 'down', object: true, when: f => !!f('pg5') && !f('pg5echo'), talk: lastEcho }
];

/** Langelinie: a Black Fleet buoy marks the way down to the Deep Sound. */
export const OSTERBRO_PG5: NpcDef[] = [
  { id: 'divebuoy', sprite: 'obj:buoy', x: 22, y: 16, dir: 'down', object: true, when: f => !!f('pg5echo'), talk: function* (s) {
    if (s.flag('pg5song')) { s.say('pg5.dive.after'); return; }
    s.say('pg5.dive.1');
    const c: number = yield s.ask('pg5.dive.ask', ['Dive', 'Not yet'], 1);
    if (c !== 0) return;
    s.sfx('door'); s.fade(1, 20);
    s.warp('deepsound', 9, 8, 'up');
    s.fade(0, 20);
    s.say('pg5.dive.2');
  } }
];

/** The three note stones: a low note (Copper), a bright one (Current), and two at once (Harmony). */
const NOTES: { id: string; x: number; y: number; mode: number }[] = [
  { id: 'noteLow', x: 1, y: 7, mode: 0 },
  { id: 'noteHigh', x: 17, y: 7, mode: 1 },
  { id: 'noteBoth', x: 9, y: 6, mode: 2 }
];
const notesDone = (f: (n: string) => unknown) => NOTES.every(n => !!f(n.id));

const noteStone = (n: typeof NOTES[number]): Script => function* (s) {
  if (s.flag(n.id)) { s.say('pg5.note.ringing'); return; }
  s.say(`pg5.${n.id}`);
  const c: number = yield s.ask('pg4.church.ask', ['Copper', 'Current', 'Harmony', 'Leave'], 3);
  if (c === 3) return;
  if (c !== n.mode) { s.sfx('hit_weak'); s.say('pg5.note.wrong'); return; }
  s.sfx('select'); s.setFlag(n.id, true);
  s.say('pg5.note.right');
  if (notesDone(s.flag.bind(s))) { s.sfx('door'); s.npc('songgate').hide(); s.say('pg5.note.all'); }
  s.checkpoint();
};

/** The concert: six against one, and the song is only whole once all three modes have been sung. */
const concert: Script = function* (s) {
  if (s.flag('pg5song')) return;
  s.say('pg5.concert.1'); s.say('pg5.concert.2'); s.say('pg5.concert.3');
  const r = yield s.battle({
    kind: 'trainer', ai: 2, bg: 'indoor1', prize: 0, concert: true, trainer: { name: 'Langelira\'s Song', title: 'The Last Echo', sprite: 'tr/lastecho' },
    foes: [{ species: 'langelira', level: 75, moves: ['sirensrequiem', 'psychic', 'icebeam', 'calmmind'], item: 'leftovers' }]
  });
  if (r !== 'win') return;
  s.setFlag('pg5song', true);
  s.takeItem('lastecho');
  s.say('pg5.concert.4'); s.say('pg5.concert.5');
  s.say('pg5.concert.yours');
  s.heal(); s.me('me_heal');
  s.say('pg5.concert.6');
  s.checkpoint();
};

export const DEEPSOUND_SCRIPTS: MapScripts = {
  npcs: [
    ...NOTES.map(n => ({ id: n.id, sprite: 'obj:terminal', x: n.x, y: n.y, dir: 'down' as const, object: true, talk: noteStone(n) })),
    { id: 'songgate', sprite: 'obj:barrier', x: 9, y: 3, dir: 'down', object: true, when: f => !notesDone(f), talk: talk('pg5.gate') },
    { id: 'lastechos', sprite: 'obj:echo', x: 9, y: 1, dir: 'down', object: true, when: f => !f('pg5song'), talk: concert },
    itemBall('item.ds1', 17, 4, 'expcandyl', 2, 'Exp. Candy L'),
    itemBall('item.ds2', 6, 1, 'ultraball', 5, 'Ultra Balls')
  ]
};

/** The lamp: Freja relights it, and the beam crosses the Sound. */
const relight: Script = function* (s) {
  if (!s.flag('pg5song')) return;
  s.say('pg5.lamp.1'); s.say('pg5.lamp.2');
  const c: number = yield s.ask('pg5.lamp.ask', ['Charge it', 'Wait'], 1);
  if (c !== 0) return;
  s.sfx('hit_super');
  for (let i = 0; i < 3; i++) { s.fade(0.7, 4); s.fade(0, 4); }
  s.setFlag('pg5done', true);
  s.say('pg5.lamp.3'); s.say('pg5.lamp.4'); s.say('pg5.lamp.5'); s.say('pg5.lamp.6');
  s.npc('frejalamp').hide();
  s.checkpoint();
  s.chapterEnd('Post-game', 'The Long Echo complete');
  s.say('pg5.end.1'); s.say('pg5.end.2');
};

export const TKLIGHTHOUSE_PG5: NpcDef[] = [
  { id: 'frejalamp', sprite: 'chars/freja', x: 2, y: 4, dir: 'right', when: f => !!f('pg5song') && !f('pg5done'), talk: relight },
  { ...sign('tklamplit', 1, 4, 'obj:lantern', 'pg5.lamp.lit'), when: f => !!f('pg5done') }
];

/** Home, after the lamp: a letter from Lindholm in prison. */
export function* lindholmLetter(s: ScriptApi): Step {
  if (!s.flag('pg5done') || s.flag('pg5letter')) return;
  s.setFlag('pg5letter', true);
  s.say('pg5.letter.1'); s.say('pg5.letter.2'); s.say('pg5.letter.3'); s.say('pg5.letter.4');
  s.checkpoint();
}
