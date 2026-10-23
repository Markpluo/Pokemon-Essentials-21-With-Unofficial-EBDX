// Post-game, "The Long Echo" (design/post-game-and-endgame.md §3). P1, Morning After: you wake up as Champion.
// Ørsted and Brix explain the Echoes (the reactor's stolen song, leaking out of cracked Resonance Cells) at the
// Palm House, the new statue on Langelinie gives you the Mermaid's Tear shard and Harmony, Lukas and Maja give
// you eggs of the two starters nobody picked, and Brix shows you the first Resonance Rift by Søerne.
import type { BattleOptions, FoeSpec, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
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
  { name: 'Lone', foes: [{ species: 'electivire', level: 63, moves: ['wildcharge', 'icepunch', 'crosschop', 'earthquake'] }, { species: 'hariyama', level: 62, moves: ['closecombat', 'knockoff', 'bulletpunch', 'heavyslam'] }] },
  { name: 'Dorte', foes: [{ species: 'magnezone', level: 64, moves: ['thunderbolt', 'flashcannon', 'triattack', 'protect'] }, { species: 'toxicroak', level: 64, moves: ['drainpunch', 'gunkshot', 'suckerpunch', 'icepunch'] }] },
  { name: 'Søs', foes: [{ species: 'luxray', level: 64, moves: ['wildcharge', 'crunch', 'icefang', 'firefang'] }, { species: 'lucario', level: 65, moves: ['aurasphere', 'flashcannon', 'darkpulse', 'vacuumwave'], item: 'sitrusberry' }] }
];

const trialTalk = (t: (typeof TRIALS)[number]): Script => function* (s) {
  if (!s.flag('pg2')) { s.say('pg2.trial.locked'); return; }
  if (s.flag(t.flag)) { s.say(`pg2.trial.${t.key}.after`); return; }
  s.say(`pg2.trial.${t.key}.1`); s.say(`pg2.trial.${t.key}.2`);
  const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'indoor1', prize: 0, trainer: { name: t.name, title: 'Oath Trial', sprite: t.sprite }, foes: t.foes, ...t.opts });
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
      const r = yield s.battle({ kind: 'trainer', ai: 2, bg: 'indoor1', prize: 0, overcharge: i === 2, trainer: { name: e.name, title: 'Oath Trial', sprite: 'tr/enforcer' }, foes: e.foes });
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
