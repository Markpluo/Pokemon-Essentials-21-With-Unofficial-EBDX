// Chapter 12, Copper & Current: the last train south in the storm, and CopenHill's ski slope under black ice.
// Kronvakt breaks the ice walls, the Gym Leaders hold the slope against the Enforcers, and Lukas fights beside you
// for the lift. On the Smokestack Ring, Director Lindholm: his team, then his Rotom fused with the reactor, then his
// plea. Brix's shutdown sequence needs a voice; Maja puts the Pact Song on every speaker and the whole city sings
// it. Langelira answers, the storm falls silent, and she waits to be caught. Kronvakt walks home to Kronborg.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { grown, talk, trainer, type MapScripts, type Step } from './lib';
import { lukasStarter } from './starters';

// ---------- The chapter starts: the last train south ----------

/** Runs on the next map you enter after Holger Danske wakes. */
export function* ch12Start(s: ScriptApi): Step {
  if (!s.flag('ch11done') || s.flag('ch12')) return;
  s.setFlag('ch12', true);
  s.chapterEnd('Chapter 12', 'Copper & Current');
  s.say('c12.start.1'); s.say('c12.start.2'); s.say('c12.start.3');
  s.fade(1, 16);
  s.setTime('night');
  s.warp('stormhill', 7, 23, 'up');
  s.fade(0, 16);
  s.say('c12.sl.arrive.1'); s.say('c12.sl.arrive.2'); s.say('c12.sl.arrive.3');
  s.setRespawn('stormhill', 4, 22, 'up', s.t('c12.sl.respawn'));
  s.checkpoint();
}

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- The slope ----------

/** Astrid runs the first aid post at the bottom of the slope. */
const astrid: Script = function* (s) {
  s.say('c12.sl.astrid.1');
  s.heal(); s.me('me_heal');
  s.say('c12.sl.astrid.2');
  s.setRespawn('stormhill', 4, 22, 'up', s.t('c12.sl.respawn'));
  s.checkpoint();
};

/** A wall of black ice across a switchback gap. Kronvakt breaks it, then waits there for you. */
const ice = (flag: string): Script => function* (s) {
  s.say('c12.sl.ice');
  if (!s.flag('kronvakt')) { s.say('c12.sl.ice.no'); return; }
  const k = s.npc('kronvakt12');
  const [x, y] = s.freeSpotNear(s.player.x, s.player.y);
  k.place(x, y, 'up'); k.show();
  s.say('c12.sl.ice.smash.1');
  s.sfx('hit_super'); s.wait(10);
  s.setFlag(flag, true);
  s.say('c12.sl.ice.smash.2');
  s.checkpoint();
};

/** The two Enforcer captains on the lift, and Lukas beside you. */
function* liftFight(s: ScriptApi): Step {
  const l = cast(s, 'lukas12');
  s.player.faceTo(l.x, l.y);
  s.say('c12.sl.top.1'); s.say('c12.sl.top.2'); s.say('c12.sl.top.3');
  const r = yield s.battle({
    kind: 'trainer', bg: 'field', prize: 0, overcharge: true, trainer: { name: 'Vagn', title: 'Enforcer Captain', sprite: 'tr/enforcer' },
    foes: [{ species: 'magnezone', level: 53 }, { species: 'crobat', level: 52 }],
    multi: {
      // Lukas's moves only ever hit the other side.
      partner: { name: 'Lukas', sprite: 'tr/lukas', foes: [
        { species: 'porygonz', level: 52, moves: ['triattack', 'thunderbolt', 'icebeam', 'agility'] },
        { species: grown(lukasStarter(s), 54), level: 54 }
      ] },
      second: { name: 'Hanne', title: 'Enforcer Captain', sprite: 'tr/enforcer', foes: [{ species: 'electivire', level: 53 }, { species: 'klinklang', level: 52 }] }
    }
  });
  if (r !== 'win') { l.n.hide(); return; }
  s.setFlag('c12lift', true);
  s.say('c12.sl.top.4');
  s.checkpoint();
}

/** The Ring is above the captains; Lukas can't hold the lift alone. */
export const smokestackGate: Script = function* (s) {
  if (s.flag('c12lift')) return true;
  s.say('c12.sl.gate');
  return false;
};

const leader = (id: string, sprite: string, x: number, y: number, dir: NpcDef['dir'], line: string): NpcDef =>
  ({ id, sprite, x, y, dir, when: f => !f('ch12done'), talk: talk(line) });

const STORMHILL: MapScripts = {
  npcs: [
    { id: 'astrid12', sprite: 'chars/astrid', x: 3, y: 22, dir: 'right', when: f => !f('ch12done'), talk: astrid },
    { id: 'kronvakt12', sprite: 'chars/kronvakt', x: 9, y: 23, dir: 'up', when: f => !f('ch12done'), talk: talk('c12.sl.kronvakt') },
    { id: 'iceA', sprite: 'obj:iceblock', x: 1, y: 18, dir: 'down', object: true, when: f => !f('c12iceA'), talk: ice('c12iceA') },
    { id: 'iceB', sprite: 'obj:iceblock', x: 1, y: 12, dir: 'down', object: true, when: f => !f('c12iceB'), talk: ice('c12iceB') },
    { id: 'iceC', sprite: 'obj:iceblock', x: 1, y: 6, dir: 'down', object: true, when: f => !f('c12iceC'), talk: ice('c12iceC') },
    leader('tariq12', 'chars/tariq', 11, 20, 'down', 'c12.sl.tariq'),
    leader('alva12', 'chars/alva', 6, 17, 'down', 'c12.sl.alva'),
    leader('kasper12', 'chars/kasper', 3, 16, 'right', 'c12.sl.kasper'),
    leader('soren12', 'chars/soren', 13, 14, 'left', 'c12.sl.soren'),
    leader('tycho12', 'chars/gentleman', 7, 11, 'down', 'c12.sl.tycho'),
    leader('pierrot12', 'chars/juggler', 12, 8, 'left', 'c12.sl.pierrot'),
    leader('margrethe12', 'chars/margrethe', 4, 4, 'down', 'c12.sl.margrethe'),
    trainer({ id: 'slEnf1', x: 13, y: 16, dir: 'left', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Rune',
      battle: { overcharge: true },
      foes: [{ species: 'luxray', level: 51 }, { species: 'magneton', level: 51 }, { species: 'hariyama', level: 52 }], intro: ['c12.sl.enf1.intro'], lose: ['c12.sl.enf1.lose'] }),
    trainer({ id: 'slEnf2', x: 2, y: 10, dir: 'right', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Dorte',
      battle: { overcharge: true },
      foes: [{ species: 'klinklang', level: 52 }, { species: 'electivire', level: 52 }], intro: ['c12.sl.enf2.intro'], lose: ['c12.sl.enf2.lose'] }),
    trainer({ id: 'slEnf3', x: 13, y: 5, dir: 'left', sprite: 'chars/enforcer', sight: 4, cls: 'Grid Enforcer', name: 'Søs',
      battle: { overcharge: true },
      foes: [{ species: 'crobat', level: 52 }, { species: 'magnezone', level: 52 }, { species: 'steelix', level: 53 }], intro: ['c12.sl.enf3.intro'], lose: ['c12.sl.enf3.lose'] }),
    { id: 'lukas12', sprite: 'chars/lukas', x: 9, y: 1, dir: 'down', hidden: true, talk: talk('c12.sl.top.after') },
    { id: 'freja12', sprite: 'chars/freja', x: 11, y: 1, dir: 'down', when: f => !f('ch12done'), talk: talk('c12.sl.top.2') }
  ],
  events: [{ x: 7, y: 1, w: 2, h: 2, on: 'step', when: f => !f('c12lift'), run: liftFight }]
};

// ---------- The Smokestack Ring ----------

const LINDHOLM = { name: 'Lindholm', title: 'Director', sprite: 'tr/lindholm' };

/** Lindholm's team, then the Reactor Rotom, then his plea and the shutdown. A loss keeps the phase you reached. */
function* lindholm(s: ScriptApi): Step {
  const l = s.npc('lindholm12');
  s.say('c12.sm.enter');
  if (!s.flag('c12phase1')) {
    s.say('c12.sm.lind.1'); s.say('c12.sm.lind.2'); s.say('c12.sm.lind.3');
    const r = yield s.battle({
      kind: 'trainer', ai: 3, bg: 'city', overcharge: true, leader: true, trainer: LINDHOLM,
      foes: [
        { species: 'porygonz', level: 53, moves: ['triattack', 'thunderbolt', 'icebeam', 'shadowball'] },
        { species: 'magnezone', level: 54, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'thunderwave'] },
        { species: 'ampharos', level: 53, moves: ['thunderbolt', 'dragonpulse', 'focusblast', 'cottonguard'] },
        { species: 'metagross', level: 55, moves: ['meteormash', 'zenheadbutt', 'earthquake', 'bulletpunch'], item: 'sitrusberry' }
      ]
    });
    if (r !== 'win') return;
    s.setFlag('c12phase1', true);
    s.say('c12.sm.lind.lose');
    // Brix comes up the service stair and patches your team up before the reactor fight.
    const b = cast(s, 'brix12');
    s.say('c12.sm.brix.0');
    s.heal(); s.me('me_heal');
    b.n.hide();
    s.checkpoint();
  }
  if (!s.flag('c12phase2')) {
    s.sfx('hit_super');
    s.say('c12.sm.storm.1'); s.say('c12.sm.storm.2'); s.say('c12.sm.lind.4');
    const r = yield s.battle({
      kind: 'trainer', ai: 3, bg: 'city', overcharge: true, leader: true, prize: 0, trainer: LINDHOLM,
      foes: [{ species: 'rotomreactor', level: 57, moves: ['discharge', 'flashcannon', 'heatwave', 'thunderwave'], item: 'leftovers' }]
    });
    if (r !== 'win') return;
    s.setFlag('c12phase2', true);
    s.checkpoint();
  }
  s.say('c12.sm.lind.5'); s.say('c12.sm.lind.6'); s.say('c12.sm.lind.7');
  for (;;) {
    const c: number = yield s.ask('c12.sm.ask', ['Shut it down', 'Wait'], 1);
    if (c === 0) break;
    s.say('c12.sm.wait');
  }
  s.say('c12.sm.shut.1');
  const b = cast(s, 'brix12');
  s.say('c12.sm.brix.1'); s.say('c12.sm.brix.2');
  s.say('c12.sm.maja.1'); s.say('c12.sm.maja.2');
  yield* song(s);
  b.n.hide();
  l.face('down');
}

/** The Voice Core closes: the whole city sings the Pact, and Langelira answers. */
function* song(s: ScriptApi): Step {
  s.say('c12.song.1');
  for (const k of ['mum', 'tourists', 'tariq', 'soren', 'kasper']) { s.fade(1, 10); s.fade(0, 10); s.say(`c12.song.${k}`); }
  s.say('c12.song.city');
  s.fade(1, 24); s.fade(0, 24);
  s.say('c12.song.2'); s.say('c12.song.3');
  s.cry('langelira');
  s.say('c12.song.4');
  s.setFlag('c12song', true);
  s.npc('langelira12').show();
  s.say('c12.song.5');
  s.checkpoint();
}

/** Langelira waits over the Ring until you catch her. */
const langelira: Script = function* (s) {
  s.say('c12.lg.talk');
  const c: number = yield s.ask('c12.lg.ask', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  s.cry('langelira');
  const r = yield s.battle({ kind: 'wild', bg: 'city', foes: [{ species: 'langelira', level: 55, moves: ['sirensrequiem', 'psychic', 'calmmind', 'aquaring'] }] });
  if (r !== 'caught') { if (r !== 'lose') s.say('c12.lg.again'); return; }
  s.say('c12.lg.caught');
  s.npc('langelira12').hide();
  yield* finale(s);
};

function* finale(s: ScriptApi): Step {
  const k = cast(s, 'kronvakt12r');
  s.say('c12.kv.bow.1'); s.say('c12.kv.bow.2');
  k.n.walk('down', 4); k.n.hide();
  s.fade(1, 16); s.fade(0, 16);
  s.say('c12.end.1'); s.say('c12.end.2'); s.say('c12.end.3'); s.say('c12.end.4');
  s.npc('lindholm12').hide();
  s.say('c12.end.5');
  s.setFlag('ch12done', true);
  s.setRespawn('pccopenhill', 2, 4, 'up', 'Nurse: Your Pokémon are fighting fit again!');
  s.checkpoint();
  s.chapterEnd('Chapter 12 complete', 'Copper & Current');
  s.say('c12.end');
}

const SMOKESTACK: MapScripts = {
  onEnter: function* (s) { if (!s.flag('c12song')) yield* lindholm(s); },
  npcs: [
    { id: 'lindholm12', sprite: 'chars/lindholm', x: 7, y: 5, dir: 'down', when: f => !f('ch12done'), talk: function* (s) { if (!s.flag('c12song')) yield* lindholm(s); } },
    { id: 'brix12', sprite: 'chars/scientist', x: 9, y: 7, dir: 'up', hidden: true },
    { id: 'langelira12', sprite: 'chars/langelira', x: 12, y: 1, dir: 'down', hidden: true, when: f => !!f('c12song') && !f('ch12done'), talk: langelira },
    { id: 'kronvakt12r', sprite: 'chars/kronvakt', x: 8, y: 9, dir: 'up', hidden: true }
  ]
};

export const REACTOR_SCRIPTS: Record<string, MapScripts> = { stormhill: STORMHILL, smokestack: SMOKESTACK };
