// Chapter 10, The Shipyards: Refshaleøen's old shipyard is Victory Road. Lukas has gone to Ivar to hear about the
// crane his grandfather built; Dr. Brix defects on the far quay with the reactor shutdown sequence; Lukas waits at the
// top of the great crane for the best fight of his life. Then CopenHill's lower slope and Gym 8: Astrid, Vanguard's
// Chief Grid Engineer, who routes the turbines to the summit lift and hands you the overload data. The chapter ends on
// Lindholm's broadcast: the Bifrost Reactor will run at 120% for the League Championship.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { centerNpcs } from './home';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { lukasStarter } from './starters';

// ---------- The chapter starts ----------

/** Runs on the next map you enter after Knippelsbro. */
export function* ch10Start(s: ScriptApi): Step {
  if (!s.flag('ch9done') || s.flag('ch10')) return;
  s.setFlag('ch10', true);
  s.chapterEnd('Chapter 10', 'The Shipyards');
  s.sfx('select');
  s.say('c10.start.1'); s.say('c10.start.2');
  s.checkpoint();
}

/** The drydock's east gate opens onto the shipyards with Chapter 10. */
export const shipyardsGate: Script = function* (s) {
  if (s.flag('ch10')) return true;
  s.say('c10.gate.early');
  return false;
};

/** Puts a hidden scene NPC next to the player, facing them. */
function cast(s: ScriptApi, id: string, nearX = s.player.x, nearY = s.player.y) {
  const n = s.npc(id);
  const [x, y] = s.freeSpotNear(nearX, nearY);
  n.place(x, y, 'down'); n.show(); n.facePlayer();
  return { n, x, y };
}

// ---------- The shipyards ----------

function* arrive(s: ScriptApi): Step {
  s.setFlag('c10arrive', true);
  s.say('c10.sy.arrive');
  const l = cast(s, 'lukas10a');
  s.player.faceTo(l.x, l.y);
  s.say('c10.sy.lukas.1'); s.say('c10.sy.ivar.1'); s.say('c10.sy.lukas.2'); s.say('c10.sy.lukas.3');
  l.n.walk('right', 6); l.n.hide();
  s.say('c10.sy.ivar.2');
  s.setRespawn('shipyards', 3, 5, 'right', s.t('c10.sy.respawn'));
  s.checkpoint();
}

/** Ivar keeps a brazier and a kettle by the gate, and patches your team up. */
const ivar: Script = function* (s) {
  s.say(s.flag('c10lukas') ? 'c10.sy.ivar.after' : 'c10.sy.ivar.heal');
  s.heal(); s.me('me_heal');
  s.setRespawn('shipyards', 3, 5, 'right', s.t('c10.sy.respawn'));
  s.checkpoint();
};

/** Brix, cornered by two Enforcers on the east quay. He fights beside you, then defects. */
function* brix(s: ScriptApi): Step {
  const b = cast(s, 'brix10');
  s.player.faceTo(b.x, b.y);
  s.say('c10.brix.1'); s.say('c10.brix.2');
  const r = yield s.battle({
    kind: 'trainer', bg: 'city', prize: 0, trainer: { name: 'Torben', title: 'Grid Enforcer', sprite: 'tr/enforcer' },
    foes: [{ species: 'electivire', level: 45 }, { species: 'klinklang', level: 45 }],
    multi: {
      // Brix's moves only ever hit the other side.
      partner: { name: 'Brix', sprite: 'tr/scientist', foes: [
        { species: 'bronzong', level: 46, moves: ['flashcannon', 'psychic', 'payback', 'trickroom'] },
        { species: 'metang', level: 45, moves: ['meteormash', 'zenheadbutt', 'bulletpunch', 'irondefense'] }
      ] },
      second: { name: 'Ulla', title: 'Grid Enforcer', sprite: 'tr/enforcer', foes: [{ species: 'rotom', level: 45 }, { species: 'magnezone', level: 46 }] }
    }
  });
  if (r !== 'win') { b.n.hide(); return; }
  s.setFlag('c10brix', true);
  s.say('c10.brix.3'); s.say('c10.brix.4'); s.say('c10.brix.5');
  s.giveItem('shutdownseq'); s.me('me_item');
  s.say('c10.got.shutdown');
  s.say('c10.brix.6'); s.say('c10.brix.7');
  b.n.walk('down', 5); b.n.hide();
  s.checkpoint();
}

/** The little dock crane swings you over the slipway (and back). */
const crane = (to: [number, number], east: boolean): Script => function* (s) {
  s.say(east ? 'c10.crane.east' : 'c10.crane.west');
  const c: number = yield s.ask('c10.crane.ask', ['Ride across', 'Stay'], 1);
  if (c !== 0) return;
  s.sfx('door'); s.fade(1, 12);
  s.warp(east ? 'eastquay' : 'shipyards', to[0], to[1], east ? 'right' : 'left');
  s.fade(0, 12);
  if (east && !s.flag('c10brix')) yield* brix(s);
};

/** The great gantry crane: the lift up to the walkway, where Lukas waits. */
const greatCrane: Script = function* (s) {
  if (!s.flag('c10brix')) { s.say('c10.gc.locked'); return; }
  s.say('c10.gc.up');
  s.sfx('door'); s.fade(1, 16);
  s.warp('cranetop', 2, 2, 'right');
  s.fade(0, 16);
};

/** CopenHill is over the bridge to Amager; Ivar won't let you go until you've seen Lukas. */
export const copenhillGate: Script = function* (s) {
  if (s.flag('c10lukas')) return true;
  s.say('c10.sy.east.early');
  return false;
};

const SHIPYARDS: MapScripts = {
  onEnter: function* (s) { if (s.flag('ch10') && !s.flag('c10arrive')) yield* arrive(s); },
  npcs: [
    { id: 'ivar10', sprite: 'chars/ivar', x: 2, y: 4, dir: 'right', talk: ivar },
    { id: 'lukas10a', sprite: 'chars/lukas', x: 4, y: 4, dir: 'left', hidden: true },
    sign('sysign', 5, 4, 'obj:sign', 'c10.sy.sign'),
    { id: 'craneW', sprite: 'obj:crane', x: 14, y: 9, dir: 'down', object: true, talk: crane([1, 9], true) },
    trainer({ id: 'sy1', x: 9, y: 4, dir: 'down', sprite: 'chars/acem', sight: 3, cls: 'Ace Trainer', name: 'Mikkel',
      foes: [{ species: 'machamp', level: 45 }, { species: 'steelix', level: 45 }], intro: ['c10.sy.t1.intro'], lose: ['c10.sy.t1.lose'] }),
    trainer({ id: 'sy2', x: 4, y: 10, dir: 'right', sprite: 'chars/acef', sight: 4, cls: 'Ace Trainer', name: 'Sofie',
      battle: { trainer: { name: 'Sofie', title: 'Ace Trainer', sprite: 'tr/acef' } },
      foes: [{ species: 'pelipper', level: 45 }, { species: 'kingdra', level: 46 }], intro: ['c10.sy.t2.intro'], lose: ['c10.sy.t2.lose'] }),
    trainer({ id: 'sy3', x: 10, y: 14, dir: 'up', sprite: 'chars/engineer', sight: 3, cls: 'Shipwright', name: 'Holger',
      foes: [{ species: 'conkeldurr', level: 46 }, { species: 'klinklang', level: 45 }], intro: ['c10.sy.t3.intro'], lose: ['c10.sy.t3.lose'] }),
    itemBall('item.sy1', 13, 1, 'hyperpotion', 3, 'Hyper Potions'),
    itemBall('item.sy2', 1, 16, 'revive', 2, 'Revives'),
  ]
};

const EASTQUAY: MapScripts = {
  npcs: [
    { id: 'brix10', sprite: 'chars/scientist', x: 5, y: 9, dir: 'left', hidden: true },
    { id: 'craneE', sprite: 'obj:crane', x: 1, y: 10, dir: 'down', object: true, talk: crane([14, 10], false) },
    { id: 'greatcrane', sprite: 'obj:crane', x: 9, y: 1, dir: 'down', object: true, talk: greatCrane },
    trainer({ id: 'sy4', x: 5, y: 13, dir: 'left', sprite: 'chars/acef', sight: 3, cls: 'Ace Trainer', name: 'Nanna',
      battle: { trainer: { name: 'Nanna', title: 'Ace Trainer', sprite: 'tr/acef' } },
      foes: [{ species: 'luxray', level: 46 }, { species: 'gyarados', level: 46 }], intro: ['c10.sy.t4.intro'], lose: ['c10.sy.t4.lose'] }),
    trainer({ id: 'sy5', x: 11, y: 5, dir: 'down', sprite: 'chars/acem', sight: 3, cls: 'Ace Trainer', name: 'Emil',
      foes: [{ species: 'haxorus', level: 46 }, { species: 'excadrill', level: 46 }], intro: ['c10.sy.t5.intro'], lose: ['c10.sy.t5.lose'] }),
    itemBall('item.sy3', 13, 9, 'ultraball', 3, 'Ultra Balls'),
    itemBall('item.sy4', 2, 16, 'fullheal', 2, 'Full Heals')
  ]
};

// ---------- The top of the great crane: Lukas ----------

function* lukasCrane(s: ScriptApi): Step {
  s.say('c10.ct.lukas.1'); s.say('c10.ct.lukas.2'); s.say('c10.ct.lukas.3');
  const c: number = yield s.ask('c10.ct.ask', ['Ready', 'Not yet'], 1);
  if (c !== 0) { s.say('c10.ct.wait'); return; }
  const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'city', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' }, prize: 120, foes: [
    { species: 'magnezone', level: 45, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'thunderwave'] },
    { species: 'porygonz', level: 45, moves: ['triattack', 'darkpulse', 'thunderbolt', 'agility'] },
    { species: 'rotom', level: 44, moves: ['discharge', 'shadowball', 'willowisp', 'voltswitch'] },
    { species: grown(lukasStarter(s), 47), level: 47 }
  ] });
  if (r !== 'win') return;
  s.setFlag('c10lukas', true);
  s.say('c10.ct.lukas.4'); s.say('c10.ct.lukas.5'); s.say('c10.ct.lukas.6');
  s.checkpoint();
}

const CRANETOP: MapScripts = {
  npcs: [
    { id: 'ctlift', sprite: 'obj:crane', x: 1, y: 2, dir: 'down', object: true, talk: function* (s) {
      s.say('c10.ct.down'); s.sfx('door'); s.fade(1, 16); s.warp('eastquay', 9, 2, 'down'); s.fade(0, 16);
    } },
    { id: 'lukas10', sprite: 'chars/lukas', x: 12, y: 2, dir: 'left', talk: function* (s) {
      if (s.flag('c10lukas')) { s.say('c10.ct.after'); return; }
      yield* lukasCrane(s);
    } },
    sign('ctplate', 7, 1, 'obj:sign', 'c10.ct.plate')
  ]
};

// ---------- CopenHill and Gym 8 ----------

/** After the Turbine Badge: every screen on Amager shows Lindholm; Brix calls. */
function* broadcast(s: ScriptApi): Step {
  s.say('c10.ch.screens'); s.say('c10.ch.lindholm.1'); s.say('c10.ch.lindholm.2');
  s.sfx('select');
  s.say('c10.ch.brix.1'); s.say('c10.ch.brix.2');
  s.setFlag('ch10done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 10 complete', 'The Shipyards');
  s.say('c10.end');
}

const COPENHILL: MapScripts = {
  onEnter: function* (s) {
    if (!s.flag('c10hill')) { s.setFlag('c10hill', true); s.say('c10.ch.arrive'); }
    if (s.flag('turbine') && !s.flag('ch10done')) yield* broadcast(s);
  },
  doors: {
    plant: function* (s) { s.sfx('door'); s.warp('gym8', 9, 12, 'up'); },
    pc: function* (s) { s.warp('pccopenhill', 6, 5, 'up'); }
  },
  npcs: [
    { id: 'summitlift', sprite: 'obj:crane', x: 4, y: 7, dir: 'down', object: true, talk: talk('c10.ch.lift') },
    sign('chsign', 12, 8, 'obj:sign', 'c10.ch.sign'),
    { id: 'chskier', sprite: 'chars/jogger', x: 6, y: 9, dir: 'right', talk: talk('c10.ch.skier') },
    { id: 'chworker', sprite: 'chars/engineer', x: 17, y: 8, dir: 'left', talk: talk('c10.ch.worker') },
    itemBall('item.ch1', 25, 17, 'hyperpotion', 2, 'Hyper Potions')
  ]
};

/** Which turbines feed which relays: A feeds 1 and 2, B feeds 2 and 3, C feeds 1 and 3. */
const FEEDS: Record<string, number[]> = { A: [0, 1], B: [1, 2], C: [0, 2] };
const relayOn = (f: (n: string) => any, i: number) => Object.entries(FEEDS).filter(([t, r]) => r.includes(i) && f(`t8${t}`)).length % 2 === 1;
/** The summit lift wants relays 1 and 3 live, 2 dark (2 would overload it). */
const liftReady = (f: (n: string) => any) => relayOn(f, 0) && !relayOn(f, 1) && relayOn(f, 2);

const turbine = (id: string): Script => function* (s) {
  if (s.flag('liftOn')) { s.say('c10.g8.turbine.running'); return; }
  const on = !!s.flag(`t8${id}`);
  s.say(s.t(on ? 'c10.g8.turbine.on' : 'c10.g8.turbine.off').replace('{t}', id));
  const c: number = yield s.ask('c10.g8.turbine.ask', [on ? 'Stop it' : 'Start it', 'Leave it'], 1);
  if (c !== 0) return;
  s.setFlag(`t8${id}`, !on);
  s.sfx(on ? 'pc_close' : 'select');
  const f = (n: string) => s.flag(n);
  const lit = [0, 1, 2].filter(i => relayOn(f, i)).map(i => String(i + 1));
  s.say(lit.length ? s.t('c10.g8.relays').replace('{r}', lit.join(' and ')) : 'c10.g8.relays.none');
  if (liftReady(f)) {
    s.wait(10); s.sfx('door');
    s.setFlag('liftOn', true);
    s.say('c10.g8.lift.on');
    s.checkpoint();
  } else if (relayOn(f, 1) && relayOn(f, 0) && relayOn(f, 2)) {
    s.sfx('hit_weak'); s.say('c10.g8.overload');
  }
};

const technician = (i: number, x: number, y: number, dir: NpcDef['dir'], name: string, foes: { species: string; level: number }[]): NpcDef => trainer({
  id: `g8tech${i}`, x, y, dir, sprite: 'chars/engineer', sight: 3, cls: 'Grid Technician', name,
  foes, intro: [`c10.g8.t${i}.intro`], lose: [`c10.g8.t${i}.lose`]
});

const astrid: Script = function* (s) {
  if (s.flag('turbine')) { s.say('c10.as.after'); return; }
  s.say('c10.as.1'); s.say('c10.as.2');
  const c: number = yield s.ask('c10.as.ask', ['Yes', 'Not yet'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'indoor1', trainer: { name: 'Astrid', title: 'Leader', sprite: 'tr/astrid' }, foes: [
    { species: 'galvantula', level: 46, moves: ['discharge', 'bugbuzz', 'energyball', 'stickyweb'] },
    { species: 'vikavolt', level: 47, moves: ['thunderbolt', 'bugbuzz', 'energyball', 'airslash'] },
    { species: 'bellibolt', level: 47, moves: ['discharge', 'muddywater', 'slackoff', 'toxic'] },
    { species: 'electivire', level: 49, moves: ['wildcharge', 'icepunch', 'crosschop', 'electricterrain'], item: 'sitrusberry' }
  ] });
  if (r !== 'win') { s.say('c10.as.win'); return; }
  s.say('c10.as.lose');
  s.setFlag('turbine', true);
  s.giveBadge('turbine', 'Turbine Badge');
  s.me('me_badge');
  s.say('c10.got.badge');
  s.say('c10.as.gears');
  s.giveItem('torquegears'); s.me('me_item');
  s.say('c10.got.gears');
  s.say('c10.as.data.1'); s.say('c10.as.data.2');
  s.giveItem('overloaddata'); s.me('me_item');
  s.say('c10.got.data');
  s.say('c10.as.data.3'); s.say('c10.as.data.4');
  s.checkpoint();
};

const GYM8: MapScripts = {
  npcs: [
    ...(['A', 'B', 'C'] as const).map((id, i): NpcDef => ({ id: `turbine${id}`, sprite: 'obj:wheel', x: 4 + i * 5, y: 8, dir: 'down', object: true, talk: turbine(id) })),
    ...[0, 1, 2].flatMap((i): NpcDef[] => [
      { id: `relay${i}on`, sprite: 'obj:lantern', x: 4 + i * 5, y: 5, dir: 'down', object: true, when: f => relayOn(f, i), talk: talk(`c10.g8.relay${i + 1}.on`) },
      { id: `relay${i}off`, sprite: 'obj:lanternout', x: 4 + i * 5, y: 5, dir: 'down', object: true, when: f => !relayOn(f, i), talk: talk(`c10.g8.relay${i + 1}.off`) }
    ]),
    ...[8, 9, 10].map((x, i): NpcDef => ({ id: `liftgate${i}`, sprite: 'obj:grate', x, y: 4, dir: 'down', object: true,
      when: f => !f('liftOn'), talk: talk('c10.g8.gate') })),
    sign('g8board', 9, 10, 'obj:schematic', 'c10.g8.board'),
    technician(1, 2, 11, 'right', 'Rikke', [{ species: 'heliolisk', level: 46 }, { species: 'magneton', level: 46 }]),
    technician(2, 16, 11, 'left', 'Jesper', [{ species: 'zebstrika', level: 46 }, { species: 'galvantula', level: 46 }]),
    technician(3, 16, 6, 'left', 'Mette', [{ species: 'kilowattrel', level: 46 }, { species: 'luxray', level: 47 }]),
    { id: 'g8guide', sprite: 'chars/oldman', x: 15, y: 13, dir: 'left', talk: function* (s) {
      if (s.flag('turbine')) { s.say('c10.g8.guide.after'); return; }
      s.say('c10.g8.guide.1'); s.say('c10.g8.guide.2');
    } },
    { id: 'astrid', sprite: 'chars/astrid', x: 9, y: 2, dir: 'down', talk: astrid },
    itemBall('item.g81', 17, 1, 'revive', 1, 'a Revive')
  ]
};

export const SHIPYARD_SCRIPTS: Record<string, MapScripts> = {
  shipyards: SHIPYARDS, eastquay: EASTQUAY, cranetop: CRANETOP, copenhill: COPENHILL, pccopenhill: { npcs: centerNpcs('copenhill', 21, 17) }, gym8: GYM8
};
